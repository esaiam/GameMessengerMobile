import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../components/MessengerHeaderLayout';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';

export const PROFILE_AVATAR_SIZE = 96;
const AVATAR_MARGIN_TOP = -12;
const NAME_MARGIN_TOP = 14;
const ACTIONS_MARGIN_TOP = 20;
const SCROLL_CONTENT_LIFT = 36;
const ACTION_ROW_HEIGHT = 52;
export const PROFILE_COLLAPSE_DISTANCE = 132;
const NAME_LINE_HEIGHT = 22;
const STATUS_MARGIN_TOP = 6;
const STATUS_LINE_HEIGHT = 13;
const SNAP_COLLAPSE_THRESHOLD = 0.42;
const COLLAPSE_SNAP_ZONE_EXTRA = 12;
const SNAP_SPRING = { damping: 22, stiffness: 280, mass: 0.85 };
const SNAP_DRAG_MIN_PX = 8;

function snapHeaderSpring(offsetY, scrollRef, scrollY, snapDriving) {
  'worklet';
  cancelAnimation(scrollY);
  snapDriving.value = true;
  scrollY.value = withSpring(offsetY, SNAP_SPRING, (finished) => {
    if (finished) {
      snapDriving.value = false;
      scrollTo(scrollRef, 0, offsetY, false);
    }
  });
}

function calcSnapTarget(y, vy, dragDelta, dragStartY) {
  if (y < 0 || y > PROFILE_COLLAPSE_DISTANCE + COLLAPSE_SNAP_ZONE_EXTRA) return -1;
  const startOffset =
    dragStartY >= PROFILE_COLLAPSE_DISTANCE * SNAP_COLLAPSE_THRESHOLD
      ? PROFILE_COLLAPSE_DISTANCE
      : 0;
  const pullExpand = dragDelta < -SNAP_DRAG_MIN_PX;
  const pullCollapse = dragDelta > SNAP_DRAG_MIN_PX;
  let offsetY;
  if (Math.abs(vy) > 0.35) {
    offsetY = vy > 0 ? 0 : PROFILE_COLLAPSE_DISTANCE;
  } else if (pullExpand) {
    const committed = y <= PROFILE_COLLAPSE_DISTANCE * (1 - SNAP_COLLAPSE_THRESHOLD);
    offsetY = committed ? 0 : startOffset;
  } else if (pullCollapse) {
    const committed = y >= PROFILE_COLLAPSE_DISTANCE * SNAP_COLLAPSE_THRESHOLD;
    offsetY = committed ? PROFILE_COLLAPSE_DISTANCE : startOffset;
  } else {
    offsetY = startOffset;
  }
  if (Math.abs(y - offsetY) < 2) return -1;
  return offsetY;
}

/**
 * Сворачивающаяся шапка профиля: аватар + имя, snap-скролл (как ProfileScreen).
 * @param {{ headerLayout: object, screenW: number, withStatusRow?: boolean }} options
 */
export function useProfileCollapseHeader({ headerLayout, screenW, withStatusRow = false }) {
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const snapDriving = useSharedValue(false);
  const nameWidthSv = useSharedValue(120);
  const collapseP = useDerivedValue(() =>
    Math.min(Math.max(scrollY.value / PROFILE_COLLAPSE_DISTANCE, 0), 1),
  );
  const scrollDragRef = useRef(false);
  const dragVyRef = useRef(0);
  const dragStartYRef = useRef(0);

  const mainTabsNav = useMainTabsNavigationOptional();
  const acquirePagerLock = mainTabsNav?.acquirePagerInteractionLock;
  const resetPagerLock = mainTabsNav?.resetPagerInteractionLock;

  const headerH = headerLayout.minHeight;
  const avatarTop = headerH + AVATAR_MARGIN_TOP;
  const nameEndY = headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - 9;
  const nameStartY = avatarTop + PROFILE_AVATAR_SIZE + NAME_MARGIN_TOP;
  const statusStartY = nameStartY + NAME_LINE_HEIGHT + STATUS_MARGIN_TOP;
  const avatarLiftY =
    avatarTop -
    (headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - PROFILE_AVATAR_SIZE / 2);

  const statusBlock = withStatusRow ? STATUS_MARGIN_TOP + STATUS_LINE_HEIGHT : 0;
  const scrollTopPadding =
    AVATAR_MARGIN_TOP +
    PROFILE_AVATAR_SIZE +
    NAME_MARGIN_TOP +
    NAME_LINE_HEIGHT +
    statusBlock +
    ACTIONS_MARGIN_TOP +
    ACTION_ROW_HEIGHT -
    SCROLL_CONTENT_LIFT;

  const scrollSnapHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (!snapDriving.value) {
        scrollY.value = e.contentOffset.y;
      }
    },
  });

  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      if (snapDriving.value) {
        scrollTo(scrollRef, 0, y, false);
      }
    },
  );

  const avatarWrapStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    const lift = Math.sin(p * Math.PI * 0.5);
    return {
      opacity: interpolate(p, [0, 0.75, 1], [1, 0.4, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: -avatarLiftY * lift },
        { scale: interpolate(p, [0, 1], [1, 0.42]) },
      ],
    };
  });

  const nameStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    const arcY = Math.sin(p * Math.PI * 0.5);
    const arcX = 1 - Math.cos(p * Math.PI * 0.5);
    const half = nameWidthSv.value / 2;
    const startTx = -half;
    const endTx = MESSENGER_HEADER_PADDING_HORIZONTAL - screenW / 2;
    return {
      transform: [
        { translateX: startTx + (endTx - startTx) * arcX },
        { translateY: (nameEndY - nameStartY) * arcY },
      ],
    };
  });

  const statusStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    return {
      opacity: interpolate(p, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    };
  });

  const snapIfNeeded = useCallback(
    (y, vy, dragDelta, dragStartY) => {
      const offsetY = calcSnapTarget(y, vy, dragDelta, dragStartY);
      if (offsetY < 0) return;
      runOnUI(snapHeaderSpring)(offsetY, scrollRef, scrollY, snapDriving);
    },
    [scrollRef, scrollY, snapDriving],
  );

  const onScrollBeginDrag = useCallback(
    (e) => {
      scrollDragRef.current = true;
      dragStartYRef.current = e.nativeEvent.contentOffset.y;
      runOnUI(() => {
        'worklet';
        cancelAnimation(scrollY);
        snapDriving.value = false;
      })();
      acquirePagerLock?.();
    },
    [acquirePagerLock, scrollY, snapDriving],
  );

  const onScrollEndDrag = useCallback(
    (e) => {
      const y = e.nativeEvent.contentOffset.y;
      const vy = e.nativeEvent.velocity?.y ?? 0;
      const dragDelta = y - dragStartYRef.current;
      dragVyRef.current = vy;
      const noMomentum = Math.abs(vy) < 0.15;
      if (noMomentum) {
        scrollDragRef.current = false;
        resetPagerLock?.();
        snapIfNeeded(y, vy, dragDelta, dragStartYRef.current);
      }
    },
    [resetPagerLock, snapIfNeeded],
  );

  const onMomentumScrollEnd = useCallback(
    (e) => {
      if (scrollDragRef.current) {
        scrollDragRef.current = false;
        resetPagerLock?.();
      }
      const y = e.nativeEvent.contentOffset.y;
      const vy = dragVyRef.current;
      const dragDelta = y - dragStartYRef.current;
      dragVyRef.current = 0;
      snapIfNeeded(y, vy, dragDelta, dragStartYRef.current);
    },
    [resetPagerLock, snapIfNeeded],
  );

  useFocusEffect(
    useCallback(() => {
      runOnUI(() => {
        'worklet';
        cancelAnimation(scrollY);
        snapDriving.value = false;
        scrollY.value = 0;
        scrollTo(scrollRef, 0, 0, false);
      })();
      return () => {
        scrollDragRef.current = false;
        resetPagerLock?.();
      };
    }, [scrollRef, scrollY, snapDriving, resetPagerLock]),
  );

  const onNameLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) nameWidthSv.value = w;
    },
    [nameWidthSv],
  );

  return {
    scrollRef,
    scrollTopPadding,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    avatarTop,
    nameStartY,
    statusStartY,
    avatarWrapStyle,
    nameStyle,
    statusStyle,
    nameWidthSv,
    onNameLayout,
  };
}
