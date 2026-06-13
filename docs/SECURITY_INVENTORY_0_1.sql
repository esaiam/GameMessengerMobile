-- ============================================================
-- Шаг 0.1 — инвентаризация security на prod
-- Supabase Dashboard → SQL Editor → Run по блокам, отметь результаты
-- Проект: nqssqplizwsukowggzxd (game-messenger)
-- ============================================================

-- ─── A. RLS: rooms, messages, game_sessions ─────────────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('rooms', 'messages', 'game_sessions')
ORDER BY tablename, policyname;

-- Ожидание: participant-политики; НЕТ дублей legacy типа
-- "Users can read own rooms" рядом с "rooms_*_participant"

-- ─── B. Таблица users (должна отсутствовать) ─────────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'users'
) AS users_table_exists;

-- Ожидание: false

-- ─── C. blocked_peers + триггер block на INSERT ─────────────
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'blocked_peers'
) AS blocked_peers_table;

SELECT tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'messages'
  AND NOT t.tgisinternal
ORDER BY tgname;

-- Ожидание: trg_messages_reject_blocked (+ push, last_message, …)

-- ─── D. delete_user_account RPC ─────────────────────────────
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'delete_user_account';

-- Ожидание: 1 строка SECURITY DEFINER (если пусто — gap, шаг 2.1)

-- ─── E. Storage chat-media + avatars ────────────────────────
SELECT id, public FROM storage.buckets WHERE id IN ('chat-media', 'avatars');

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname ILIKE '%chat-media%' OR policyname ILIKE 'avatars%')
ORDER BY policyname;

-- Ожидание: chat-media INSERT authenticated only; avatars authenticated path uid

-- ─── F. anon EXECUTE (лишние RPC) ───────────────────────────
SELECT routine_name, grantee
FROM information_schema.role_routine_grants
WHERE grantee IN ('anon', 'public')
  AND routine_schema = 'public'
ORDER BY routine_name, grantee;

-- ─── G. Push trigger (код на edge — отдельно в Dashboard) ───
SELECT pg_get_functiondef(p.oid) AS trigger_push_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'trigger_push_on_message';

-- Edge Function send_push_on_message: Dashboard → Edge Functions → исходник
-- Ожидание body: «Новое сообщение», не plaintext чата (§5 чеклиста)

-- ─── H. Миграции в репо (сверка вручную) ────────────────────
-- GameMessengerMobile/supabase/migrations/ — последние (commit 414b3fd+):
-- 20260615_drop_legacy_rls_policies.sql
-- 20260616_messages_delete_storage_on_delete.sql
-- Полный список: docs/PROD_SECURITY_CHECKLIST.md § «Миграции в репо»
