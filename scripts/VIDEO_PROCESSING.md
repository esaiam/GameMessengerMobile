## Видео: исправление “звук обрывается, видео идёт”

### Суть
Некоторые `mp4`, записанные через `expo-camera`, могут получить **audio track короче video track**. Тогда под конец звук заканчивается, а картинка продолжает.

Скрипт `scripts/process-chat-videos.mjs` делает постобработку:
- читает длительность видео,
- **дополняет аудио тишиной** до длины видео,
- загружает фикс обратно **в тот же объект** Supabase Storage (upsert), чтобы текущие `publicUrl` не менялись.

### Требования
- Node.js 18+
- `ffmpeg` и `ffprobe` в `PATH`
- env:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (НЕ коммитить)

### Запуск

#### Починить один ролик по `publicUrl`

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/process-chat-videos.mjs --url "https://.../storage/v1/object/public/chat-media/video/....mp4"
```

#### Починить последние N видеосообщений (по таблице `messages`)

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/process-chat-videos.mjs --latest 50
```

#### Dry-run (без загрузки результата)

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
node scripts/process-chat-videos.mjs --latest 20 --dry-run
```

### Замечания
- Если видео **без аудиодорожки** — скрипт пропускает.
- Если длительность не читается (сломанный metadata) — скрипт пропускает.
- Если аудио уже совпадает с видео (в пределах 150ms) — скрипт пропускает.

