import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  cancelAnimation,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { PROFILE_COLLAPSE_DISTANCE } from './profileCollapse/profileCollapseConstants';
import { calcSnapTarget, snapHeaderSpring } from './profileCollapse/profileCollapseSnap';
import { useProfileCollapseAvatarStyles } from './profileCollapse/useProfileCollapseAvatarStyles';
import { useProfileCollapseChromeStyles } from './profileCollapse/useProfileCollapseChromeStyles';
import { useProfileCollapseNameStyles } from './profileCollapse/useProfileCollapseNameStyles';
import { useProfileCollapseScrollMetrics } from './profileCollapse/useProfileCollapseScrollMetrics';

export {
  HEADER_MINI_AVATAR_SIZE,
  HEADER_UNDER_GLOW_LIFT_UP,
  PROFILE_AVATAR_SIZE,
  PROFILE_COLLAPSE_DISTANCE,
} from './profileCollapse/profileCollapseConstants';

/**
 * Сворачивающаяся шапка профиля: аватар + имя, snap-скролл (как ProfileScreen).
 * @param {{ headerLayout: object, screenW: number, withStatusRow?: boolean, withAvatarScrollGlow?: boolean, avatarTopExtra?: number }} options
 */
export function useProfileCollapseHeader({
  headerLayout,
  screenW,
  withStatusRow = false,
  withAvatarScrollGlow = false,
  avatarTopExtra = 0,
}) {
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const snapDriving = useSharedValue(false);
  const collapseP = useDerivedValue(() =>
    Math.min(Math.max(scrollY.value / PROFILE_COLLAPSE_DISTANCE, 0), 1),
  );

  const scrollDragRef = useRef(false);
  const dragVyRef = useRef(0);
  const dragStartYRef = useRef(0);

  const mainTabsNav = useMainTabsNavigationOptional();
  const acquirePagerLock = mainTabsNav?.acquirePagerInteractionLock;
  const resetPagerLock = mainTabsNav?.resetPagerInteractionLock;

  const {
    headerH,
    avatarTop,
    nameStartY,
    statusStartY,
    avatarLiftY,
    nameEndY,
    nameHeaderTx,
    nameHeaderTy,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerNameLeft,
    headerStatusTop,
    actionsFloatTop,
    scrollTopPadding,
    scrollContentPullSv,
    headerUnderGlowTop,
    headerUnderGlowHeight,
  } = useProfileCollapseScrollMetrics({
    headerLayout,
    screenW,
    withStatusRow,
    withAvatarScrollGlow,
    avatarTopExtra,
  });

  const {
    avatarParallaxY,
    actionsParallaxY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowFillStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
  } = useProfileCollapseAvatarStyles({
    scrollY,
    collapseP,
    withAvatarScrollGlow,
    avatarLiftY,
  });

  const {
    nameWidthSv,
    onNameLayout,
    nameStyle,
    headerMiniAvatarStyle,
    nameHeaderChromeStackStyle,
  } = useProfileCollapseNameStyles({
    scrollY,
    collapseP,
    withAvatarScrollGlow,
    avatarParallaxY,
    avatarLiftY,
    nameHeaderTx,
    nameHeaderTy,
    nameEndY,
    nameStartY,
    screenW,
  });

  const {
    headerUnderGlowStyle,
    profileChromeStackStyle,
    statusStyle,
    headerStatusStyle,
    scrollContentPullStyle,
    actionsFloatStyle,
  } = useProfileCollapseChromeStyles({
    scrollY,
    collapseP,
    withAvatarScrollGlow,
    scrollContentPullSv,
    avatarLiftY,
    actionsParallaxY,
  });

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

  const snapIfNeeded = useCallback(
    (y, vy, dragDelta) => {
      const offsetY = calcSnapTarget(y, vy, dragDelta);
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
        snapIfNeeded(y, vy, dragDelta);
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
      snapIfNeeded(y, vy, dragDelta);
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

  return {
    scrollRef,
    scrollTopPadding,
    scrollContentPullStyle,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    avatarTop,
    actionsFloatTop,
    actionsFloatStyle,
    nameStartY,
    statusStartY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowFillStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
    nameStyle,
    statusStyle,
    headerStatusStyle,
    nameWidthSv,
    onNameLayout,
    headerNameLeft,
    headerStatusTop,
    headerHeight: headerH,
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  };
}
