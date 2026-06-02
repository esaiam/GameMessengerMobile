-- ============================================================
-- blocked_peers: серверная блокировка + запрет INSERT в messages
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.vault_profile_handle()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT handle FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.vault_profile_handle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_profile_handle() TO authenticated;

CREATE TABLE IF NOT EXISTS public.blocked_peers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_handle text NOT NULL,
  blocked_handle text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_peers_no_self CHECK (blocker_handle <> blocked_handle),
  CONSTRAINT blocked_peers_unique UNIQUE (blocker_handle, blocked_handle)
);

CREATE INDEX IF NOT EXISTS idx_blocked_peers_blocker
  ON public.blocked_peers (blocker_handle);

CREATE INDEX IF NOT EXISTS idx_blocked_peers_blocked
  ON public.blocked_peers (blocked_handle);

CREATE OR REPLACE FUNCTION public.blocked_peers_set_blocker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.blocker_handle := public.vault_profile_handle();
  IF NEW.blocker_handle IS NULL OR btrim(NEW.blocker_handle) = '' THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  NEW.blocked_handle := lower(btrim(NEW.blocked_handle));
  IF NEW.blocked_handle = '' THEN
    RAISE EXCEPTION 'invalid_blocked_handle' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.blocked_peers_set_blocker() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_blocked_peers_set_blocker ON public.blocked_peers;
CREATE TRIGGER trg_blocked_peers_set_blocker
  BEFORE INSERT ON public.blocked_peers
  FOR EACH ROW
  EXECUTE FUNCTION public.blocked_peers_set_blocker();

ALTER TABLE public.blocked_peers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.blocked_peers FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.blocked_peers TO authenticated;
GRANT ALL ON TABLE public.blocked_peers TO service_role;

DROP POLICY IF EXISTS blocked_peers_select_own ON public.blocked_peers;
CREATE POLICY blocked_peers_select_own ON public.blocked_peers
  FOR SELECT TO authenticated
  USING (blocker_handle = public.vault_profile_handle());

DROP POLICY IF EXISTS blocked_peers_insert_own ON public.blocked_peers;
CREATE POLICY blocked_peers_insert_own ON public.blocked_peers
  FOR INSERT TO authenticated
  WITH CHECK (
    blocker_handle = public.vault_profile_handle()
    AND blocked_handle <> public.vault_profile_handle()
  );

DROP POLICY IF EXISTS blocked_peers_delete_own ON public.blocked_peers;
CREATE POLICY blocked_peers_delete_own ON public.blocked_peers
  FOR DELETE TO authenticated
  USING (blocker_handle = public.vault_profile_handle());

CREATE OR REPLACE FUNCTION public.messages_reject_if_peer_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u1 text;
  u2 text;
  other text;
BEGIN
  SELECT r.user1_id, r.user2_id
  INTO u1, u2
  FROM public.rooms r
  WHERE r.id = NEW.room_id;

  IF u1 IS NULL OR u2 IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.player_name = u1 THEN
    other := u2;
  ELSIF NEW.player_name = u2 THEN
    other := u1;
  ELSE
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocked_peers bp
    WHERE (bp.blocker_handle = NEW.player_name AND bp.blocked_handle = other)
       OR (bp.blocker_handle = other AND bp.blocked_handle = NEW.player_name)
  ) THEN
    RAISE EXCEPTION 'blocked_peer'
      USING ERRCODE = 'P0001',
            HINT = 'Messaging is blocked between these users';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.messages_reject_if_peer_blocked() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_messages_reject_blocked ON public.messages;
CREATE TRIGGER trg_messages_reject_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_reject_if_peer_blocked();

COMMIT;
