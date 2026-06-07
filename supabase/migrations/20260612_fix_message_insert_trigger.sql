-- ============================================================
-- Fix: INSERT в messages откатывался из‑за триггера rooms_set_last_message
-- (тип last_message_id, thread_cleared_at, DELETE hidden_chat_rooms)
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS thread_cleared_at timestamptz;

-- last_message_id: text — совместимо и с bigint, и с uuid у messages.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
      AND column_name = 'last_message_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.rooms
      ALTER COLUMN last_message_id TYPE text USING last_message_id::text;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
      AND column_name = 'last_message_id'
  ) THEN
    ALTER TABLE public.rooms ADD COLUMN last_message_id text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rooms_set_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Сначала rooms — критично для доставки; cleanup hidden_chat_rooms не должен откатывать INSERT
  UPDATE public.rooms
  SET
    last_message_at = NEW.created_at,
    last_message_id = NEW.id::text,
    thread_cleared_at = NULL
  WHERE id = NEW.room_id;

  BEGIN
    DELETE FROM public.hidden_chat_rooms
    WHERE room_id = NEW.room_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'rooms_set_last_message hidden_chat_rooms cleanup: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_set_room_last_message ON public.messages;
CREATE TRIGGER trg_messages_set_room_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.rooms_set_last_message();

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Проверка типов:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('messages', 'rooms')
--   AND column_name IN ('id', 'last_message_id');
