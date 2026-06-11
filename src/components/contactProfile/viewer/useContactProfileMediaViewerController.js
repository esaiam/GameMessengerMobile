import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { clampIndex } from './mediaViewerConstants';
import { useMediaViewerFrameAnim } from './useMediaViewerFrameAnim';
import { useMediaViewerPanGesture } from './useMediaViewerPanGesture';
import { useMediaViewerPhase } from './useMediaViewerPhase';

/**
 * @param {ContactProfileMediaViewerModalProps} props
 * @param {React.Ref<{ close: () => void }>} ref
 */
export function useContactProfileMediaViewerController(
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
  const { width: screenW, height: screenH } = useWindowDimensions();

  const count = items.length;
  const safeIndex = clampIndex(viewIndex, count);
  const activeItem = items[safeIndex] ?? null;

  /** @type {['opening' | 'ready' | 'closing' | null]} */
  const [viewerPhase, setViewerPhase] = useState(null);
  const [slideIndex, setSlideIndex] = useState(safeIndex);
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

  const panGesture = useMediaViewerPanGesture({
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
  });

  useMediaViewerPhase({
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
  });

  if (count === 0 || !visible) return null;

  return {
    visible,
    items,
    count,
    screenW,
    screenH,
    slideIndex,
    effectivePhase,
    heroItem: items[slideIndex] ?? activeItem,
    pagerLayerActive: count > 1 && pagerMounted && effectivePhase === 'ready',
    isInteractable: effectivePhase === 'ready',
    requestClose,
    panGesture,
    backdropStyle,
    heroFrameStyle,
    pagerX,
  };
}
