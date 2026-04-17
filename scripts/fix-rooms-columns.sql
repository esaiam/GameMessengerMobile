-- Добавить недостающие колонки в rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_state jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS player1_name text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS player2_name text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status text DEFAULT 'waiting';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Убедиться что RLS выключен
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
