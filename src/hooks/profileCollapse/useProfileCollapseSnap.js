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
import { useMainTabsNavigationOptional } from '../../context/MainTabsNavigationContext';
import { PROFILE_COLLAPSE_DISTANCE } from './profileCollapseConstants';
import { calcSnapTarget, snapHeaderSpring } from './profileCollapseSnap';

/**
 * Snap scroll: `scrollRef` / `scrollY`, handlers, pager lock, focus reset.
 * @returns {{
 *   scrollRef: import('react-native-reanimated').AnimatedRef<import('react-native').ScrollView>,
 *   scrollY: import('react-native-reanimated').SharedValue<number>,
 *   collapseP: import('react-native-reanimated').DerivedValue<number>,
 *   scrollSnapHandler: ReturnType<typeof import('react-native-reanimated').useAnimatedScrollHandler>,
 *   onScrollBeginDrag: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void,
 *   onScrollEndDrag: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void,
 *   onMomentumScrollEnd: (e: import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>) => void,
 * }}
 */
export function useProfileCollapseSnap() {
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
    scrollY,
    collapseP,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}
