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
import { cappedRubberBandPullPx, computeAriaPullProgress } from './ariaPullProgress';
import { tabOverscrollRubberBand } from './useAndroidTabOverscroll';

const SPRING = { damping: 28, stiffness: 160, mass: 1.3 };
const AT_TOP_THRESHOLD_PX = 12;
const SNAP_OPEN_THRESHOLD = 0.38;
const SNAP_SETTLED_EPS = 0.04;
const SEARCH_DRAG_MIN_DY_PX = 4;
const POINTER_OPEN_THRESHOLD = 0.06;
const POINTER_CLOSE_THRESHOLD = 0.02;
/** Сырой pull (px) после полного раскрытия поиска, до rubber-band всего экрана. */
const TOP_PULL_CAP_PX = 240;

function snapExpandedTo(expanded, target) {
  'worklet';
  cancelAnimation(expanded);
  if (Math.abs(expanded.value - target) < SNAP_SETTLED_EPS) {
    expanded.value = target;
    return;
  }
  expanded.value = withSpring(target, SPRING);
}

function snapTopPullTo(topPullPx, target) {
  'worklet';
  cancelAnimation(topPullPx);
  if (Math.abs(topPullPx.value - target) < 0.5) {
    topPullPx.value = target;
    return;
  }
  topPullPx.value = withSpring(target, SPRING);
}

/**
 * Двухфазный pull: сначала поиск 0→1, затем rubber-band всего контента; закрытие — зеркально.
 */
function applyTwoStageSearchDrag(
  expanded,
  topPullPx,
  dragStartExpanded,
  dragStartTopPullPx,
  translationY,
  searchRevealRangePx,
) {
  'worklet';
  let search = dragStartExpanded;
  let pullPx = dragStartTopPullPx;
  let dy = translationY;

  if (dy > 0) {
    const searchRoom = Math.max(0, 1 - search) * searchRevealRangePx;
    const addSearch = Math.min(dy, searchRoom);
    search += addSearch / searchRevealRangePx;
    dy -= addSearch;
    if (dy > 0 && search >= 1 - 1e-4) {
      search = 1;
      pullPx = Math.min(pullPx + dy, TOP_PULL_CAP_PX);
    }
  } else if (dy < 0) {
    let closePx = -dy;
    if (pullPx > 0) {
      const sub = Math.min(closePx, pullPx);
      pullPx -= sub;
      closePx -= sub;
    }
    if (closePx > 0 && pullPx <= 1e-4) {
      pullPx = 0;
      const searchRoom = search * searchRevealRangePx;
      const sub = Math.min(closePx, searchRoom);
      search -= sub / searchRevealRangePx;
    }
  }

  expanded.value = Math.max(0, Math.min(1, search));
  topPullPx.value = Math.max(0, pullPx);
}

function computeListScrollEnabled(atTop, open, drag) {
  'worklet';
  if (drag) return false;
  return !(atTop && !open);
}

/** Отступ между нижней гранью шапки и верхней гранью поля поиска. */
export const CHATS_SEARCH_HEADER_GAP_PX = 4;

/** Отступ под полем поиска до списка. */
export const CHATS_SEARCH_BOTTOM_SPACING_PX = 20;

/**
 * Collapsible поиск: один Pan, progress следует за translationY до отпускания.
 * После полного раскрытия — rubber-band шапки, поиска и списка вместе.
 * pointerEvents / scrollEnabled — без runOnJS на каждый кадр (Android jank).
 */
export function useChatsSearchReveal(
  q,
  searchFocused,
  headerMinHeightPx = 0,
  ariaPullReleasePx,
  ariaPullReleaseTick,
  ariaCommittedSv,
  ariaPullProgress,
) {
  const SEARCH_FIELD_H = SEARCH_FIELD_LAYOUT.chatsHeight;
  const SEARCH_REVEAL_RANGE_PX =
    CHATS_SEARCH_HEADER_GAP_PX + SEARCH_FIELD_H + CHATS_SEARCH_BOTTOM_SPACING_PX;

  const expanded = useSharedValue(1);
  const listScrollY = useSharedValue(0);
  const listMaxScrollY = useSharedValue(0);
  const locked = useSharedValue(false);
  const dragStartExpanded = useSharedValue(0);
  const dragStartTopPullPx = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const topPullPx = useSharedValue(0);
  const searchDragActive = useSharedValue(false);
  const searchPointerOpen = useSharedValue(1);
  const listScrollEnabledSv = useSharedValue(1);
  const isActivated = useSharedValue(false);

  const isLockedRef = useRef(false);
  const searchDragActiveRef = useRef(false);
  const listScrollEnabledRef = useRef(true);

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
      cancelAnimation(topPullPx);
      topPullPx.value = 0;
      expanded.value = animated ? withSpring(open ? 1 : 0, SPRING) : open ? 1 : 0;
    },
    [expanded, topPullPx],
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
        isActivated.value = false;
        const t = e.allTouches[0];
        if (!t) return;
        panStartX.value = t.x;
        panStartY.value = t.y;
      })
      .onTouchesMove((e, state) => {
        'worklet';
        if (ariaCommittedSv?.value > 0.5) {
          if (!isActivated.value) {
            state.fail();
          }
          return;
        }
        if (locked.value) {
          if (!isActivated.value) {
            state.fail();
            return;
          }
          return;
        }
        const atTop = listScrollY.value <= AT_TOP_THRESHOLD_PX;
        const searchOpen = expanded.value > 0.001;
        if (!atTop && !searchOpen) {
          if (!isActivated.value) {
            state.fail();
            return;
          }
          return;
        }
        const t = e.allTouches[0];
        if (!t) return;
        const movingUp = t.y < panStartY.value;
        const atEnd =
          listMaxScrollY.value >= 0 &&
          listScrollY.value >= listMaxScrollY.value - 3;
        if (!searchOpen && atEnd && movingUp) {
          if (!isActivated.value) {
            state.fail();
            return;
          }
          return;
        }
        const dx = Math.abs(t.x - panStartX.value);
        const dy = Math.abs(t.y - panStartY.value);
        if (shouldFailHorizontalPan(dx, dy)) {
          if (!isActivated.value) {
            state.fail();
            return;
          }
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
        isActivated.value = true;
        searchDragActive.value = true;
        runOnJS(setSearchDragActiveJs)(true);
        runOnJS(setListScrollEnabledIfChanged)(false);
        cancelAnimation(expanded);
        cancelAnimation(topPullPx);
        dragStartExpanded.value = expanded.value;
        dragStartTopPullPx.value = topPullPx.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (locked.value) return;
        applyTwoStageSearchDrag(
          expanded,
          topPullPx,
          dragStartExpanded.value,
          dragStartTopPullPx.value,
          e.translationY,
          SEARCH_REVEAL_RANGE_PX,
        );
        if (ariaPullProgress && ariaCommittedSv.value <= 0.5) {
          cancelAnimation(ariaPullProgress);
          ariaPullProgress.value = computeAriaPullProgress(topPullPx.value);
        }
      })
      .onEnd(() => {
        'worklet';
        const releasePullPx = topPullPx.value;
        searchDragActive.value = false;
        runOnJS(setSearchDragActiveJs)(false);
        if (ariaPullReleasePx && ariaPullReleaseTick) {
          ariaPullReleasePx.value = releasePullPx;
          ariaPullReleaseTick.value += 1;
        }
        if (computeAriaPullProgress(releasePullPx) <= 0.001) {
          snapTopPullTo(topPullPx, 0);
        }
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
    dragStartTopPullPx,
    expanded,
    topPullPx,
    isActivated,
    listScrollY,
    listMaxScrollY,
    locked,
    panStartX,
    panStartY,
    searchDragActive,
    setListScrollEnabledIfChanged,
    setSearchDragActiveJs,
    ariaPullReleasePx,
    ariaPullReleaseTick,
    ariaCommittedSv,
    ariaPullProgress,
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

  const topPullBounceStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: tabOverscrollRubberBand(cappedRubberBandPullPx(topPullPx.value)),
      },
    ],
  }));

  const listTopInsetStyle = useAnimatedStyle(() => ({
    height:
      headerMinHeightPx +
      interpolate(expanded.value, [0, 1], [0, SEARCH_REVEAL_RANGE_PX], Extrapolation.CLAMP),
  }));

  const listScrollAnimatedProps = useAnimatedProps(() => ({
    scrollEnabled: listScrollEnabledSv.value > 0.5,
  }));

  return {
    SEARCH_FIELD_H,
    SEARCH_REVEAL_RANGE_PX,
    expanded,
    topPullPx,
    setSearchShown,
    listScrollY,
    listMaxScrollY,
    searchDragActive,
    searchDragActiveRef,
    pullGesture,
    topPullBounceStyle,
    listTopInsetStyle,
    scrollHandler,
    searchBarWrapStyle,
    searchBarWrapAnimatedProps,
    searchBarInnerStyle,
    iconStyle,
    listScrollAnimatedProps,
  };
}
