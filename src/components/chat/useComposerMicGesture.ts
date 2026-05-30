import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { triggerRecordStartHaptic } from '../../utils/recordStartHaptic';
import type { VideoRecorderHandle } from './VideoRecorder';
import {
  LOCK_COMMIT_UP_PX,
  CANCEL_SLIDE_RATIO,
  RAIL_LOCK_PX,
  HOLD_DELAY_MS,
  AUDIO_LIFT_PREVIEW_MS,
  HOLD_DRIFT_CANCEL_PX,
  PRESS_DOWN_MS,
  PRESS_DOWN_SCALE,
  PRESS_UP_SPRING,
} from './voiceRecorderConstants';
import type { VoiceRecordingState } from './useVoiceRecordingPipeline';

export interface ComposerMicGestureAnim {
  pressSV: SharedValue<number>;
  recordLiftSV: SharedValue<number>;
  micDragSV: SharedValue<number>;
  txSV: SharedValue<number>;
  tySV: SharedValue<number>;
  railSV: SharedValue<number>;
  lockFallSV: SharedValue<number>;
  lockLatchSV: SharedValue<number>;
  lockGesturesOffSV: SharedValue<number>;
  maxSlideXSV: SharedValue<number>;
}

export interface UseComposerMicGestureParams {
  stateRef: RefObject<VoiceRecordingState>;
  lockDropArmedRef: RefObject<boolean>;
  holdRefs: {
    holdCancelledRef: RefObject<boolean>;
    isHoldingRef: RefObject<boolean>;
  };
  anim: ComposerMicGestureAnim;
  doStart: () => void | Promise<void>;
  doCancel: () => void | Promise<void>;
  doSend: () => void | Promise<void>;
  playLockDropThenLock: () => void;
  beginAudioLiftPreview: () => void;
  rollbackAudioLiftPreview: () => boolean;
  commitAudioRecording: () => void;
  beginOptimisticVideoHold: () => void;
  rollbackOptimisticVideoHold: () => void;
  setCancelActive: (active: boolean) => void;
  mediaMode: 'audio' | 'video';
  allowVideoRecording: boolean;
  setMediaMode: React.Dispatch<React.SetStateAction<'audio' | 'video'>>;
  videoRecorderRef: RefObject<VideoRecorderHandle | null>;
  videoLockArmedRef: RefObject<boolean>;
  isVideoLockedRef: RefObject<boolean>;
  isVideoRecordingRef: RefObject<boolean>;
  setIsVideoLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useComposerMicGesture({
  stateRef,
  lockDropArmedRef,
  holdRefs,
  anim,
  doStart,
  doCancel,
  doSend,
  playLockDropThenLock,
  beginAudioLiftPreview,
  rollbackAudioLiftPreview,
  commitAudioRecording,
  beginOptimisticVideoHold,
  rollbackOptimisticVideoHold,
  setCancelActive,
  mediaMode,
  allowVideoRecording,
  setMediaMode,
  videoRecorderRef,
  videoLockArmedRef,
  isVideoLockedRef,
  isVideoRecordingRef,
  setIsVideoLocked,
}: UseComposerMicGestureParams) {
  const { holdCancelledRef, isHoldingRef } = holdRefs;
  const {
    pressSV,
    micDragSV,
    txSV,
    tySV,
    railSV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    maxSlideXSV,
  } = anim;

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liftPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const clearLiftPreviewTimer = useCallback(() => {
    if (liftPreviewTimerRef.current !== null) {
      clearTimeout(liftPreviewTimerRef.current);
      liftPreviewTimerRef.current = null;
    }
  }, []);

  const clearAllHoldTimers = useCallback(() => {
    clearHoldTimer();
    clearLiftPreviewTimer();
  }, [clearHoldTimer, clearLiftPreviewTimer]);

  useEffect(() => {
    return () => {
      holdCancelledRef.current = true;
      isHoldingRef.current = false;
      clearAllHoldTimers();
    };
  }, [clearAllHoldTimers, holdCancelledRef, isHoldingRef]);

  const pressDown = useCallback(() => {
    pressSV.value = withTiming(PRESS_DOWN_SCALE, { duration: PRESS_DOWN_MS });
  }, [pressSV]);

  const pressUp = useCallback(() => {
    pressSV.value = withSpring(1, PRESS_UP_SPRING);
  }, [pressSV]);

  const scheduleAudioLiftPreview = useCallback(() => {
    clearLiftPreviewTimer();
    if (stateRef.current !== 'IDLE') return;
    if (allowVideoRecording && mediaMode === 'video') return;
    liftPreviewTimerRef.current = setTimeout(() => {
      liftPreviewTimerRef.current = null;
      if (holdCancelledRef.current || stateRef.current !== 'IDLE') return;
      beginAudioLiftPreview();
    }, AUDIO_LIFT_PREVIEW_MS);
  }, [
    clearLiftPreviewTimer,
    stateRef,
    holdCancelledRef,
    allowVideoRecording,
    mediaMode,
    beginAudioLiftPreview,
  ]);

  const scheduleHold = useCallback(() => {
    clearAllHoldTimers();
    if (stateRef.current !== 'IDLE') return;
    isHoldingRef.current = false;
    holdCancelledRef.current = false;
    lockDropArmedRef.current = false;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    railSV.value = 0;
    txSV.value = 0;
    tySV.value = 0;
    scheduleAudioLiftPreview();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      if (holdCancelledRef.current || stateRef.current !== 'IDLE') return;
      isHoldingRef.current = true;
      triggerRecordStartHaptic();
      if (allowVideoRecording && mediaMode === 'video') {
        beginOptimisticVideoHold();
        void videoRecorderRef.current?.beginInlineHold().then((ok) => {
          if (!ok) rollbackOptimisticVideoHold();
        });
      } else {
        commitAudioRecording();
        void doStart();
      }
    }, HOLD_DELAY_MS);
  }, [
    clearAllHoldTimers,
    scheduleAudioLiftPreview,
    stateRef,
    isHoldingRef,
    holdCancelledRef,
    lockDropArmedRef,
    lockLatchSV,
    lockGesturesOffSV,
    railSV,
    txSV,
    tySV,
    doStart,
    mediaMode,
    allowVideoRecording,
    videoRecorderRef,
    commitAudioRecording,
    beginOptimisticVideoHold,
    rollbackOptimisticVideoHold,
  ]);

  const sendPanToVideo = useCallback(
    (tx: number, ty: number) => {
      videoRecorderRef.current?.onPanUpdate(tx, ty);
    },
    [videoRecorderRef],
  );

  const handlePanMove = useCallback(
    (projTx: number, projTy: number, rail: number, rawDy: number, maxSlideX: number) => {
      if (
        !isHoldingRef.current &&
        (holdTimerRef.current !== null || liftPreviewTimerRef.current !== null) &&
        (Math.abs(projTx) > HOLD_DRIFT_CANCEL_PX || Math.abs(rawDy) > HOLD_DRIFT_CANCEL_PX)
      ) {
        holdCancelledRef.current = true;
        clearAllHoldTimers();
        rollbackAudioLiftPreview();
        railSV.value = 0;
        txSV.value = 0;
        tySV.value = 0;
        micDragSV.value = 0;
      }
      const half = Math.max(24, maxSlideX * 0.5);
      const leftHint = rail !== 2 && projTx < -half;
      if (stateRef.current === 'RECORDING' || isHoldingRef.current) {
        setCancelActive(leftHint);
      } else {
        return;
      }
      if ((rail === 0 || rail === 2) && rawDy < -LOCK_COMMIT_UP_PX) {
        if (mediaMode === 'video') {
          videoLockArmedRef.current = true;
        } else {
          playLockDropThenLock();
        }
      }
      if (mediaMode === 'video') {
        sendPanToVideo(projTx, projTy);
      }
    },
    [
      clearAllHoldTimers,
      rollbackAudioLiftPreview,
      playLockDropThenLock,
      txSV,
      tySV,
      railSV,
      micDragSV,
      mediaMode,
      sendPanToVideo,
      stateRef,
      isHoldingRef,
      holdCancelledRef,
      setCancelActive,
      videoLockArmedRef,
    ],
  );

  const handleGestureEnd = useCallback(
    (projTx: number, rail: number, maxSlideX: number) => {
      clearAllHoldTimers();
      if (!isHoldingRef.current) {
        holdCancelledRef.current = true;
        const hadAudioPreview = rollbackAudioLiftPreview();
        if (isVideoLockedRef.current) {
          setIsVideoLocked(false);
          videoRecorderRef.current?.sendLocked();
          return;
        }
        if (
          !hadAudioPreview &&
          stateRef.current === 'IDLE' &&
          allowVideoRecording &&
          !isVideoRecordingRef.current
        ) {
          if (mediaMode === 'video') {
            setMediaMode('audio');
          } else {
            setMediaMode('video');
          }
        }
        return;
      }
      isHoldingRef.current = false;
      const s = stateRef.current;
      if (mediaMode === 'video' && s === 'IDLE') {
        const need = Math.max(40, maxSlideX * CANCEL_SLIDE_RATIO);
        const cancelSlide = (rail === 1 || rail === 0) && projTx < -need;
        const shouldLock = videoLockArmedRef.current && !cancelSlide;
        videoLockArmedRef.current = false;
        if (shouldLock) {
          setIsVideoLocked(true);
          videoRecorderRef.current?.lock();
        } else {
          videoRecorderRef.current?.endInlineHold({ cancelSlide });
        }
        return;
      }
      if (s === 'LOCKED' || s === 'PAUSED') return;
      if (s === 'IDLE') {
        holdCancelledRef.current = true;
        return;
      }
      if (lockDropArmedRef.current) return;
      const canCancelBySlide = rail === 1 || rail === 0;
      const need = Math.max(40, maxSlideX * CANCEL_SLIDE_RATIO);
      if (canCancelBySlide && projTx < -need) void doCancel();
      else void doSend();
    },
    [
      clearAllHoldTimers,
      rollbackAudioLiftPreview,
      doCancel,
      doSend,
      mediaMode,
      allowVideoRecording,
      stateRef,
      isHoldingRef,
      holdCancelledRef,
      lockDropArmedRef,
      videoLockArmedRef,
      isVideoLockedRef,
      isVideoRecordingRef,
      setIsVideoLocked,
      videoRecorderRef,
      setMediaMode,
    ],
  );

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      'worklet';
      railSV.value = 0;
      lockLatchSV.value = 0;
      lockGesturesOffSV.value = 0;
      runOnJS(pressDown)();
      runOnJS(scheduleHold)();
    })
    .onUpdate((e) => {
      'worklet';
      if (lockGesturesOffSV.value > 0.5) {
        return;
      }
      const dx = e.translationX;
      const dy = e.translationY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const m = maxSlideXSV.value;
      const clampX = (x: number) => Math.max(-m, Math.min(0, x));
      const capY = -LOCK_COMMIT_UP_PX;
      const clampY = (y: number) => Math.min(0, Math.max(y, capY));
      if (micDragSV.value > 0.5 && lockLatchSV.value > 0.5) {
        if (railSV.value === 1) {
          txSV.value = clampX(dx);
        }
        runOnJS(handlePanMove)(txSV.value, tySV.value, railSV.value, dy, m);
        return;
      }
      if (railSV.value === 0 && dist > RAIL_LOCK_PX) {
        railSV.value = Math.abs(dx) >= Math.abs(dy) ? 1 : 2;
      }
      if (railSV.value === 1) {
        txSV.value = clampX(dx);
        tySV.value = 0;
      } else if (railSV.value === 2) {
        txSV.value = 0;
        tySV.value = clampY(dy);
      } else if (Math.abs(dx) >= Math.abs(dy)) {
        txSV.value = clampX(dx);
        tySV.value = 0;
      } else {
        txSV.value = 0;
        tySV.value = clampY(dy);
      }
      runOnJS(handlePanMove)(txSV.value, tySV.value, railSV.value, dy, m);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(handleGestureEnd)(txSV.value, railSV.value, maxSlideXSV.value);
      runOnJS(pressUp)();
    });

  const micAnimStyle = useAnimatedStyle(() => {
    const tx = micDragSV.value * txSV.value;
    const s = pressSV.value * anim.recordLiftSV.value;
    return {
      transform: [{ translateX: tx }, { scale: s }],
    };
  });

  const onVoiceMountLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) maxSlideXSV.value = Math.max(48, Math.floor(w / 3));
    },
    [maxSlideXSV],
  );

  return {
    gesture,
    micAnimStyle,
    onVoiceMountLayout,
  };
}
