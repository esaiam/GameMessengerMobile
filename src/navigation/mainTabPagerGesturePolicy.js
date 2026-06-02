import { Platform } from 'react-native';

/** Экраны, где нативный свайп PagerView мешает нардам / чату / профилю контакта / подэкранам профиля. */
export const PAGER_SWIPE_DISABLED_DEEPEST = new Set([
  'Room',
  'ChatRoom',
  'ContactProfile',
  'InviteFriends',
  'BlockedContacts',
  'Storage',
]);

/** Опции native-stack для ContactProfile: свайп вправо → pop (iOS native; Android — useContactProfileSwipeBack). */
export const CONTACT_PROFILE_STACK_SCREEN_OPTIONS = {
  gestureEnabled: Platform.OS === 'ios',
  fullScreenGestureEnabled: true,
};

export function getDeepestRouteName(state) {
  let s = state;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (!r?.state) return r?.name || null;
    s = r.state;
  }
  return null;
}

/**
 * Эффективный «текущий» экран для таббара / pager lock.
 * На планшете чат/нарды в правой колонке (`TabletSplitShell`) не попадают в React Navigation state.
 */
export function getTabBarDeepestRoute(navigationState, splitDetailType) {
  if (splitDetailType) return splitDetailType;
  return getDeepestRouteName(navigationState);
}

/**
 * Нативный горизонтальный скролл PagerView.
 */
export function isPagerNativeScrollEnabled({ navigationState, splitDetailType }) {
  const deepest = getTabBarDeepestRoute(navigationState, splitDetailType);
  if (deepest && PAGER_SWIPE_DISABLED_DEEPEST.has(deepest)) return false;
  return true;
}
