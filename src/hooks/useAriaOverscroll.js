import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated } from 'react-native';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ARIA_SNAP_OPEN_THRESHOLD,
  ARIA_TAB_BAR_HIDE_PROGRESS,
  ARIA_TAB_BAR_SHOW_PROGRESS,
  computeAriaGlowIntensity,
  computeAriaPullProgress,
} from './ariaPullProgress';

const GLOW_ANIM_DURATION_MS = 300;
const ARIA_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };

/**
 * Pull-down на верхней границе списка чатов:
 * до rubber-band порога — glow иконки + резинка контента;
 * дальше — панель Aria следует за пальцем; snap при отпускании.
 */
export function useAriaOverscroll({
  topPullPx,
  searchDragActive,
  ariaPullReleasePx,
  ariaPullReleaseTick,
  ariaCommittedSv,
  ariaPullProgress,
  acquirePagerLock,
  releasePagerLock,
  acquireTabBarSuppress,
  releaseTabBarSuppress,
}) {
  const ariaGlowIntensity = useRef(new RNAnimated.Value(0)).current;
  const [ariaVisible, setAriaVisible] = useState(false);

  const ariaVisibleRef = useRef(false);
  const glowTargetRef = useRef(0);
  const pagerLockedRef = useRef(false);
  const tabBarSuppressedRef = useRef(false);

  const setPagerLockedJs = useCallback(
    (locked) => {
      if (pagerLockedRef.current === locked) return;
      pagerLockedRef.current = locked;
      if (locked) {
        acquirePagerLock?.();
      } else {
        releasePagerLock?.();
      }
    },
    [acquirePagerLock, releasePagerLock],
  );

  const setTabBarSuppressedJs = useCallback(
    (suppressed) => {
      if (tabBarSuppressedRef.current === suppressed) return;
      tabBarSuppressedRef.current = suppressed;
      if (suppressed) {
        acquireTabBarSuppress?.();
      } else {
        releaseTabBarSuppress?.();
      }
    },
    [acquireTabBarSuppress, releaseTabBarSuppress],
  );

  useEffect(
    () => () => {
      if (pagerLockedRef.current) {
        pagerLockedRef.current = false;
        releasePagerLock?.();
      }
      if (tabBarSuppressedRef.current) {
        tabBarSuppressedRef.current = false;
        releaseTabBarSuppress?.();
      }
    },
    [releasePagerLock, releaseTabBarSuppress],
  );

  const animateGlowTo = useCallback(
    (toValue) => {
      if (ariaVisibleRef.current && toValue < 1) {
        return;
      }
      if (glowTargetRef.current === toValue) {
        return;
      }
      glowTargetRef.current = toValue;
      ariaGlowIntensity.stopAnimation();
      RNAnimated.timing(ariaGlowIntensity, {
        toValue,
        duration: GLOW_ANIM_DURATION_MS,
        useNativeDriver: false,
      }).start();
    },
    [ariaGlowIntensity],
  );

  const setGlowImmediate = useCallback(
    (toValue) => {
      if (ariaVisibleRef.current && toValue < 1) {
        return;
      }
      glowTargetRef.current = toValue;
      ariaGlowIntensity.stopAnimation();
      ariaGlowIntensity.setValue(toValue);
    },
    [ariaGlowIntensity],
  );

  const commitOpenJs = useCallback(() => {
    if (ariaVisibleRef.current) {
      return;
    }
    ariaVisibleRef.current = true;
    glowTargetRef.current = 1;
    ariaGlowIntensity.stopAnimation();
    ariaGlowIntensity.setValue(1);
    setAriaVisible(true);
  }, [ariaGlowIntensity]);

  const openAriaPanel = useCallback(() => {
    if (ariaVisibleRef.current) {
      return;
    }
    ariaVisibleRef.current = true;
    ariaCommittedSv.value = 1;
    glowTargetRef.current = 1;
    ariaGlowIntensity.stopAnimation();
    ariaGlowIntensity.setValue(1);
    setAriaVisible(true);
    setPagerLockedJs(true);
    cancelAnimation(ariaPullProgress);
    ariaPullProgress.value = withSpring(1, ARIA_SPRING);
  }, [
    ariaCommittedSv,
    ariaGlowIntensity,
    ariaPullProgress,
    setPagerLockedJs,
  ]);

  const closeAriaPanel = useCallback(() => {
    ariaVisibleRef.current = false;
    ariaCommittedSv.value = 0;
    glowTargetRef.current = 0;
    setAriaVisible(false);
    ariaGlowIntensity.stopAnimation();
    RNAnimated.timing(ariaGlowIntensity, {
      toValue: 0,
      duration: GLOW_ANIM_DURATION_MS,
      useNativeDriver: false,
    }).start();
    cancelAnimation(ariaPullProgress);
    ariaPullProgress.value = withSpring(0, ARIA_SPRING, (finished) => {
      if (finished) {
        runOnJS(setPagerLockedJs)(false);
      }
    });
  }, [
    ariaCommittedSv,
    ariaGlowIntensity,
    ariaPullProgress,
    setPagerLockedJs,
  ]);

  const syncGlowFromPull = useCallback(
    (intensity) => {
      if (ariaVisibleRef.current) {
        return;
      }
      setGlowImmediate(intensity);
    },
    [setGlowImmediate],
  );

  useAnimatedReaction(
    () => ({
      pull: topPullPx.value,
      dragging: searchDragActive.value,
      committed: ariaCommittedSv.value > 0.5,
    }),
    (cur, prev) => {
      if (cur.committed) {
        return;
      }

      if (cur.dragging) {
        runOnJS(syncGlowFromPull)(computeAriaGlowIntensity(cur.pull));
        const progress = computeAriaPullProgress(cur.pull);
        if (progress > 0.001) {
          runOnJS(setPagerLockedJs)(true);
        }
        return;
      }

      if (prev != null && prev.dragging) {
        runOnJS(syncGlowFromPull)(computeAriaGlowIntensity(cur.pull));
      }
    },
    [setPagerLockedJs, syncGlowFromPull],
  );

  useAnimatedReaction(
    () => ariaPullProgress.value,
    (progress) => {
      if (progress >= ARIA_TAB_BAR_HIDE_PROGRESS) {
        runOnJS(setTabBarSuppressedJs)(true);
        return;
      }
      if (progress <= ARIA_TAB_BAR_SHOW_PROGRESS) {
        runOnJS(setTabBarSuppressedJs)(false);
      }
    },
    [setTabBarSuppressedJs],
  );

  useAnimatedReaction(
    () => (ariaPullReleaseTick ? ariaPullReleaseTick.value : 0),
    (tick, prevTick) => {
      if (!ariaPullReleasePx || !ariaPullReleaseTick || !ariaPullProgress) {
        return;
      }
      if (tick === prevTick || tick === 0) {
        return;
      }
      if (ariaCommittedSv.value > 0.5) {
        return;
      }

      const pullPx = ariaPullReleasePx.value;
      const progress = computeAriaPullProgress(pullPx);

      if (progress >= ARIA_SNAP_OPEN_THRESHOLD) {
        ariaCommittedSv.value = 1;
        cancelAnimation(ariaPullProgress);
        ariaPullProgress.value = withSpring(1, ARIA_SPRING);
        runOnJS(commitOpenJs)();
        return;
      }
      if (progress > 0.001) {
        cancelAnimation(ariaPullProgress);
        ariaPullProgress.value = withSpring(0, ARIA_SPRING, (finished) => {
          if (finished) {
            runOnJS(setPagerLockedJs)(false);
          }
        });
        runOnJS(animateGlowTo)(0);
      } else {
        runOnJS(setPagerLockedJs)(false);
        runOnJS(animateGlowTo)(0);
      }
    },
    [animateGlowTo, commitOpenJs, setPagerLockedJs],
  );

  return {
    ariaGlowIntensity,
    ariaVisible,
    ariaPullProgress,
    openAriaPanel,
    closeAriaPanel,
  };
}
