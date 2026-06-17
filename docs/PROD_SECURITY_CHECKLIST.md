# Prod security checklist (beta 0.1)

> **Источник SQL:** `docs/SECURITY_INVENTORY_0_1.sql` — прогонять блоки **A–H** в Supabase SQL Editor (prod).  
> Этот файл — оглавление и соответствие §1–§7 из `MVP_READINESS.md`. Отдельный SQL-файл не дублируется.

**Проект:** `nqssqplizwsukowggzxd` (game-messenger)  
**Последняя сверка:** _заполнить дату после прогона_

---

## §1 — RLS `rooms` / `messages` / `game_sessions`

- SQL: **блок A** в `SECURITY_INVENTORY_0_1.sql`
- Ожидание: только `*participant*` политики; **нет** legacy-дублей
- Если legacy есть → применить `supabase/migrations/20260615_drop_legacy_rls_policies.sql`

## §2 — таблица `users`

- SQL: **блок B**
- Ожидание: `users_table_exists = false`

## §3 — `vault_public_keys`

- SQL (дополнительно к инвентаризации):

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vault_public_keys'
ORDER BY policyname;
```

- Ожидание: read для authenticated; insert/update без дыр (сверять с `src/utils/VaultKeyServer.ts`)

## §4 — Storage `chat-media` / `avatars`

- SQL: **блок E**
- Ожидание: `chat-media` INSERT — **authenticated**, не `anon`

## §5 — Push без plaintext

- SQL: **блок G** (триггер `trigger_push_on_message`)
- Dashboard → Edge Functions → `send_push_on_message`
- **E2E после release APK:** текст на шторке **≠** plaintext сообщения в чате

## §6 — anon EXECUTE

- SQL: **блок F**
- Ожидание: короткий список; опционально REVOKE на trigger-функции (см. миграцию `20260615`)

## §7 — Клиент

- Локально: `npm run verify:env` — только `EXPO_PUBLIC_*` в клиенте
- `grep -r service_role src/` — пусто

---

## Миграции в репо (сверка с prod)

См. **блок H** в `SECURITY_INVENTORY_0_1.sql`. Актуальные (после `1a1e5fe`):

| Файл | Назначение |
|------|------------|
| `20260613_fix_purge_reply_to_fkey.sql` | FK purge / reply_to |
| `20260614_clear_thread_vs_delete_chat.sql` | clear thread vs delete chat |
| `20260615_drop_legacy_rls_policies.sql` | legacy RLS cleanup |
| `20260616_messages_delete_storage_on_delete.sql` | storage cleanup on DELETE |

После применения: `npm run smoke:api` + быстрый чат/игра.

---

## Быстрый probe (не замена SQL)

```bash
npm run smoke:api          # нужен .env.smoke
node scripts/security-inventory-probe.mjs
```

Probe — sanity anon API; **не** подменяет блоки A–H на prod.

---

## Sign-off

| § | Дата | OK / gap | Комментарий |
|---|------|----------|-------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | pending до APK |
| 6 | | | |
| 7 | | | |
