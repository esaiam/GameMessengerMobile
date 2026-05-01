# Где обновляется список сообщений (`setMessages`)

Карта для шага **B (батчинг)** — менять по одному источнику за раз.

| Файл | Назначение |
|------|------------|
| `src/components/chat/useChatRoomEffects.js` | Кеш комнаты при открытии; загрузка истории из Supabase; **realtime** `postgres_changes` (INSERT / UPDATE / DELETE); таймер эфемерки (раз в 1 с при наличии `expires_at`). |
| `src/components/Chat.js` | Ветка Aria: typing / отправка через `sendToAria`, откат при ошибке. |
| `src/components/chat/useChatSelection.js` | Удаление «для меня» из режима выбора (patch списка). |
| `src/components/chat/useChatOptimisticVideo.js` | Оптимистичное видео + снятие temp id. |
| `src/components/chat/useChatMessageMutations.js` | Удаление сообщений (обычное / для всех). |
| `src/components/chat/useChatMediaActions.js` | Обновление локального списка после загрузки медиа. |

**Realtime INSERT:** несколько подряд расшифрованных INSERT складываются в очередь и сливаются в **один** `setMessages` за `queueMicrotask` (`useChatRoomEffects.js`). UPDATE/DELETE без изменений.
