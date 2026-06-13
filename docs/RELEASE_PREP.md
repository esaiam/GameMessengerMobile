# Подготовка к release APK (без сборки сейчас)

Чеклист до первой раздачи `app-release.apk` или EAS `production`.

## Уже сделано

- [x] Freeze кода: тег `beta-0.1.0` @ `4503dac`; далее `53578b3` (scroll + docs)
- [x] `Table` submodule → `53578b3`
- [x] `npm run smoke` + `npm run smoke:api`
- [x] Черновик для тестеров: `docs/BETA_BRIEF.md`
- [x] P0.5 аудит secrets (см. ниже) — **ручное:** убрать `vault-*.json` с диска

## Secrets (P0.5) — до APK

| Проверка | Статус |
|----------|--------|
| `vault-*.json` в `.gitignore` (корень `Table`) | OK |
| `vault-*.json` не в `git ls-files` | OK |
| Файл на диске `Table/vault-54acb-*.json` | **P0.5:** убран с диска — **перепроверить** перед APK; не хранить в репо / бэкапах git |
| `service_role` не в клиентском коде | OK (только anon / publishable) |
| `google-services.json` в mobile | В git (норма для FCM); ключи ограничить в Google Cloud |

**Рекомендация:** после переноса SA-json — ротация ключа в Firebase/GCP, если файл когда-либо светился.

При подозрении на утечку: `git log --all --full-history -- vault-*.json` в `Table`.

## Перед сборкой

### 1. VPS (Aria / полноценный prod)

- [ ] Поднять Aria-lite (или аналог) на VPS, HTTPS или HTTP только для internal beta
- [ ] В `eas.json` → `production.env` добавить:
  ```json
  "EXPO_PUBLIC_ARIA_API_URL": "https://your-vps.example:8001"
  ```
- [ ] Проверить с телефона (не LAN): чат Aria → ответ бота
- [ ] При необходимости: edge / firewall, не светить `192.168.x.x` в release

### 2. Код

- [x] Фиксы после `beta-0.1.0` @ `414b3fd` (chat refactor, beta QA infra)
- [ ] Опционально: тег `beta-0.1.1` перед APK
- [ ] Прогон `docs/chat-regression-checklist.md` на dev-сборке

### 3. Сборка APK (когда готов)

**Вариант A — Android Studio**

1. `GameMessengerMobile/android` → Build Variant **release**
2. Build → Build APK(s)
3. Артефакт: `android/app/build/outputs/apk/release/app-release.apk`
4. Release сейчас подписан debug keystore — ок для узкой беты; для Play — свой keystore

**Вариант B — EAS** (после сброса квоты / paid)

```bash
npx eas build -p android --profile production --non-interactive
```

### 4. Security prod (P0.4) — до APK, без Studio

Чеклист + SQL: **`docs/PROD_SECURITY_CHECKLIST.md`** → блоки в **`docs/SECURITY_INVENTORY_0_1.sql`** (Supabase SQL Editor).

- [ ] Пройден чеклист §1–7
- [ ] Storage `chat-media`: INSERT = `authenticated`, не `anon`
- [ ] Дубли RLS убраны
- [ ] Push без plaintext

### 5. После APK

- [ ] Вставить ссылку на APK в `docs/BETA_BRIEF.md`
- [ ] Раздать тестерам + канал багов

## Не блокирует черновик brief

- EAS quota / локальный Gradle

## Legal (готово)

- [x] **Privacy Policy** — https://esaiam.github.io/vault-privacy-policy (контакт: vaultprivacy06@gmail.com)
- [x] **Удаление аккаунта** — `ProfileScreen` → RPC `delete_user_account`, каскад в Supabase
- [x] **Удаление контакта** — RPC `delete_contact_room`, физическое удаление room + messages

## Env для smoke перед каждым релизом

```bash
npm run smoke
npm run smoke:api   # .env.smoke
```
