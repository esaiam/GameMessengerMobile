-- Только то, чего не хватает (messages + недостающие политики)

create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_name text not null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists idx_messages_room_id on messages(room_id);

alter table messages enable row level security;

create policy "Anyone can read messages" on messages for select using (true);
create policy "Anyone can insert messages" on messages for insert with check (true);

-- Realtime (rooms может быть уже добавлен, поэтому используем IF NOT EXISTS для messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;
