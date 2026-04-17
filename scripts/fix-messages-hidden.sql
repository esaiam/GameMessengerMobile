-- Скрытие сообщений только у себя (массив ников)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden_for text[] DEFAULT '{}';
