# P0.4 — сверка security на prod (Supabase Dashboard)

Выполни в **SQL Editor** проекта `nqssqplizwsukowggzxd`. Отмечай `[x]` когда совпало с «Ожидаемо».

См. также аудит: `Table/docs/vault_session_summary.md` (статус «всё закрыто» — **подтверди запросами**, не по памяти).

**Не применять на prod как есть:** `supabase_setup_v2.sql`, `scripts/supabase-storage-chat-media.sql` (anon INSERT) — только dev/legacy.

---

## 1. RLS: `rooms`, `messages`, `game_sessions`

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('rooms', 'messages', 'game_sessions')
ORDER BY tablename, policyname;
```

**Ожидаемо на prod:**
- [ ] RLS **включён** на всех трёх таблицах
- [ ] **Нет** политик вида `Anyone can read/update/delete` с `USING (true)`
- [ ] Есть participant-политики (имена могут отличаться, суть: доступ только участникам комнаты через `profiles.handle`)
- [ ] **Нет дублей:** старые `Users can read own rooms` **и** новые `rooms_*_participant` одновременно — оставить один набор

```sql
SELECT relname, relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('rooms', 'messages', 'game_sessions');
```

`relrowsecurity` = `t` для всех.

---

## 2. Таблица `users` (B1)

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'users'
) AS users_table_exists;
```

**Ожидаемо:** `false` (таблица дропнута).

---

## 3. `vault_public_keys` (B3)

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vault_public_keys'
ORDER BY policyname;
```

**Ожидаемо:**
- [ ] INSERT/UPDATE только для своей строки (`player_name` = handle из `profiles` для `auth.uid()`)
- [ ] Нет открытого `WITH CHECK (true)` на INSERT/UPDATE

---

## 4. Storage `chat-media` (B4)

```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'chat-media';

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname ILIKE '%chat-media%'
ORDER BY policyname;
```

**Ожидаемо на prod (по аудиту):**
- [ ] Bucket **public** read (для `getPublicUrl`) — ок для текущей архитектуры
- [ ] INSERT только **`authenticated`**, не `anon`
- [ ] **Нет** политики `chat-media anon insert`

Если на prod всё ещё anon insert — применить в SQL Editor (пример целевого состояния):

```sql
DROP POLICY IF EXISTS "chat-media anon insert" ON storage.objects;
DROP POLICY IF EXISTS "chat-media authenticated insert" ON storage.objects;
CREATE POLICY "chat-media authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');
```

---

## 5. Push — без plaintext (B5)

Проверить Edge Function / триггер, который шлёт Expo push (репо: `supabase/functions/` или Vault secret).

**Ожидаемо:** в body только **«Новое сообщение»** (или без текста чата), не расшифрованный текст сообщения.

- [ ] Проверено в коде функции на проде
- [ ] Тест: отправить E2E-сообщение → текст push на устройстве не совпадает с plaintext

---

## 6. Grants / anon EXECUTE

```sql
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE grantee IN ('anon', 'public')
  AND routine_schema = 'public'
ORDER BY routine_name, grantee;
```

**Ожидаемо:**
- [ ] `anon` может вызывать только задуманные RPC (`search_profiles_by_handle_prefix`, `redeem_invite_code`, …)
- [ ] Нет лишнего `EXECUTE` на админские/опасные функции

---

## 7. Клиент

- [x] В приложении только `EXPO_PUBLIC_SUPABASE_ANON_KEY` / publishable — **не** `service_role` (проверено в `src/`, 2026-05-26)
- [x] `eas.json` production: только `APP_VARIANT`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable)
- [x] `npm run verify:env` — URL согласованы `.env` ↔ EAS

---

## Итог

| Дата проверки | Кто | Все пункты OK |
|---------------|-----|----------------|
| | | [ ] |

Заметки:

---

*После сверки: отметь в `RELEASE_PREP.md` §4 галочки.*
