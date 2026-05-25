import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { shouldFailHorizontalPan, VERTICAL_PAN_FAIL_OFFSET_X } from '../lib/verticalPanAxis';
import { GAME_NO_OVERSCROLL_PROPS, TAB_OVERSCROLL_PROPS } from '../theme';

const SPRING_BACK = { damping: 20, stiffness: 260, mass: 0.85 };
const RUBBER_FACTOR = 0.38;
const MAX_OVERSCROLL_PX = 72;
const EDGE_EPS_PX = 3;

export const TAB_OVERSCROLL_SPRING_BACK = SPRING_BACK;

/** Rubber-band для Android overscroll (worklet). */
export function tabOverscrollRubberBand(delta) {
  'worklet';
  const sign = delta > 0 ? 1 : -1;
  const abs = Math.min(Math.abs(delta), MAX_OVERSCROLL_PX * 4);
  const band = MAX_OVERSCROLL_PX * (1 - 1 / (abs / MAX_OVERSCROLL_PX + 1));
  return sign * band * RUBBER_FACTOR;
}

function useAndroidTabBounceGesture({
  enabled,
  inverted,
  suppressTopBounce,
  scrollY,
  maxScrollY,
  acquirePagerLock,
  releasePagerLock,
  searchDragActive,
}) {
  const overscrollY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pullFromTop = useSharedValue(false);
  const pullFromBottom = useSharedValue(false);
  const bouncePagerLocked = useSharedValue(false);

  const androidBounce = Platform.OS === 'android' && enabled;

  const bounceGesture = useMemo(() => {
    if (!androidBounce) {
      return null;
    }

    return Gesture.Pan()
      .manualActivation(true)
      .failOffsetX([-VERTICAL_PAN_FAIL_OFFSET_X, VERTICAL_PAN_FAIL_OFFSET_X])
      .onTouchesDown((e) => {
        'worklet';
        const t = e.allTouches[0];
        if (!t) return;
        panStartX.value = t.x;
        panStartY.value = t.y;
        pullFromTop.value = false;
        pullFromBottom.value = false;
      })
      .onTouchesMove((e, state) => {
        'worklet';
        if (searchDragActive?.value) {
          state.fail();
          return;
        }
        const t = e.allTouches[0];
        if (!t) return;
        const dx = Math.abs(t.x - panStartX.value);
        const dy = Math.abs(t.y - panStartY.value);
        if (shouldFailHorizontalPan(dx, dy)) {
          state.fail();
          return;
        }
        if (dy < 8 || dy <= dx * 1.35) {
          return;
        }

        const movingDown = t.y - panStartY.value > 0;
        const movingUp = t.y - panStartY.value < 0;
        const atStart = scrollY.value <= EDGE_EPS_PX;
        const atEnd = scrollY.value >= maxScrollY.value - EDGE_EPS_PX;

        const canPullTop = inverted ? atEnd : atStart;
        const canPullBottom = inverted ? atStart : atEnd;

        if (movingDown && canPullTop && !suppressTopBounce) {
          pullFromTop.value = true;
          pullFromBottom.value = false;
          state.activate();
          return;
        }
        if (movingUp && canPullBottom) {
          pullFromTop.value = false;
          pullFromBottom.value = true;
          state.activate();
          return;
        }
        state.fail();
      })
      .onStart(() => {
        'worklet';
        if (acquirePagerLock && !bouncePagerLocked.value) {
          bouncePagerLocked.value = true;
          runOnJS(acquirePagerLock)();
        }
      })
      .onUpdate((e) => {
        'worklet';
        if (pullFromTop.value) {
          overscrollY.value = tabOverscrollRubberBand(Math.max(0, e.translationY));
        } else if (pullFromBottom.value) {
          overscrollY.value = tabOverscrollRubberBand(Math.min(0, e.translationY));
        }
      })
      .onEnd(() => {
        'worklet';
        overscrollY.value = withSpring(0, SPRING_BACK);
        pullFromTop.value = false;
        pullFromBottom.value = false;
      })
      .onFinalize(() => {
        'worklet';
        overscrollY.value = withSpring(0, SPRING_BACK);
        pullFromTop.value = false;
        pullFromBottom.value = false;
        if (bouncePagerLocked.value && releasePagerLock) {
          bouncePagerLocked.value = false;
          runOnJS(releasePagerLock)();
        }
      });
  }, [
    acquirePagerLock,
    androidBounce,
    bouncePagerLocked,
    inverted,
    maxScrollY,
    overscrollY,
    panStartX,
    panStartY,
    pullFromBottom,
    pullFromTop,
    releasePagerLock,
    scrollY,
    searchDragActive,
    suppressTopBounce,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!androidBounce) {
      return {};
    }
    return {
      transform: [{ translateY: overscrollY.value }],
    };
  });

  const wrapGesture = useMemo(() => {
    if (!bounceGesture) {
      return null;
    }
    return (otherGesture) => {
      if (!otherGesture) {
        return Gesture.Simultaneous(bounceGesture, Gesture.Native());
      }
      return Gesture.Simultaneous(bounceGesture, otherGesture);
    };
  }, [bounceGesture]);

  return { androidBounce, bounceGesture, animatedStyle, wrapGesture };
}

/**
 * iOS: `TAB_OVERSCROLL_PROPS`. Android: rubber-band через Pan + translateY.
 *
 * @param {object} opts
 * @param {boolean} [opts.enabled]
 * @param {boolean} [opts.inverted]
 * @param {boolean} [opts.suppressTopBounce]
 * @param {import('react-native-reanimated').SharedValue<number>} [opts.scrollY]
 * @param {import('react-native-reanimated').SharedValue<number>} [opts.maxScrollY]
 * @param {(e: object) => void} [opts.onScrollExtra] worklet
 */
export function useAndroidTabOverscroll({
  enabled = true,
  inverted = false,
  suppressTopBounce = false,
  scrollY: externalScrollY,
  maxScrollY: externalMaxScrollY,
  onScrollExtra,
  acquirePagerLock,
  releasePagerLock,
  searchDragActive,
} = {}) {
  const internalScrollY = useSharedValue(0);
  const internalMaxScrollY = useSharedValue(0);
  const scrollY = externalScrollY ?? internalScrollY;
  const maxScrollY = externalMaxScrollY ?? internalMaxScrollY;
  const usesExternalMetrics = externalScrollY != null && externalMaxScrollY != null;

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        if (!usesExternalMetrics) {
          scrollY.value = e.contentOffset.y;
          maxScrollY.value = Math.max(
            0,
            e.contentSize.height - e.layoutMeasurement.height,
          );
        }
        if (onScrollExtra) {
          onScrollExtra(e);
        }
      },
    },
    [onScrollExtra, usesExternalMetrics],
  );

  const bounce = useAndroidTabBounceGesture({
    enabled,
    inverted,
    suppressTopBounce,
    scrollY,
    maxScrollY,
    acquirePagerLock,
    releasePagerLock,
    searchDragActive,
  });

  const overscrollProps = enabled ? TAB_OVERSCROLL_PROPS : GAME_NO_OVERSCROLL_PROPS;

  return {
    ...bounce,
    scrollHandler: usesExternalMetrics ? null : scrollHandler,
    overscrollProps,
    scrollY,
    maxScrollY,
  };
}
