import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { isValidMediaTransitionRect } from '../mediaTransitionSource';
import { logMediaViewer } from '../mediaViewerDebugLog';
import {
  AXIS_LOCK_PX,
  DISMISS_DRAG,
  DISMISS_VELOCITY,
  PAGE_SPRING,
  SPRING_BACK,
} from './mediaViewerConstants';

/**
 * Vertical dismiss + horizontal pager pan for media viewer hero frame.
 */
export function useMediaViewerPanGesture({
  count,
  items,
  axisLock,
  isClosing,
  isOpening,
  frameY,
  pagerX,
  backdropOpacity,
  viewIndexSv,
  screenDims,
  originSv,
  safeIndexRef,
  getTransitionSourceRef,
  onIndexChangeRef,
  beginCloseFly,
  setSlideIndex,
  setPagerMounted,
}) {
  const logPanAxis = useCallback((axis, extra) => {
    logMediaViewer('modal', `pan axis=${axis}`, extra);
  }, []);

  const logPanPageEnd = useCallback((cur, next, tx, vx) => {
    logMediaViewer('modal', 'pan pageEnd', { cur, next, tx: Math.round(tx), vx: Math.round(vx) });
  }, []);

  const applySlideIndex = useCallback((next) => {
    setSlideIndex(next);
  }, [setSlideIndex]);

  const ensurePagerMounted = useCallback(() => {
    if (count > 1) setPagerMounted(true);
  }, [count, setPagerMounted]);

  const notifyIndexChange = useCallback(
    (next) => {
      logMediaViewer('modal', 'notifyIndexChange', { next, prev: safeIndexRef.current });
      setSlideIndex(next);
      onIndexChangeRef.current?.(next);
      const item = items[next];
      if (!item) return;
      const layout = getTransitionSourceRef.current?.(item.id);
      if (isValidMediaTransitionRect(layout)) originSv.value = layout;
    },
    [items, originSv, safeIndexRef, getTransitionSourceRef, onIndexChangeRef, setSlideIndex],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .activeOffsetX([-28, 28])
        .onStart(() => {
          if (isClosing.value || isOpening.value) return;
          axisLock.value = 0;
          if (count > 1) runOnJS(ensurePagerMounted)();
        })
        .onUpdate((e) => {
          if (count === 0 || isClosing.value || isOpening.value) return;

          if (axisLock.value === 0) {
            const ax = Math.abs(e.translationX);
            const ay = Math.abs(e.translationY);
            if (ax > AXIS_LOCK_PX || ay > AXIS_LOCK_PX) {
              const nextAxis = ay > ax * 1.15 ? 1 : 2;
              axisLock.value = nextAxis;
              runOnJS(logPanAxis)(nextAxis, {
                ax: Math.round(ax),
                ay: Math.round(ay),
                idxSv: viewIndexSv.value,
                pagerX: Math.round(pagerX.value),
              });
            }
          }

          if (axisLock.value === 1) {
            frameY.value = e.translationY;
            const progress = Math.min(
              Math.abs(e.translationY) / (screenDims.value.h * 0.45),
              1,
            );
            backdropOpacity.value = interpolate(
              progress,
              [0, 1],
              [1, 0.35],
              Extrapolation.CLAMP,
            );
            return;
          }

          if (axisLock.value === 2 && count > 1) {
            frameY.value = 0;
            const sw = screenDims.value.w;
            const base = -viewIndexSv.value * sw;
            const minX = -(count - 1) * sw;
            pagerX.value = Math.min(0, Math.max(minX, base + e.translationX));
          }
        })
        .onEnd((e) => {
          if (count === 0 || isClosing.value || isOpening.value) return;

          if (axisLock.value === 1) {
            const ty = e.translationY;
            const vy = e.velocityY;
            const shouldClose =
              Math.abs(ty) > DISMISS_DRAG || Math.abs(vy) > DISMISS_VELOCITY;

            if (shouldClose) {
              runOnJS(logPanAxis)(1, { end: 'dismiss', frameY: Math.round(frameY.value) });
              runOnJS(beginCloseFly)(frameY.value);
            } else {
              frameY.value = withSpring(0, SPRING_BACK);
              backdropOpacity.value = withSpring(1, SPRING_BACK);
            }
            axisLock.value = 0;
            return;
          }

          if (axisLock.value === 2 && count > 1) {
            const sw = screenDims.value.w;
            const threshold = sw * 0.22;
            const cur = viewIndexSv.value;
            let next = cur;
            if (e.translationX < -threshold || e.velocityX < -450) {
              next = Math.min(count - 1, cur + 1);
            } else if (e.translationX > threshold || e.velocityX > 450) {
              next = Math.max(0, cur - 1);
            }
            runOnJS(logPanPageEnd)(cur, next, e.translationX, e.velocityX);
            viewIndexSv.value = next;
            pagerX.value = withSpring(-next * sw, PAGE_SPRING);
            if (next !== cur) {
              runOnJS(applySlideIndex)(next);
              runOnJS(notifyIndexChange)(next);
            }
          }

          axisLock.value = 0;
        }),
    [
      count,
      viewIndexSv,
      screenDims,
      frameY,
      pagerX,
      backdropOpacity,
      axisLock,
      isClosing,
      isOpening,
      beginCloseFly,
      notifyIndexChange,
      applySlideIndex,
      ensurePagerMounted,
      logPanAxis,
      logPanPageEnd,
    ],
  );

  return panGesture;
}
