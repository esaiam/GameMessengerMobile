# Supabase migrations (Vault Messenger)

SQL в порядке префикса даты в имени файла.

## Быстрое применение (linked project)

```powershell
cd GameMessengerMobile
npx supabase login          # один раз
npx supabase link           # если ещё не link
.\scripts\apply-supabase-migrations.ps1
```

Или по одному файлу:

```powershell
npx supabase db query --linked --file supabase/migrations/20260521_rooms_last_message.sql
```

**Важно:** `apply-supabase-migrations.ps1` прогоняет **все** `.sql` подряд. На prod с данными — только **новые** файлы, не весь каталог. Миграция `20260524_clear_messages_pre_beta.sql` была one-time wipe и теперь no-op (раньше `DELETE FROM messages`).

## Файлы

| Файл | Назначение |
|------|------------|
| `20260521_rooms_last_message.sql` | `last_message_at` / `last_message_id`, триггер, бэкфилл |
| `20260522_messages_purge_hidden_for_all.sql` | DELETE при `hidden_for` = все участники |
| `20260522_pg_cron_maintenance.sql` | `pg_cron`: пустые rooms, старые `game_sessions`, `expires_at` |
| `20260522_push_dedup.sql` | Таблица дедупа push |
| `20260522_push_on_message_insert.sql` | `trigger_push_on_message` → Edge `send_push_on_message` |
| `20260619_profiles_push_token.sql` | `profiles.push_token` — Expo token для Aria / push |

См. также зеркала в `docs/migrations/` и § «Миграции в репо» в `docs/PROD_SECURITY_CHECKLIST.md`.

## Push: секрет Vault (обязательно перед push-миграцией)

Триггер читает **service role key** из Vault, не из SQL (ключ в репозиторий не кладём).

1. Dashboard → **Project Settings** → **Vault** → New secret  
2. Name: `service_role_key`  
3. Value: service_role key из **Settings → API**

Опционально другой URL проекта:

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_REF.supabase.co';
```

## Проверка после применения

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.messages'::regclass AND NOT tgisinternal
ORDER BY tgname;
-- Ожидается: push_on_message_insert, trg_purge_message_if_hidden_for_all, trg_rooms_last_message

SELECT count(*) AS total,
       count(*) FILTER (WHERE last_message_at IS NULL) AS null_last
FROM public.rooms;
-- null_last желательно 0 (для комнат с сообщениями)

SELECT jobid, schedule, active FROM cron.job ORDER BY jobid;
```

## Статус prod (game-messenger, ref `nqssqplizwsukowggzxd`)

Проверено через `supabase db query --linked` (2026-05-22):

- Колонки `last_message_*`, все три триггера на `messages`, три `cron.job` — **уже есть**
- `push_dedup` — **есть**
- Функция `trigger_push_on_message` на проде использовала JWT в теле функции → после деплоя файла из репо перейдёт на Vault (создайте секрет до прогона `20260522_push_on_message_insert.sql`)

Повторный прогон идемпотентных миграций безопасен; `pg_cron` jobs не дублируются.
