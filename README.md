## Vault Messenger (mobile)

React Native + Expo SDK 54. Основная ветка разработки: **`tab-pager-experiment`**.

### Быстрый старт

```powershell
git clone https://github.com/esaiam/GameMessengerMobile.git
cd GameMessengerMobile
git checkout tab-pager-experiment
npm install
copy .env.example .env   # заполнить Supabase + Aria URL
npm run smoke
npx expo start
```

Полный чеклист переезда на новое железо: **`docs/DEV_SETUP.md`**.

Монорепо с submodule: репозиторий **`Table`** → `docs/README.md`.

### Документация

| Файл | Назначение |
|------|------------|
| `docs/DEV_SETUP.md` | Установка, env, Android, Supabase |
| `docs/MVP_READINESS.md` | Готовность к бете |
| `docs/TESTING.md` | Smoke, Maestro, crypto |
| `docs/EDGE_FUNCTIONS.md` | Supabase Edge deploy |

### Авто-фикс видеосообщений

GitHub Action `Fix chat videos (pad audio)` — раз в 30 минут допадит аудио в mp4 и перезаливает в Supabase Storage.

Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Подробности: `scripts/VIDEO_PROCESSING.md`.
