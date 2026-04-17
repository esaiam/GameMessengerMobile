-- =============================================
-- Supabase Setup (v2) for Vault Messenger / Backgammon
-- Target: clean Supabase project (run once in SQL Editor)
--
-- Notes:
-- - Current app code expects:
--   - rooms.id is TEXT (deterministic "room_<u1>_<u2>")
--   - rooms has: code, user1_id, user2_id
--   - messages.room_id references rooms(id) (TEXT)
--   - game_sessions exists and is used by GameScreen
-- - Auth is not used (anon key, no user sessions), so policies are permissive.
-- =============================================

-- Extensions
create extension if not exists "uuid-ossp";

-- Rooms (v2)
create table if not exists rooms (
  id text primary key,
  code text unique not null,
  user1_id text not null,
  user2_id text not null,
  created_at timestamptz default now() not null,
  -- legacy compatibility / optional
  player1_name text,
  player2_name text,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  game_state jsonb,
  constraint rooms_user_order check (user1_id < user2_id),
  constraint rooms_unique_pair unique (user1_id, user2_id)
);

create index if not exists idx_rooms_created_at on rooms(created_at desc);
create index if not exists idx_rooms_user1 on rooms(user1_id);
create index if not exists idx_rooms_user2 on rooms(user2_id);

-- Messages (v2)
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  room_id text references rooms(id) on delete cascade,
  player_name text not null,
  text text not null,
  created_at timestamptz default now(),
  -- messenger extras
  read_at timestamptz,
  reply_to uuid references messages(id),
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

create index if not exists idx_messages_room_id_created_at on messages(room_id, created_at desc);
create index if not exists idx_messages_expires_at on messages(expires_at);

-- Game sessions (sub-entity inside rooms)
create table if not exists game_sessions (
  id uuid primary key default uuid_generate_v4(),
  room_id text not null references rooms(id) on delete cascade,
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

-- RLS (permissive; anon-key clients)
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

-- Realtime publication (safe add)
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

-- Storage for chat media (optional, but required for images/voice uploads in Chat.js)
-- This is equivalent to scripts/supabase-storage-chat-media.sql
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "chat-media public read" on storage.objects;
create policy "chat-media public read"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "chat-media anon insert" on storage.objects;
create policy "chat-media anon insert"
  on storage.objects for insert
  with check (bucket_id = 'chat-media');

