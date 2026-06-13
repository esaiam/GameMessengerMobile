# Тестирование (Vault Messenger)

## CI / локально (Node)

```bash
npm run smoke          # offline: room id, VM2, media text
npm run smoke:api      # Supabase: auth, room, send/read (нужен .env.smoke)
```

**CI:** на каждый PR и push в `main`/`master` — GitHub Action `.github/workflows/smoke.yml` гоняет `npm run smoke` (offline, без секретов).

Креды для API: скопируй `.env.smoke.example` → `.env.smoke` (в gitignore).

## Crypto smoke (`vaultCryptoSmokeTests.ts`)

**Не запускается в Node/CI** — нужен `react-native-libsodium` (нативный модуль).

### На устройстве / симуляторе (__DEV__)

1. `npx expo start`, открой dev-клиент.
2. В Metro / React Native debugger console:

```javascript
await global.runVaultCryptoTests();
```

Ожидаемо: три строки `[TEST n] PASS`.

### Подсказка в терминале

```bash
npm run smoke:crypto
```

(только напоминание, не выполняет тесты)

## Edge (ИИ-редактор)

Деплой и секрет `GROQ_API_KEY`: `docs/EDGE_FUNCTIONS.md`. Проверка — в чате, кнопка стиля переписывания (нужен логин).

## E2E UI (Maestro)

Baseline: auth → открыть чат → отправить текст → раскрыть game island.

### Требования

1. [Maestro CLI](https://maestro.mobile.dev/docs/getting-started/installing-maestro) в PATH
2. Android-эмулятор или устройство с **dev client** / APK
3. `.env.smoke` — скопируй из `.env.smoke.example`:
   - `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD` — аккаунт **с @handle**
   - `SMOKE_TEST_PEER_HANDLE` — имя контакта в списке чатов (не Aria)
   - `MAESTRO_APP_ID` — `com.vault.messenger` или `.dev` для dev-сборки

### Запуск

```bash
# Metro / dev client уже запущен на устройстве
npm run maestro:smoke
```

Flows: `.maestro/smoke.yaml` + `subflows/*`.

### testID (Maestro selectors)

| id | Экран |
|----|-------|
| `auth-email-input` | Auth |
| `auth-password-input` | Auth |
| `auth-submit-button` | Auth |
| `chats-screen` | Chats list |
| `chat-row-{roomId}` | Chat row |
| `chat-composer-input` | Chat |
| `chat-composer-send` | Chat |
| `game-island-handle` | GameScreen |

## Что не в CI

| Проверка | Где |
|----------|-----|
| API smoke | `npm run smoke:api` — вручную перед релизом |
| Crypto smoke | dev-клиент, `global.runVaultCryptoTests` |
| E2E UI | `npm run maestro:smoke` — вручную, нужен эмулятор + Maestro CLI |
| Offline smoke CI | PR / push → `.github/workflows/smoke.yml` |
