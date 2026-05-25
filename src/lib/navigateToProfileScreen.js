import { mainTabsNavigationApi } from '../context/MainTabsNavigationContext';

/**
 * Переход на экран внутри Profile-стека (с переключением на вкладку Профиль).
 * @param {string} screen
 * @param {object} [params]
 * @param {import('@react-navigation/native').NavigationProp<any>} [navigation]
 */
export function navigateToProfileScreen(screen, params, navigation) {
  if (mainTabsNavigationApi.navigateProfileStack?.(screen, params)) {
    return true;
  }
  if (navigation?.navigate) {
    navigation.navigate(screen, params);
    return true;
  }
  return false;
}
