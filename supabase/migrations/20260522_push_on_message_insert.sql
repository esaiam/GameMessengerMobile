-- ============================================================
-- Push при INSERT в messages → Edge Function send_push_on_message
--
-- Перед первым применением на новой БД создайте секрет в Vault:
--   Dashboard → Project Settings → Vault → New secret
--   name: service_role_key
--   value: <service_role key из Settings → API>
--
-- URL проекта (публичный): замените ref при другом инстансе или задайте:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_REF.supabase.co';
--
-- На проде, где триггер уже с захардкоженным JWT: сначала создайте vault secret,
-- затем выполните этот файл (функция перейдёт на vault; триггер не трогаем).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  fn_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret
  INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL OR btrim(service_key) = '' THEN
    RAISE WARNING 'trigger_push_on_message: vault secret service_role_key missing — push skipped';
    RETURN NEW;
  END IF;

  base_url := nullif(btrim(current_setting('app.supabase_url', true)), '');
  IF base_url IS NULL THEN
    base_url := 'https://nqssqplizwsukowggzxd.supabase.co';
  END IF;

  fn_url := rtrim(base_url, '/') || '/functions/v1/send_push_on_message';

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'trigger_push_on_message failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_message_insert ON public.messages;
CREATE TRIGGER push_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_message();
