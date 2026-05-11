# Tab swipe — стабильная схема

- **`createBottomTabNavigator`** — `MainTabsNavigator.js`.
- **Межтабовый свайп** — `Gesture.Pan` + `runOnJS` в **`MainTabSwipeOverlay`** (`useMainTabSwipeGesture.js`), политика в том же файле.
- **`App.js`** оборачивает дерево навигации в **`MainTabSwipeOverlay`**.

**Material Top Tabs + pager-view** на этом устройстве/стеке давали падения — не используем, зависимости убраны из `package.json`.

После следующего `eas build` нативная часть перестанет тащить лишний pager (до тех пор в установленном APK модуль может остаться «мертвым грузом» — не страшно).
