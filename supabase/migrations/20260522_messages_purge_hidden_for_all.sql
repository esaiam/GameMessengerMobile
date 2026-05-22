-- ============================================================
-- Физическое удаление сообщения, когда hidden_for покрывает
-- всех участников комнаты (1:1). Синхронно с клиентом:
-- buildHiddenForEveryone + UPDATE hidden_for.
-- На проде: trg_purge_message_if_hidden_for_all (уже может быть).
-- Идемпотентно: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_message_if_hidden_for_all()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participants text[];
  elem text;
  all_hidden boolean := true;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.hidden_for IS NULL OR cardinality(NEW.hidden_for) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT array_remove(
    ARRAY[
      NULLIF(btrim(r.user1_id::text), ''),
      NULLIF(btrim(r.user2_id::text), '')
    ],
    NULL
  )
  INTO participants
  FROM public.rooms r
  WHERE r.id = NEW.room_id;

  IF participants IS NULL OR cardinality(participants) < 2 THEN
    RETURN NEW;
  END IF;

  FOREACH elem IN ARRAY participants
  LOOP
    IF NOT (elem = ANY (NEW.hidden_for)) THEN
      all_hidden := false;
      EXIT;
    END IF;
  END LOOP;

  IF all_hidden THEN
    DELETE FROM public.messages WHERE id = NEW.id;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_message_if_hidden_for_all ON public.messages;
CREATE TRIGGER trg_purge_message_if_hidden_for_all
  AFTER UPDATE OF hidden_for ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_message_if_hidden_for_all();
