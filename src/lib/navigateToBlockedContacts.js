import { navigateToProfileScreen } from './navigateToProfileScreen';

/**
 * Переход на экран списка заблокированных (вкладка Профиль).
 * @param {import('@react-navigation/native').NavigationProp<any>} [navigation]
 */
export function navigateToBlockedContacts(navigation) {
  return navigateToProfileScreen('BlockedContacts', undefined, navigation);
}
