# План нарезки `Chat.js` (без смены поведения)

Цель: **тонкий экран** + **модули с понятными именами**, чтобы новый разработчик находил логику за минуты.

## Статус (факт в репозитории)

| Фаза | Сделано |
|------|---------|
| 1 | `messageDecrypt.js`, `messageFilters.js` |
| 2 | `useMessageRowAnimations.js` |
| 3 | `useChatRoomEffects.js` (загрузка, realtime, эфемерка, read receipts; сброс `readSentRef` при смене `roomId`) |
| 4 | `useChatMediaActions.js`, `useChatSendText.js` |
| 5 | `useChatSelection.js` |
| Доп. | Мёртвые импорты в `Chat.js` убраны; `roomCode` убран из пропсов `useChatRoomEffects` (перезагрузка через `decryptBatch` ↔ ключ комнаты в родителе). |
| Копирование | `getMessageCopyText` — контекстное меню (без расшифровки); `getBatchCopyLineFromDecrypted` — мультикопирование после `decryptMsg` (`getMessageCopyText.js`). |
| Сообщения UI | `useChatMessageMutations.js` (реакции, удаление), `useChatReplyHelpers.js` (превью ответа), `useChatOptimisticVideo.js` (оптимистичное видео + refs для realtime). |
| Фаза 5+ | `useChatComposerChrome.js` — клавиатура (`keyboardHeightShared` + стили root/composer), анимация превью ответа, wobble эмодзи, `toggleEmojiPicker` / `insertEmoji`. |

`Chat.js` после нарезки ориентировочно **~820 строк** (сборка хуков + `FlatList` + модалки).

---

## Принципы

1. **Один шаг — один PR/коммит-смысл**: вынесли → прогнали ручной сценарий (отправка, медиа, удаление, realtime).
2. **Сначала чистые функции**, потом хуки с состоянием — меньше регрессий.
3. **Не плодить «god hook»**: если хук >400 строк, резать по домену (сообщения vs отправка vs медиа).
4. **Reanimated/shared values и ref’ы скролла** оставить рядом с `FlatList`, пока не устаканится хук сообщений — иначе циклические зависимости.

---

## Фаза 1 — Чистые утилиты (низкий риск)

| Файл | Содержимое |
|------|------------|
| `src/chat/messageDecrypt.js` (или `src/components/chat/`) | `decryptMsg`, `decryptBatch`, модульный кэш `decryptedCache` (как сейчас — один Map на приложение). Зависимости: `nickname`, ключ комнаты из `roomCode`, вызовы Vault/CryptoJS API. |
| `src/chat/messageFilters.js` | `filterExpired`, `filterHiddenForMe`. Для варианта «оставить удаляемые» — `filterHiddenForMeKeepingDeleting(msgs, isDeletingId)` вместо прямого доступа к ref из компонента. |

**Критерий готовности:** `Chat.js` только импортирует функции; тесты/ручная проверка расшифровки старых/новых форматов.

---

## Фаза 2 — Анимации сообщений (средний риск)

| Файл | Содержимое |
|------|------------|
| `src/components/chat/useMessageRowAnimations.js` | `fadeAnims` / `scaleAnims`, `ensureMessageAnims`, `popMessage`, эффект очистки ключей при удалении из `messages`. |

Realtime INSERT сейчас **пишет в эти maps** — хук должен отдавать стабильные ref’ы + те же объекты, что и сегодня.

---

## Фаза 3 — Данные комнаты: загрузка + канал + побочные эффекты (высокий объём, ядро)

Вынести в **один или два** хука (на выбор после Фазы 1–2):

### Вариант A (один хук)

`useChatRoomMessages({ roomId, roomCode, nickname, renderPausedRef, messageAnimRefs, … })`

Внутри:

- начальная загрузка + `roomMessagesCache`
- `supabase.channel` INSERT/UPDATE/DELETE
- интервал истечения эфемерки + delete в БД
- пометка `read_at`

### Вариант B (два хука, проще ревьюить)

1. `useChatMessagesInitialLoad(...)` — только первый fetch + merge cache + `listOpacity` (если остаётся в этом слое).
2. `useChatMessagesRealtime(...)` — channel + оптимистичное видео + миграция `activeVideoId`.

**Явно передавать** в realtime-слой: `decryptMsg`, фильтры, `optimisticVideoTempIdRef`, `pendingVideoActiveIdMigrationRef`, колбэки `setActiveVideoId` / активация видео — как сейчас, без «умных» сокрытий.

---

## Фаза 4 — Отправка и медиа

| Файл | Содержимое |
|------|------------|
| `useChatMediaPipeline.js` | `uploadMedia`, `sendMediaMessage`, при желании обёртки `pickImageFromGallery` / `takePhoto` / `sendCurrentLocation` (или оставить в экране, если много `Alert`/`setUploading`). |
| `useChatSendText.js` | `sendMessage`, `sendInProgressRef`, зависимость от `otherPlayerName`, `encryptMessage`, `replyTo`, `ephemeralSec`. |

---

## Фаза 5 — UI-состояние и жесты

| Файл | Содержимое |
|------|------------|
| `useChatSelection.js` | `selectionMode`, `selectedIds`, `exitSelectionMode`, `handleMessagePress` / long press в режиме выбора, batch delete/copy/forward. |
| `useChatComposerChrome.js` | Сделано: клавиатура, `replyTargetProgress`, wobble эмодзи, `toggleEmojiPicker`, `insertEmoji`. `listOpacity` / скролл остаются в `Chat.js`. |

---

## Что остаётся в `Chat.js` в конце

- Сборка хуков и пропсов в `ChatComposer` / `MessageRow` / `FlatList`.
- `renderItem` + `createRenderMessageContent` (или тонкая обёртка).
- Инварианты inverted-листа в **2–5 строках комментария** у `stickToBottomRef` / `onContentSizeChange`.

---

## Порядок работ (рекомендуемый)

1. Фаза 1 → Фаза 2 → Фаза 3 (самый большой выигрыш в читаемости).
2. Фаза 4 (отправка часто трогают при фичах — удобно изолировать).
3. Фаза 5 по необходимости (уже косметика для размера файла).

---

## Чего не делать

- Не вводить абстрактный «Repository» без боли — пока один бэкенд (Supabase).
- Не смешивать крипто-ключи и UI-тему.
- Не переносить игровую логику в chat-слой.

---

## Типы сообщений (сделано)

Файл `src/components/chat/chatMessageTypes.ts`: `ChatMessageType`, `ChatMessageRow`, `ChatFormattedMessageRow`, `ChatMessageReactions`.

В `.js` для подсказок: `@param {import('./chatMessageTypes').ChatMessageRow} msg` (см. `messageDecrypt.js`, `messageFilters.js`, `getMessageCopyText.js`, `chatMessageListFormat.js`).

Дальше при желании: строгий `checkJs` по `Chat.js` или отдельный тип для VM2 payload в VaultCrypto.
