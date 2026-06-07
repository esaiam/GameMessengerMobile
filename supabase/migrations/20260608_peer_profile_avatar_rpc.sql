-- ============================================================
-- get_peer_profile_avatar: публичные поля аватара по @handle
-- Требует: profiles.avatar_path, profiles.avatar_updated_at (20260607)
-- Применить: Supabase Dashboard → SQL Editor → Run
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_peer_profile_avatar(p_handle text)
RETURNS TABLE (
  handle text,
  avatar_path text,
  avatar_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    p.handle,
    p.avatar_path,
    p.avatar_updated_at
  FROM
    public.profiles p,
    LATERAL (
      SELECT
        lower(trim(p_handle)) AS h
    ) n
  WHERE
    (SELECT auth.uid()) IS NOT NULL
    AND n.h ~ '^[a-z0-9_]{1,32}$'
    AND p.handle = n.h
  LIMIT 1;
$func$;

COMMENT ON FUNCTION public.get_peer_profile_avatar (text) IS
  'Аватар контакта по handle (без @). Только authenticated. Не возвращает id профиля.';

REVOKE ALL ON FUNCTION public.get_peer_profile_avatar (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_peer_profile_avatar (text) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Проверка (под authenticated-сессией в SQL Editor нельзя — тест из приложения или psql):
--
-- SELECT * FROM public.get_peer_profile_avatar('somehandle');
--
-- SELECT routine_name, grantee
-- FROM information_schema.role_routine_grants
-- WHERE routine_schema = 'public'
--   AND routine_name = 'get_peer_profile_avatar';
