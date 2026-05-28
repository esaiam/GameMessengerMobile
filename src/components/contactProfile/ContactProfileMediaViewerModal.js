import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from 'react';
import {
  Modal,
  Image,
  TouchableOpacity,
  View,
  StyleSheet,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';
import {
  alignCloseTargetRect,
  alignOpenSourceRect,
  isValidMediaTransitionRect,
} from './mediaTransitionSource';
import { formatRect, formatSnap, logMediaViewer } from './mediaViewerDebugLog';

const DISMISS_DRAG = 110;
const DISMISS_VELOCITY = 720;
const AXIS_LOCK_PX = 10;
const HANDOFF_FADE_MS = 100;
const SPRING_BACK = { damping: 22, stiffness: 300, mass: 0.85 };
/** Достаточно медленно, чтобы читался скейл из ячейки. */
const OPEN_MS = 480;
const CLOSE_MS = 340;
const REMEASURE_TIMEOUT_MS = 150;
/** Симметричный in-out — скейл виден и в начале, и в конце. */
const OPEN_EASING = Easing.inOut(Easing.cubic);
/** Замедление в конце — «посадка» в ячейку без рывка. */
const CLOSE_EASING = Easing.out(Easing.cubic);
const PAGE_SPRING = {
  damping: 32,
  stiffness: 220,
  mass: 1,
  restDisplacementThreshold: 0.35,
  restSpeedThreshold: 0.35,
};

function clampIndex(idx, count) {
  if (count <= 0) return 0;
  return Math.min(Math.max(idx, 0), count - 1);
}

const ViewerSlide = React.memo(function ViewerSlide({
  item,
  width,
  height,
  fill = false,
  active,
  showVideoControls,
}) {
  const isVideo = item.kind === 'video';
  const boxStyle = fill ? styles.slideFill : [styles.slide, { width, height }];

  const player = useVideoPlayer(isVideo && active ? item.uri : null, (p) => {
    if (!p) return;
    p.loop = false;
  });

  useEffect(() => {
    if (!isVideo || !player || !active) return undefined;
    try {
      player.play();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [isVideo, player, item.uri, active]);

  if (isVideo) {
    return (
      <View style={boxStyle}>
        <VideoView
          player={player}
          style={styles.media}
          contentFit="cover"
          nativeControls={showVideoControls}
        />
      </View>
    );
  }

  return (
    <View style={boxStyle}>
      <Image
        source={{ uri: item.uri, cache: 'force-cache' }}
        style={styles.media}
        resizeMode="cover"
        fadeDuration={0}
      />
    </View>
  );
});

/**
 * Hero viewer: один Animated rect (window space) + один ViewerSlide на open/close.
 *
 * @param {{
 *   visible: boolean,
 *   items: { id: string, uri: string, kind: 'image' | 'video' }[],
 *   viewIndex: number,
 *   initialTransitionSource?: import('./mediaTransitionSource').MediaTransitionRect | null,
 *   getTransitionSource?: (itemId: string) => import('./mediaTransitionSource').MediaTransitionRect | null | undefined,
 *   remeasureTransitionSource?: (itemId: string) => Promise<import('./mediaTransitionSource').MediaTransitionRect | null>,
 *   getCloseTransitionSource?: () => import('./mediaTransitionSource').MediaTransitionRect | null | undefined,
 *   openEpoch?: number,
 *   onHandoff?: () => void,
 *   onClose: () => void,
 *   onIndexChange?: (index: number) => void,
 * }} props
 */
const ContactProfileMediaViewerModal = forwardRef(function ContactProfileMediaViewerModal(
  {
    visible,
    items,
    viewIndex,
    initialTransitionSource = null,
    getTransitionSource,
    remeasureTransitionSource,
    getCloseTransitionSource,
    openEpoch = 0,
    onHandoff,
    onClose,
    onIndexChange,
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const count = items.length;
  const safeIndex = clampIndex(viewIndex, count);
  const activeItem = items[safeIndex] ?? null;

  const lastAnimatedEpochRef = useRef(-1);
  const openFlyGenRef = useRef(0);
  const openSettleGenRef = useRef(0);
  const closeFlyGenRef = useRef(0);
  const closeSettleGenRef = useRef(0);
  const closeSafetyTimerRef = useRef(null);
  const closeFinishedRef = useRef(false);
  const handoffStartedRef = useRef(false);

  /** @type {['opening' | 'ready' | 'closing' | null]} */
  const [viewerPhase, setViewerPhase] = useState(null);
  /** Индекс активного слайда в pager (синхрон с viewIndexSv, без лага safeIndex). */
  const [slideIndex, setSlideIndex] = useState(safeIndex);
  /** Горизонтальная лента — только после settle open (не во время hero-скейла). */
  const [pagerMounted, setPagerMounted] = useState(false);

  const effectivePhase = viewerPhase ?? (visible && activeItem ? 'opening' : null);

  const getTransitionSourceRef = useRef(getTransitionSource);
  const getCloseTransitionSourceRef = useRef(getCloseTransitionSource);
  const remeasureTransitionSourceRef = useRef(remeasureTransitionSource);
  const initialTransitionSourceRef = useRef(initialTransitionSource);
  const onIndexChangeRef = useRef(onIndexChange);
  const onHandoffRef = useRef(onHandoff);
  getTransitionSourceRef.current = getTransitionSource;
  onHandoffRef.current = onHandoff;
  getCloseTransitionSourceRef.current = getCloseTransitionSource;
  remeasureTransitionSourceRef.current = remeasureTransitionSource;
  initialTransitionSourceRef.current = initialTransitionSource;
  onIndexChangeRef.current = onIndexChange;

  const frameX = useSharedValue(0);
  const frameY = useSharedValue(0);
  const frameW = useSharedValue(0);
  const frameH = useSharedValue(0);
  const pagerX = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const heroContentOpacity = useSharedValue(1);
  const axisLock = useSharedValue(0);
  const isClosing = useSharedValue(false);
  const isOpening = useSharedValue(false);
  const originSv = useSharedValue(null);
  const viewIndexSv = useSharedValue(safeIndex);
  const screenDims = useSharedValue({ w: screenW, h: screenH });
  const safeIndexRef = useRef(safeIndex);
  const slideIndexRef = useRef(safeIndex);
  safeIndexRef.current = safeIndex;
  slideIndexRef.current = slideIndex;

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
          axisLock: axisLock.value,
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
      frameX,
      frameY,
      frameW,
      frameH,
      pagerX,
      viewIndexSv,
      backdropOpacity,
      axisLock,
      isOpening,
      isClosing,
    ],
  );

  useEffect(() => {
    if (isClosing.value || isOpening.value) return;
    if (viewIndexSv.value === safeIndex) return;
    viewIndexSv.value = safeIndex;
    setSlideIndex(safeIndex);
    pagerX.value = -safeIndex * screenW;
  }, [safeIndex, viewIndexSv, screenW, pagerX, isClosing, isOpening]);

  useEffect(() => {
    screenDims.value = { w: screenW, h: screenH };
  }, [screenW, screenH, screenDims]);

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

  const logPanAxis = useCallback((axis, extra) => {
    logMediaViewer('modal', `pan axis=${axis}`, extra);
  }, []);

  const logPanPageEnd = useCallback((cur, next, tx, vx) => {
    logMediaViewer('modal', 'pan pageEnd', { cur, next, tx: Math.round(tx), vx: Math.round(vx) });
  }, []);

  const applySlideIndex = useCallback((next) => {
    setSlideIndex(next);
  }, []);

  const ensurePagerMounted = useCallback(() => {
    if (count > 1) setPagerMounted(true);
  }, [count]);

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
    [items, originSv],
  );

  const remeasureWithTimeout = useCallback((itemId) => {
    const remeasure = remeasureTransitionSourceRef.current;
    if (!itemId || !remeasure) return Promise.resolve(null);
    return Promise.race([
      remeasure(itemId),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), REMEASURE_TIMEOUT_MS);
      }),
    ]);
  }, []);

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
      onHandoffRef.current?.();
      requestAnimationFrame(() => {
        if (closeFinishedRef.current) return;
        if (!itemId) {
          hideHeroAndDismiss();
          return;
        }
        remeasureWithTimeout(itemId)
          .then((visibleRect) => {
            if (closeFinishedRef.current) return;
            snapHeroToRect(visibleRect, 'handoffAlignVisible');
            hideHeroAndDismiss();
          })
          .catch(() => {
            if (!closeFinishedRef.current) hideHeroAndDismiss();
          });
      });
    };

    revealAndDismiss();
  }, [
    items,
    count,
    snapFrameToRect,
    finishClose,
    heroContentOpacity,
    frameX,
    frameY,
    frameW,
    frameH,
    remeasureWithTimeout,
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
  }, [items, count, originSv]);

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
    [screenW, screenH, viewIndexSv, pagerX, frameX, frameY, frameW, frameH, backdropOpacity, handleCloseSettled],
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
      resolveCloseLayout,
      launchClose,
      finishClose,
      isClosing,
      isOpening,
      frameY,
      pagerX,
      logSnap,
      remeasureWithTimeout,
    ],
  );

  const requestClose = useCallback(() => {
    beginCloseFly(frameY.value);
  }, [beginCloseFly, frameY]);

  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    if (visible) return;
    logMediaViewer('modal', 'reset invisible');
    clearCloseSafetyTimer();
    const resetId = requestAnimationFrame(() => {
      isClosing.value = false;
      isOpening.value = false;
      axisLock.value = 0;
      pagerX.value = 0;
      backdropOpacity.value = 0;
      heroContentOpacity.value = 1;
      frameX.value = 0;
      frameY.value = 0;
      frameW.value = 0;
      frameH.value = 0;
    });
    setViewerPhase(null);
    setPagerMounted(false);
    closeFinishedRef.current = false;
    handoffStartedRef.current = false;
    return () => cancelAnimationFrame(resetId);
  }, [
    visible,
    isClosing,
    isOpening,
    axisLock,
    pagerX,
    backdropOpacity,
    clearCloseSafetyTimer,
    frameX,
    frameY,
    frameW,
    frameH,
  ]);

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
    startOpenFrameAnimation,
    handleOpenSettled,
  ]);

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

  const pagerStripStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: count * screenW,
    height: screenH,
    transform: [{ translateX: pagerX.value }],
  }));

  const pagerLayerActive = count > 1 && pagerMounted && effectivePhase === 'ready';
  const isInteractable = effectivePhase === 'ready';
  const heroItem = items[slideIndex] ?? activeItem;

  if (count === 0 || !visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={panGesture}>
          <View collapsable={false} style={styles.pagerClip}>
            {effectivePhase && heroItem ? (
              <Animated.View
                pointerEvents={isInteractable ? 'auto' : 'none'}
                style={heroFrameStyle}
                collapsable={false}
              >
                <View style={styles.heroStack} collapsable={false}>
                    <View
                      style={[styles.heroBaseLayer, pagerLayerActive && styles.heroLayerHidden]}
                      pointerEvents="none"
                    >
                      <ViewerSlide
                        key={heroItem.id}
                        item={heroItem}
                        fill
                        active
                        showVideoControls={effectivePhase === 'ready' && !pagerLayerActive}
                      />
                    </View>
                    {pagerLayerActive ? (
                      <Animated.View
                        style={[styles.heroPagerLayer, pagerStripStyle]}
                        pointerEvents="auto"
                        collapsable={false}
                      >
                        {items.map((item, index) => (
                          <ViewerSlide
                            key={item.id}
                            item={item}
                            width={screenW}
                            height={screenH}
                            active={index === slideIndex}
                            showVideoControls={pagerLayerActive && index === slideIndex}
                          />
                        ))}
                      </Animated.View>
                    ) : null}
                </View>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8, opacity: isInteractable ? 1 : 0 }]}
          onPress={requestClose}
          disabled={!isInteractable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <X size={18} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
});

export default ContactProfileMediaViewerModal;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  pagerClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroStack: {
    flex: 1,
    overflow: 'hidden',
  },
  heroBaseLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPagerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroLayerHidden: {
    opacity: 0,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideFill: {
    flex: 1,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    borderRadius: 999,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
