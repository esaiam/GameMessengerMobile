-- ============================================================
-- profile avatars: profiles.avatar_path + storage bucket `avatars`
-- Требует: public.profiles, auth.users
-- Применить: Supabase Dashboard → SQL Editor → Run
--
-- Путь файла: {user_id}/avatar.jpg (один JPEG на пользователя, upsert на клиенте)
-- Публичный read bucket — getPublicUrl без signed URL (как chat-media)
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) profiles: метаданные аватара
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text NULL,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.avatar_path IS
  'Путь в bucket avatars, напр. {user_id}/avatar.jpg. NULL — аватар снят.';

COMMENT ON COLUMN public.profiles.avatar_updated_at IS
  'Время последней загрузки/удаления аватара; cache bust на клиенте.';

CREATE OR REPLACE FUNCTION public.profiles_validate_avatar_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_path IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.avatar_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.jpg$' THEN
    RAISE EXCEPTION 'invalid_avatar_path' USING ERRCODE = '22023';
  END IF;

  IF NEW.avatar_path <> (NEW.id::text || '/avatar.jpg') THEN
    RAISE EXCEPTION 'avatar_path_must_match_profile_id' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_validate_avatar_path() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_validate_avatar_path ON public.profiles;
CREATE TRIGGER trg_profiles_validate_avatar_path
  BEFORE INSERT OR UPDATE OF avatar_path ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_validate_avatar_path();

-- ---------------------------------------------------------------------------
-- 2) Storage bucket `avatars`
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars authenticated insert own" ON storage.objects;
CREATE POLICY "avatars authenticated insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars authenticated update own" ON storage.objects;
CREATE POLICY "avatars authenticated update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars authenticated delete own" ON storage.objects;
CREATE POLICY "avatars authenticated delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- Проверка после Run (вручную):
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
--   AND column_name IN ('avatar_path', 'avatar_updated_at');
--
-- SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
--
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname ILIKE 'avatars%'
-- ORDER BY policyname;
