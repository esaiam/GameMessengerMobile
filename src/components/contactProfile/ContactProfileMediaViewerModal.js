import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Modal,
  Image,
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
  runOnUI,
  cancelAnimation,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';

const DISMISS_DRAG = 110;
const DISMISS_VELOCITY = 720;
const AXIS_LOCK_PX = 10;
const SPRING_BACK = { damping: 22, stiffness: 300, mass: 0.85 };
const OPEN_MS = 240;
const CLOSE_MS = 260;
const PAGE_SPRING = {
  damping: 32,
  stiffness: 220,
  mass: 1,
  restDisplacementThreshold: 0.35,
  restSpeedThreshold: 0.35,
};
const OPEN_EASING = Easing.out(Easing.cubic);
const CLOSE_EASING = Easing.in(Easing.cubic);

function clampIndex(idx, count) {
  if (count <= 0) return 0;
  return Math.min(Math.max(idx, 0), count - 1);
}

function cellFlyTargets(o, screenW, contentH, clipCenterY) {
  return {
    x: o.x + o.width / 2 - screenW / 2,
    y: o.y + o.height / 2 - clipCenterY,
    scaleX: o.width / screenW,
    scaleY: o.height / contentH,
  };
}

const ViewerSlide = React.memo(function ViewerSlide({ item, width, height }) {
  const isVideo = item.kind === 'video';

  const player = useVideoPlayer(isVideo ? item.uri : null, (p) => {
    if (!p) return;
    p.loop = false;
  });

  useEffect(() => {
    if (!isVideo || !player) return;
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
  }, [isVideo, player, item.uri]);

  if (isVideo) {
    return (
      <View style={[styles.slide, { width, height }]}>
        <VideoView
          player={player}
          style={styles.media}
          contentFit="contain"
          nativeControls
        />
      </View>
    );
  }

  return (
    <View style={[styles.slide, { width, height }]}>
      <Image source={{ uri: item.uri }} style={styles.media} resizeMode="contain" />
    </View>
  );
});

/**
 * Полноэкранный просмотр: один активный слайд (O(1) по памяти), листание по index.
 *
 * @param {{
 *   visible: boolean,
 *   items: { id: string, uri: string, kind: 'image' | 'video' }[],
 *   viewIndex: number,
 *   getOriginLayout?: (itemId: string) => { x: number, y: number, width: number, height: number } | null | undefined,
 *   initialOriginLayout?: { x: number, y: number, width: number, height: number } | null,
 *   openEpoch?: number,
 *   onClose: () => void,
 *   onIndexChange?: (index: number) => void,
 *   getCloseOriginLayout?: () => { x: number, y: number, width: number, height: number } | null | undefined,
 * }} props
 */
const ContactProfileMediaViewerModal = forwardRef(function ContactProfileMediaViewerModal(
  {
    visible,
    items,
    viewIndex,
    getOriginLayout,
    initialOriginLayout = null,
    openEpoch = 0,
    onClose,
    onIndexChange,
    getCloseOriginLayout,
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const count = items.length;
  const safeIndex = clampIndex(viewIndex, count);
  const activeItem = items[safeIndex] ?? null;

  const modalCenterRef = useRef(null);
  const modalCenterY = useRef(screenH / 2);
  const lastAnimatedEpochRef = useRef(-1);
  const getOriginLayoutRef = useRef(getOriginLayout);
  const getCloseOriginLayoutRef = useRef(getCloseOriginLayout);
  const initialOriginLayoutRef = useRef(initialOriginLayout);
  const onIndexChangeRef = useRef(onIndexChange);
  getOriginLayoutRef.current = getOriginLayout;
  getCloseOriginLayoutRef.current = getCloseOriginLayout;
  initialOriginLayoutRef.current = initialOriginLayout;
  onIndexChangeRef.current = onIndexChange;

  const dismissX = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const dismissScaleX = useSharedValue(1);
  const dismissScaleY = useSharedValue(1);
  const pageDragX = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const axisLock = useSharedValue(0);
  const isClosing = useSharedValue(false);
  const isOpening = useSharedValue(false);
  const originSv = useSharedValue(null);
  const viewIndexSv = useSharedValue(safeIndex);
  const screenDims = useSharedValue({ w: screenW, h: screenH });

  const updateModalCenterFromMarker = useCallback(() => {
    modalCenterRef.current?.measureInWindow((_x, y, _w, h) => {
      if (h > 0) modalCenterY.current = y + h / 2;
    });
  }, []);

  const getClipCenterY = useCallback(() => modalCenterY.current, []);

  useEffect(() => {
    viewIndexSv.value = safeIndex;
  }, [safeIndex, viewIndexSv]);

  useEffect(() => {
    screenDims.value = { w: screenW, h: screenH };
  }, [screenW, screenH, screenDims]);

  useEffect(() => {
    modalCenterY.current = screenH / 2;
    if (visible) updateModalCenterFromMarker();
  }, [screenH, visible, updateModalCenterFromMarker]);

  const finishClose = useCallback(() => {
    isClosing.value = false;
    isOpening.value = false;
    pageDragX.value = 0;
    onClose();
  }, [onClose, isClosing, isOpening, pageDragX]);

  const notifyIndexChange = useCallback(
    (next) => {
      onIndexChangeRef.current?.(next);
      const item = items[next];
      if (!item) return;
      const layout = getOriginLayoutRef.current?.(item.id);
      if (layout?.width > 0) originSv.value = layout;
    },
    [items, originSv],
  );

  const flyToCellWithTargets = useCallback(
    (targets) => {
      'worklet';
      if (isClosing.value) return;
      isClosing.value = true;
      isOpening.value = false;

      cancelAnimation(dismissX);
      cancelAnimation(dismissY);
      cancelAnimation(dismissScaleX);
      cancelAnimation(dismissScaleY);
      cancelAnimation(pageDragX);
      cancelAnimation(backdropOpacity);

      dismissX.value = withTiming(targets.x, { duration: CLOSE_MS, easing: CLOSE_EASING }, (finished) => {
        if (finished) runOnJS(finishClose)();
      });
      dismissY.value = withTiming(targets.y, { duration: CLOSE_MS, easing: CLOSE_EASING });
      dismissScaleX.value = withTiming(targets.scaleX, { duration: CLOSE_MS, easing: CLOSE_EASING });
      dismissScaleY.value = withTiming(targets.scaleY, { duration: CLOSE_MS, easing: CLOSE_EASING });
      backdropOpacity.value = withTiming(0, { duration: CLOSE_MS, easing: CLOSE_EASING });
    },
    [
      isClosing,
      isOpening,
      dismissX,
      dismissY,
      dismissScaleX,
      dismissScaleY,
      pageDragX,
      backdropOpacity,
      finishClose,
    ],
  );

  const startFlyToCell = useCallback(
    (targets) => {
      runOnUI(flyToCellWithTargets)(targets);
    },
    [flyToCellWithTargets],
  );

  const resolveCloseLayout = useCallback(() => {
    const item = items[clampIndex(viewIndex, count)];
    const layout =
      getCloseOriginLayoutRef.current?.() ??
      (item ? getOriginLayoutRef.current?.(item.id) : null) ??
      originSv.value;
    if (layout?.width > 0) originSv.value = layout;
    return layout;
  }, [items, viewIndex, count, originSv]);

  const beginCloseFly = useCallback(() => {
    if (isClosing.value) return;

    if (isOpening.value) {
      cancelAnimation(dismissX);
      cancelAnimation(dismissY);
      cancelAnimation(dismissScaleX);
      cancelAnimation(dismissScaleY);
      cancelAnimation(backdropOpacity);
      isOpening.value = false;
      dismissX.value = 0;
      dismissY.value = 0;
      dismissScaleX.value = 1;
      dismissScaleY.value = 1;
      backdropOpacity.value = 1;
    }

    const frozenLayout = resolveCloseLayout();
    if (!frozenLayout?.width) {
      finishClose();
      return;
    }

    startFlyToCell(cellFlyTargets(frozenLayout, screenW, screenH, getClipCenterY()));
  }, [
    resolveCloseLayout,
    startFlyToCell,
    screenW,
    screenH,
    getClipCenterY,
    finishClose,
    isClosing,
    isOpening,
    dismissX,
    dismissY,
    dismissScaleX,
    dismissScaleY,
    backdropOpacity,
  ]);

  const requestClose = useCallback(() => {
    beginCloseFly();
  }, [beginCloseFly]);

  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    if (visible) return;
    lastAnimatedEpochRef.current = -1;
    isClosing.value = false;
    isOpening.value = false;
    axisLock.value = 0;
    pageDragX.value = 0;
    backdropOpacity.value = 0;
    dismissX.value = 0;
    dismissY.value = 0;
    dismissScaleX.value = 1;
    dismissScaleY.value = 1;
  }, [
    visible,
    isClosing,
    isOpening,
    axisLock,
    pageDragX,
    backdropOpacity,
    dismissX,
    dismissY,
    dismissScaleX,
    dismissScaleY,
  ]);

  useLayoutEffect(() => {
    if (!visible || count === 0 || !activeItem) return;
    if (openEpoch === lastAnimatedEpochRef.current) return;
    lastAnimatedEpochRef.current = openEpoch;

    isClosing.value = false;
    isOpening.value = true;
    axisLock.value = 0;
    pageDragX.value = 0;

    cancelAnimation(dismissX);
    cancelAnimation(dismissY);
    cancelAnimation(dismissScaleX);
    cancelAnimation(dismissScaleY);
    cancelAnimation(backdropOpacity);

    const layout =
      initialOriginLayoutRef.current?.width > 0
        ? initialOriginLayoutRef.current
        : getOriginLayoutRef.current?.(activeItem.id);

    if (layout?.width > 0) {
      originSv.value = layout;
      const t = cellFlyTargets(layout, screenW, screenH, getClipCenterY());
      dismissX.value = t.x;
      dismissY.value = t.y;
      dismissScaleX.value = t.scaleX;
      dismissScaleY.value = t.scaleY;
      backdropOpacity.value = 0;

      dismissX.value = withTiming(0, { duration: OPEN_MS, easing: OPEN_EASING });
      dismissY.value = withTiming(0, { duration: OPEN_MS, easing: OPEN_EASING });
      dismissScaleX.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING });
      dismissScaleY.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING });
      backdropOpacity.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING }, (finished) => {
        if (finished) isOpening.value = false;
      });
      return;
    }

    dismissX.value = 0;
    dismissY.value = 0;
    dismissScaleX.value = 1;
    dismissScaleY.value = 1;
    backdropOpacity.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING }, (finished) => {
      if (finished) isOpening.value = false;
    });
  }, [
    visible,
    openEpoch,
    count,
    activeItem,
    screenW,
    screenH,
    getClipCenterY,
    dismissX,
    dismissY,
    dismissScaleX,
    dismissScaleY,
    backdropOpacity,
    isClosing,
    isOpening,
    axisLock,
    pageDragX,
    originSv,
  ]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          if (isClosing.value || isOpening.value) return;
          axisLock.value = 0;
        })
        .onUpdate((e) => {
          if (count === 0 || isClosing.value || isOpening.value) return;

          if (axisLock.value === 0) {
            const ax = Math.abs(e.translationX);
            const ay = Math.abs(e.translationY);
            if (ax > AXIS_LOCK_PX || ay > AXIS_LOCK_PX) {
              axisLock.value = ay > ax * 0.85 ? 1 : 2;
            }
          }

          if (axisLock.value === 1) {
            pageDragX.value = 0;
            dismissX.value = 0;
            dismissScaleX.value = 1;
            dismissScaleY.value = 1;
            dismissY.value = e.translationY;
            const progress = Math.min(Math.abs(e.translationY) / (screenDims.value.h * 0.45), 1);
            backdropOpacity.value = interpolate(
              progress,
              [0, 1],
              [1, 0.35],
              Extrapolation.CLAMP,
            );
            return;
          }

          if (axisLock.value === 2 && count > 1) {
            dismissY.value = 0;
            pageDragX.value = e.translationX;
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
              runOnJS(beginCloseFly)();
            } else {
              dismissX.value = withSpring(0, SPRING_BACK);
              dismissY.value = withSpring(0, SPRING_BACK);
              dismissScaleX.value = withSpring(1, SPRING_BACK);
              dismissScaleY.value = withSpring(1, SPRING_BACK);
              backdropOpacity.value = withSpring(1, SPRING_BACK);
            }
            axisLock.value = 0;
            return;
          }

          if (axisLock.value === 2 && count > 1) {
            const sw = screenDims.value.w;
            const threshold = sw * 0.18;
            const cur = viewIndexSv.value;
            let next = cur;
            if (e.translationX < -threshold || e.velocityX < -380) {
              next = Math.min(count - 1, cur + 1);
            } else if (e.translationX > threshold || e.velocityX > 380) {
              next = Math.max(0, cur - 1);
            }
            pageDragX.value = withSpring(0, PAGE_SPRING);
            if (next !== cur) {
              viewIndexSv.value = next;
              runOnJS(notifyIndexChange)(next);
            }
          }

          axisLock.value = 0;
        }),
    [
      count,
      viewIndexSv,
      screenDims,
      dismissX,
      dismissY,
      dismissScaleX,
      dismissScaleY,
      pageDragX,
      backdropOpacity,
      axisLock,
      isClosing,
      isOpening,
      beginCloseFly,
      notifyIndexChange,
    ],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const slideStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [
      { translateX: dismissX.value + pageDragX.value },
      { translateY: dismissY.value },
      { scaleX: dismissScaleX.value },
      { scaleY: dismissScaleY.value },
    ],
  }));

  if (count === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.root}>
        <View
          ref={modalCenterRef}
          pointerEvents="none"
          style={styles.modalCenterMarker}
          onLayout={updateModalCenterFromMarker}
        />
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={panGesture}>
          <View collapsable={false} style={styles.pagerClip}>
            {visible && activeItem ? (
              <Animated.View
                style={[styles.slideHost, { width: screenW, height: screenH }, slideStyle]}
              >
                <ViewerSlide
                  key={activeItem.id}
                  item={activeItem}
                  width={screenW}
                  height={screenH}
                />
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={requestClose}
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
  modalCenterMarker: {
    position: 'absolute',
    top: '50%',
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  pagerClip: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideHost: {
    overflow: 'hidden',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
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
