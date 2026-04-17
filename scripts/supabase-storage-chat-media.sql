-- Выполни в Supabase → SQL Editor (после add-media-columns.sql для таблицы messages).

-- 1) Bucket (публичный — чтобы getPublicUrl открывал картинки без signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) Любой клиент с anon key может читать файлы
DROP POLICY IF EXISTS "chat-media public read" ON storage.objects;
CREATE POLICY "chat-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

-- 3) Загрузка (anon — как в приложении с SUPABASE_ANON_KEY)
DROP POLICY IF EXISTS "chat-media anon insert" ON storage.objects;
CREATE POLICY "chat-media anon insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media');

-- 4) Обновление/удаление (опционально; для чата часто не нужно)
-- Раскомментируй, если нужно удалять свои файлы:
-- DROP POLICY IF EXISTS "chat-media anon update" ON storage.objects;
-- CREATE POLICY "chat-media anon update"
--   ON storage.objects FOR UPDATE USING (bucket_id = 'chat-media');
-- DROP POLICY IF EXISTS "chat-media anon delete" ON storage.objects;
-- CREATE POLICY "chat-media anon delete"
--   ON storage.objects FOR DELETE USING (bucket_id = 'chat-media');
