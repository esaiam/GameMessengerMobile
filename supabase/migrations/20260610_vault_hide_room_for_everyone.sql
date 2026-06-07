-- ============================================================
-- «Удалить у всех»: RPC + rooms.thread_cleared_at
-- Требует: vault_profile_handle(), hidden_chat_rooms, rooms.last_message_*
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_id bigint,
  ADD COLUMN IF NOT EXISTS thread_cleared_at timestamptz;

COMMENT ON COLUMN public.rooms.thread_cleared_at IS
  'Переписка скрыта у обоих («удалить у всех»). Сбрасывается при новом сообщении.';

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

-- PostgREST: обновить schema cache (иначе «could not find function … in the schema cache»)
NOTIFY pgrst, 'reload schema';

COMMIT;
