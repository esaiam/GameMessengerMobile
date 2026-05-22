-- ============================================================
-- Плановая очистка (pg_cron) — как на проде (cron.job).
-- Не меняет клиент; только серверная БД.
-- Идемпотентно: job не создаётся, если такой command уже есть.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Индекс для job удаления по expires_at (если ещё нет)
CREATE INDEX IF NOT EXISTS idx_messages_expires_at_due
  ON public.messages (expires_at)
  WHERE expires_at IS NOT NULL;

-- 1) Каждый час :00 — комнаты без сообщений
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command ILIKE '%delete%from%public.rooms%'
      AND command ILIKE '%not exists%'
      AND command ILIKE '%messages%m.room_id = r.id%'
  ) AND NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command ILIKE '%delete%from%rooms%'
      AND command ILIKE '%not exists%select%from%messages%'
  ) THEN
    PERFORM cron.schedule(
      '0 * * * *',
      $cmd$
        DELETE FROM public.rooms r
        WHERE NOT EXISTS (
          SELECT 1 FROM public.messages m WHERE m.room_id = r.id
        );
      $cmd$
    );
  END IF;
END;
$do$;

-- 2) Ежедневно 03:20 — старые завершённые game_sessions
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command ILIKE '%delete%from%public.game_sessions%'
      AND command ILIKE '%finished%'
      AND command ILIKE '%interval ''7 days''%'
  ) THEN
    PERFORM cron.schedule(
      '20 3 * * *',
      $cmd$
        DELETE FROM public.game_sessions
        WHERE status IN ('finished', 'cancelled')
          AND created_at < now() - interval '7 days';
      $cmd$
    );
  END IF;
END;
$do$;

-- 3) Каждую минуту — ephemeral (expires_at)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command ILIKE '%delete%from%public.messages%'
      AND command ILIKE '%expires_at%'
  ) THEN
    PERFORM cron.schedule(
      '* * * * *',
      $cmd$
        DELETE FROM public.messages
        WHERE expires_at IS NOT NULL
          AND expires_at <= now();
      $cmd$
    );
  END IF;
END;
$do$;
