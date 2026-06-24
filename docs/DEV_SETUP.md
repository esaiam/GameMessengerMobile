# Dev setup — Vault Messenger (новая машина)

> **Переезд с другого ПК:** этот файл — главный чеклист. Секреты в git **не** лежат — переноси вручную.

**Обновлено:** 2026-06-24  
**Ветка:** `tab-pager-experiment`  
**Submodule в `Table`:** `GameMessengerMobile` → https://github.com/esaiam/GameMessengerMobile

---

## 1. Репозиторий

### Вариант A — только mobile (достаточно для разработки APK)

```powershell
git clone https://github.com/esaiam/GameMessengerMobile.git
cd GameMessengerMobile
git checkout tab-pager-experiment
```

### Вариант B — монорепо `Table` (submodule + Aria prompts)

```powershell
git clone --recurse-submodules https://github.com/esaiam/Table.git
cd Table
git submodule update --init --recursive
```

Если клонировали без submodules:

```powershell
git submodule update --init --recursive
```

Структура `Table`:

| Путь | Назначение |
|------|------------|
| `GameMessengerMobile/` | React Native / Expo (основной код) |
| `aria/core/aria_prompt.py` | Промпты Aria для сервера |
| `docs/vault_session_summary.md` | Аудит security + ссылки |
| `.cursor/rules/` | Правила для Cursor |

---

## 2. Софт (Windows)

| Инструмент | Версия / заметка |
|------------|------------------|
| **Node.js** | LTS 20+ (`node -v`) |
| **npm** | идёт с Node |
| **Git** | для submodule |
| **Android Studio** | SDK 34+, Build-Tools, platform-tools (`adb`) |
| **JDK** | 17 (для Gradle) |
| **Expo / EAS** | `npm i -g eas-cli` (опционально, для облачных сборок) |
| **Supabase CLI** | `npx supabase` (миграции, `db query --linked`) |
| **Maestro** | опционально, E2E — см. `docs/TESTING.md` |

Проверка Android:

```powershell
adb devices
```

---

## 3. Секреты и env (перенести вручную!)

Файлы **в .gitignore** — на новой машине создать заново:

### `GameMessengerMobile/.env`

Скопируй с старого ПК или из `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://nqssqplizwsukowggzxd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
EXPO_PUBLIC_ARIA_API_URL=http://<LAN-IP-этого-ПК>:8001
```

- **LAN IP:** `ipconfig` → Wi‑Fi IPv4 (не `127.0.0.1`), если телефон в той же сети.
- **Эмулятор на том же ПК:** можно `http://127.0.0.1:8001` или `http://10.0.2.2:8001` (Android emulator → host).
- После смены сети / ПК — **обновить IP** в `.env`, `eas.json` (dev/prod env) и при необходимости `ARIA_LITE_LOCAL_URL` в `src/lib/aria.js`.

### `GameMessengerMobile/.env.smoke`

Для `npm run smoke:api` и Maestro. Шаблон — `.env.smoke.example` (если есть в репо) или копия со старой машины:

- `SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD`
- `SMOKE_TEST_PEER_HANDLE`
- `MAESTRO_APP_ID` — `com.vault.messenger` или dev variant

### Никогда не коммитить

- `vault-*.json` (Firebase service account)
- `.env`, `.env.smoke`
- `service_role` key
- Любые `.pem` / keystore пароли

`google-services.json` — **в репо** (норма для FCM). При смене keystore — обновить SHA-1 в Google Cloud Console.

---

## 4. Установка зависимостей

```powershell
cd GameMessengerMobile
npm install
```

`postinstall` патчит `react-native-libsodium` и `expo-video-audio-extractor` под Windows — дождись окончания.

Проверка env (только `EXPO_PUBLIC_*` в клиенте):

```powershell
npm run verify:env
```

---

## 5. Supabase

**Проект:** `nqssqplizwsukowggzxd` (game-messenger)

```powershell
npx supabase login
npx supabase link --project-ref nqssqplizwsukowggzxd
```

Новые миграции (после clone) — см. `supabase/migrations/README.md`.  
Для prod применять **только новые** файлы, не весь каталог подряд на живых данных.

Актуальная миграция для Aria push (2026-06-19):

- `supabase/migrations/20260619_profiles_push_token.sql` — колонка `profiles.push_token`

---

## 6. Aria (локально / VPS)

- Порт **8001** (lite), не 8000.
- Клиент: `EXPO_PUBLIC_ARIA_API_URL` или авто из Metro host (`src/lib/aria.js`).
- JWT: Aria API принимает Supabase `access_token` (`getAriaAuthHeaders`).
- Промпты: `Table/aria/core/aria_prompt.py` (на сервере).

На **release APK** нужен **HTTPS VPS**, не `192.168.x.x` — см. `docs/RELEASE_PREP.md`.

---

## 7. Запуск dev

```powershell
cd GameMessengerMobile
npx expo start
```

- **Dev client** (не Expo Go) — нативные модули: libsodium, dice, push.
- Первый раз на новой машине с нативным кодом:

```powershell
npx expo prebuild --platform android
```

Открыть `android/` в Android Studio → Run на устройстве / эмуляторе.

---

## 8. Smoke перед работой

```powershell
npm run smoke
npm run smoke:api    # нужен .env.smoke
```

CI (offline smoke): `.github/workflows/smoke.yml` на PR.

---

## 9. Edge Functions

ИИ-редактор, GIF, картинки — Supabase Edge. Деплой и секреты: **`docs/EDGE_FUNCTIONS.md`**.

---

## 10. Чеклист переезда (кратко)

- [ ] Clone + `git checkout tab-pager-experiment`
- [ ] `npm install` в `GameMessengerMobile`
- [ ] Перенести `.env` и `.env.smoke`
- [ ] Обновить `EXPO_PUBLIC_ARIA_API_URL` / LAN IP
- [ ] `npm run verify:env` + `npm run smoke` + `npm run smoke:api`
- [ ] Supabase CLI `link` (если миграции)
- [ ] Android SDK + `adb devices`
- [ ] Dev client / prebuild при первом native run
- [ ] Firebase: при новом debug keystore — SHA-1 в GCP
- [ ] Не копировать `vault-*.json` в git / облако без шифрования

---

## Связанные документы

| Файл | Зачем |
|------|--------|
| `docs/MVP_READINESS.md` | Бета / блокеры |
| `docs/RELEASE_PREP.md` | Release APK |
| `docs/TESTING.md` | Smoke, Maestro, crypto |
| `docs/EDGE_FUNCTIONS.md` | Groq / edge deploy |
| `docs/PROD_SECURITY_CHECKLIST.md` | Prod SQL §1–§7 |
| `../docs/vault_session_summary.md` | Аудит (корень `Table`) |
