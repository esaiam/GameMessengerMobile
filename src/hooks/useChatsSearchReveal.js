import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { shouldFailHorizontalPan, VERTICAL_PAN_FAIL_OFFSET_X } from '../lib/verticalPanAxis';
import { SEARCH_FIELD_LAYOUT } from '../theme';
import { tabOverscrollRubberBand } from './useAndroidTabOverscroll';

const SPRING = { damping: 22, stiffness: 240, mass: 0.85 };
const AT_TOP_THRESHOLD_PX = 12;
const SNAP_OPEN_THRESHOLD = 0.38;
const SNAP_SETTLED_EPS = 0.04;
const SEARCH_DRAG_MIN_DY_PX = 4;
const POINTER_OPEN_THRESHOLD = 0.06;
const POINTER_CLOSE_THRESHOLD = 0.02;

function snapExpandedTo(expanded, target) {
  'worklet';
  cancelAnimation(expanded);
  if (Math.abs(expanded.value - target) < SNAP_SETTLED_EPS) {
    expanded.value = target;
    return;
  }
  expanded.value = withSpring(target, SPRING);
}

function applySearchDragFromTranslation(
  expanded,
  contentOverscrollY,
  dragStartExpanded,
  translationY,
  revealRangePx,
) {
  'worklet';
  const raw = dragStartExpanded + translationY / revealRangePx;
  if (raw <= 1) {
    expanded.value = Math.max(0, raw);
    contentOverscrollY.value = 0;
  } else {
    expanded.value = 1;
    contentOverscrollY.value = tabOverscrollRubberBand((raw - 1) * revealRangePx);
  }
}

function computeListScrollEnabled(atTop, open, drag) {
  'worklet';
  if (drag) return false;
  return !(atTop && !open);
}

/** Отступ под полем поиска до списка. */
export const CHATS_SEARCH_BOTTOM_SPACING_PX = 20;

/**
 * Collapsible поиск: один Pan, progress следует за translationY до отпускания.
 * pointerEvents / scrollEnabled — без runOnJS на каждый кадр (Android jank).
 */
export function useChatsSearchReveal(q, searchFocused) {
  const SEARCH_FIELD_H = SEARCH_FIELD_LAYOUT.chatsHeight;
  const SEARCH_REVEAL_RANGE_PX = SEARCH_FIELD_H + CHATS_SEARCH_BOTTOM_SPACING_PX;

  const expanded = useSharedValue(0);
  const listScrollY = useSharedValue(0);
  const listMaxScrollY = useSharedValue(0);
  const locked = useSharedValue(false);
  const dragStartExpanded = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const contentOverscrollY = useSharedValue(0);
  const searchDragActive = useSharedValue(false);
  const searchPointerOpen = useSharedValue(0);
  const listScrollEnabledSv = useSharedValue(0);

  const isLockedRef = useRef(false);
  const searchDragActiveRef = useRef(false);
  const listScrollEnabledRef = useRef(false);

  const setSearchDragActiveJs = useCallback((active) => {
    searchDragActiveRef.current = active;
  }, []);

  const setListScrollEnabledIfChanged = useCallback((enabled) => {
    if (listScrollEnabledRef.current === enabled) return;
    listScrollEnabledRef.current = enabled;
    listScrollEnabledSv.value = enabled ? 1 : 0;
  }, [listScrollEnabledSv]);

  const setExpanded = useCallback(
    (open, animated = true) => {
      cancelAnimation(expanded);
      expanded.value = animated ? withSpring(open ? 1 : 0, SPRING) : open ? 1 : 0;
    },
    [expanded],
  );

  useEffect(() => {
    const nextLocked = q.trim().length > 0 || searchFocused;
    isLockedRef.current = nextLocked;
    locked.value = nextLocked;
    if (nextLocked) {
      setExpanded(true, false);
    }
  }, [q, searchFocused, locked, setExpanded]);

  useAnimatedReaction(
    () => ({
      value: expanded.value,
      drag: searchDragActive.value,
    }),
    ({ value, drag }) => {
      if (drag) {
        searchPointerOpen.value = value > 0.001 ? 1 : 0;
        return;
      }
      const wasOpen = searchPointerOpen.value > 0.5;
      const nextOpen = wasOpen ? value > POINTER_CLOSE_THRESHOLD : value > POINTER_OPEN_THRESHOLD;
      searchPointerOpen.value = nextOpen ? 1 : 0;
    },
  );

  useAnimatedReaction(
    () => {
      if (searchDragActive.value) return null;
      return {
        atTop: listScrollY.value <= AT_TOP_THRESHOLD_PX,
        open: expanded.value > 0.001,
      };
    },
    (cur, prev) => {
      if (cur == null) return;
      const enabled = !(cur.atTop && !cur.open);
      const prevEnabled =
        prev == null ? !enabled : !(prev.atTop && !prev.open);
      if (enabled !== prevEnabled) {
        runOnJS(setListScrollEnabledIfChanged)(enabled);
      }
    },
    [setListScrollEnabledIfChanged],
  );

  const setSearchShown = useCallback(
    (shown) => {
      if (!shown && isLockedRef.current) return;
      setExpanded(shown, true);
    },
    [setExpanded],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      listScrollY.value = e.contentOffset.y;
      listMaxScrollY.value = Math.max(
        0,
        e.contentSize.height - e.layoutMeasurement.height,
      );
    },
  });

  const pullGesture = useMemo(() => {
    return Gesture.Pan()
      .manualActivation(true)
      .failOffsetX([-VERTICAL_PAN_FAIL_OFFSET_X, VERTICAL_PAN_FAIL_OFFSET_X])
      .onTouchesDown((e) => {
        'worklet';
        const t = e.allTouches[0];
        if (!t) return;
        panStartX.value = t.x;
        panStartY.value = t.y;
      })
      .onTouchesMove((e, state) => {
        'worklet';
        if (locked.value) {
          state.fail();
          return;
        }
        const atTop = listScrollY.value <= AT_TOP_THRESHOLD_PX;
        const searchOpen = expanded.value > 0.001;
        if (!atTop && !searchOpen) {
          state.fail();
          return;
        }
        const t = e.allTouches[0];
        if (!t) return;
        const movingUp = t.y < panStartY.value;
        const atEnd =
          listMaxScrollY.value >= 0 &&
          listScrollY.value >= listMaxScrollY.value - 3;
        if (!searchOpen && atEnd && movingUp) {
          state.fail();
          return;
        }
        const dx = Math.abs(t.x - panStartX.value);
        const dy = Math.abs(t.y - panStartY.value);
        if (shouldFailHorizontalPan(dx, dy)) {
          state.fail();
          return;
        }
        const minDy = atTop && !searchOpen ? 2 : SEARCH_DRAG_MIN_DY_PX;
        if (dy < minDy || dy <= dx) {
          return;
        }
        state.activate();
      })
      .onStart(() => {
        'worklet';
        searchDragActive.value = true;
        runOnJS(setSearchDragActiveJs)(true);
        runOnJS(setListScrollEnabledIfChanged)(false);
        cancelAnimation(expanded);
        cancelAnimation(contentOverscrollY);
        contentOverscrollY.value = 0;
        dragStartExpanded.value = expanded.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (locked.value) return;
        applySearchDragFromTranslation(
          expanded,
          contentOverscrollY,
          dragStartExpanded.value,
          e.translationY,
          SEARCH_REVEAL_RANGE_PX,
        );
      })
      .onEnd(() => {
        'worklet';
        cancelAnimation(contentOverscrollY);
        contentOverscrollY.value = 0;
        if (locked.value) {
          expanded.value = 1;
          return;
        }
        if (expanded.value >= SNAP_OPEN_THRESHOLD) {
          snapExpandedTo(expanded, 1);
        } else {
          snapExpandedTo(expanded, 0);
        }
      })
      .onFinalize(() => {
        'worklet';
        searchDragActive.value = false;
        runOnJS(setSearchDragActiveJs)(false);
        cancelAnimation(contentOverscrollY);
        contentOverscrollY.value = 0;
        const enabled = computeListScrollEnabled(
          listScrollY.value <= AT_TOP_THRESHOLD_PX,
          expanded.value > 0.001,
          false,
        );
        runOnJS(setListScrollEnabledIfChanged)(enabled);
      });
  }, [
    SEARCH_REVEAL_RANGE_PX,
    dragStartExpanded,
    expanded,
    listScrollY,
    listMaxScrollY,
    locked,
    panStartX,
    panStartY,
    searchDragActive,
    setListScrollEnabledIfChanged,
    setSearchDragActiveJs,
    contentOverscrollY,
  ]);

  const searchBarWrapStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expanded.value,
      [0, 1],
      [0, SEARCH_REVEAL_RANGE_PX],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(expanded.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const searchBarWrapAnimatedProps = useAnimatedProps(() => ({
    pointerEvents: searchPointerOpen.value > 0.5 ? 'box-none' : 'none',
  }));

  const searchBarInnerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          expanded.value,
          [0, 1],
          [-SEARCH_FIELD_H * 0.35, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  const contentBounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentOverscrollY.value }],
  }));

  const listScrollAnimatedProps = useAnimatedProps(() => ({
    scrollEnabled: listScrollEnabledSv.value > 0.5,
  }));

  return {
    SEARCH_FIELD_H,
    SEARCH_REVEAL_RANGE_PX,
    setSearchShown,
    listScrollY,
    listMaxScrollY,
    searchDragActive,
    searchDragActiveRef,
    pullGesture,
    contentBounceStyle,
    scrollHandler,
    searchBarWrapStyle,
    searchBarWrapAnimatedProps,
    searchBarInnerStyle,
    iconStyle,
    listScrollAnimatedProps,
  };
}
