-- Ephemeral (disappearing) messages: expires_at column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
