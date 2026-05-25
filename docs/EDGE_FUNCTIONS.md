# Edge Functions

## ai-rewrite

ИИ-редактор в чате (Groq `llama-3.1-8b-instant`). Ключ **только на сервере**.

### Однократная настройка (prod)

1. [Groq API key](https://console.groq.com/) → скопировать ключ.
2. Supabase Dashboard → Project Settings → Edge Functions → Secrets:

   ```
   GROQ_API_KEY=gsk_...
   ```

   (`SUPABASE_URL` и `SUPABASE_ANON_KEY` подставляются автоматически при деплое.)

3. CLI из `GameMessengerMobile/`:

   ```bash
   npx supabase login
   npx supabase link --project-ref nqssqplizwsukowggzxd
   npx supabase secrets set GROQ_API_KEY=gsk_ВАШ_КЛЮЧ
   npx supabase functions deploy ai-rewrite
   ```

### Клиент

- `src/lib/edgeFunctions.js` — вызовы на `https://nqssqplizwsukowggzxd.supabase.co/functions/v1/...`
- `Authorization: Bearer <access_token>`, `apikey: sb_publishable_...`
- При ключах `sb_publishable_*` в `config.toml` для функции нужно **`verify_jwt = false`** (проверка user JWT внутри handler).
- **`EXPO_PUBLIC_XAI_API_KEY` больше не используется** — убери из `.env` / EAS secrets.

### GIF / картинки

`search-gif` и `search-pic` — отдельные функции (могут быть не задеплоены). Без них сработает fallback, если в `.env` есть `EXPO_PUBLIC_GIPHY_API_KEY` / `EXPO_PUBLIC_PEXELS_API_KEY`.

### Локальная отладка (опционально)

```bash
npx supabase start
npx supabase secrets set GROQ_API_KEY=gsk_...
npx supabase functions serve ai-rewrite
```

### Стили

`formal` | `short` | `soft` | `bold` | `fix` — промпты в `supabase/functions/ai-rewrite/stylePrompts.ts`.
