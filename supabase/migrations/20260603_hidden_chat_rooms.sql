-- ============================================================
-- hidden_chat_rooms: скрытие диалога из списка чатов (синк между устройствами)
-- Требует: vault_profile_handle() из 20260602_blocked_peers.sql
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hidden_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_handle text NOT NULL,
  room_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hidden_chat_rooms_unique UNIQUE (owner_handle, room_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_chat_rooms_owner
  ON public.hidden_chat_rooms (owner_handle);

CREATE INDEX IF NOT EXISTS idx_hidden_chat_rooms_room
  ON public.hidden_chat_rooms (room_id);

COMMENT ON TABLE public.hidden_chat_rooms IS
  'Комнаты, скрытые из списка чатов у владельца (удалить у меня). Сообщения остаются в messages.hidden_for.';

CREATE OR REPLACE FUNCTION public.hidden_chat_rooms_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
BEGIN
  h := public.vault_profile_handle();
  IF h IS NULL OR btrim(h) = '' THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  NEW.owner_handle := h;
  NEW.room_id := btrim(NEW.room_id);
  IF NEW.room_id = '' THEN
    RAISE EXCEPTION 'invalid_room_id' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.rooms r
    WHERE r.id = NEW.room_id
      AND (r.user1_id = h OR r.user2_id = h)
  ) THEN
    RAISE EXCEPTION 'not_room_participant' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hidden_chat_rooms_set_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_hidden_chat_rooms_set_owner ON public.hidden_chat_rooms;
CREATE TRIGGER trg_hidden_chat_rooms_set_owner
  BEFORE INSERT ON public.hidden_chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.hidden_chat_rooms_set_owner();

ALTER TABLE public.hidden_chat_rooms ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hidden_chat_rooms FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.hidden_chat_rooms TO authenticated;
GRANT ALL ON TABLE public.hidden_chat_rooms TO service_role;

DROP POLICY IF EXISTS hidden_chat_rooms_select_own ON public.hidden_chat_rooms;
CREATE POLICY hidden_chat_rooms_select_own ON public.hidden_chat_rooms
  FOR SELECT TO authenticated
  USING (owner_handle = public.vault_profile_handle());

DROP POLICY IF EXISTS hidden_chat_rooms_insert_own ON public.hidden_chat_rooms;
CREATE POLICY hidden_chat_rooms_insert_own ON public.hidden_chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (owner_handle = public.vault_profile_handle());

DROP POLICY IF EXISTS hidden_chat_rooms_delete_own ON public.hidden_chat_rooms;
CREATE POLICY hidden_chat_rooms_delete_own ON public.hidden_chat_rooms
  FOR DELETE TO authenticated
  USING (owner_handle = public.vault_profile_handle());

COMMIT;
