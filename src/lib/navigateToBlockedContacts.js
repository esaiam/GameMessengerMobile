/**
 * Переход на экран списка заблокированных (вкладка Профиль).
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 */
export function navigateToBlockedContacts(navigation) {
  const tabNav = navigation?.getParent?.();
  if (tabNav?.navigate) {
    tabNav.navigate('Profile', { screen: 'BlockedContacts' });
    return true;
  }
  return false;
}
