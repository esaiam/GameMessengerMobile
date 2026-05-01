# Tab swipe — актуально

Документ для разработчика.

## Текущая реализация (стабильная)

- **`createBottomTabNavigator`** — главные вкладки (`MainTabsNavigator.js`).
- **Межтабовый свайп** — `Gesture.Pan` в **`MainTabSwipeOverlay`** (`useMainTabSwipeGesture.js`), обёртка в **`App.js`** вокруг дерева навигации.
- Политика «не свайпать на чате/нардах» задана **в том же файле**, что и жест (`TAB_ORDER`, `SWIPE_DISABLED_DEEPEST`) — без отдельного модуля.

## Отключено (нестабильно на устройстве)

- **Material Top Tabs + `react-native-pager-view`** и **`setOptions({ swipeEnabled })`** на вложенных экранах — отказались из‑за падений/гонок.

## Зависимости

Пакеты `@react-navigation/material-top-tabs` и `react-native-pager-view` из проекта убраны. Если когда‑нибудь вернёшь pager — снова `expo install` и **новая сборка APK**.

## Ручной регресс

Корни табов → свайп; `ChatRoom` / `Room` / `Game` → межтабовый свайп не переключает вкладки; чат и шифрование не связаны с навигатором табов.
