import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Easing,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { VideoRecorderHandle } from './VideoRecorder';
import { RECORD_LIFT, RECORD_LIFT_SPRING, RECORD_OVERLAY_MS, RECORD_ROLLBACK_MS, SPRING_RAIL_RETURN } from './voiceRecorderConstants';
import type { VoiceRecordingState } from './useVoiceRecordingPipeline';

export interface VideoRecordingAnimSync {
  recordLiftSV: SharedValue<number>;
  micDragSV: SharedValue<number>;
  railSV: SharedValue<number>;
  txSV: SharedValue<number>;
  tySV: SharedValue<number>;
  lockFallSV: SharedValue<number>;
  lockLatchSV: SharedValue<number>;
  lockGesturesOffSV: SharedValue<number>;
  overlayOp: SharedValue<number>;
  edgeGlowSV: SharedValue<number>;
}

export interface UseVideoRecordingOrchestrationParams {
  allowVideoRecording: boolean;
  onRecordingChange?: (active: boolean) => void;
  audioState: VoiceRecordingState;
  stateRef: RefObject<VoiceRecordingState>;
  lockDropArmedRef: RefObject<boolean>;
  setCancelActive: (active: boolean) => void;
  anim: VideoRecordingAnimSync;
}

export function useVideoRecordingOrchestration({
  allowVideoRecording,
  onRecordingChange,
  audioState,
  stateRef,
  lockDropArmedRef,
  setCancelActive,
  anim,
}: UseVideoRecordingOrchestrationParams) {
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isVideoLocked, setIsVideoLocked] = useState(false);

  const videoLockArmedRef = useRef(false);
  const videoRecorderRef = useRef<VideoRecorderHandle>(null);
  const isVideoLockedRef = useRef(isVideoLocked);
  const isVideoRecordingRef = useRef(isVideoRecording);

  useEffect(() => {
    isVideoLockedRef.current = isVideoLocked;
  }, [isVideoLocked]);

  useEffect(() => {
    isVideoRecordingRef.current = isVideoRecording;
  }, [isVideoRecording]);

  const {
    recordLiftSV,
    micDragSV,
    railSV,
    txSV,
    tySV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    overlayOp,
    edgeGlowSV,
  } = anim;

  useEffect(() => {
    if (!allowVideoRecording && mediaMode !== 'audio') {
      setMediaMode('audio');
    }
  }, [allowVideoRecording, mediaMode]);

  useEffect(() => {
    const active = isVideoRecording || isVideoLocked;
    if (active) {
      recordLiftSV.value = withSpring(RECORD_LIFT, RECORD_LIFT_SPRING);
      micDragSV.value = isVideoLocked ? 0 : 1;
      railSV.value = 0;
      lockFallSV.value = 0;
      lockLatchSV.value = 0;
      lockGesturesOffSV.value = isVideoLocked ? 1 : 0;
      lockDropArmedRef.current = false;
      overlayOp.value = withTiming(1, { duration: RECORD_OVERLAY_MS });
    } else {
      if (
        stateRef.current === 'RECORDING' ||
        stateRef.current === 'LOCKED' ||
        stateRef.current === 'PAUSED'
      ) {
        return;
      }
      overlayOp.value = withTiming(0, { duration: RECORD_ROLLBACK_MS });
      recordLiftSV.value = withSpring(1, { ...RECORD_LIFT_SPRING, overshootClamping: true });
      micDragSV.value = 0;
      railSV.value = 0;
      txSV.value = withSpring(0, SPRING_RAIL_RETURN);
      tySV.value = withSpring(0, SPRING_RAIL_RETURN);
      lockFallSV.value = 0;
      lockLatchSV.value = 0;
      lockGesturesOffSV.value = 0;
      lockDropArmedRef.current = false;
      videoLockArmedRef.current = false;
      setCancelActive(false);
    }
  }, [
    isVideoRecording,
    isVideoLocked,
    overlayOp,
    recordLiftSV,
    micDragSV,
    railSV,
    txSV,
    tySV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    lockDropArmedRef,
    stateRef,
    setCancelActive,
  ]);

  useEffect(() => {
    if (
      audioState === 'RECORDING' ||
      audioState === 'LOCKED' ||
      isVideoRecording ||
      isVideoLocked
    ) {
      edgeGlowSV.value = withRepeat(
        withSequence(
          withTiming(0.72, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.38, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      edgeGlowSV.value = 0;
    }
  }, [audioState, isVideoRecording, isVideoLocked, edgeGlowSV]);

  const onVideoRecordingChange = useCallback(
    (active: boolean) => {
      setIsVideoRecording(active);
      if (!active) setIsVideoLocked(false);
      onRecordingChange?.(active);
    },
    [onRecordingChange],
  );

  const beginOptimisticVideoHold = useCallback(() => {
    setIsVideoRecording(true);
  }, []);

  const rollbackOptimisticVideoHold = useCallback(() => {
    setIsVideoRecording(false);
    setIsVideoLocked(false);
  }, []);

  const micLayerAboveVideo =
    mediaMode === 'video' && (isVideoRecording || isVideoLocked);

  const showVideoLockFloat = isVideoRecording && !isVideoLocked;

  return {
    mediaMode,
    setMediaMode,
    isVideoRecording,
    isVideoLocked,
    setIsVideoLocked,
    videoRecorderRef,
    videoLockArmedRef,
    isVideoLockedRef,
    isVideoRecordingRef,
    onVideoRecordingChange,
    beginOptimisticVideoHold,
    rollbackOptimisticVideoHold,
    micLayerAboveVideo,
    showVideoLockFloat,
  };
}
