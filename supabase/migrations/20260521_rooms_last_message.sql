-- ============================================================
-- Денормализация последнего сообщения в таблице rooms
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Добавить колонки
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS last_message_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_id  UUID;   -- без FK, чтобы не было circular dependency

-- 2. Индекс для сортировки списка чатов
CREATE INDEX IF NOT EXISTS idx_rooms_last_message_at
  ON rooms (last_message_at DESC NULLS LAST);

-- 3. Бэкфилл существующих данных
UPDATE rooms r
SET
  last_message_at = sub.max_at,
  last_message_id = sub.last_id
FROM (
  SELECT DISTINCT ON (room_id)
    room_id,
    created_at AS max_at,
    id          AS last_id
  FROM messages
  ORDER BY room_id, created_at DESC
) sub
WHERE r.id = sub.room_id;

-- 4. Триггер: обновлять при INSERT / DELETE сообщений
CREATE OR REPLACE FUNCTION update_room_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms
    SET last_message_at = NEW.created_at,
        last_message_id = NEW.id
    WHERE id = NEW.room_id
      AND (last_message_at IS NULL OR NEW.created_at >= last_message_at);

  ELSIF TG_OP = 'DELETE' THEN
    -- пересчитать последнее сообщение
    UPDATE rooms
    SET (last_message_at, last_message_id) = (
      SELECT created_at, id
      FROM messages
      WHERE room_id = OLD.room_id
      ORDER BY created_at DESC
      LIMIT 1
    )
    WHERE id = OLD.room_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_last_message ON messages;
CREATE TRIGGER trg_rooms_last_message
  AFTER INSERT OR DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_room_last_message();
