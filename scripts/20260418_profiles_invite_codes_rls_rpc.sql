-- 2026-04-18: profiles (@handle без @ в БД), invite_codes, RLS, поиск и redeem через RPC
--
-- Запуск: Supabase SQL Editor или supabase db push (если подключите папку migrations).
-- Сначала проверьте на staging.
--
-- Права (кратко):
-- - Клиент (anon key в приложении): только authenticated + RLS; service_role в клиент НЕ класть.
-- - redeem_invite_code / search_profiles_by_handle_prefix: EXECUTE только для authenticated
--   (anon не может вызывать — нет обхода RLS на profiles).
-- - Фоновые задачи / админка: service_role обходит RLS; использовать только на сервере.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  handle text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_handle_lower_alnum CHECK (
    handle ~ '^[a-z0-9_]+$'
    AND char_length(handle) BETWEEN 1 AND 32
  ),
  CONSTRAINT profiles_handle_unique UNIQUE (handle)
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles (handle);

COMMENT ON TABLE public.profiles IS 'Публичный handle без символа @; в UI добавляйте @.';

-- ---------------------------------------------------------------------------
-- 2) invite_codes: каноническое значение code = lower(trim(code)); уникальность по выражению
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  code text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  expires_at timestamptz,
  max_uses int NOT NULL DEFAULT 1,
  uses_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_codes_max_uses_positive CHECK (max_uses >= 1),
  CONSTRAINT invite_codes_uses_non_negative CHECK (uses_count >= 0),
  CONSTRAINT invite_codes_uses_lte_max CHECK (uses_count <= max_uses)
);

ALTER TABLE public.invite_codes DROP CONSTRAINT IF EXISTS invite_codes_code_unique;

UPDATE public.invite_codes
SET
  code = lower(trim(code));

CREATE UNIQUE INDEX IF NOT EXISTS uq_invite_codes_lower_trim_code ON public.invite_codes (lower(trim(code)));

CREATE OR REPLACE FUNCTION public.invite_codes_normalize_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $trig$
BEGIN
  NEW.code := lower(trim(NEW.code));
  RETURN NEW;
END;
$trig$;

REVOKE ALL ON FUNCTION public.invite_codes_normalize_code() FROM PUBLIC;

DROP TRIGGER IF EXISTS invite_codes_normalize_code ON public.invite_codes;

CREATE TRIGGER invite_codes_normalize_code
  BEFORE INSERT OR UPDATE OF code ON public.invite_codes
  FOR EACH ROW
  EXECUTE PROCEDURE public.invite_codes_normalize_code();

COMMENT ON TABLE public.invite_codes IS 'Инвайт-коды; code хранится в lower(trim); уникальность — uq_invite_codes_lower_trim_code.';

-- ---------------------------------------------------------------------------
-- 3) RLS + grants (anon без прямого SELECT по таблицам)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.invite_codes FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.invite_codes TO authenticated;

-- service_role: для Edge Functions / серверных скриптов (обходит RLS по умолчанию в Supabase)
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.invite_codes TO service_role;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS invite_codes_select_own ON public.invite_codes;
CREATE POLICY invite_codes_select_own ON public.invite_codes
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS invite_codes_insert_own ON public.invite_codes;
CREATE POLICY invite_codes_insert_own ON public.invite_codes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) Поиск профилей только через RPC (SECURITY DEFINER, обход RLS внутри функции)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_profiles_by_handle_prefix (prefix text, lim int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  handle text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    p.id,
    p.handle
  FROM
    public.profiles p,
    LATERAL (
      SELECT
        trim(lower(prefix)) AS pfx
    ) n
  WHERE
    n.pfx IS NOT NULL
    AND char_length(n.pfx) >= 2
    AND n.pfx ~ '^[a-z0-9_]{2,}$'
    AND starts_with(p.handle, n.pfx)
  ORDER BY
    p.handle ASC
  LIMIT (
    SELECT
      LEAST(GREATEST(coalesce(lim, 20), 1), 50) AS n
  );
$func$;

COMMENT ON FUNCTION public.search_profiles_by_handle_prefix (text, int) IS
'Префикс нормализуется (trim+lower); только ^[a-z0-9_]{2,}$, иначе пусто. Лимит 1..50.';

REVOKE ALL ON FUNCTION public.search_profiles_by_handle_prefix (text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_handle_prefix (text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Redeem инвайта (только для залогиненного пользователя)
--
-- Рекомендуемый порядок на клиенте:
-- 1) signUp / signInWithPassword / magic link — пока есть сессия (JWT), auth.uid() заполнен.
-- 2) INSERT в public.profiles (id = auth.uid(), handle = ...) если строки ещё нет.
-- 3) Вызвать redeem_invite_code('...') один раз для привязки/активации инвайта.
--    Не вызывать с anon-ключом: функция вернёт not_authenticated.
-- 4) Доп. данные (роли, связь user↔invite) при необходимости — отдельные таблицы в следующих миграциях.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invite_code (p_code text)
RETURNS TABLE (
  success boolean,
  error_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_norm text;
  v_lookup public.invite_codes%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    success := FALSE;
    error_reason := 'not_authenticated';
    RETURN NEXT;
    RETURN;
  END IF;

  v_norm := lower(trim(p_code));

  IF v_norm = '' OR char_length(v_norm) > 128 THEN
    success := FALSE;
    error_reason := 'invalid_code';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.invite_codes ic
  SET
    uses_count = ic.uses_count + 1
  WHERE
    lower(trim(ic.code)) = v_norm
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
    AND ic.uses_count < ic.max_uses;

  IF FOUND THEN
    success := TRUE;
    error_reason := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    ic.* INTO STRICT v_lookup
  FROM
    public.invite_codes ic
  WHERE
    lower(trim(ic.code)) = v_norm;

  IF v_lookup.expires_at IS NOT NULL AND v_lookup.expires_at <= now() THEN
    success := FALSE;
    error_reason := 'expired';
  ELSIF v_lookup.uses_count >= v_lookup.max_uses THEN
    success := FALSE;
    error_reason := 'exhausted';
  ELSE
    success := FALSE;
    error_reason := 'redeem_failed';
  END IF;

  RETURN NEXT;
  RETURN;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    success := FALSE;
    error_reason := 'not_found';
    RETURN NEXT;
    RETURN;
END;
$func$;

COMMENT ON FUNCTION public.redeem_invite_code (text) IS
'Атомарно увеличивает uses_count при валидном коде. Вызывать с JWT authenticated после регистрации/логина.';

REVOKE ALL ON FUNCTION public.redeem_invite_code (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code (text) TO authenticated;

COMMIT;
