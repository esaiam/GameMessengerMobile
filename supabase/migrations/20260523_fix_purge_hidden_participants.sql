-- ============================================================
-- Fix: rooms on prod have user1_id/user2_id only (no player1_name).
-- purge_message_if_hidden_for_all() failed on hidden_for UPDATE.
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
