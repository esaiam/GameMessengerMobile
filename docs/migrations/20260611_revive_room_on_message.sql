-- ============================================================
-- После «удалить у всех»: новое сообщение снова показывает чат у обоих
-- (снимает hidden_chat_rooms + сбрасывает thread_cleared_at)
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rooms_set_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.hidden_chat_rooms
  WHERE room_id = NEW.room_id;

  UPDATE public.rooms
  SET
    last_message_at = NEW.created_at,
    last_message_id = NEW.id,
    thread_cleared_at = NULL
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
