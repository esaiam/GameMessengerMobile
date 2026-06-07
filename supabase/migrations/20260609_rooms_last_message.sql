-- ============================================================
-- rooms.last_message_*: денормализация для списка чатов + realtime
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_id bigint;

CREATE INDEX IF NOT EXISTS idx_rooms_last_message_at
  ON public.rooms (last_message_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.rooms_set_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms
  SET
    last_message_at = NEW.created_at,
    last_message_id = NEW.id
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rooms_set_last_message() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_messages_set_room_last_message ON public.messages;
CREATE TRIGGER trg_messages_set_room_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.rooms_set_last_message();

COMMIT;
