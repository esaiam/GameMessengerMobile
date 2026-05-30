import React, { memo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import VideoRecorder from './VideoRecorder';
import {
  LOCK_COMMIT_UP_PX,
  LOCK_FLOAT_EXTRA,
  MIC_VIDEO_FRONT_Z,
} from './voiceRecorderConstants';
import { PausedPreviewBar } from './PausedPreviewBar';
import { VoiceRecordingOverlay } from './VoiceRecordingOverlay';
import { useVoiceRecordingPipeline } from './useVoiceRecordingPipeline';
import { useComposerMicGesture } from './useComposerMicGesture';
import { useVideoRecordingOrchestration } from './useVideoRecordingOrchestration';
import { ComposerMicButton } from './ComposerMicButton';

interface Props {
  onSendAudio: (uri: string, duration: number, waveform: number[]) => void;
  onRecordingChange?: (active: boolean) => void;
  uploadMedia: (uri: string, folder: string, ext: string, contentType: string) => Promise<string>;
  sendMediaMessage: (type: string, url: string, extra?: Record<string, unknown>) => Promise<void>;
  onOpen?: () => void;
  onVideoRecorded?: (localUri: string) => void;
  onVideoSendError?: () => void;
  onVideoUploadFinished?: () => void;
  /** false — только голос (чат Aria: без upload video). */
  allowVideoRecording?: boolean;
}

function VoiceRecorder({
  onSendAudio,
  onRecordingChange,
  uploadMedia,
  sendMediaMessage,
  onOpen,
  onVideoRecorded,
  onVideoSendError,
  onVideoUploadFinished,
  allowVideoRecording = true,
}: Props) {
  const holdCancelledRef = useRef(false);
  const isHoldingRef = useRef(false);

  const pressSV = useSharedValue(1);
  const recordLiftSV = useSharedValue(1);
  const micDragSV = useSharedValue(0);
  const edgeGlowSV = useSharedValue(0);
  const txSV = useSharedValue(0);
  const tySV = useSharedValue(0);
  const railSV = useSharedValue(0);
  const maxSlideXSV = useSharedValue(120);
  const lockFallSV = useSharedValue(0);
  const lockLatchSV = useSharedValue(0);
  const lockGesturesOffSV = useSharedValue(0);
  const dotOp = useSharedValue(1);
  const overlayOp = useSharedValue(0);

  const audio = useVoiceRecordingPipeline({
    onSendAudio,
    onRecordingChange,
    anim: {
      pressSV,
      overlayOp,
      recordLiftSV,
      micDragSV,
      railSV,
      txSV,
      tySV,
      lockFallSV,
      lockLatchSV,
      lockGesturesOffSV,
      edgeGlowSV,
      dotOp,
    },
    holdRefs: { holdCancelledRef, isHoldingRef },
  });

  const {
    state,
    stateRef,
    dur,
    bars,
    cancelActive,
    setCancelActive,
    savedUriRef,
    handlePausedTrim,
    lockDropArmedRef,
    isAudioOverlayActive,
    doStart,
    doSend,
    doCancel,
    doPause,
    playLockDropThenLock,
  } = audio;

  const video = useVideoRecordingOrchestration({
    allowVideoRecording,
    onRecordingChange,
    audioState: state,
    stateRef,
    lockDropArmedRef,
    setCancelActive,
    anim: {
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
    },
  });

  const {
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
    micLayerAboveVideo,
    showVideoLockFloat,
  } = video;

  const { gesture, micAnimStyle, onVoiceMountLayout } = useComposerMicGesture({
    stateRef,
    lockDropArmedRef,
    holdRefs: { holdCancelledRef, isHoldingRef },
    anim: {
      pressSV,
      recordLiftSV,
      micDragSV,
      txSV,
      tySV,
      railSV,
      lockFallSV,
      lockLatchSV,
      lockGesturesOffSV,
      maxSlideXSV,
    },
    doStart,
    doCancel,
    doSend,
    playLockDropThenLock,
    setCancelActive,
    mediaMode,
    allowVideoRecording,
    setMediaMode,
    videoRecorderRef,
    videoLockArmedRef,
    isVideoLockedRef,
    isVideoRecordingRef,
    setIsVideoLocked,
  });

  const lockAboveAnimStyle = useAnimatedStyle(() => {
    const dy = Math.min(0, tySV.value);
    const fall = lockFallSV.value;
    return {
      transform: [{ translateY: dy - LOCK_FLOAT_EXTRA + fall }],
      opacity: Math.max(0.55, 1 - Math.abs(dy) / (LOCK_COMMIT_UP_PX * 1.35)),
    };
  });

  const lockLockFadeStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(Math.min(0, tySV.value)) / LOCK_COMMIT_UP_PX);
    return { opacity: 1 - p };
  });

  const lockUnlockFadeStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(Math.min(0, tySV.value)) / LOCK_COMMIT_UP_PX);
    return { opacity: p };
  });

  const dotAnimStyle = useAnimatedStyle(() => ({ opacity: dotOp.value }));

  const overlayAnimStyle = useAnimatedStyle(() => ({ opacity: overlayOp.value }));

  const isMicActive =
    state === 'RECORDING' || state === 'LOCKED' || isVideoRecording || isVideoLocked;
  const isAudioRecording = state === 'RECORDING' || state === 'LOCKED';

  if (state === 'PAUSED') {
    return (
      <PausedPreviewBar
        uri={savedUriRef.current}
        bars={bars}
        dur={dur}
        onTrim={handlePausedTrim}
        onCancel={() => void doCancel()}
        onSend={() => void doSend()}
      />
    );
  }

  return (
    <View style={styles.voiceRecorderShell} pointerEvents="box-none" collapsable={false}>
      <View
        style={styles.voiceMount}
        pointerEvents="box-none"
        collapsable={false}
        onLayout={onVoiceMountLayout}
      >
        <VoiceRecordingOverlay
          showLockFloat={state === 'RECORDING' || showVideoLockFloat}
          showPauseAbove={state === 'LOCKED'}
          isOverlayActive={isAudioOverlayActive}
          state={state === 'LOCKED' ? 'LOCKED' : 'RECORDING'}
          dur={dur}
          cancelActive={cancelActive}
          lockAboveAnimStyle={lockAboveAnimStyle}
          lockLockFadeStyle={lockLockFadeStyle}
          lockUnlockFadeStyle={lockUnlockFadeStyle}
          overlayAnimStyle={overlayAnimStyle}
          dotAnimStyle={dotAnimStyle}
          onPause={() => void doPause()}
          onCancel={() => void doCancel()}
        />
      </View>
      {allowVideoRecording ? (
        <VideoRecorder
          ref={videoRecorderRef}
          uploadMedia={uploadMedia}
          sendMediaMessage={sendMediaMessage}
          onOpen={onOpen}
          onVideoRecorded={onVideoRecorded}
          onVideoSendError={onVideoSendError}
          onVideoUploadFinished={onVideoUploadFinished}
          onRecordingChange={onVideoRecordingChange}
          cancelActive={cancelActive}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.micAfterVideoLayer, micLayerAboveVideo && styles.micAfterVideoLayerOnTop]}
      >
        <ComposerMicButton
          gesture={gesture}
          micAnimStyle={micAnimStyle}
          edgeGlowSV={edgeGlowSV}
          isMicActive={isMicActive}
          isAudioRecording={isAudioRecording}
          isVideoRecording={isVideoRecording}
          isVideoLocked={isVideoLocked}
          allowVideoRecording={allowVideoRecording}
          mediaMode={mediaMode}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  voiceRecorderShell: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  voiceMount: {
    ...StyleSheet.absoluteFillObject,
  },
  micAfterVideoLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  micAfterVideoLayerOnTop: {
    zIndex: MIC_VIDEO_FRONT_Z,
    elevation: MIC_VIDEO_FRONT_Z,
  },
});

const VoiceRecorderMemo = memo(VoiceRecorder);
VoiceRecorderMemo.displayName = 'VoiceRecorder';
export default VoiceRecorderMemo;
