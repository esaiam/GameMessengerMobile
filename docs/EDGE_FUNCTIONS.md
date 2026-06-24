# Supabase Edge Functions (Vault Messenger)

Клиент вызывает edge через `src/lib/edgeFunctions.js` → `invokeVaultEdgeFunction`.

**URL:** `https://nqssqplizwsukowggzxd.supabase.co/functions/v1/<name>`  
**Auth:** `Authorization: Bearer <user access_token>` + `apikey: <publishable/anon>`  
**Конфиг:** `verify_jwt = false` в `config.toml` + проверка JWT в handler (`/auth/v1/user`).

Секреты **только** в Supabase Dashboard → Edge Functions → Secrets, не в `.env` клиента.

---

## Функции

| Имя | Назначение | Секреты |
|-----|------------|---------|
| `ai-rewrite` | ИИ-переписывание текста в чате (`AiRewritePanel`) | `GROQ_API_KEY` |
| `search-gif` | Поиск GIF в композере | по деплою |
| `search-pic` | Поиск картинок | по деплою |
| `send_push_on_message` | Push при INSERT в `messages` (триггер БД) | Vault `service_role_key` в БД |

Клиентские обёртки:

- `src/lib/aiRewrite.js` → `ai-rewrite`
- GIF/pic — через тот же `invokeVaultEdgeFunction` (см. композер / media pickers)

---

## Деплой (Supabase CLI)

```powershell
cd GameMessengerMobile
npx supabase login
npx supabase link --project-ref nqssqplizwsukowggzxd

# Исходники функций — в Dashboard или в supabase/functions/ (если добавлены в репо)
npx supabase functions deploy ai-rewrite
npx supabase secrets set GROQ_API_KEY=gsk_...
```

Проверка `ai-rewrite`: чат → выделить текст → стиль переписывания (нужен логин).

---

## Push edge (`send_push_on_message`)

1. Перед миграцией push — секрет в **Vault** (не в git):  
   Dashboard → Project Settings → **Vault** → `service_role_key` = service role из API settings.
2. Миграции: `supabase/migrations/20260522_push_*.sql` — см. `supabase/migrations/README.md`.
3. Body push — **не plaintext** чата («Новое сообщение»). E2E после release APK — §5 в `PROD_SECURITY_CHECKLIST.md`.

---

## Aria push (отдельно от edge)

Expo push token пишется клиентом в `profiles.push_token` (`src/lib/notifications.js`).  
Сервер Aria читает через `service_role`. Миграция: `20260619_profiles_push_token.sql`.

---

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| `Функция ai-rewrite не развёрнута` (404) | `functions deploy ai-rewrite` |
| 401 от edge | Сессия истекла — re-login; проверить JWT в handler |
| 500 / Groq | Проверить `GROQ_API_KEY` в secrets |
| Push FIS_AUTH_ERROR | Firebase / `google-services.json`, SHA-1 в GCP |
