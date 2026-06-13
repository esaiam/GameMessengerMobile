# Vault Messenger — готовность к MVP / закрытой бете

> **Для агента:** если пользователь спрашивает про готовность к MVP, бете или «что осталось» — **сначала прочитай этот файл**, затем `RELEASE_PREP.md`, `BETA_BRIEF.md`, `PROD_SECURITY_CHECKLIST.md`.  
> **Обновляй этот файл** после крупных вех (APK, VPS, P1).

**Последнее обновление:** 2026-06-13

---

## Вердикт (кратко)

| Уровень | Статус |
|---------|--------|
| **Закрытая бета (10–30 человек, invite)** | **Почти готово** — ждём **VPS (Aria)** + **release APK** + раздачу |
| **Публичный MVP / Store** | **Нет** — после беты: Sentry (crash reporting) |

---

## Уже сделано (не повторять как блокеры)

### Код и freeze
- Ветка: `tab-pager-experiment`
- Тег: `beta-0.1.0` @ `4503dac`; дальше фиксы до `c079c4c`+ (scroll ContactProfile, `__DEV__` логи media, docs)
- `Table` submodule bump делался (проверь актуальный SHA: `git ls-tree HEAD GameMessengerMobile` в корне `Table`)

### QA автomatika
- `npm run smoke` — OK
- `npm run smoke:api` — OK (нужен `.env.smoke`)
- **CI:** `.github/workflows/smoke.yml` — offline smoke на PR / push в main
- **Maestro baseline:** `.maestro/smoke.yaml` — auth → chat → send → game (ручной запуск, `npm run maestro:smoke`)
- **Error Boundary:** `VaultErrorBoundary` в `App.js` (Sentry — перед APK)

### Документация
- `docs/BETA_BRIEF.md` — brief для тестеров; баги → **esaiam86@gmail.com**, тема `Vault beta`; **APK = TBD**
- `docs/RELEASE_PREP.md` — чеклист до первой APK
- `docs/PROD_SECURITY_CHECKLIST.md` — SQL-сверка prod

### Security prod (ручная сверка 2026-05-26)
- §1 RLS `rooms`/`messages`/`game_sessions` — participant OK; ~~дубли legacy~~ → миграция `20260615_drop_legacy_rls_policies.sql`
- §2 `users` — нет
- §3 `vault_public_keys` — OK
- §4 storage `chat-media` — **исправлено:** убран `chat-media anon insert`
- §5 push plaintext — **отложено до release APK** (тест на шторке)
- §6 anon EXECUTE — список короткий, beta OK; опционально REVOKE на trigger-функции
- §7 клиент — OK (`EXPO_PUBLIC_*` only, `npm run verify:env`)

### Secrets
- `vault-*.json` убран с диска (P0.5)

### Сознательно снято с очереди
- **Aria «push есть — лента пустая»** — пользователь подтвердил: **баг закрыт**, не поднимать
- **DM policy («кто может писать»)** — **не продукт Vault**: invite-only мессенджер, комната = пара; блокировка уже на сервере (`blocked_peers`). UI и `profileSettings.js` без policy; server-side policy не планируется

### Аккаунт, контакты, legal
- **Удаление аккаунта** — кнопка в `ProfileScreen`, RPC `delete_user_account` (Supabase), каскадное удаление данных пользователя
- **Удаление контакта** — RPC `delete_contact_room` (`useContactProfileActions.js`), физическое удаление `room` и `messages` из БД
- **Privacy Policy** — https://esaiam.github.io/vault-privacy-policy, контакт: **vaultprivacy06@gmail.com**

---

## Ждём пользователя (главные блокеры раздачи)

1. **VPS** — Aria API для prod  
   - В `eas.json` → `production.env` добавить `EXPO_PUBLIC_ARIA_API_URL` (HTTPS, не LAN IP)  
   - Проверка с телефона вне Wi‑Fi

2. **Release APK**  
   - EAS production (квота free была исчерпана ~2026-06-01) **или** Android Studio → variant `release`  
   - Пакет: `com.vault.messenger` + `google-services.json`  
   - После сборки: ссылка в `BETA_BRIEF.md`

3. **Шаг 4 (ручной)** — `docs/chat-regression-checklist.md` на dev-сборке (~10 мин)

4. **§5 push** — после APK: E2E-сообщение → текст на шторке **не** = plaintext чата

---

## P1 — после первой волны беты (не блокирует старт)

- Sentry + `captureException` в `VaultErrorBoundary` (перед release APK)
- ~~Error Boundary~~ — **сделано:** `src/components/VaultErrorBoundary.js`
- ~~Блокировка на сервере~~ — **сделано:** `blocked_peers` + `blockedContacts.js`
- ~~Удаление аккаунта~~ — **сделано:** RPC `delete_user_account`
- ~~Удаление контакта~~ — **сделано:** RPC `delete_contact_room`
- ~~Privacy Policy~~ — **сделано:** https://esaiam.github.io/vault-privacy-policy
- ~~CI smoke на PR~~ — **сделано:** `.github/workflows/smoke.yml`
- Maestro E2E — baseline в `.maestro/`; прогон вручную (`npm run maestro:smoke`)
- Вкладка **Poker / Tamagotchi** — P1 backlog (сейчас 3 таба)
- **Переслать** — заглушка; **закрепить** — уже в чате (`useChatPinnedMessage`)

---

## Опциональный SQL — legacy RLS cleanup

**Миграция:** `supabase/migrations/20260615_drop_legacy_rls_policies.sql` (зеркало в `docs/migrations/`)

- DROP legacy RLS на `rooms` + `game_sessions` (оставляет `*participant*`)
- REVOKE `anon EXECUTE` на trigger-функции (`purge_message_if_hidden_for_all`, …)
- В конце — SELECT для проверки оставшихся политик

**Применить:** SQL Editor на prod **или** `npm run db:migrate:apply` (Supabase CLI linked).

После применения: `npm run smoke:api` + быстрый чат/игра в dev.

---

## Как отвечать пользователю «готовы к MVP?»

1. Различай **узкую закрытую бету** vs **store MVP**.  
2. Если нет APK + VPS — статус: **«prep готов, раздача ждёт VPS + release APK»**.  
3. Не поднимать закрытый баг Aria push/пустая лента.  
4. Указать актуальный commit: `git -C GameMessengerMobile rev-parse HEAD`.  
5. Напомнить известные ограничения из `BETA_BRIEF.md` § «Не баг».

---

## Связанные файлы

| Файл | Назначение |
|------|------------|
| `ROADMAP.md` | Исторический roadmap + P1/P2 |
| `docs/BETA_BRIEF.md` | Текст для тестеров |
| `docs/RELEASE_PREP.md` | До первой APK |
| `docs/PROD_SECURITY_CHECKLIST.md` | Supabase SQL |
| `docs/TESTING.md` | smoke / crypto |
| `Table/docs/vault_session_summary.md` | Аудит security (может расходиться с prod — сверять чеклистом) |
