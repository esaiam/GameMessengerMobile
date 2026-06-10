-- ============================================================
-- Fix: «удалить у всех» / очистка переписки падает с
-- messages_v2_reply_to_fkey when purge trigger DELETEs messages
-- that are still referenced by reply_to.
--
-- Root cause: trg_purge_message_if_hidden_for_all DELETE after
-- hidden_for covers all participants; reply_to FK has no ON DELETE SET NULL.
--
-- Apply: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

-- 1) reply_to FK: ON DELETE SET NULL (messages or messages_v2)
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      cl.relname AS table_name,
      c.conname AS constraint_name
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND c.contype = 'f'
      AND a.attname = 'reply_to'
      AND cl.relname IN ('messages', 'messages_v2')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (reply_to) REFERENCES %I.%I(id) ON DELETE SET NULL',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name,
      fk.schema_name,
      fk.table_name
    );
  END LOOP;
END;
$$;

-- 2) Purge trigger: drop reply links before physical DELETE
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
    UPDATE public.messages SET reply_to = NULL WHERE reply_to = NEW.id;
    DELETE FROM public.messages WHERE id = NEW.id;
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Bulk hide RPC: clear reply_to in room before hidden_for mass-update
CREATE OR REPLACE FUNCTION public.vault_hide_room_for_everyone(p_room_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
  u1 text;
  u2 text;
  targets text[];
BEGIN
  h := public.vault_profile_handle();
  IF h IS NULL OR btrim(h) = '' THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  p_room_id := btrim(p_room_id);
  IF p_room_id = '' THEN
    RAISE EXCEPTION 'invalid_room_id' USING ERRCODE = '22023';
  END IF;

  SELECT r.user1_id, r.user2_id
  INTO u1, u2
  FROM public.rooms r
  WHERE r.id = p_room_id
    AND (r.user1_id = h OR r.user2_id = h);

  IF u1 IS NULL THEN
    RAISE EXCEPTION 'not_room_participant' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT val), ARRAY[]::text[])
  INTO targets
  FROM (
    SELECT u1 AS val
    WHERE u1 IS NOT NULL AND btrim(u1) <> ''
    UNION
    SELECT u2
    WHERE u2 IS NOT NULL AND btrim(u2) <> ''
    UNION
    SELECT m.player_name
    FROM public.messages m
    WHERE m.room_id = p_room_id
      AND m.player_name IS NOT NULL
      AND btrim(m.player_name) <> ''
  ) s;

  IF targets IS NULL OR array_length(targets, 1) IS NULL THEN
    targets := ARRAY[h];
  END IF;

  UPDATE public.messages
  SET reply_to = NULL
  WHERE room_id = p_room_id
    AND reply_to IS NOT NULL;

  UPDATE public.messages
  SET hidden_for = targets
  WHERE room_id = p_room_id;

  UPDATE public.rooms
  SET
    last_message_at = NULL,
    last_message_id = NULL,
    thread_cleared_at = now()
  WHERE id = p_room_id;

  INSERT INTO public.hidden_chat_rooms (room_id)
  VALUES (p_room_id)
  ON CONFLICT ON CONSTRAINT hidden_chat_rooms_unique DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_hide_room_for_everyone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_hide_room_for_everyone(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
