-- =============================================
-- Migration: existing DB (legacy rooms/messages) -> v2 schema used by app
-- Run in Supabase SQL Editor on an EXISTING database.
--
-- What it does:
-- - Ensures legacy tables have columns required for copying (ADD COLUMN IF NOT EXISTS)
-- - Creates v2 tables (rooms_v2/messages_v2) and game_sessions
-- - Migrates data into v2 tables
-- - Swaps tables (keeps *_old backups)
-- - Ensures Realtime publication includes rooms/messages/game_sessions
-- - Enables permissive RLS policies (anon-key clients)
--
-- WARNING:
-- - This script renames tables. Run on staging first if possible.
-- =============================================

begin;

create extension if not exists "uuid-ossp";

-- 0) Make legacy tables forward-compatible for migration SELECTs
-- Legacy rooms expected: uuid id, player1_name/player2_name, code, created_at, status, game_state
alter table rooms add column if not exists code text;
alter table rooms add column if not exists player1_name text;
alter table rooms add column if not exists player2_name text;
alter table rooms add column if not exists created_at timestamptz default now();
alter table rooms add column if not exists status text default 'waiting';
alter table rooms add column if not exists game_state jsonb;

-- Legacy messages expected: uuid id, room_id uuid, player_name, text, created_at
alter table messages add column if not exists created_at timestamptz default now();
alter table messages add column if not exists read_at timestamptz;
alter table messages add column if not exists reply_to uuid;
alter table messages add column if not exists reactions jsonb default '{}'::jsonb;
alter table messages add column if not exists hidden_for text[] default '{}'::text[];
alter table messages add column if not exists message_type text default 'text';
alter table messages add column if not exists media_url text;
alter table messages add column if not exists latitude double precision;
alter table messages add column if not exists longitude double precision;
alter table messages add column if not exists expires_at timestamptz;

-- 1) New rooms table (deterministic id + ordered pair)
create table if not exists rooms_v2 (
  id text primary key,
  code text unique not null,
  user1_id text not null,
  user2_id text not null,
  created_at timestamptz default now() not null,
  constraint rooms_user_order check (user1_id < user2_id),
  constraint rooms_unique_pair unique (user1_id, user2_id)
);

create index if not exists idx_rooms_v2_created_at on rooms_v2(created_at desc);

-- 2) New messages table (room_id becomes text)
create table if not exists messages_v2 (
  id uuid primary key default uuid_generate_v4(),
  room_id text references rooms_v2(id) on delete cascade,
  player_name text not null,
  text text not null,
  created_at timestamptz default now(),
  -- messenger extras
  read_at timestamptz,
  reply_to uuid references messages_v2(id),
  reactions jsonb default '{}'::jsonb,
  hidden_for text[] default '{}'::text[],
  -- media extras
  message_type text default 'text',
  media_url text,
  latitude double precision,
  longitude double precision,
  -- ephemeral
  expires_at timestamptz
);

create index if not exists idx_messages_v2_room_id_created_at on messages_v2(room_id, created_at desc);

-- 3) game_sessions table
create table if not exists game_sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id text not null references rooms_v2(id) on delete cascade,
  created_at timestamptz default now() not null,
  status text not null default 'active' check (status in ('active','finished','cancelled')),
  winner_id text,
  board_state jsonb
);

create index if not exists idx_game_sessions_room_id on game_sessions(room_id);
create index if not exists idx_game_sessions_created_at on game_sessions(created_at desc);
create unique index if not exists uq_game_sessions_one_active_per_room
  on game_sessions(room_id)
  where status = 'active';

-- 4) Pick "keeper room" for each pair: the one with most messages
create temporary table tmp_room_mapping (
  old_room_id uuid primary key,
  new_room_id text not null,
  u1 text not null,
  u2 text not null,
  old_code text
) on commit drop;

with room_pairs as (
  select
    r.id as old_room_id,
    r.code as old_code,
    r.created_at as old_created_at,
    r.player1_name,
    r.player2_name,
    r.game_state,
    r.status as old_status,
    least(r.player1_name, r.player2_name) as u1,
    greatest(r.player1_name, r.player2_name) as u2
  from rooms r
  where r.player1_name is not null
    and r.player2_name is not null
    and r.player1_name <> r.player2_name
),
msg_counts as (
  select room_id as old_room_id, count(*)::int as cnt
  from messages
  group by room_id
),
ranked as (
  select
    p.*,
    coalesce(mc.cnt, 0) as msg_cnt,
    row_number() over (
      partition by p.u1, p.u2
      order by coalesce(mc.cnt, 0) desc, p.old_created_at asc
    ) as rn
  from room_pairs p
  left join msg_counts mc on mc.old_room_id = p.old_room_id
),
keepers as (
  select
    old_room_id,
    u1,
    u2,
    ('room_' || u1 || '_' || u2) as new_room_id,
    old_code,
    old_created_at,
    game_state,
    old_status
  from ranked
  where rn = 1
),
mapping as (
  select
    r.old_room_id,
    k.new_room_id,
    k.u1,
    k.u2,
    k.old_code
  from ranked r
  join keepers k
    on k.u1 = r.u1 and k.u2 = r.u2
)
insert into tmp_room_mapping (old_room_id, new_room_id, u1, u2, old_code)
select old_room_id, new_room_id, u1, u2, old_code
from mapping
on conflict (old_room_id) do nothing;

-- 4a) Insert rooms_v2 (unique by deterministic id) from mapping
insert into rooms_v2 (id, code, user1_id, user2_id, created_at)
select distinct
  ('room_' || m.u1 || '_' || m.u2) as id,
  coalesce(m.old_code, ('room_' || m.u1 || '_' || m.u2)) as code,
  m.u1 as user1_id,
  m.u2 as user2_id,
  now() as created_at
from tmp_room_mapping m
on conflict (id) do nothing;

-- 4b) Migrate messages into messages_v2, remapping room_id to keeper deterministic room id
insert into messages_v2 (
  id, room_id, player_name, text, created_at,
  read_at, reply_to, reactions, hidden_for,
  message_type, media_url, latitude, longitude,
  expires_at
)
select
  m.id,
  mp.new_room_id,
  m.player_name,
  m.text,
  m.created_at,
  m.read_at,
  m.reply_to,
  m.reactions,
  m.hidden_for,
  m.message_type,
  m.media_url,
  m.latitude,
  m.longitude,
  m.expires_at
from messages m
join tmp_room_mapping mp on mp.old_room_id = m.room_id;

-- 4c) Create initial game_session per keeper room using keeper's last known room.game_state
insert into game_sessions (room_id, created_at, status, board_state)
select
  ('room_' || rp.u1 || '_' || rp.u2) as room_id,
  rp.old_created_at,
  case when rp.old_status = 'finished' then 'finished' else 'active' end,
  rp.game_state
from (
  select distinct on (m.u1, m.u2)
    m.u1,
    m.u2,
    r.created_at as old_created_at,
    r.status as old_status,
    r.game_state
  from tmp_room_mapping m
  join rooms r on r.id = m.old_room_id
  order by m.u1, m.u2, r.created_at asc
) rp
on conflict do nothing;

-- 5) Swap tables (keep old as backup)
alter table messages rename to messages_old;
alter table rooms rename to rooms_old;
alter table rooms_v2 rename to rooms;
alter table messages_v2 rename to messages;

-- 6) Realtime publication (safe add)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions'
  ) then
    alter publication supabase_realtime add table game_sessions;
  end if;
end $$;

-- 7) Permissive RLS policies (anon clients)
alter table rooms enable row level security;
alter table messages enable row level security;
alter table game_sessions enable row level security;

drop policy if exists "Anyone can read rooms" on rooms;
create policy "Anyone can read rooms" on rooms for select using (true);
drop policy if exists "Anyone can insert rooms" on rooms;
create policy "Anyone can insert rooms" on rooms for insert with check (true);
drop policy if exists "Anyone can update rooms" on rooms;
create policy "Anyone can update rooms" on rooms for update using (true) with check (true);

drop policy if exists "Anyone can read messages" on messages;
create policy "Anyone can read messages" on messages for select using (true);
drop policy if exists "Anyone can insert messages" on messages;
create policy "Anyone can insert messages" on messages for insert with check (true);
drop policy if exists "Anyone can update messages" on messages;
create policy "Anyone can update messages" on messages for update using (true) with check (true);
drop policy if exists "Anyone can delete messages" on messages;
create policy "Anyone can delete messages" on messages for delete using (true);

drop policy if exists "Anyone can read game sessions" on game_sessions;
create policy "Anyone can read game sessions" on game_sessions for select using (true);
drop policy if exists "Anyone can insert game sessions" on game_sessions;
create policy "Anyone can insert game sessions" on game_sessions for insert with check (true);
drop policy if exists "Anyone can update game sessions" on game_sessions;
create policy "Anyone can update game sessions" on game_sessions for update using (true) with check (true);
drop policy if exists "Anyone can delete game sessions" on game_sessions;
create policy "Anyone can delete game sessions" on game_sessions for delete using (true);

commit;

