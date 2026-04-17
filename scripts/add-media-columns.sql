-- Добавление колонок для поддержки медиа-сообщений (изображения, геолокация, голосовые)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS waveform jsonb;

-- Storage: проще выполнить scripts/supabase-storage-chat-media.sql
-- (bucket chat-media + политики SELECT/INSERT для anon).
