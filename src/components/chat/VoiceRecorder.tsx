import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS } from 'react-native-reanimated';
import { Mic, Video as VideoIcon } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { triggerRecordStartHaptic } from '../../utils/recordStartHaptic';
import VideoRecorder, { type VideoRecorderHandle } from './VideoRecorder';
import {
  LOCK_COMMIT_UP_PX,
  CANCEL_SLIDE_RATIO,
  RAIL_LOCK_PX,
  SPRING_RAIL_RETURN,
  MIC_INNER,
  MIC_OUTER,
  MIC_ICON_SPEC,
  MIC_ICON_ON_SAGE,
  RECORD_LIFT,
  LOCK_FLOAT_EXTRA,
  EDGE_GLOW_SIZE,
  MIC_VIDEO_FRONT_Z } from './voiceRecorderConstants';
import { PausedPreviewBar } from './PausedPreviewBar';
import { VoiceRecordingOverlay } from './VoiceRecordingOverlay';
import { useVoiceRecordingPipeline } from './useVoiceRecordingPipeline';

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

// ─── Main component ───────────────────────────────────────────────────────────
function VoiceRecorder({
  onSendAudio,
  onRecordingChange,
  uploadMedia,
  sendMediaMessage,
  onOpen,
  onVideoRecorded,
  onVideoSendError,
  onVideoUploadFinished,
  allowVideoRecording = true }: Props) {
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isVideoLocked, setIsVideoLocked] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const holdCancelledRef = useRef(false);
  const videoLockArmedRef = useRef(false);
  const videoRecorderRef = useRef<VideoRecorderHandle>(null);

  // ── Reanimated shared values ────────────────────────────────────────────────
  /** Удержание пальца: 0.93 → spring 1 (спек onPressIn / onPressOut) */
  const pressSV = useSharedValue(1);
  /** Увеличение микрофона при записи: 1 → RECORD_LIFT */
  const recordLiftSV = useSharedValue(1);
  /** 1 — можно смещать микрофон за пальцем (после старта записи) */
  const micDragSV = useSharedValue(0);
  /** Мягкое свечение по краю круга: 0 = нет, 1 = пик пульса (RECORDING / LOCKED) */
  const edgeGlowSV = useSharedValue(0);
  const txSV = useSharedValue(0);   // pan X (≤ 0 = left)
  const tySV = useSharedValue(0);   // pan Y (≤ 0 = вверх)
  /** 0 — ось не зафиксирована; 1 — рельс «влево»; 2 — рельс «вверх» */
  const railSV = useSharedValue(0);
  /** Макс. сдвиг микрофона влево (≈ треть ширины капсулы), задаётся из onLayout voiceMount */
  const maxSlideXSV = useSharedValue(120);
  /** Доп. сдвиг замка вниз при «падении» перед закреплением */
  const lockFallSV = useSharedValue(0);
  /** 1 — идёт анимация latch (падение + приземление); жест не трогает ty */
  const lockLatchSV = useSharedValue(0);
  /** 1 — LOCKED: не применять pan к ty/tx (убирает дёрганье после закрепления) */
  const lockGesturesOffSV = useSharedValue(0);
  const dotOp = useSharedValue(1);
  const overlayOp = useSharedValue(0);
  const isMicActiveSV = useSharedValue(0);

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

  // ── Mode morph (audio ↔ video) ──────────────────────────────────────────────
  const modeMorphSV = useSharedValue(mediaMode === 'video' ? 1 : 0);
  useEffect(() => {
    if (!allowVideoRecording && mediaMode !== 'audio') {
      setMediaMode('audio');
    }
  }, [allowVideoRecording, mediaMode]);
  useEffect(() => {
    // Only morph when user toggles modes in IDLE (recording state forces mic anyway).
    modeMorphSV.value = withTiming(mediaMode === 'video' ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic) });
  }, [mediaMode, modeMorphSV]);

  // ── Video: mirror audio button lift (overlay — только в VideoRecorder) ───────
  useEffect(() => {
    const active = isVideoRecording || isVideoLocked;
    if (active) {
      recordLiftSV.value = withSpring(RECORD_LIFT, { damping: 14, stiffness: 140 });
      micDragSV.value = isVideoLocked ? 0 : 1;
      railSV.value = 0;
      lockFallSV.value = 0;
      lockLatchSV.value = 0;
      lockGesturesOffSV.value = isVideoLocked ? 1 : 0;
      lockDropArmedRef.current = false;
    } else {
      // Don't fight audio recording state machine.
      if (stateRef.current === 'RECORDING' || stateRef.current === 'LOCKED' || stateRef.current === 'PAUSED') return;
      overlayOp.value = withTiming(0, { duration: 150 });
      recordLiftSV.value = withSpring(1, { damping: 14, stiffness: 140, overshootClamping: true });
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
    lockGesturesOffSV]);

  // ── Свечение по краю: узкий диапазон + дольше цикл (слабая пульсация) ─────────
  useEffect(() => {
    if (state === 'RECORDING' || state === 'LOCKED' || isVideoRecording || isVideoLocked) {
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
  }, [state, isVideoRecording, isVideoLocked, edgeGlowSV]);

  // ── Gesture JS callbacks (JS-thread only) ───────────────────────────────────
  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      holdCancelledRef.current = true;
      isHoldingRef.current = false;
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  const pressDown = useCallback(() => {
    pressSV.value = withTiming(0.93, { duration: 80 });
  }, [pressSV]);

  const pressUp = useCallback(() => {
    pressSV.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, [pressSV]);

  /** Schedules recording start after HOLD_MS. Mirrors original PanResponder logic. */
  const scheduleHold = useCallback(() => {
    clearHoldTimer();
    // Don't start a new hold if already recording/locked/paused
    if (stateRef.current !== 'IDLE') return;
    isHoldingRef.current = false;
    holdCancelledRef.current = false;
    lockDropArmedRef.current = false;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    railSV.value = 0;
    txSV.value = 0;
    tySV.value = 0;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      if (holdCancelledRef.current || stateRef.current !== 'IDLE') return;
      isHoldingRef.current = true;
      triggerRecordStartHaptic();
      if (allowVideoRecording && mediaMode === 'video') {
        void videoRecorderRef.current?.beginInlineHold();
      } else {
        void doStart();
      }
    }, 220);
  }, [clearHoldTimer, txSV, tySV, railSV, lockLatchSV, lockGesturesOffSV, doStart, mediaMode, allowVideoRecording]);

  const sendPanToVideo = useCallback((tx: number, ty: number) => {
    videoRecorderRef.current?.onPanUpdate(tx, ty);
  }, []);

  const handlePanMove = useCallback(
    (projTx: number, projTy: number, rail: number, rawDy: number, maxSlideX: number) => {
      // До старта записи: сдвиг >14px — отменить ожидание удержания (как в PanResponder)
      if (!isHoldingRef.current && holdTimerRef.current !== null &&
          (Math.abs(projTx) > 14 || Math.abs(rawDy) > 14)) {
        holdCancelledRef.current = true;
        clearHoldTimer();
        railSV.value = 0;
        txSV.value = 0;
        tySV.value = 0;
        micDragSV.value = 0;
      }
      const half = Math.max(24, maxSlideX * 0.5);
      const leftHint = rail !== 2 && projTx < -half;
      if (stateRef.current === 'RECORDING') {
        setCancelActive(leftHint);
      } else if (mediaMode === 'video' && isHoldingRef.current) {
        setCancelActive(leftHint);
      } else {
        return;
      }
      // Вверх на ~1 см → падение и закрепление (не на горизонтальном рельсе)
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
    [clearHoldTimer, playLockDropThenLock, txSV, tySV, railSV, micDragSV, mediaMode, sendPanToVideo],
  );

  const handleGestureEnd = useCallback(
    (projTx: number, rail: number, maxSlideX: number) => {
      clearHoldTimer();
      if (!isHoldingRef.current) {
        holdCancelledRef.current = true;
        if (stateRef.current === 'IDLE' && allowVideoRecording) {
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
      // Already locked/paused — finger lift doesn't stop recording
      if (s === 'LOCKED' || s === 'PAUSED') return;
      if (s === 'IDLE') {
        holdCancelledRef.current = true;
        return;
      }
      // Анимация закрепления — не интерпретировать отпускание как «отправить»
      if (lockDropArmedRef.current) return;
      // Отмена только если не «чисто вертикальный» рельс (вверх — замок, не отмена по X)
      const canCancelBySlide = rail === 1 || rail === 0;
      const need = Math.max(40, maxSlideX * CANCEL_SLIDE_RATIO);
      if (canCancelBySlide && projTx < -need) void doCancel();
      else void doSend();
    },
    [clearHoldTimer, doCancel, doSend, mediaMode, allowVideoRecording],
  );

  // ── Gesture: minDistance(0) — сразу тянется за пальцем; корень не должен remount
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
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          txSV.value = clampX(dx);
          tySV.value = 0;
        } else {
          txSV.value = 0;
          tySV.value = clampY(dy);
        }
      }
      runOnJS(handlePanMove)(txSV.value, tySV.value, railSV.value, dy, m);
    })
    .onFinalize(() => {
      'worklet';
      // onEnd иногда не вызывается при коротком тапе; финализация — стабильный «палец отпустили»
      runOnJS(handleGestureEnd)(txSV.value, railSV.value, maxSlideXSV.value);
      runOnJS(pressUp)();
    });

  // ── Animated styles ─────────────────────────────────────────────────────────
  const isIos = Platform.OS === 'ios';
  const micAnimStyle = useAnimatedStyle(() => {
    const tx = micDragSV.value * txSV.value;
    const s = pressSV.value * recordLiftSV.value;
    const out: ViewStyle = {
      transform: [{ translateX: tx }, { scale: s }] };
    return out;
  });

  /** Лёгкая «дымчатая» подсветка по периметру (тень, без увеличения габарита) */
  const edgeGlowAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const t = edgeGlowSV.value;
    if (isIos) {
      return {
        shadowColor: V.accentSage,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.05 + t * 0.05,
        shadowRadius: 2 + t * 2 };
    }
    return {
      elevation: 2 + t * 0.8 };
  });

  const lockAboveAnimStyle = useAnimatedStyle(() => {
    const dy = Math.min(0, tySV.value);
    const fall = lockFallSV.value;
    return {
      transform: [{ translateY: dy - LOCK_FLOAT_EXTRA + fall }],
      opacity: Math.max(0.55, 1 - Math.abs(dy) / (LOCK_COMMIT_UP_PX * 1.35)) };
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

  const micIconMicAnimStyle = useAnimatedStyle(() => {
    const active = isMicActiveSV.value > 0.5;
    if (active) return { opacity: 1, transform: [{ scale: 1 }] };
    const t = 1 - modeMorphSV.value; // 1 = audio, 0 = video
    const op = interpolate(t, [0, 1], [0, 1]);
    const rot = interpolate(t, [0, 1], [90, 0]);
    const sc = interpolate(t, [0, 1], [0.92, 1]);
    return {
      opacity: op,
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }] } as ViewStyle;
  });

  const micIconVideoAnimStyle = useAnimatedStyle(() => {
    const active = isMicActiveSV.value > 0.5;
    if (active) return { opacity: 0, transform: [{ scale: 0.92 }] };
    const t = modeMorphSV.value; // 0 = audio, 1 = video
    const op = interpolate(t, [0, 1], [0, 1]);
    const rot = interpolate(t, [0, 1], [-90, 0]);
    const sc = interpolate(t, [0, 1], [0.92, 1]);
    return {
      opacity: op,
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }] } as ViewStyle;
  });

  const onVoiceMountLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) maxSlideXSV.value = Math.max(48, Math.floor(w / 3));
    },
    [maxSlideXSV],
  );

  const isMicActive = state === 'RECORDING' || state === 'LOCKED' || isVideoRecording || isVideoLocked;
  useEffect(() => {
    isMicActiveSV.value = isMicActive ? 1 : 0;
  }, [isMicActive, isMicActiveSV]);
  /** Поднять слой только когда поверх лежит inline-overlay VideoRecorder (z 201) */
  const micLayerAboveVideo =
    mediaMode === 'video' && (isVideoRecording || isVideoLocked);

  // ── Mic: слот фиксированной ширины (правый край капсулы не смещается), ×3 + glow ─
  const micEl = (
    <View
      style={[styles.micPos, (isMicActive || isVideoRecording || isVideoLocked) && styles.micPosOnTop]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.micAssembly, micAnimStyle]}>
          {isMicActive ? (
            <Animated.View
              style={[styles.micEdgeGlow, edgeGlowAnimStyle]}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.micGlowRing} pointerEvents="none" />
          <View style={styles.micInsetWell} pointerEvents="none">
            <View
              style={[
                styles.micCircle,
                isMicActive ? styles.micCircleRecording : styles.micCircleIdle]}
            >
              {allowVideoRecording ? (
                <View style={styles.micIconStack} pointerEvents="none">
                  <Animated.View style={[styles.micIconAbs, micIconMicAnimStyle]}>
                    <Mic
                      size={MIC_ICON_SPEC}
                      color={MIC_ICON_ON_SAGE}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                  <Animated.View style={[styles.micIconAbs, micIconVideoAnimStyle]}>
                    <VideoIcon
                      size={MIC_ICON_SPEC}
                      color={MIC_ICON_ON_SAGE}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                </View>
              ) : (
                <Mic
                  size={MIC_ICON_SPEC}
                  color={MIC_ICON_ON_SAGE}
                  strokeWidth={1.5}
                />
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );

  // ── PAUSED: отдельный экран (жест уже завершён) ─────────────────────────────
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

  /** IDLE / RECORDING / LOCKED: один корень — GestureDetector не remount при go(RECORDING) */
  return (
    <View style={styles.voiceRecorderShell} pointerEvents="box-none" collapsable={false}>
    <View
      style={styles.voiceMount}
      pointerEvents="box-none"
      collapsable={false}
      onLayout={onVoiceMountLayout}
    >
      <VoiceRecordingOverlay
        showLockFloat={state === 'RECORDING' || (isVideoRecording && !isVideoLocked)}
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
        onRecordingChange={(active) => {
          setIsVideoRecording(active);
          if (!active) setIsVideoLocked(false);
          onRecordingChange?.(active);
        }}
        cancelActive={cancelActive}
      />
    ) : null}
    <View
      pointerEvents="box-none"
      style={[styles.micAfterVideoLayer, micLayerAboveVideo && styles.micAfterVideoLayerOnTop]}
    >
      {micEl}
    </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  /** Один контейнер на depth-ring: порядок сиблингов voiceMount → VideoRecorder → mic (видео) */
  voiceRecorderShell: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none' },
  /** Стабильный корень: на весь depth-ring, не перехватывает тапы вне детей */
  voiceMount: {
    ...StyleSheet.absoluteFillObject },
  /** Кнопка всегда после VideoRecorder — не прячется под его overlay; z только для видео */
  micAfterVideoLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none' },
  micAfterVideoLayerOnTop: {
    zIndex: MIC_VIDEO_FRONT_Z,
    elevation: MIC_VIDEO_FRONT_Z },
  /** Правый край инпут-бара: margin-right 4px от DEPTH, вертикально по центру ряда */
  micPos: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MIC_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 5 },
  micPosOnTop: {
    zIndex: 50,
    elevation: 50 },
  micAssembly: {
    width: MIC_OUTER,
    height: MIC_OUTER,
    alignItems: 'center',
    justifyContent: 'center' },
  /** Едва заметное свечение по краю (диск чуть больше inner, без «ореола») */
  micEdgeGlow: {
    position: 'absolute',
    width: EDGE_GLOW_SIZE,
    height: EDGE_GLOW_SIZE,
    borderRadius: EDGE_GLOW_SIZE / 2,
    backgroundColor: 'rgba(90,158,154,0.04)',
    borderWidth: 0,
    borderColor: 'transparent' },
  /** Внешнее кольцо-свечение (под размер MIC_OUTER) */
  micGlowRing: {
    position: 'absolute',
    width: MIC_OUTER,
    height: MIC_OUTER,
    borderRadius: MIC_OUTER / 2,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent' },
  /** «Гнездо»: тёмное кольцо вокруг диска (без внешней тени — иначе кружок снова «выпирает») */
  micInsetWell: {
    width: MIC_OUTER,
    height: MIC_OUTER,
    borderRadius: MIC_OUTER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.45)' },
  micCircle: {
    width: MIC_INNER,
    height: MIC_INNER,
    borderRadius: MIC_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent' },
  micCircleIdle: {
    backgroundColor: V.accentSage,
    /** Вдавленная кнопка: тёмный верх/левый край, светлый низ/право (без внешнего «подъёма») */
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.32)',
    borderLeftColor: 'rgba(0, 0, 0, 0.24)',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderRightColor: 'rgba(255, 255, 255, 0.07)' },
  micCircleRecording: {
    backgroundColor: V.accentSage,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.32)',
    borderLeftColor: 'rgba(0, 0, 0, 0.24)',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderRightColor: 'rgba(255, 255, 255, 0.07)' },
  micIconStack: {
    width: MIC_ICON_SPEC,
    height: MIC_ICON_SPEC,
    alignItems: 'center',
    justifyContent: 'center' },
  micIconAbs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center' } });

const VoiceRecorderMemo = memo(VoiceRecorder);
VoiceRecorderMemo.displayName = 'VoiceRecorder';
export default VoiceRecorderMemo;
