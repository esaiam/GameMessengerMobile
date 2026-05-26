# Подготовка к release APK (без сборки сейчас)

Чеклист до первой раздачи `app-release.apk` или EAS `production`.

## Уже сделано

- [x] Freeze кода: тег `beta-0.1.0` @ `4503dac`
- [x] `npm run smoke` + `npm run smoke:api`
- [x] Черновик для тестеров: `docs/BETA_BRIEF.md`

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

- [ ] Закоммитить все фиксы после `beta-0.1.0` (например scroll на ContactProfile)
- [ ] Опционально: тег `beta-0.1.1`
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

### 4. После APK

- [ ] Вставить ссылку на APK в `docs/BETA_BRIEF.md`
- [ ] Раздать тестерам + канал багов
- [ ] P0.4 security reconcile prod (Storage, дубли RLS) — по плану

## Не блокирует черновик brief

- EAS quota / локальный Gradle
- Privacy Policy URL (нужен перед Play Store, не для 10 друзей с APK в Telegram)

## Env для smoke перед каждым релизом

```bash
npm run smoke
npm run smoke:api   # .env.smoke
```
