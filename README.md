## Vault Messenger (mobile)

### Авто-фикс видеосообщений (звук обрывается раньше видео)

В репозитории есть GitHub Action `Fix chat videos (pad audio)` — он раз в 30 минут
прогоняет последние видеосообщения и, если в mp4 аудиодорожка короче видеодорожки,
делает постобработку (допад аудио тишиной до длины видео) и **перезаливает файл в тот же объект**
Supabase Storage (URL не меняется).

#### Настройка

Добавь GitHub Secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Подробности и ручной запуск: `scripts/VIDEO_PROCESSING.md`.

