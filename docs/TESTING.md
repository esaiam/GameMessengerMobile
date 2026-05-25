# Тестирование (Vault Messenger)

## CI / локально (Node)

```bash
npm run smoke          # offline: room id, VM2, media text
npm run smoke:api      # Supabase: auth, room, send/read (нужен .env.smoke)
```

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

## Что не в CI

| Проверка | Где |
|----------|-----|
| API smoke | `npm run smoke:api` — вручную перед релизом |
| Crypto smoke | dev-клиент, `global.runVaultCryptoTests` |
| E2E UI | нет |
