-- ============================================================
-- Удаление файлов из Storage при физическом DELETE messages.
--
-- Покрывает:
--   • «удалить у всех» → hidden_for → purge_message_if_hidden_for_all → DELETE
--   • ephemeral (pg_cron DELETE по expires_at)
--   • delete_contact_room / CASCADE
--
-- НЕ удаляет при «только у меня» (строка остаётся в БД).
--
-- Требует vault secret service_role_key (как push-триггер).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Путь объекта в bucket chat-media из public URL
CREATE OR REPLACE FUNCTION public.vault_extract_chat_media_path(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    substring(btrim(p_url) FROM '/storage/v1/object/(?:public/)?chat-media/(.+)$'),
    ''
  );
$$;

-- Собрать уникальные пути из media_url + media_urls (json array)
CREATE OR REPLACE FUNCTION public.vault_collect_chat_media_paths(
  p_media_url text,
  p_media_urls jsonb
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  paths text[] := ARRAY[]::text[];
  p text;
  elem text;
BEGIN
  p := public.vault_extract_chat_media_path(p_media_url);
  IF p IS NOT NULL THEN
    paths := array_append(paths, p);
  END IF;

  IF p_media_urls IS NOT NULL AND jsonb_typeof(p_media_urls) = 'array' THEN
    FOR elem IN
      SELECT jsonb_array_elements_text(p_media_urls)
    LOOP
      p := public.vault_extract_chat_media_path(elem);
      IF p IS NOT NULL AND NOT (p = ANY (paths)) THEN
        paths := array_append(paths, p);
      END IF;
    END LOOP;
  END IF;

  RETURN paths;
END;
$$;

-- Async DELETE в Storage через REST (pg_net)
CREATE OR REPLACE FUNCTION public.vault_delete_chat_media_paths(p_paths text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  service_key text;
  path text;
  obj_url text;
BEGIN
  IF p_paths IS NULL OR cardinality(p_paths) = 0 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret
  INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL OR btrim(service_key) = '' THEN
    RAISE WARNING 'vault_delete_chat_media_paths: vault secret service_role_key missing — storage not deleted';
    RETURN;
  END IF;

  base_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  IF base_url IS NULL THEN
    base_url := 'https://nqssqplizwsukowggzxd.supabase.co';
  END IF;

  FOREACH path IN ARRAY p_paths
  LOOP
    obj_url := rtrim(base_url, '/') || '/storage/v1/object/chat-media/' || path;
    BEGIN
      PERFORM net.http_delete(
        url := obj_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_key,
          'apikey', service_key
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'vault_delete_chat_media_paths failed for %: %', path, SQLERRM;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_message_storage(
  p_media_url text,
  p_media_urls jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.vault_delete_chat_media_paths(
    public.vault_collect_chat_media_paths(p_media_url, p_media_urls)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_messages_delete_chat_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.vault_delete_message_storage(OLD.media_url, OLD.media_urls);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_delete_chat_media ON public.messages;
CREATE TRIGGER trg_messages_delete_chat_media
  AFTER DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_messages_delete_chat_media();

REVOKE ALL ON FUNCTION public.vault_delete_chat_media_paths(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_delete_message_storage(text, jsonb) FROM PUBLIC;

COMMENT ON FUNCTION public.trg_messages_delete_chat_media IS
  'AFTER DELETE on messages: удаляет chat-media объекты (async pg_net).';
