/**
 * Межтабовый горизонтальный свайп (Pan на корне навигации).
 * Политика ниже — без отдельного модуля, чтобы не ломать сборку при удалении файлов.
 *
 * Material Top Tabs + setOptions(swipeEnabled) отключены — давали нестабильность/краши.
 */
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const TAB_ORDER = ['Chats', 'Contacts', 'Poker', 'Profile'];
const SWIPE_DISABLED_DEEPEST = new Set(['Room', 'Game', 'ChatRoom']);

function getDeepestRouteName(state) {
  let s = state;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (!r?.state) return r?.name || null;
    s = r.state;
  }
  return null;
}

function getActiveTabName(state) {
  let s = state;
  let lastTab = null;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (r?.name && TAB_ORDER.includes(r.name)) lastTab = r.name;
    s = r?.state;
  }
  return lastTab;
}

function canSwipeBetweenTabs(navigationState) {
  if (!navigationState) return false;
  const deepest = getDeepestRouteName(navigationState);
  if (deepest && SWIPE_DISABLED_DEEPEST.has(deepest)) return false;
  return true;
}

const MIN_DIST = 70;
const MIN_VELOCITY = 650;

export function useMainTabSwipeGesture(navRef) {
  const onSwipeEnd = useCallback((tx, vx) => {
    const nav = navRef.current;
    if (!nav) return;

    const state = nav.getRootState?.();
    if (!state) return;

    if (!canSwipeBetweenTabs(state)) return;

    const currentTab = getActiveTabName(state);
    if (!currentTab) return;

    const idx = TAB_ORDER.indexOf(currentTab);
    if (idx < 0) return;

    const absTx = Math.abs(tx);
    const absVx = Math.abs(vx);

    const isSwipe = absTx >= MIN_DIST || absVx >= MIN_VELOCITY;
    if (!isSwipe) return;

    const dir = tx === 0 ? (vx < 0 ? -1 : 1) : tx < 0 ? -1 : 1;
    const nextIdx = idx + (dir < 0 ? 1 : -1);
    if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;

    const nextTab = TAB_ORDER[nextIdx];
    nav.navigate?.('Main', { screen: nextTab });
  }, [navRef]);

  return useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        runOnJS(onSwipeEnd)(e.translationX ?? 0, e.velocityX ?? 0);
      });
  }, [onSwipeEnd]);
}

export function MainTabSwipeOverlay({ navRef, children }) {
  const gesture = useMainTabSwipeGesture(navRef);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
