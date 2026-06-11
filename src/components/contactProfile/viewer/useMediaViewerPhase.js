import { useEffect, useImperativeHandle, useLayoutEffect } from 'react';
import {
  cancelAnimation,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import {
  alignOpenSourceRect,
  isValidMediaTransitionRect,
} from '../mediaTransitionSource';
import { formatRect, logMediaViewer } from '../mediaViewerDebugLog';
import { OPEN_EASING, OPEN_MS } from './mediaViewerConstants';

/**
 * Open layout effect, invisible reset, imperative close handle.
 */
export function useMediaViewerPhase({
  ref,
  visible,
  openEpoch,
  count,
  activeItem,
  safeIndex,
  screenW,
  screenH,
  lastAnimatedEpochRef,
  openFlyGenRef,
  openSettleGenRef,
  closeFinishedRef,
  handoffStartedRef,
  frameX,
  frameY,
  frameW,
  frameH,
  pagerX,
  backdropOpacity,
  heroContentOpacity,
  isClosing,
  isOpening,
  originSv,
  viewIndexSv,
  axisLock,
  initialTransitionSourceRef,
  getTransitionSourceRef,
  setViewerPhase,
  setSlideIndex,
  setPagerMounted,
  clearCloseSafetyTimer,
  resetFrameOnInvisible,
  requestClose,
  startOpenFrameAnimation,
  handleOpenSettled,
}) {
  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    if (visible) return;
    logMediaViewer('modal', 'reset invisible');
    clearCloseSafetyTimer();
    const resetId = requestAnimationFrame(() => {
      axisLock.value = 0;
      resetFrameOnInvisible();
    });
    setViewerPhase(null);
    setPagerMounted(false);
    return () => cancelAnimationFrame(resetId);
  }, [visible, axisLock, clearCloseSafetyTimer, resetFrameOnInvisible, setViewerPhase, setPagerMounted]);

  useEffect(() => () => clearCloseSafetyTimer(), [clearCloseSafetyTimer]);

  useLayoutEffect(() => {
    if (!visible || count === 0 || !activeItem) return;
    if (openEpoch === lastAnimatedEpochRef.current) return;
    lastAnimatedEpochRef.current = openEpoch;

    logMediaViewer('modal', 'openLayoutEffect', {
      openEpoch,
      activeId: activeItem.id,
      safeIndex,
      initialRect: formatRect(initialTransitionSourceRef.current),
      measuredRect: formatRect(getTransitionSourceRef.current?.(activeItem.id)),
    });

    const flyGen = ++openFlyGenRef.current;
    openSettleGenRef.current = flyGen;
    closeFinishedRef.current = false;
    handoffStartedRef.current = false;
    isClosing.value = false;
    isOpening.value = true;
    axisLock.value = 0;
    setSlideIndex(safeIndex);
    setPagerMounted(false);
    viewIndexSv.value = safeIndex;
    pagerX.value = -safeIndex * screenW;

    const rawLayout = isValidMediaTransitionRect(initialTransitionSourceRef.current)
      ? initialTransitionSourceRef.current
      : getTransitionSourceRef.current?.(activeItem.id);
    const layout = isValidMediaTransitionRect(rawLayout) ? alignOpenSourceRect(rawLayout) : null;

    if (layout) {
      frameX.value = layout.x;
      frameY.value = layout.y;
      frameW.value = layout.width;
      frameH.value = layout.height;
      originSv.value = layout;
    }
    cancelAnimation(frameX);
    cancelAnimation(frameY);
    cancelAnimation(frameW);
    cancelAnimation(frameH);
    cancelAnimation(backdropOpacity);

    setViewerPhase('opening');
    heroContentOpacity.value = 1;
    backdropOpacity.value = 0;

    if (!layout) {
      logMediaViewer('modal', 'open NO rect → instant fullscreen');
      frameX.value = 0;
      frameY.value = 0;
      frameW.value = screenW;
      frameH.value = screenH;
      backdropOpacity.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING }, (finished) => {
        'worklet';
        if (finished) runOnJS(handleOpenSettled)();
      });
      return;
    }

    backdropOpacity.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING });
    startOpenFrameAnimation(layout);
  }, [
    visible,
    openEpoch,
    count,
    activeItem,
    screenW,
    screenH,
    backdropOpacity,
    isClosing,
    isOpening,
    axisLock,
    pagerX,
    originSv,
    safeIndex,
    lastAnimatedEpochRef,
    openFlyGenRef,
    openSettleGenRef,
    closeFinishedRef,
    handoffStartedRef,
    frameX,
    frameY,
    frameW,
    frameH,
    heroContentOpacity,
    viewIndexSv,
    initialTransitionSourceRef,
    getTransitionSourceRef,
    setViewerPhase,
    setSlideIndex,
    setPagerMounted,
    startOpenFrameAnimation,
    handleOpenSettled,
  ]);
}
