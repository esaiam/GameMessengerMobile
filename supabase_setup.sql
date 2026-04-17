-- =============================================
-- Supabase Setup for Backgammon Game
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable realtime
create extension if not exists "uuid-ossp";

-- Rooms table
create table if not exists rooms (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  player1_name text not null,
  player2_name text,
  game_state jsonb,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz default now()
);

-- Messages table
create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_name text not null,
  text text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_rooms_code on rooms(code);
create index if not exists idx_rooms_status on rooms(status);
create index if not exists idx_messages_room_id on messages(room_id);

-- RLS policies (permissive for game use)
alter table rooms enable row level security;
alter table messages enable row level security;

create policy "Anyone can read rooms" on rooms for select using (true);
create policy "Anyone can insert rooms" on rooms for insert with check (true);
create policy "Anyone can update rooms" on rooms for update using (true);

create policy "Anyone can read messages" on messages for select using (true);
create policy "Anyone can insert messages" on messages for insert with check (true);
create policy "Anyone can update messages" on messages for update using (true) with check (true);
create policy "Anyone can delete messages" on messages for delete using (true);

-- Enable Realtime on both tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table messages;
