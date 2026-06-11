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
  TouchableOpacity,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
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
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';
import ContactProfileViewerSlide from './ContactProfileViewerSlide';
import {
  alignOpenSourceRect,
  isValidMediaTransitionRect,
} from './mediaTransitionSource';
import { formatRect, logMediaViewer } from './mediaViewerDebugLog';
import {
  AXIS_LOCK_PX,
  DISMISS_DRAG,
  DISMISS_VELOCITY,
  OPEN_EASING,
  OPEN_MS,
  PAGE_SPRING,
  SPRING_BACK,
  clampIndex,
} from './viewer/mediaViewerConstants';
import { useMediaViewerFrameAnim } from './viewer/useMediaViewerFrameAnim';

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

  const safeIndexRef = useRef(safeIndex);
  const slideIndexRef = useRef(safeIndex);
  safeIndexRef.current = safeIndex;
  slideIndexRef.current = slideIndex;

  const axisLock = useSharedValue(0);

  const {
    frameAnimRefs: {
      lastAnimatedEpochRef,
      openFlyGenRef,
      openSettleGenRef,
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
    beginCloseFly,
    requestClose,
    startOpenFrameAnimation,
    handleOpenSettled,
    resetFrameOnInvisible,
  } = useMediaViewerFrameAnim({
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
  });

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
  }, [visible, axisLock, clearCloseSafetyTimer, resetFrameOnInvisible]);

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
                      <ContactProfileViewerSlide
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
                          <ContactProfileViewerSlide
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
  closeBtn: {
    position: 'absolute',
    right: 16,
    borderRadius: 999,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
