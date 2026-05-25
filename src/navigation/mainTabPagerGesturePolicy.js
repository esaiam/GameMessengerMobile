import { Platform } from 'react-native';

/** Экраны, где нативный свайп PagerView мешает нардам / чату / профилю контакта. */
export const PAGER_SWIPE_DISABLED_DEEPEST = new Set(['Room', 'ChatRoom', 'ContactProfile']);

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
 * Нативный горизонтальный скролл PagerView.
 * Только по стеку навигации — split-detail не учитываем (иначе ломаются тапы в ChatsList).
 */
export function isPagerNativeScrollEnabled({ navigationState }) {
  const deepest = getDeepestRouteName(navigationState);
  if (deepest && PAGER_SWIPE_DISABLED_DEEPEST.has(deepest)) return false;
  return true;
}
