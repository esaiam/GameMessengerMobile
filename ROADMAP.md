# Roadmap — Vault Messenger

> Фазы 1–8 ниже — **исторический** трек «Нарды Онлайн» (логин по нику, amber/twrnc). Актуальный продукт: **Vault Messenger** (auth, чаты, E2E, нарды в комнате). Статус MVP-блокеров — в конце файла.

## Фаза 1–8 — архив (выполнено в ранней версии)

<details>
<summary>Развернуть старый чеклист</summary>

### Фаза 1 — Инфраструктура
- [x] Expo, зависимости, навигация, Supabase, SQL

### Фаза 2 — Авторизация (legacy: ник)
- [x] Логин по нику, AsyncStorage, автологин, выход

### Фаза 3 — Лобби
- [x] Комнаты по коду, список, poll 5s

### Фаза 4–8 — Нарды, realtime, чат, twrnc/amber UI
- [x] Игровая логика, доска, мультиплеер, чат, стилизация

</details>

## Фаза 9 — Деплой и финал (игра)
- [x] SQL миграции, Metro bundle, git
- [x] Анимации кубиков, haptic, таймер хода
- [x] Без истории матчей / winner в БД (по замыслу)
- [ ] Система рейтинга
- [ ] Звуковые эффекты (кроме dice roll)
- [ ] **Звонки** (голос/видео) — WebRTC или SDK; входящий в фоне *(заглушка «скоро» в UI)*

---

## MVP (2026-05) — статус

- [x] Миграции БД: `last_message`, purge hidden, pg_cron, push + Vault
- [x] RLS на prod — participant-политики, не `supabase_setup_v2` как есть
- [x] Регрессия чата (ручной чеклист)
- [x] Профиль контакта: block / delete / контакты (локально + `hidden_for`)
- [x] Жесты на фото в чате
- [x] Prod-логи: `console.*` только в `__DEV__` (кроме фатальных `console.error`)
- [x] Удалён опасный `scripts/fix-messages-rls-update-delete.sql`

---

## P1 — после ограниченной беты

### Наблюдаемость (сейчас ≈ ноль в prod)

В prod нет crash reporting, error tracking и метрик — падения у тестеров видны только если напишут; кроме `console.error` на bootstrap/libsodium обратной связи нет.

- [ ] **Crash reporting** — [Sentry](https://sentry.io) (`@sentry/react-native` + EAS): падения, необработанные ошибки, версия сборки, stack trace, алерты
- [ ] **Error boundaries** — необработанные ошибки React-дерева не теряются молча (связка с Sentry)
- [ ] *(опционально)* базовые метрики отправки / realtime reconnect — после Sentry, если нужно для широкой беты

### Качество / QA

> **E2E encryption** (VM2 + libsodium) — уже есть. Ниже — **E2E UI** (автотесты сценариев в приложении).

- [ ] **E2E UI-тесты** — Detox или Maestro: auth → чат → отправка текста/медиа → reply; прогон в CI или перед релизным APK. Сейчас только `npm run smoke` / `smoke:api` (Node) и ручной `docs/chat-regression-checklist.md`

### Продукт
- [ ] **Aria** — серверная история / sync; fix «пуш пришёл — в чате пусто»
- [ ] **DM policy** на сервере (сейчас только AsyncStorage)
- [ ] **Блокировка** на сервере (сейчас локальный список)
- [ ] Вкладка **Poker** → переименовать (сейчас Tamagotchi)
- [ ] Удаление аккаунта: cascade `auth.users` + storage
- [ ] Контекстное меню: переслать / закрепить (сейчас «в разработке»)

### Инфра
- [ ] Storage RLS: `chat-media` (публичный read/anon insert в `supabase_setup_v2.sql` — сверить с prod)
- [ ] Cleanup дублирующих RLS policies на prod (`Users can read own rooms` vs `rooms_*_participant`)
- [x] Пометить `supabase_setup_v2.sql` как **legacy / не для prod**

---

## P2 — техдолг и мусор

### God-components (рефакторинг без смены поведения)
- [x] `Chat.js` — вынесены inline media, clear history, input settling, message list, overlays (`src/components/chat/*`)
- [x] `GameScreen.js` — board vs chat chrome → `src/screens/game/*` (~454 строк wiring)
- [x] `ContactsDrawer.js` → `src/components/contacts/*` (~95 строк wiring)
- [ ] **`VoiceRecorder.tsx` + `VideoRecorder.tsx`** (~1388 + ~594 строк) — разделение процессов без смены UX:
  - Сейчас: `VideoRecorder` не мусор — рендерится **внутри** `VoiceRecorder`; общая кнопка микрофона, переключение Mic ↔ Video, hold → голос или inline-видео в круге
  - Цель: вынести общее (жесты hold/lock/cancel, haptic, layout капсулы) в shared-слой; **аудио** (`expo-audio`, waveform, trim/pause) и **видео** (`expo-camera`, upload, optimistic bubble) — отдельные модули/хуки с похожим API, но разными пайплайнами
  - Wiring в `ChatComposer` остаётся одной точкой; поведение для пользователя не менять

### Дубли и legacy
- [x] Handle: `PickHandleScreen` + `ProfileEditHandleModal` → `src/lib/handleProfile.js`
- [x] E2E: только VM2 + libsodium (`VaultCrypto`); CryptoJS/room-key удалены; `20260524_clear_messages_pre_beta.sql`
- [x] `NICKNAME_STORAGE_KEY` → `@vault_nickname` + миграция из `@backgammon_nickname` (`nicknameStorage.js`, `RootBootstrap`)
- [ ] **twrnc** + **Lumenmorphism** (`StyleSheet` + `V.*`) — два стилевых стека; постепенно унифицировать
- [ ] `ROADMAP` фазы 1–8 не отражают текущий продукт *(этот файл обновлён)*

### Зависимости
- [x] Удалён **`@shopify/react-native-skia`** (в `src` не использовался; dice = Three.js + expo-gl)
- [x] `expo-av` удалён — голос/звуки только `expo-audio` (`useVoicePlayer`, VoiceRecorder, diceSound, Aria)
- [x] `EXPO_PUBLIC_XAI_API_KEY` — edge `ai-rewrite` + `GROQ_API_KEY` (деплой: `docs/EDGE_FUNCTIONS.md`)

### Качество (smoke / crypto)
- [x] Минимальные smoke-тесты — `npm run smoke` (offline), `npm run smoke:api` (Supabase + `SMOKE_TEST_*` в `.env`)
- [x] Тексты ошибок в `useChatMessageMutations` → `chatMutationErrorMessage.js` (RLS/сеть/сессия)
- [x] `vaultCryptoSmokeTests.ts` — dev-only (`global.runVaultCryptoTests`, `docs/TESTING.md`, `npm run smoke:crypto` — hint)
- [ ] E2E UI — см. **P1 → Качество / QA** (не путать с E2E encryption VM2)

---

## Бэклог — Aria

- [ ] Хранить переписку с Aria в Supabase; unread/preview как у DM; убрать расхождение push vs пустой чат при сворачивании приложения.
