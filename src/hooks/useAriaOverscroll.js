import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Keyboard, Platform } from 'react-native';
import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';
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
  computeAriaTabBarHideFactor,
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
  ariaTabBarHideSv,
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
  const tabBarSuppressLatchSv = useSharedValue(0);
  const ariaReleaseLatchSv = useSharedValue(0);
  const pagerLockedFromPullSv = useSharedValue(0);

  const setPagerLockedJs = useCallback(
    (locked) => {
      if (pagerLockedRef.current === locked) return;
      pagerLockedRef.current = locked;
      if (!locked) {
        pagerLockedFromPullSv.value = 0;
      }
      if (locked) {
        acquirePagerLock?.();
      } else {
        releasePagerLock?.();
      }
    },
    [acquirePagerLock, pagerLockedFromPullSv, releasePagerLock],
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
      if (ariaTabBarHideSv) {
        ariaTabBarHideSv.value = 0;
      }
    },
    [ariaTabBarHideSv, releasePagerLock, releaseTabBarSuppress],
  );

  /** Manual KB lift on Aria overlay — avoid window resize shrinking curtain height. */
  useEffect(() => {
    if (Platform.OS !== 'android' || !ariaVisible) {
      return undefined;
    }
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    return () => {
      KeyboardController.setDefaultMode();
    };
  }, [ariaVisible]);

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

  const resetTopPullPx = useCallback(() => {
    cancelAnimation(topPullPx);
    topPullPx.value = 0;
  }, [topPullPx]);

  const commitOpenJs = useCallback(() => {
    if (ariaVisibleRef.current) {
      return;
    }
    resetTopPullPx();
    ariaVisibleRef.current = true;
    ariaReleaseLatchSv.value = 0;
    tabBarSuppressLatchSv.value = 1;
    if (ariaTabBarHideSv) {
      ariaTabBarHideSv.value = 1;
    }
    setTabBarSuppressedJs(true);
    glowTargetRef.current = 1;
    ariaGlowIntensity.stopAnimation();
    ariaGlowIntensity.setValue(1);
    setAriaVisible(true);
  }, [
    ariaGlowIntensity,
    ariaReleaseLatchSv,
    ariaTabBarHideSv,
    resetTopPullPx,
    setTabBarSuppressedJs,
    tabBarSuppressLatchSv,
  ]);

  const openAriaPanel = useCallback(() => {
    if (ariaVisibleRef.current) {
      return;
    }
    resetTopPullPx();
    ariaVisibleRef.current = true;
    ariaCommittedSv.value = 1;
    ariaReleaseLatchSv.value = 0;
    tabBarSuppressLatchSv.value = 1;
    if (ariaTabBarHideSv) {
      ariaTabBarHideSv.value = 1;
    }
    setTabBarSuppressedJs(true);
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
    ariaReleaseLatchSv,
    ariaTabBarHideSv,
    resetTopPullPx,
    setPagerLockedJs,
    setTabBarSuppressedJs,
    tabBarSuppressLatchSv,
  ]);

  const closeAriaPanel = useCallback(() => {
    Keyboard.dismiss();
    ariaVisibleRef.current = false;
    ariaCommittedSv.value = 0;
    resetTopPullPx();
    ariaReleaseLatchSv.value = 0;
    tabBarSuppressLatchSv.value = 0;
    if (ariaTabBarHideSv) {
      ariaTabBarHideSv.value = 0;
    }
    setTabBarSuppressedJs(false);
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
        ariaReleaseLatchSv.value = 0;
        tabBarSuppressLatchSv.value = 0;
        if (ariaTabBarHideSv) {
          ariaTabBarHideSv.value = 0;
        }
        runOnJS(setTabBarSuppressedJs)(false);
        runOnJS(setPagerLockedJs)(false);
      }
    });
  }, [
    ariaCommittedSv,
    ariaGlowIntensity,
    ariaPullProgress,
    ariaReleaseLatchSv,
    ariaTabBarHideSv,
    resetTopPullPx,
    setPagerLockedJs,
    setTabBarSuppressedJs,
    tabBarSuppressLatchSv,
    ariaTabBarHideSv,
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

  const finishAriaPullReleaseJs = useCallback(
    (finished) => {
      ariaReleaseLatchSv.value = 0;
      if (finished) {
        tabBarSuppressLatchSv.value = 0;
        if (ariaTabBarHideSv) {
          ariaTabBarHideSv.value = 0;
        }
        setTabBarSuppressedJs(false);
        setPagerLockedJs(false);
      }
    },
    [
      ariaReleaseLatchSv,
      ariaTabBarHideSv,
      setPagerLockedJs,
      setTabBarSuppressedJs,
      tabBarSuppressLatchSv,
    ],
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
        if (progress > 0.001 && pagerLockedFromPullSv.value === 0) {
          pagerLockedFromPullSv.value = 1;
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
    () => ({
      progress: ariaPullProgress.value,
      pull: topPullPx.value,
      committed: ariaCommittedSv.value > 0.5,
      releaseLatched: ariaReleaseLatchSv.value,
    }),
    ({ progress, pull, committed, releaseLatched }) => {
      const effectiveProgress = committed ? 1 : Math.max(progress, computeAriaPullProgress(pull));
      if (ariaTabBarHideSv) {
        ariaTabBarHideSv.value = computeAriaTabBarHideFactor(effectiveProgress);
      }

      const prevSuppressed = tabBarSuppressLatchSv.value;
      let nextSuppressed = prevSuppressed;
      if (effectiveProgress >= ARIA_TAB_BAR_HIDE_PROGRESS) {
        nextSuppressed = 1;
      } else if (
        effectiveProgress <= ARIA_TAB_BAR_SHOW_PROGRESS
        && releaseLatched === 0
      ) {
        nextSuppressed = 0;
      }
      if (nextSuppressed === prevSuppressed) {
        return;
      }
      tabBarSuppressLatchSv.value = nextSuppressed;
      runOnJS(setTabBarSuppressedJs)(nextSuppressed === 1);
    },
    [ariaReleaseLatchSv, ariaTabBarHideSv, setTabBarSuppressedJs, tabBarSuppressLatchSv],
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

      ariaReleaseLatchSv.value = 1;
      const pullPx = ariaPullReleasePx.value;
      const progress = computeAriaPullProgress(pullPx);

      if (progress >= ARIA_SNAP_OPEN_THRESHOLD) {
        ariaReleaseLatchSv.value = 0;
        ariaCommittedSv.value = 1;
        cancelAnimation(topPullPx);
        topPullPx.value = 0;
        cancelAnimation(ariaPullProgress);
        ariaPullProgress.value = withSpring(1, ARIA_SPRING);
        runOnJS(commitOpenJs)();
        return;
      }
      if (progress > 0.001) {
        cancelAnimation(ariaPullProgress);
        cancelAnimation(topPullPx);
        ariaPullProgress.value = withSpring(0, ARIA_SPRING, (finished) => {
          if (finished) {
            topPullPx.value = 0;
            runOnJS(finishAriaPullReleaseJs)(true);
          }
        });
        topPullPx.value = withSpring(0, ARIA_SPRING);
        runOnJS(animateGlowTo)(0);
      } else {
        ariaReleaseLatchSv.value = 0;
        topPullPx.value = 0;
        runOnJS(setPagerLockedJs)(false);
        runOnJS(animateGlowTo)(0);
      }
    },
    [animateGlowTo, commitOpenJs, finishAriaPullReleaseJs, setPagerLockedJs],
  );

  return {
    ariaGlowIntensity,
    ariaVisible,
    ariaPullProgress,
    openAriaPanel,
    closeAriaPanel,
  };
}
