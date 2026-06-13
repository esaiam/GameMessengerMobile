-- Drop legacy RLS duplicates on prod (rooms + game_sessions).
-- Keeps policies whose names contain 'participant'.
-- Safe to re-run: IF EXISTS + skips unknown participant set.
--
-- Apply: SQL Editor on prod OR npm run db:migrate:apply (linked Supabase CLI)

BEGIN;

-- ─── rooms: legacy handle-based policies ────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can read/update own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can read own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can update own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can insert own rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can delete own rooms" ON public.rooms;

-- Catch-all: any remaining rooms policy without 'participant' that matches legacy naming
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rooms'
      AND policyname NOT ILIKE '%participant%'
      AND (
        policyname ILIKE 'Users can % own room%'
        OR policyname ILIKE 'Authenticated users can % room%'
        OR policyname ILIKE 'Anyone can %'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rooms', pol.policyname);
    RAISE NOTICE 'Dropped legacy rooms policy: %', pol.policyname;
  END LOOP;
END $$;

-- ─── game_sessions: legacy "Users can … own game sessions" ───
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_sessions'
      AND policyname NOT ILIKE '%participant%'
      AND policyname ILIKE 'Users can % own game session%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_sessions', pol.policyname);
    RAISE NOTICE 'Dropped legacy game_sessions policy: %', pol.policyname;
  END LOOP;
END $$;

-- ─── Optional hardening: trigger helpers not for anon RPC ───
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS proc, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'purge_message_if_hidden_for_all',
        'update_room_last_message',
        'trigger_push_on_message'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', fn.proc);
      RAISE NOTICE 'Revoked anon EXECUTE on %', fn.proname;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skip REVOKE on %: %', fn.proname, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;

-- ─── Verify (run output should show only participant / intended policies) ───
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('rooms', 'game_sessions')
ORDER BY tablename, policyname;
