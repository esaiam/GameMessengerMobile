import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring } from 'react-native-reanimated';

import { SEARCH_FIELD_LAYOUT } from '../theme';

const SEARCH_HIDE_GAP_PX = 8;
const SEARCH_OVERSCROLL_PX = 28;
const ANDROID_PULL_COEF = 0.45;
const PAN_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };

/** Отступ под полем поиска до списка (используется в ChatsScreen для paddingTop FlatList). */
export const CHATS_SEARCH_BOTTOM_SPACING_PX = 20;

export function useChatsSearchReveal(q, searchFocused, listRef) {
  const SEARCH_FIELD_H = SEARCH_FIELD_LAYOUT.chatsHeight;
  const SEARCH_REVEAL_RANGE_PX = SEARCH_FIELD_H + CHATS_SEARCH_BOTTOM_SPACING_PX;

  const [searchPointerEvents, setSearchPointerEvents] = useState('auto');
  const [listViewportH, setListViewportH] = useState(0);

  const scrollY = useSharedValue(0);
  const overscrollPull = useSharedValue(0);
  const locked = useSharedValue(false);
  const isLockedRef = useRef(false);

  useEffect(() => {
    const nextLocked = q.trim().length > 0 || searchFocused;
    isLockedRef.current = nextLocked;
    locked.value = nextLocked;
    if (nextLocked) {
      overscrollPull.value = 0;
      listRef?.current?.scrollToOffset?.({ offset: 0, animated: false });
    }
  }, [q, searchFocused, listRef, locked, overscrollPull]);

  const effectiveY = useDerivedValue(() => {
    if (locked.value) return 0;
    if (Platform.OS === 'android') {
      return scrollY.value - overscrollPull.value;
    }
    return scrollY.value;
  });

  const revealProgress = useDerivedValue(() => {
    if (locked.value) return 1;
    return 1 - effectiveY.value / SEARCH_REVEAL_RANGE_PX;
  });

  useAnimatedReaction(
    () => revealProgress.value,
    (p, prev) => {
      const shown = p > 0.02;
      const wasShown = prev == null ? true : prev > 0.02;
      if (shown !== wasShown) {
        runOnJS(setSearchPointerEvents)(shown ? 'auto' : 'none');
      }
    }
  );

  const resetOverscrollPull = useCallback(() => {
    overscrollPull.value = withSpring(0, PAN_SPRING);
  }, [overscrollPull]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.value = y;
      if (Platform.OS === 'android' && y > 2 && overscrollPull.value > 0) {
        overscrollPull.value = 0;
      }
    } });

  const onListScrollEndDrag = useCallback(() => {
    if (Platform.OS === 'android') {
      resetOverscrollPull();
    }
  }, [resetOverscrollPull]);

  const onListMomentumScrollEnd = useCallback(() => {
    if (Platform.OS === 'android') {
      resetOverscrollPull();
    }
  }, [resetOverscrollPull]);

  const setSearchShown = useCallback(
    (shown) => {
      if (!shown && isLockedRef.current) return;
      overscrollPull.value = 0;
      listRef?.current?.scrollToOffset?.({
        offset: shown ? 0 : SEARCH_REVEAL_RANGE_PX,
        animated: true });
    },
    [SEARCH_REVEAL_RANGE_PX, listRef, overscrollPull]
  );

  const listGesture = useMemo(() => {
    const native = Gesture.Native();

    if (Platform.OS !== 'android') {
      return native;
    }

    const pull = Gesture.Pan()
      .manualActivation(true)
      .onTouchesMove((_e, state) => {
        if (locked.value) {
          state.fail();
          return;
        }
        const y = scrollY.value;
        const atOpenTop = y <= 2;
        if (!atOpenTop && overscrollPull.value <= 0) {
          state.fail();
          return;
        }
        state.activate();
      })
      .onUpdate((e) => {
        if (locked.value) return;
        const y = scrollY.value;
        const atOpenTop = y <= 2;
        if (e.changeY > 0 && atOpenTop) {
          const next = overscrollPull.value + e.changeY * ANDROID_PULL_COEF;
          overscrollPull.value = Math.max(0, Math.min(SEARCH_OVERSCROLL_PX, next));
          return;
        }
        if (e.changeY < 0 && overscrollPull.value > 0) {
          const next = overscrollPull.value + e.changeY * ANDROID_PULL_COEF;
          overscrollPull.value = Math.max(0, Math.min(SEARCH_OVERSCROLL_PX, next));
        }
      })
      .onEnd(() => {
        overscrollPull.value = withSpring(0, PAN_SPRING);
      })
      .onFinalize(() => {
        overscrollPull.value = withSpring(0, PAN_SPRING);
      });

    return Gesture.Simultaneous(native, pull);
  }, [locked, overscrollPull, scrollY]);

  const searchBarStyle = useAnimatedStyle(() => {
    const p = revealProgress.value;
    const clampedP = Math.min(Math.max(p, 0), 1);
    const overscrollExtra = Math.max(p - 1, 0);
    return {
      opacity: clampedP,
      transform: [
        {
          translateY:
            interpolate(
              clampedP,
              [0, 1],
              [-(SEARCH_FIELD_H + SEARCH_HIDE_GAP_PX), 0],
              Extrapolation.CLAMP
            ) + overscrollExtra * 12 },
      ] };
  }, [SEARCH_FIELD_H]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.min(Math.max(revealProgress.value, 0), 1),
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    ) }));

  const listMinHeight =
    listViewportH > 0 ? listViewportH + SEARCH_REVEAL_RANGE_PX + 1 : undefined;

  return {
    SEARCH_FIELD_H,
    SEARCH_REVEAL_RANGE_PX,
    searchPointerEvents,
    setSearchShown,
    listGesture,
    scrollHandler,
    onListScrollEndDrag,
    onListMomentumScrollEnd,
    searchBarStyle,
    iconStyle,
    listMinHeight,
    setListViewportH };
}
