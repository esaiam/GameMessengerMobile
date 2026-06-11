import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { alignCloseTargetRect, isValidMediaTransitionRect } from '../mediaTransitionSource';
import { formatRect, formatSnap, logMediaViewer } from '../mediaViewerDebugLog';
import {
  CLOSE_EASING,
  CLOSE_MS,
  HANDOFF_FADE_MS,
  OPEN_EASING,
  OPEN_MS,
  REMEASURE_TIMEOUT_MS,
  clampIndex,
} from './mediaViewerConstants';

/**
 * Hero frame shared values + open/close fly + handoff + finishClose.
 */
export function useMediaViewerFrameAnim({
  screenW,
  screenH,
  count,
  items,
  viewerPhase,
  pagerMounted,
  safeIndexRef,
  slideIndexRef,
  safeIndex,
  onClose,
  onHandoffRef,
  getTransitionSourceRef,
  getCloseTransitionSourceRef,
  remeasureTransitionSourceRef,
  setSlideIndex,
  setViewerPhase,
  setPagerMounted,
  axisLock,
}) {
  const lastAnimatedEpochRef = useRef(-1);
  const openFlyGenRef = useRef(0);
  const openSettleGenRef = useRef(0);
  const closeFlyGenRef = useRef(0);
  const closeSettleGenRef = useRef(0);
  const closeSafetyTimerRef = useRef(null);
  const closeFinishedRef = useRef(false);
  const handoffStartedRef = useRef(false);

  const frameX = useSharedValue(0);
  const frameY = useSharedValue(0);
  const frameW = useSharedValue(0);
  const frameH = useSharedValue(0);
  const pagerX = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const heroContentOpacity = useSharedValue(1);
  const isClosing = useSharedValue(false);
  const isOpening = useSharedValue(false);
  const originSv = useSharedValue(null);
  const viewIndexSv = useSharedValue(safeIndex);
  const screenDims = useSharedValue({ w: screenW, h: screenH });

  const logSnap = useCallback(
    (event, extra = {}) => {
      logMediaViewer('modal', event, {
        phase: viewerPhase,
        snap: formatSnap({
          frameX: frameX.value,
          frameY: frameY.value,
          frameW: frameW.value,
          frameH: frameH.value,
          pagerX: pagerX.value,
          viewIndexSv: viewIndexSv.value,
          safeIndex: safeIndexRef.current,
          backdrop: backdropOpacity.value,
          axisLock: axisLock?.value ?? 0,
          isOpening: isOpening.value,
          isClosing: isClosing.value,
        }),
        showPager: count > 1 && pagerMounted,
        ...extra,
      });
    },
    [
      viewerPhase,
      count,
      pagerMounted,
      safeIndexRef,
      axisLock,
      frameX,
      frameY,
      frameW,
      frameH,
      pagerX,
      viewIndexSv,
      backdropOpacity,
      isOpening,
      isClosing,
    ],
  );

  const clearCloseSafetyTimer = useCallback(() => {
    if (closeSafetyTimerRef.current != null) {
      clearTimeout(closeSafetyTimerRef.current);
      closeSafetyTimerRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    if (closeFinishedRef.current) return;
    logSnap('finishClose → onClose');
    closeFinishedRef.current = true;
    clearCloseSafetyTimer();
    isClosing.value = false;
    isOpening.value = false;
    frameY.value = 0;
    pagerX.value = -viewIndexSv.value * screenDims.value.w;
    lastAnimatedEpochRef.current = -1;
    onClose();
  }, [
    onClose,
    isClosing,
    isOpening,
    frameY,
    pagerX,
    viewIndexSv,
    screenDims,
    clearCloseSafetyTimer,
    logSnap,
  ]);

  const remeasureWithTimeout = useCallback((itemId) => {
    const remeasure = remeasureTransitionSourceRef.current;
    if (!itemId || !remeasure) return Promise.resolve(null);
    return Promise.race([
      remeasure(itemId),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), REMEASURE_TIMEOUT_MS);
      }),
    ]);
  }, [remeasureTransitionSourceRef]);

  const snapFrameToRect = useCallback(
    (rect) => {
      frameX.value = rect.x;
      frameY.value = rect.y;
      frameW.value = rect.width;
      frameH.value = rect.height;
    },
    [frameX, frameY, frameW, frameH],
  );

  const runCloseHandoff = useCallback(() => {
    if (handoffStartedRef.current) return;
    handoffStartedRef.current = true;

    const itemId = items[clampIndex(slideIndexRef.current, count)]?.id;
    const animRect = {
      x: frameX.value,
      y: frameY.value,
      w: frameW.value,
      h: frameH.value,
    };

    const hideHeroAndDismiss = () => {
      if (closeFinishedRef.current) return;
      cancelAnimation(heroContentOpacity);
      heroContentOpacity.value = withTiming(
        0,
        { duration: HANDOFF_FADE_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(finishClose)();
        },
      );
    };

    const snapHeroToRect = (rect, label) => {
      if (!isValidMediaTransitionRect(rect)) return;
      const aligned = alignCloseTargetRect(rect);
      const dy = aligned.y - animRect.y;
      logMediaViewer('modal', label, {
        anim: `{x:${Math.round(animRect.x)},y:${Math.round(animRect.y)}}`,
        fresh: formatRect(rect),
        aligned: formatRect(aligned),
        dy: Math.round(dy * 10) / 10,
      });
      if (Math.abs(dy) > 0.5 || Math.abs(aligned.x - animRect.x) > 0.5) {
        snapFrameToRect(aligned);
      }
    };

    const revealAndDismiss = () => {
      if (closeFinishedRef.current) return;
      requestAnimationFrame(() => {
        if (closeFinishedRef.current) return;
        if (!itemId) {
          onHandoffRef.current?.();
          hideHeroAndDismiss();
          return;
        }
        remeasureWithTimeout(itemId)
          .then((visibleRect) => {
            if (closeFinishedRef.current) return;
            snapHeroToRect(visibleRect, 'handoffAlignVisible');
            onHandoffRef.current?.();
            hideHeroAndDismiss();
          })
          .catch(() => {
            if (!closeFinishedRef.current) {
              onHandoffRef.current?.();
              hideHeroAndDismiss();
            }
          });
      });
    };

    revealAndDismiss();
  }, [
    items,
    count,
    slideIndexRef,
    snapFrameToRect,
    finishClose,
    heroContentOpacity,
    frameX,
    frameY,
    frameW,
    frameH,
    remeasureWithTimeout,
    onHandoffRef,
  ]);

  const resolveCloseLayout = useCallback(() => {
    const idx = clampIndex(slideIndexRef.current, count);
    const item = items[idx];
    const layout =
      getCloseTransitionSourceRef.current?.() ??
      (item ? getTransitionSourceRef.current?.(item.id) : null) ??
      originSv.value;
    if (isValidMediaTransitionRect(layout)) originSv.value = layout;
    return isValidMediaTransitionRect(layout) ? layout : null;
  }, [items, count, originSv, slideIndexRef, getCloseTransitionSourceRef, getTransitionSourceRef]);

  const handleCloseSettled = useCallback(() => {
    if (closeFinishedRef.current) {
      logMediaViewer('modal', 'closeSettled SKIP already finished');
      return;
    }
    if (closeSettleGenRef.current !== closeFlyGenRef.current) {
      logMediaViewer('modal', 'closeSettled SKIP stale gen', {
        settle: closeSettleGenRef.current,
        fly: closeFlyGenRef.current,
      });
      return;
    }
    logSnap('closeSettled → handoff');
    runCloseHandoff();
  }, [runCloseHandoff, logSnap]);

  const handleOpenSettled = useCallback(() => {
    if (openSettleGenRef.current !== openFlyGenRef.current) {
      logMediaViewer('modal', 'openSettled SKIP stale gen', {
        settle: openSettleGenRef.current,
        fly: openFlyGenRef.current,
      });
      return;
    }
    if (isClosing.value) {
      logMediaViewer('modal', 'openSettled SKIP isClosing');
      return;
    }
    logSnap('openSettled → ready', { idxSv: viewIndexSv.value, slideIndex: viewIndexSv.value });
    isOpening.value = false;
    setSlideIndex(viewIndexSv.value);
    frameX.value = 0;
    frameY.value = 0;
    frameW.value = screenW;
    frameH.value = screenH;
    pagerX.value = -viewIndexSv.value * screenW;
    setViewerPhase('ready');
    if (count > 1) {
      InteractionManager.runAfterInteractions(() => {
        setPagerMounted(true);
      });
    }
  }, [
    isOpening,
    isClosing,
    frameX,
    frameY,
    frameW,
    frameH,
    screenW,
    screenH,
    pagerX,
    viewIndexSv,
    count,
    logSnap,
    setSlideIndex,
    setViewerPhase,
    setPagerMounted,
  ]);

  const startOpenFrameAnimation = useCallback(
    (layout) => {
      logMediaViewer('modal', 'startOpenAnim', { from: formatRect(layout), screenW, screenH });
      cancelAnimation(frameX);
      cancelAnimation(frameY);
      cancelAnimation(frameW);
      cancelAnimation(frameH);

      frameX.value = layout.x;
      frameY.value = layout.y;
      frameW.value = layout.width;
      frameH.value = layout.height;

      const timingConfig = { duration: OPEN_MS, easing: OPEN_EASING };
      frameX.value = withTiming(0, timingConfig);
      frameY.value = withTiming(0, timingConfig);
      frameW.value = withTiming(screenW, timingConfig);
      frameH.value = withTiming(screenH, timingConfig, (finished) => {
        'worklet';
        if (finished) runOnJS(handleOpenSettled)();
      });
    },
    [screenW, screenH, frameX, frameY, frameW, frameH, handleOpenSettled],
  );

  const startCloseFrameAnimation = useCallback(
    (targetRect, startYOffset = 0) => {
      const sw = screenW;
      const sh = screenH;
      logSnap('startCloseAnim', {
        to: formatRect(targetRect),
        startYOffset,
        idxSv: viewIndexSv.value,
      });

      cancelAnimation(frameX);
      cancelAnimation(frameY);
      cancelAnimation(frameW);
      cancelAnimation(frameH);

      pagerX.value = -viewIndexSv.value * sw;
      const fromX = frameX.value;
      const fromY = frameY.value > 0 ? frameY.value : startYOffset;
      const fromW = frameW.value > 1 ? frameW.value : sw;
      const fromH = frameH.value > 1 ? frameH.value : sh;
      frameX.value = fromX;
      frameY.value = fromY;
      frameW.value = fromW;
      frameH.value = fromH;

      const timingConfig = { duration: CLOSE_MS, easing: CLOSE_EASING };
      backdropOpacity.value = withTiming(0, { duration: CLOSE_MS * 0.92, easing: CLOSE_EASING });
      frameX.value = withTiming(targetRect.x, timingConfig);
      frameY.value = withTiming(targetRect.y, timingConfig);
      frameW.value = withTiming(targetRect.width, timingConfig);
      frameH.value = withTiming(targetRect.height, timingConfig, (finished) => {
        'worklet';
        if (finished) runOnJS(handleCloseSettled)();
      });
    },
    [screenW, screenH, viewIndexSv, pagerX, frameX, frameY, frameW, frameH, backdropOpacity, handleCloseSettled, logSnap],
  );

  const launchClose = useCallback(
    (frozenLayout, startYOffset = 0) => {
      if (!isValidMediaTransitionRect(frozenLayout)) {
        logMediaViewer('modal', 'launchClose INVALID rect → finishClose');
        finishClose();
        return;
      }
      originSv.value = frozenLayout;
      const gen = ++closeFlyGenRef.current;
      closeSettleGenRef.current = gen;
      logMediaViewer('modal', 'launchClose', { gen, startYOffset, multi: count > 1 });
      startCloseFrameAnimation(frozenLayout, startYOffset);

      clearCloseSafetyTimer();
      closeSafetyTimerRef.current = setTimeout(() => {
        closeSafetyTimerRef.current = null;
        if (closeSettleGenRef.current === gen && isClosing.value) {
          handleCloseSettled();
        }
      }, CLOSE_MS + REMEASURE_TIMEOUT_MS + 200);
    },
    [originSv, finishClose, clearCloseSafetyTimer, isClosing, startCloseFrameAnimation, count, handleCloseSettled],
  );

  const beginCloseFly = useCallback(
    (startYOffset = 0) => {
      if (isClosing.value) {
        logMediaViewer('modal', 'beginCloseFly SKIP already closing');
        return;
      }
      logSnap('beginCloseFly', { startYOffset });
      isClosing.value = true;
      isOpening.value = false;
      closeFinishedRef.current = false;
      handoffStartedRef.current = false;

      openFlyGenRef.current += 1;
      cancelAnimation(frameY);
      cancelAnimation(pagerX);

      const fallbackLayout = resolveCloseLayout();
      setViewerPhase('closing');

      const startFly = (targetRect) => {
        if (closeFinishedRef.current) return;
        if (!isValidMediaTransitionRect(targetRect)) {
          finishClose();
          return;
        }
        const aligned = alignCloseTargetRect(targetRect);
        logMediaViewer('modal', 'closeTarget', {
          raw: formatRect(targetRect),
          aligned: formatRect(aligned),
        });
        originSv.value = aligned;
        launchClose(aligned, startYOffset);
      };

      const item = items[clampIndex(slideIndexRef.current, count)];
      if (!item) {
        finishClose();
        return;
      }
      if (!item.id) {
        startFly(fallbackLayout);
        return;
      }

      remeasureWithTimeout(item.id)
        .then((fresh) => {
          const target = isValidMediaTransitionRect(fresh) ? fresh : fallbackLayout;
          startFly(target);
        })
        .catch(() => startFly(fallbackLayout));
    },
    [
      items,
      count,
      slideIndexRef,
      resolveCloseLayout,
      launchClose,
      finishClose,
      isClosing,
      isOpening,
      frameY,
      pagerX,
      logSnap,
      remeasureWithTimeout,
      setViewerPhase,
      originSv,
    ],
  );

  const requestClose = useCallback(() => {
    beginCloseFly(frameY.value);
  }, [beginCloseFly, frameY]);

  const resetFrameOnInvisible = useCallback(() => {
    isClosing.value = false;
    isOpening.value = false;
    pagerX.value = 0;
    backdropOpacity.value = 0;
    heroContentOpacity.value = 1;
    frameX.value = 0;
    frameY.value = 0;
    frameW.value = 0;
    frameH.value = 0;
    closeFinishedRef.current = false;
    handoffStartedRef.current = false;
  }, [
    isClosing,
    isOpening,
    pagerX,
    backdropOpacity,
    heroContentOpacity,
    frameX,
    frameY,
    frameW,
    frameH,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const heroFrameStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: frameX.value,
    top: frameY.value,
    width: frameW.value,
    height: frameH.value,
    overflow: 'hidden',
    opacity: heroContentOpacity.value,
  }));

  return {
    frameAnimRefs: {
      lastAnimatedEpochRef,
      openFlyGenRef,
      openSettleGenRef,
      closeFlyGenRef,
      closeSettleGenRef,
      closeSafetyTimerRef,
      closeFinishedRef,
      handoffStartedRef,
    },
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
    screenDims,
    backdropStyle,
    heroFrameStyle,
    clearCloseSafetyTimer,
    finishClose,
    beginCloseFly,
    requestClose,
    startOpenFrameAnimation,
    handleOpenSettled,
    handleCloseSettled,
    resetFrameOnInvisible,
  };
}
