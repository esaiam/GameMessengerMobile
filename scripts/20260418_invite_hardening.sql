-- 2026-04-18: invite-only hardening — profiles.invited, invite_codes.redeemed_by, redeem_invite_code
--
-- Запуск: Supabase SQL Editor или миграции. Сначала staging.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited boolean NOT NULL DEFAULT false;

ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS redeemed_by uuid REFERENCES public.profiles (id);

COMMENT ON COLUMN public.profiles.invited IS 'Уже успешно применил инвайт (redeem_invite_code).';
COMMENT ON COLUMN public.invite_codes.redeemed_by IS 'Кто последним успешно увеличил uses_count по этому коду (один шаг redeem).';

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

  IF EXISTS (
    SELECT
      1
    FROM
      public.profiles p
    WHERE
      p.id = (SELECT auth.uid())
      AND p.invited = TRUE) THEN
    success := FALSE;
    error_reason := 'already_redeemed';
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
    uses_count = ic.uses_count + 1,
    redeemed_by = (SELECT auth.uid())
  WHERE
    lower(trim(ic.code)) = v_norm
    AND (ic.expires_at IS NULL OR ic.expires_at > now())
    AND ic.uses_count < ic.max_uses;

  IF FOUND THEN
    UPDATE public.profiles
    SET
      invited = TRUE
    WHERE
      id = (SELECT auth.uid());

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
'Инвайт один раз на профиль (profiles.invited). При успехе: uses_count++, redeemed_by, invited=true.';

COMMIT;
