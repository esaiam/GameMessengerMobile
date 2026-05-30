import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Alert } from 'react-native';
import {
  Easing,
  runOnJS,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
} from 'expo-audio';
import { setAudioModeAsync } from '../../utils/audioMode';
import { trimVoiceMessageFile, VOICE_TRIM_NATIVE_UNAVAILABLE } from '../../lib/voiceMessageTrim';
import { pauseDiceSound } from '../../utils/diceSound';
import {
  LOCK_DROP_MS,
  LOCK_DROP_SETTLE_MS,
  SPRING_RAIL_RETURN,
  RECORD_LIFT,
  RECORD_LIFT_SPRING,
  RECORD_OVERLAY_MS,
  RECORD_ROLLBACK_MS,
  PRESS_UP_SPRING,
  BAR_COUNT,
  TRIM_MIN_SPAN,
  MIN_RECORDING_SEC,
} from './voiceRecorderConstants';
import { buildWaveform40FromAmps } from './voiceWaveformUtils';

export type VoiceRecordingState = 'IDLE' | 'RECORDING' | 'LOCKED' | 'PAUSED';

export interface VoiceRecordingAnimRefs {
  pressSV: SharedValue<number>;
  overlayOp: SharedValue<number>;
  recordLiftSV: SharedValue<number>;
  micDragSV: SharedValue<number>;
  railSV: SharedValue<number>;
  txSV: SharedValue<number>;
  tySV: SharedValue<number>;
  lockFallSV: SharedValue<number>;
  lockLatchSV: SharedValue<number>;
  lockGesturesOffSV: SharedValue<number>;
  edgeGlowSV: SharedValue<number>;
  dotOp: SharedValue<number>;
}

export interface VoiceRecordingHoldRefs {
  holdCancelledRef: RefObject<boolean>;
  isHoldingRef: RefObject<boolean>;
}

export interface UseVoiceRecordingPipelineOptions {
  onSendAudio: (uri: string, duration: number, waveform: number[]) => void;
  onRecordingChange?: (active: boolean) => void;
  anim: VoiceRecordingAnimRefs;
  holdRefs: VoiceRecordingHoldRefs;
}

export function useVoiceRecordingPipeline({
  onSendAudio,
  onRecordingChange,
  anim,
  holdRefs,
}: UseVoiceRecordingPipelineOptions) {
  const { holdCancelledRef, isHoldingRef } = holdRefs;
  const {
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
  } = anim;

  const [state, setState] = useState<VoiceRecordingState>('IDLE');
  /** Audio: lift @50ms, до overlay/haptic @120ms */
  const [audioLiftPreview, setAudioLiftPreview] = useState(false);
  const [optimisticAudioHold, setOptimisticAudioHold] = useState(false);
  const [dur, setDur] = useState(0);
  const [amps, setAmps] = useState<number[]>([]);
  const [cancelActive, setCancelActive] = useState(false);

  const stateRef = useRef<VoiceRecordingState>('IDLE');
  const durRef = useRef(0);
  const ampsRef = useRef<number[]>([]);
  const lastMeterRef = useRef(0);
  const savedUriRef = useRef<string | null>(null);
  const pausedTrimRef = useRef({ s: 0, e: 1 });
  const lockDropArmedRef = useRef(false);
  const onRecordingChangeRef = useRef(onRecordingChange);
  onRecordingChangeRef.current = onRecordingChange;

  const handlePausedTrim = useCallback((s: number, e: number) => {
    pausedTrimRef.current = { s, e };
  }, []);

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  } as Parameters<typeof useAudioRecorder>[0]);
  const recStatus = useAudioRecorderState(recorder, 100);

  const go = useCallback(
    (s: VoiceRecordingState) => {
      stateRef.current = s;
      setState(s);
      onRecordingChange?.(s === 'RECORDING' || s === 'LOCKED' || s === 'PAUSED');
    },
    [onRecordingChange],
  );

  useEffect(() => {
    if (stateRef.current !== 'RECORDING' && stateRef.current !== 'LOCKED') return;
    const d = Math.floor((recStatus.durationMillis ?? 0) / 1000);
    durRef.current = d;
    setDur(d);
  }, [recStatus.durationMillis]);

  useEffect(() => {
    const s = stateRef.current;
    if (s !== 'RECORDING' && s !== 'LOCKED') return;
    const now = Date.now();
    if (now - lastMeterRef.current < 80) return;
    lastMeterRef.current = now;
    const db =
      typeof recStatus.metering === 'number' &&
      !Number.isNaN(recStatus.metering) &&
      recStatus.metering > -159
        ? recStatus.metering
        : null;

    let linear: number;
    if (db !== null) {
      linear = Math.pow((db + 160) / 160, 0.5);
    } else {
      const prev = ampsRef.current[ampsRef.current.length - 1] ?? 0.3;
      const delta = (Math.random() - 0.5) * 0.3;
      linear = Math.min(0.95, Math.max(0.05, prev + delta));
    }
    ampsRef.current.push(linear);
  }, [recStatus.metering, recStatus.durationMillis]);

  useEffect(() => {
    if (state === 'RECORDING' || state === 'LOCKED') {
      dotOp.value = withRepeat(
        withSequence(
          withTiming(0.45, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
        false,
      );
    } else {
      dotOp.value = 1;
    }
  }, [state, dotOp]);

  const pulseEdgeGlow = useCallback(() => {
    edgeGlowSV.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.38, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [edgeGlowSV]);

  const shrinkLiftPreview = useCallback(() => {
    pressSV.value = withSpring(1, PRESS_UP_SPRING);
    recordLiftSV.value = withSpring(1, { ...RECORD_LIFT_SPRING, overshootClamping: true });
  }, [pressSV, recordLiftSV]);

  const beginAudioLiftPreview = useCallback(() => {
    setAudioLiftPreview(true);
    pressSV.value = withSpring(1, PRESS_UP_SPRING);
    recordLiftSV.value = withSpring(RECORD_LIFT, RECORD_LIFT_SPRING);
  }, [pressSV, recordLiftSV]);

  /** @returns true если был активен preview (для skip mic↔video toggle) */
  const rollbackAudioLiftPreview = useCallback((): boolean => {
    if (!audioLiftPreview) return false;
    setAudioLiftPreview(false);
    if (stateRef.current !== 'IDLE') return true;
    shrinkLiftPreview();
    return true;
  }, [audioLiftPreview, shrinkLiftPreview]);

  const commitAudioRecording = useCallback(() => {
    setAudioLiftPreview(false);
    setOptimisticAudioHold(true);
    overlayOp.value = withTiming(1, { duration: RECORD_OVERLAY_MS });
    micDragSV.value = 1;
    railSV.value = 0;
    txSV.value = 0;
    tySV.value = 0;
    lockFallSV.value = 0;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    lockDropArmedRef.current = false;
    pulseEdgeGlow();
  }, [
    overlayOp,
    micDragSV,
    railSV,
    txSV,
    tySV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    pulseEdgeGlow,
  ]);

  const rollbackOptimisticAudioHold = useCallback(() => {
    setAudioLiftPreview(false);
    setOptimisticAudioHold(false);
    if (stateRef.current !== 'IDLE') return;
    shrinkLiftPreview();
    micDragSV.value = 0;
    edgeGlowSV.value = 0;
    overlayOp.value = withTiming(0, { duration: RECORD_ROLLBACK_MS });
    railSV.value = 0;
    txSV.value = withSpring(0, SPRING_RAIL_RETURN);
    tySV.value = withSpring(0, SPRING_RAIL_RETURN);
    lockFallSV.value = 0;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    lockDropArmedRef.current = false;
    setCancelActive(false);
  }, [
    shrinkLiftPreview,
    micDragSV,
    edgeGlowSV,
    overlayOp,
    railSV,
    txSV,
    tySV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
  ]);

  const resetAnim = useCallback(() => {
    setAudioLiftPreview(false);
    setOptimisticAudioHold(false);
    pressSV.value = 1;
    recordLiftSV.value = 1;
    micDragSV.value = 0;
    edgeGlowSV.value = 0;
    railSV.value = 0;
    txSV.value = withSpring(0, SPRING_RAIL_RETURN);
    tySV.value = withSpring(0, SPRING_RAIL_RETURN);
    lockFallSV.value = 0;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    overlayOp.value = 0;
    lockDropArmedRef.current = false;
    pausedTrimRef.current = { s: 0, e: 1 };
    setCancelActive(false);
  }, [
    pressSV,
    recordLiftSV,
    micDragSV,
    edgeGlowSV,
    txSV,
    tySV,
    railSV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    overlayOp,
  ]);

  const doStart = useCallback(async () => {
    const abortIfHoldReleased = () => {
      if (!holdCancelledRef.current && isHoldingRef.current) return false;
      rollbackOptimisticAudioHold();
      return true;
    };
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (abortIfHoldReleased()) return;
      if (!perm.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к микрофону');
        rollbackOptimisticAudioHold();
        return;
      }
      pauseDiceSound();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        allowsRecording: true,
        shouldRouteThroughEarpiece: false,
      });
      if (abortIfHoldReleased()) return;
      await recorder.prepareToRecordAsync();
      if (abortIfHoldReleased() || stateRef.current !== 'IDLE') return;
      recorder.record();
      ampsRef.current = [];
      lastMeterRef.current = 0;
      savedUriRef.current = null;
      setOptimisticAudioHold(false);
      go('RECORDING');
    } catch (e) {
      console.warn('[VoiceRecorder] doStart:', e);
      rollbackOptimisticAudioHold();
    }
  }, [
    recorder,
    go,
    holdCancelledRef,
    isHoldingRef,
    rollbackOptimisticAudioHold,
  ]);

  const doSend = useCallback(async () => {
    const s = stateRef.current;
    if (s === 'IDLE') return;
    const d = durRef.current;
    const caps = [...ampsRef.current];
    const pausedUri = s === 'PAUSED' ? savedUriRef.current : null;
    const pausedTrim = s === 'PAUSED' ? { ...pausedTrimRef.current } : null;
    setAmps(caps);
    go('IDLE');
    resetAnim();
    try {
      if (s === 'PAUSED') {
        if (pausedUri) {
          const { s: ts, e: te } = pausedTrim ?? { s: 0, e: 1 };
          const span = Math.max(TRIM_MIN_SPAN, te - ts);
          const effSec = Math.round(d * span);
          if (effSec < MIN_RECORDING_SEC) return;
          const wf = buildWaveform40FromAmps(caps, ts, te);
          try {
            const sendUri = await trimVoiceMessageFile(pausedUri, d, { start: ts, end: te });
            onSendAudio(sendUri, effSec, wf);
          } catch (e) {
            console.warn('[VoiceRecorder] trim/send PAUSED:', e);
            const msg = e instanceof Error ? e.message : String(e);
            if (msg === VOICE_TRIM_NATIVE_UNAVAILABLE) {
              Alert.alert(
                'Нужна пересборка',
                'Обрезка голоса работает только в dev/release-сборке с нативным модулем.\n\nnpx expo run:android\nили\nnpx expo run:ios',
              );
            } else {
              Alert.alert('Ошибка', 'Не удалось обрезать голосовое. Попробуй ещё раз.');
            }
          }
        }
        return;
      }
      await recorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      if (d < MIN_RECORDING_SEC) return;
      const uri = recorder.uri;
      if (uri) onSendAudio(uri, d, buildWaveform40FromAmps(caps, 0, 1));
    } catch (e) {
      console.warn('[VoiceRecorder] doSend:', e);
    }
  }, [recorder, go, resetAnim, onSendAudio]);

  const doCancel = useCallback(async () => {
    const s = stateRef.current;
    if (s === 'IDLE') return;
    go('IDLE');
    resetAnim();
    try {
      if (s !== 'PAUSED') await recorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch (e) {
      console.warn('[VoiceRecorder] doCancel:', e);
    }
  }, [recorder, go, resetAnim]);

  const doPause = useCallback(async () => {
    if (stateRef.current !== 'LOCKED') return;
    const caps = [...ampsRef.current];
    const d = durRef.current;
    try {
      await recorder.stop();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      savedUriRef.current = recorder.uri;
    } catch (e) {
      console.warn('[VoiceRecorder] doPause:', e);
    }
    pausedTrimRef.current = { s: 0, e: 1 };
    setAmps(caps);
    setDur(d);
    recordLiftSV.value = 1;
    micDragSV.value = 0;
    railSV.value = 0;
    lockFallSV.value = 0;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    lockDropArmedRef.current = false;
    edgeGlowSV.value = 0;
    go('PAUSED');
  }, [
    recorder,
    go,
    recordLiftSV,
    micDragSV,
    railSV,
    lockFallSV,
    lockLatchSV,
    lockGesturesOffSV,
    edgeGlowSV,
  ]);

  const doLock = useCallback(() => {
    if (stateRef.current !== 'RECORDING') return;
    lockDropArmedRef.current = false;
    lockLatchSV.value = 0;
    lockFallSV.value = 0;
    micDragSV.value = 0;
    lockGesturesOffSV.value = 1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    railSV.value = 0;
    txSV.value = 0;
    tySV.value = 0;
    go('LOCKED');
    setCancelActive(false);
  }, [go, txSV, tySV, railSV, lockFallSV, lockLatchSV, micDragSV, lockGesturesOffSV]);

  const onLockDropAnimInterrupted = useCallback(() => {
    lockDropArmedRef.current = false;
    lockLatchSV.value = 0;
    lockFallSV.value = 0;
    tySV.value = 0;
  }, [lockFallSV, lockLatchSV, tySV]);

  const playLockDropThenLock = useCallback(() => {
    if (lockDropArmedRef.current) return;
    if (stateRef.current !== 'RECORDING') return;
    lockDropArmedRef.current = true;
    lockLatchSV.value = 1;
    const settleEase = Easing.out(Easing.cubic);
    lockFallSV.value = withTiming(
      24,
      { duration: LOCK_DROP_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished) {
          lockLatchSV.value = 0;
          runOnJS(onLockDropAnimInterrupted)();
          return;
        }
        const settle = LOCK_DROP_SETTLE_MS;
        tySV.value = withTiming(0, { duration: settle, easing: settleEase }, (f2) => {
          if (f2) runOnJS(doLock)();
        });
        lockFallSV.value = withTiming(0, { duration: settle, easing: settleEase });
      },
    );
  }, [lockFallSV, lockLatchSV, tySV, doLock, onLockDropAnimInterrupted]);

  useEffect(() => {
    return () => {
      const s = stateRef.current;
      void (async () => {
        try {
          if (s === 'RECORDING' || s === 'LOCKED') {
            await recorder.stop();
            await setAudioModeAsync({
              playsInSilentMode: true,
              interruptionMode: 'mixWithOthers',
              allowsRecording: false,
              shouldRouteThroughEarpiece: false,
            });
          }
        } catch {
          /* ignore */
        }
      })();
      onRecordingChangeRef.current?.(false);
    };
  }, [recorder]);

  const srcBars = amps.length > 0 ? amps : (Array(BAR_COUNT).fill(0.05) as number[]);
  const step = srcBars.length / BAR_COUNT;
  const bars: number[] = Array.from({ length: BAR_COUNT }, (_, i) => {
    const s = Math.floor(i * step);
    const e = Math.max(s + 1, Math.floor((i + 1) * step));
    const sl = srcBars.slice(s, e);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });

  const isAudioOverlayActive =
    state === 'RECORDING' || state === 'LOCKED' || optimisticAudioHold;

  return {
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
    audioLiftPreview,
    optimisticAudioHold,
    beginAudioLiftPreview,
    rollbackAudioLiftPreview,
    commitAudioRecording,
    rollbackOptimisticAudioHold,
    doStart,
    doSend,
    doCancel,
    doPause,
    playLockDropThenLock,
  };
}
