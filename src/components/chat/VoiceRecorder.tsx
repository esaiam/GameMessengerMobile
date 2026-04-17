import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  type ViewStyle,
} from 'react-native';
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
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  useAudioPlayer,
  useAudioPlayerStatus,
  setIsAudioActiveAsync,
} from 'expo-audio';
import { Mic, Lock, Unlock, SendHorizontal, Trash2, Pause, Play } from '../../icons/lucideIcons';
import { Video as VideoIcon } from 'lucide-react-native';
import { V, TAB_BAR_LAYOUT, TAB_BAR_INNER_ROW_H } from '../../theme';
import { setAudioModeAsync } from '../../utils/audioMode';
import { pauseDiceSound } from '../../utils/diceSound';
import VideoRecorder, { type VideoRecorderHandle } from './VideoRecorder';

// ─── Constants ────────────────────────────────────────────────────────────────
/** Вертикальный подъём до закрепления (~1 см в pt на типичном телефоне) */
const LOCK_COMMIT_UP_PX = 38;
/** Фаза «падение» без пружины — только easing */
const LOCK_DROP_MS = 200;
const LOCK_DROP_SETTLE_MS = 170;
/** Отмена при сдвиге влево ≥ этой доли от maxSlideX (maxSlideX ≈ ширина капсулы / 3) */
const CANCEL_SLIDE_RATIO = 0.88;
/** После этого смещения (px) выбирается «рельс»: только влево или только вверх */
const RAIL_LOCK_PX = 14;
const SPRING_RAIL_RETURN = { damping: 18, stiffness: 280 } as const;
/** padding between depth-ring and SafeBlurView */
const DEPTH = 0;
/** Визуальный спек микрофона в инпут-баре */
const MIC_INNER = 44;
const MIC_OUTER = 52;
/** Кружок под плавающие Lock / Pause над микрофоном */
const FLOAT_ICON_CIRCLE = 36;
const MIC_ICON_SPEC = 20;
const MIC_ICON_RECORDING = '#8ECECA';
/** Масштаб кнопки при активной записи (меньше, чем «полный» ×3) */
const RECORD_LIFT = 2;
/** Сдвиг замка вверх при увеличении кнопки */
const LOCK_FLOAT_EXTRA = Math.round((MIC_OUTER * (RECORD_LIFT - 1)) / 2);
/** Тонкое свечение чуть больше внутреннего круга (только край) */
const EDGE_GLOW_SIZE = MIC_INNER + 6;
/** Выше overlay внутри VideoRecorder (zIndex 201), чтобы кнопка не уходила под превью */
const MIC_VIDEO_FRONT_Z = 250;
const BAR_COUNT = 40;
/** Ручки обрезки голоса (предпросмотр) */
const TRIM_HANDLE_W = 10;
const TRIM_HANDLE_H = 34;
const TRIM_MIN_SPAN = 0.06;

// ─── Types ────────────────────────────────────────────────────────────────────
type RS = 'IDLE' | 'RECORDING' | 'LOCKED' | 'PAUSED';

interface Props {
  onSendAudio: (uri: string, duration: number, waveform: number[]) => void;
  onRecordingChange?: (active: boolean) => void;
  uploadMedia: (uri: string, folder: string, ext: string, contentType: string) => Promise<string>;
  sendMediaMessage: (type: string, url: string, extra?: Record<string, unknown>) => Promise<void>;
  onOpen?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Амплитуды 0…1 → 40 высот столбиков (4…40) для сохранения в сообщении. */
function buildWaveform40FromAmps(amps: number[], trimStart: number, trimEnd: number): number[] {
  const TARGET = 40;
  if (!amps.length) return Array(TARGET).fill(4);
  const i0 = Math.min(amps.length - 1, Math.max(0, Math.floor(trimStart * amps.length)));
  const i1 = Math.min(amps.length, Math.max(i0 + 1, Math.ceil(trimEnd * amps.length)));
  const slice = amps.slice(i0, i1);
  const n = slice.length;
  const out: number[] = [];
  for (let i = 0; i < TARGET; i++) {
    const t0 = (i / TARGET) * n;
    const t1 = ((i + 1) / TARGET) * n;
    let mx = 0.008;
    const j0 = Math.floor(t0);
    const j1 = Math.ceil(t1);
    for (let j = j0; j < j1 && j < n; j++) {
      mx = Math.max(mx, slice[j] ?? 0);
    }
    // Растягиваем тихие уровни (иначе всё упирается в min 4px после clamp).
    const shaped = Math.pow(Math.min(1, Math.max(0, mx)), 0.58);
    out.push(Math.max(5, Math.min(39, 5 + shaped * 34)));
  }
  return out;
}

function WaveformSvg({
  bars,
  w,
  h = 28,
  fill = V.accentSage,
}: {
  bars: number[];
  w: number;
  h?: number;
  fill?: string;
}) {
  if (w <= 0) return null;
  const bw = w / bars.length;
  return (
    <Svg width={w} height={h}>
      {bars.map((amp, i) => {
        const bh = Math.max(2, amp * h * 0.85);
        return (
          <Rect
            key={i}
            x={i * bw + 0.5}
            y={(h - bh) / 2}
            width={Math.max(1.5, bw - 1)}
            height={bh}
            rx={1}
            fill={fill}
          />
        );
      })}
    </Svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VoiceRecorder({
  onSendAudio,
  onRecordingChange,
  uploadMedia,
  sendMediaMessage,
  onOpen,
}: Props) {
  const [state, setState] = useState<RS>('IDLE');
  const [dur, setDur] = useState(0);
  const [amps, setAmps] = useState<number[]>([]);
  const [cancelActive, setCancelActive] = useState(false);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [isVideoLocked, setIsVideoLocked] = useState(false);

  const stateRef = useRef<RS>('IDLE');
  const durRef = useRef(0);
  const ampsRef = useRef<number[]>([]);
  const lastMeterRef = useRef(0);
  const savedUriRef = useRef<string | null>(null);
  /** Доля [0,1] границ обрезки в режиме PAUSED (для длительности при отправке) */
  const pausedTrimRef = useRef({ s: 0, e: 1 });
  const handlePausedTrim = useCallback((s: number, e: number) => {
    pausedTrimRef.current = { s, e };
  }, []);
  /** setTimeout id — ожидание 220 мс перед стартом записи */
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** true когда таймер сработал и запись инициирована */
  const isHoldingRef = useRef(false);
  /** Защита от повторного запуска анимации падения → doLock */
  const lockDropArmedRef = useRef(false);
  const videoLockArmedRef = useRef(false);
  const videoRecorderRef = useRef<VideoRecorderHandle>(null);

  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  } as Parameters<typeof useAudioRecorder>[0]);
  const recStatus = useAudioRecorderState(recorder, 100);
  console.log('[RECORDER STATUS]', recStatus);

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

  // ── Mode morph (audio ↔ video) ──────────────────────────────────────────────
  const modeMorphSV = useSharedValue(mediaMode === 'video' ? 1 : 0);
  useEffect(() => {
    // Only morph when user toggles modes in IDLE (recording state forces mic anyway).
    modeMorphSV.value = withTiming(mediaMode === 'video' ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [mediaMode, modeMorphSV]);

  // ── State machine ───────────────────────────────────────────────────────────
  const go = useCallback(
    (s: RS) => {
      stateRef.current = s;
      setState(s);
      onRecordingChange?.(s === 'RECORDING' || s === 'LOCKED' || s === 'PAUSED');
    },
    [onRecordingChange],
  );

  // ── Duration tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    if (stateRef.current !== 'RECORDING' && stateRef.current !== 'LOCKED') return;
    const d = Math.floor((recStatus.durationMillis ?? 0) / 1000);
    durRef.current = d;
    setDur(d);
  }, [recStatus.durationMillis]);

  // ── Amplitude collection ────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[METERING] raw value:', recStatus.metering, '| state:', stateRef.current);
    const s = stateRef.current;
    if (s !== 'RECORDING' && s !== 'LOCKED') return;
    const now = Date.now();
    if (now - lastMeterRef.current < 80) return;
    lastMeterRef.current = now;
    // Как в expo-av metering: ~−160…0 dB; на Android часто всегда -160 — тогда тик по durationMillis + псевдо-амплитуда.
    const db =
      typeof recStatus.metering === 'number' &&
      !Number.isNaN(recStatus.metering) &&
      recStatus.metering > -159 // -160 = нет данных
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

  // ── Red dot pulse (слабее и медленнее) ───────────────────────────────────────
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

  // ── Video: mirror audio button animations (lift/overlay) ────────────────────
  useEffect(() => {
    const active = isVideoRecording || isVideoLocked;
    if (active) {
      overlayOp.value = withTiming(1, { duration: 150 });
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
      recordLiftSV.value = withSpring(1, { damping: 14, stiffness: 140 });
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
  ]);

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

  // ── Animations reset ────────────────────────────────────────────────────────
  const resetAnim = useCallback(() => {
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
  }, [pressSV, recordLiftSV, micDragSV, edgeGlowSV, txSV, tySV, railSV, lockFallSV, lockLatchSV, lockGesturesOffSV, overlayOp]);

  // ── Audio actions ───────────────────────────────────────────────────────────
  const doStart = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к микрофону');
        pressSV.value = withSpring(1, { damping: 12, stiffness: 200 });
        return;
      }
      pauseDiceSound();
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        allowsRecording: true,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      ampsRef.current = [];
      lastMeterRef.current = 0;
      savedUriRef.current = null;
      go('RECORDING');
      overlayOp.value = withTiming(1, { duration: 150 });
      pressSV.value = withSpring(1, { damping: 12, stiffness: 200 });
      recordLiftSV.value = withSpring(RECORD_LIFT, { damping: 14, stiffness: 140 });
      railSV.value = 0;
      txSV.value = 0;
      tySV.value = 0;
      lockFallSV.value = 0;
      lockLatchSV.value = 0;
      lockGesturesOffSV.value = 0;
      lockDropArmedRef.current = false;
      micDragSV.value = 1;
    } catch (e) {
      console.warn('[VoiceRecorder] doStart:', e);
      pressSV.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, [recorder, go, pressSV, overlayOp, recordLiftSV, micDragSV, railSV, txSV, tySV, lockFallSV, lockLatchSV, lockGesturesOffSV]);

  const doSend = useCallback(async () => {
    const s = stateRef.current;
    if (s === 'IDLE') return;
    const d = durRef.current;
    const caps = [...ampsRef.current];
    setAmps(caps);
    go('IDLE');
    resetAnim();
    try {
      if (s === 'PAUSED') {
        // Recorder was already stopped in doPause; just send the saved URI
        if (savedUriRef.current) {
          const { s: ts, e: te } = pausedTrimRef.current;
          const span = Math.max(TRIM_MIN_SPAN, te - ts);
          const eff = Math.max(1, Math.round(d * span));
          const wf = buildWaveform40FromAmps(caps, ts, te);
          onSendAudio(savedUriRef.current, eff, wf);
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
  }, [recorder, go, recordLiftSV, micDragSV, railSV, lockFallSV, lockLatchSV, lockGesturesOffSV, edgeGlowSV]);

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

  // ── Gesture JS callbacks (JS-thread only) ───────────────────────────────────
  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

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
    lockDropArmedRef.current = false;
    lockLatchSV.value = 0;
    lockGesturesOffSV.value = 0;
    railSV.value = 0;
    txSV.value = 0;
    tySV.value = 0;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      if (stateRef.current !== 'IDLE') return; // guard
      isHoldingRef.current = true;
      if (mediaMode === 'video') {
        void videoRecorderRef.current?.beginInlineHold();
      } else {
        void doStart();
      }
    }, 220);
  }, [clearHoldTimer, txSV, tySV, railSV, lockLatchSV, lockGesturesOffSV, doStart, mediaMode]);

  const sendPanToVideo = useCallback((tx: number, ty: number) => {
    videoRecorderRef.current?.onPanUpdate(tx, ty);
  }, []);

  const handlePanMove = useCallback(
    (projTx: number, projTy: number, rail: number, rawDy: number, maxSlideX: number) => {
      // До старта записи: сдвиг >14px — отменить ожидание удержания (как в PanResponder)
      if (!isHoldingRef.current && holdTimerRef.current !== null &&
          (Math.abs(projTx) > 14 || Math.abs(rawDy) > 14)) {
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
        if (stateRef.current === 'IDLE') {
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
          console.log('[VoiceRecorder] calling lock');
          setIsVideoLocked(true);
          videoRecorderRef.current?.lock();
        } else {
          videoRecorderRef.current?.endInlineHold({ cancelSlide });
        }
        return;
      }
      // Already locked/paused — finger lift doesn't stop recording
      if (s === 'LOCKED' || s === 'PAUSED') return;
      if (s === 'IDLE') return; // doStart still in flight (race); it will handle itself
      // Анимация закрепления — не интерпретировать отпускание как «отправить»
      if (lockDropArmedRef.current) return;
      // Отмена только если не «чисто вертикальный» рельс (вверх — замок, не отмена по X)
      const canCancelBySlide = rail === 1 || rail === 0;
      const need = Math.max(40, maxSlideX * CANCEL_SLIDE_RATIO);
      if (canCancelBySlide && projTx < -need) void doCancel();
      else void doSend();
    },
    [clearHoldTimer, doCancel, doSend, mediaMode],
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
      transform: [{ translateX: tx }, { scale: s }],
    };
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
        shadowRadius: 2 + t * 2,
      };
    }
    return {
      elevation: 2 + t * 0.8,
    };
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

  const micIconMicAnimStyle = useAnimatedStyle(() => {
    const active = isMicActiveSV.value > 0.5;
    if (active) return { opacity: 1, transform: [{ scale: 1 }] };
    const t = 1 - modeMorphSV.value; // 1 = audio, 0 = video
    const op = interpolate(t, [0, 1], [0, 1]);
    const rot = interpolate(t, [0, 1], [90, 0]);
    const sc = interpolate(t, [0, 1], [0.92, 1]);
    return {
      opacity: op,
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }],
    };
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
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }],
    };
  });

  const onVoiceMountLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) maxSlideXSV.value = Math.max(48, Math.floor(w / 3));
    },
    [maxSlideXSV],
  );

  // ── Waveform bars ───────────────────────────────────────────────────────────
  const srcBars = amps.length > 0 ? amps : Array(BAR_COUNT).fill(0.05) as number[];
  const step = srcBars.length / BAR_COUNT;
  const bars: number[] = Array.from({ length: BAR_COUNT }, (_, i) => {
    const s = Math.floor(i * step);
    const e = Math.max(s + 1, Math.floor((i + 1) * step));
    const sl = srcBars.slice(s, e);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });

  const isMicActive = state === 'RECORDING' || state === 'LOCKED' || isVideoRecording || isVideoLocked;
  useEffect(() => {
    isMicActiveSV.value = isMicActive ? 1 : 0;
  }, [isMicActive, isMicActiveSV]);
  /** Поднять слой только когда поверх лежит inline-overlay VideoRecorder (z 201) */
  const micLayerAboveVideo =
    mediaMode === 'video' && (isVideoRecording || isVideoLocked);
  console.log('[VoiceRecorder] render', { state, isVideoRecording, isVideoLocked, isMicActive, mediaMode });

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
          <View
            style={[
              styles.micCircle,
              isMicActive ? styles.micCircleRecording : styles.micCircleIdle,
            ]}
          >
            {/* Icon morph: Mic ↔ Video (only meaningful in IDLE) */}
            <View style={styles.micIconStack} pointerEvents="none">
              <Animated.View style={[styles.micIconAbs, micIconMicAnimStyle]}>
                <Mic
                  size={MIC_ICON_SPEC}
                  color={V.textPrimary}
                  strokeWidth={3}
                />
              </Animated.View>
              <Animated.View style={[styles.micIconAbs, micIconVideoAnimStyle]}>
                <VideoIcon
                  size={MIC_ICON_SPEC}
                  color={V.textPrimary}
                  strokeWidth={3}
                />
              </Animated.View>
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
      {(state === 'RECORDING' || (isVideoRecording && !isVideoLocked)) ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.lockAbove, styles.floatingIconCircle, lockAboveAnimStyle]}
        >
          <View style={styles.lockIconPair}>
            <Animated.View style={lockLockFadeStyle}>
              <Lock size={16} color={V.textSecondary} strokeWidth={1.5} />
            </Animated.View>
            <Animated.View style={[styles.lockUnlockAbs, lockUnlockFadeStyle]}>
              <Unlock size={16} color={V.accentSage} strokeWidth={1.5} />
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
      {isVideoLocked ? (
        <View
          pointerEvents="box-none"
          style={[styles.lockAbove, styles.lockAboveLocked]}
        >
          <TouchableOpacity
            onPress={() => {
              setIsVideoLocked(false);
              videoRecorderRef.current?.cancelLocked();
            }}
            style={[styles.floatingIconCircle, styles.pauseAboveBtn]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Отмена видео"
          >
            <Trash2 size={16} color={V.dangerMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      ) : null}
      {state === 'LOCKED' ? (
        <View
          pointerEvents="box-none"
          style={[styles.lockAbove, styles.lockAboveLocked]}
        >
          <TouchableOpacity
            onPress={() => void doPause()}
            style={[styles.floatingIconCircle, styles.pauseAboveBtn]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Пауза"
          >
            <Pause size={16} color={V.accentSage} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Animated.View
        pointerEvents={isMicActive ? 'auto' : 'none'}
        style={[styles.overlay, overlayAnimStyle]}
      >
        {isMicActive ? (
          <>
            <View style={styles.timerRow}>
              <Animated.View style={[styles.dot, dotAnimStyle]} />
              <Text style={styles.timerText}>{fmtDur(dur)}</Text>
            </View>

            {state === 'RECORDING' ? (
              <Text
                style={[styles.hintText, cancelActive && styles.hintActive]}
                numberOfLines={1}
              >
                {'← Slide to cancel'}
              </Text>
            ) : (
              <View style={styles.lockedRow}>
                <TouchableOpacity
                  onPress={() => void doCancel()}
                  style={styles.lockedCancelBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  accessibilityLabel="Отмена"
                >
                  <Trash2 size={18} color={V.dangerMuted} strokeWidth={1.5} />
                </TouchableOpacity>
                <View style={styles.lockedRowSpacer} />
              </View>
            )}

            <View style={styles.micSpacer} />
          </>
        ) : null}
      </Animated.View>

    </View>
    <VideoRecorder
      ref={videoRecorderRef}
      uploadMedia={uploadMedia}
      sendMediaMessage={sendMediaMessage}
      onOpen={onOpen}
      onRecordingChange={(active) => {
        setIsVideoRecording(active);
        if (!active) setIsVideoLocked(false);
        onRecordingChange?.(active);
      }}
      cancelActive={cancelActive}
    />
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
    pointerEvents: 'box-none',
  },
  /** Стабильный корень: на весь depth-ring, не перехватывает тапы вне детей */
  voiceMount: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Кнопка всегда после VideoRecorder — не прячется под его overlay; z только для видео */
  micAfterVideoLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  micAfterVideoLayerOnTop: {
    zIndex: MIC_VIDEO_FRONT_Z,
    elevation: MIC_VIDEO_FRONT_Z,
  },
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
    zIndex: 5,
  },
  micPosOnTop: {
    zIndex: 50,
    elevation: 50,
  },
  micAssembly: {
    width: MIC_OUTER,
    height: MIC_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Едва заметное свечение по краю (диск чуть больше inner, без «ореола») */
  micEdgeGlow: {
    position: 'absolute',
    width: EDGE_GLOW_SIZE,
    height: EDGE_GLOW_SIZE,
    borderRadius: EDGE_GLOW_SIZE / 2,
    backgroundColor: 'rgba(90,158,154,0.04)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  /** Внешнее кольцо-свечение 52px */
  micGlowRing: {
    position: 'absolute',
    width: MIC_OUTER,
    height: MIC_OUTER,
    borderRadius: MIC_OUTER / 2,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  micCircle: {
    width: MIC_INNER,
    height: MIC_INNER,
    borderRadius: MIC_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  micCircleIdle: {
    backgroundColor: V.accentSage,
    ...Platform.select({
      ios: {
        shadowColor: V.bgApp,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.42,
        shadowRadius: 12,
      },
      android: { elevation: 7 },
    }),
  },
  micCircleRecording: {
    backgroundColor: V.accentSage,
    /** Основная тень снята — пульс на micEdgeGlow, без раздувания пятна */
    ...Platform.select({
      ios: {
        shadowColor: V.bgApp,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  micIconStack: {
    width: MIC_ICON_SPEC,
    height: MIC_ICON_SPEC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIconAbs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Active overlay: covers SafeBlurView area exactly */
  overlay: {
    position: 'absolute',
    top: DEPTH,
    left: DEPTH,
    right: DEPTH,
    bottom: DEPTH,
    borderRadius: TAB_BAR_INNER_ROW_H / 2,
    backgroundColor: V.bgSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
    minHeight: TAB_BAR_INNER_ROW_H,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    overflow: 'hidden',
  },

  /** Lock / pause над микрофоном — центр по внешнему кольцу MIC_OUTER */
  lockAbove: {
    position: 'absolute',
    right: Math.round((MIC_OUTER - FLOAT_ICON_CIRCLE) / 2),
    bottom: TAB_BAR_INNER_ROW_H + DEPTH * 2 + 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  floatingIconCircle: {
    width: FLOAT_ICON_CIRCLE,
    height: FLOAT_ICON_CIRCLE,
    borderRadius: FLOAT_ICON_CIRCLE / 2,
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lockAboveLocked: {
    transform: [{ translateY: -LOCK_FLOAT_EXTRA }],
    zIndex: 30,
  },
  lockIconPair: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockUnlockAbs: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseAboveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Recording row content
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: V.dangerMuted,
  },
  timerText: {
    fontSize: 13,
    color: V.textPrimary,
    fontWeight: '500',
    minWidth: 36,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    color: V.textMuted,
    fontWeight: '400',
    textAlign: 'center',
  },
  hintActive: {
    color: V.dangerMuted,
  },
  lockedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  lockedCancelBtn: {
    width: TAB_BAR_INNER_ROW_H,
    height: TAB_BAR_INNER_ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedRowSpacer: {
    flex: 1,
  },
  /** Reserves space in the overlay row for the absolutely-positioned mic button */
  micSpacer: {
    width: MIC_OUTER,
    height: TAB_BAR_INNER_ROW_H,
  },

  // PAUSED state
  iconSlot: {
    width: 40,
    height: TAB_BAR_INNER_ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimStripOuter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  trimStrip: {
    height: 46,
    borderRadius: 12,
    backgroundColor: V.btnPrimaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
    position: 'relative',
    overflow: 'hidden',
  },
  trimWaveLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimMaskSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: V.btnPrimaryBg,
  },
  trimHandle: {
    position: 'absolute',
    top: (46 - TRIM_HANDLE_H) / 2,
    width: TRIM_HANDLE_W,
    height: TRIM_HANDLE_H,
    borderRadius: 3,
    backgroundColor: V.accentSage,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  trimHandleGrip: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: V.textPrimary,
  },
  trimCenterPillWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    pointerEvents: 'box-none',
  },
  trimPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  trimPillTime: {
    fontSize: 11,
    fontWeight: '400',
    color: V.textPrimary,
  },
  trimPillPlayOffset: {
    marginLeft: 1,
  },
  sendSlot: {
    width: MIC_OUTER,
    height: TAB_BAR_INNER_ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface PausedPreviewBarProps {
  uri: string | null | undefined;
  bars: number[];
  dur: number;
  onTrim: (start: number, end: number) => void;
  onCancel: () => void;
  onSend: () => void;
}

/** Предпросмотр с обрезкой (как в референсе), цвета Vault */
function PausedPreviewBar({ uri, bars, dur, onTrim, onCancel, onSend }: PausedPreviewBarProps) {
  const [trackW, setTrackW] = useState(0);
  const [trim, setTrim] = useState({ s: 0, e: 1 });
  const trimDragRef = useRef({ s: 0, e: 1 });
  const trackWRef = useRef(0);
  const dragStartRef = useRef({ s: 0, e: 1 });

  const player = useAudioPlayer(uri ?? null, {});
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    trimDragRef.current = trim;
  }, [trim]);

  useEffect(() => {
    onTrim(trim.s, trim.e);
  }, [trim, onTrim]);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [player]);

  /** При паузе — держать курсор на начале выбранного фрагмента */
  useEffect(() => {
    if (dur <= 0 || status.playing) return;
    try {
      void player.seekTo(dur * trim.s);
    } catch {
      /* ignore */
    }
  }, [trim.s, trim.e, dur, player, status.playing]);

  useEffect(() => {
    if (!status.playing || dur <= 0) return;
    const t1 = dur * trim.e;
    if (status.currentTime >= t1 - 0.06) {
      try {
        player.pause();
        void player.seekTo(dur * trim.s);
      } catch {
        /* ignore */
      }
    }
  }, [status.playing, status.currentTime, dur, trim.s, trim.e, player]);

  const activatePlayback = useCallback(async () => {
    try {
      await setIsAudioActiveAsync(true);
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: Platform.OS === 'android' ? 'duckOthers' : 'mixWithOthers',
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
    } catch {
      /* ignore */
    }
  }, []);

  const togglePreview = useCallback(async () => {
    if (!uri || dur <= 0) return;
    if (status.playing) {
      player.pause();
      return;
    }
    await activatePlayback();
    try {
      await player.seekTo(dur * trim.s);
    } catch {
      /* ignore */
    }
    player.play();
  }, [uri, dur, trim.s, status.playing, player, activatePlayback]);

  const beginLeft = useCallback(() => {
    dragStartRef.current = { ...trimDragRef.current };
  }, []);
  const moveLeft = useCallback(
    (tx: number) => {
      const tw = trackWRef.current;
      if (tw < 48) return;
      const d = tx / tw;
      const start = dragStartRef.current;
      const nextS = Math.min(
        Math.max(0, start.s + d),
        trimDragRef.current.e - TRIM_MIN_SPAN,
      );
      setTrim((prev) => ({ s: nextS, e: prev.e }));
    },
    [],
  );

  const beginRight = useCallback(() => {
    dragStartRef.current = { ...trimDragRef.current };
  }, []);
  const moveRight = useCallback((tx: number) => {
    const tw = trackWRef.current;
    if (tw < 48) return;
    const d = tx / tw;
    const start = dragStartRef.current;
    const nextE = Math.max(
      trimDragRef.current.s + TRIM_MIN_SPAN,
      Math.min(1, start.e + d),
    );
    setTrim((prev) => ({ s: prev.s, e: nextE }));
  }, []);

  const leftPan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(beginLeft)();
        })
        .onUpdate((e) => {
          runOnJS(moveLeft)(e.translationX);
        }),
    [beginLeft, moveLeft],
  );

  const rightPan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          runOnJS(beginRight)();
        })
        .onUpdate((e) => {
          runOnJS(moveRight)(e.translationX);
        }),
    [beginRight, moveRight],
  );

  const wL = trim.s * trackW;
  const wR = (1 - trim.e) * trackW;
  const spanSec = Math.max(TRIM_MIN_SPAN, trim.e - trim.s);
  const pillDur = Math.max(1, Math.round(dur * spanSec));

  const leftHandleLeft =
    trackW > 0 ? Math.max(0, Math.min(trackW - TRIM_HANDLE_W, trim.s * (trackW - TRIM_HANDLE_W))) : 0;
  const rightHandleLeft =
    trackW > 0 ? Math.max(0, Math.min(trackW - TRIM_HANDLE_W, trim.e * (trackW - TRIM_HANDLE_W))) : 0;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity onPress={onCancel} style={styles.iconSlot}>
        <Trash2 size={18} color={V.dangerMuted} strokeWidth={1.5} />
      </TouchableOpacity>

      <View style={styles.trimStripOuter}>
        <View
          style={styles.trimStrip}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setTrackW(w);
            trackWRef.current = w;
          }}
        >
          <View style={styles.trimWaveLayer} pointerEvents="none">
            {trackW > 0 ? (
              <WaveformSvg bars={bars} w={trackW} h={26} fill={V.textPrimary} />
            ) : null}
          </View>
          {trackW > 0 ? (
            <>
              <View style={[styles.trimMaskSide, { width: wL, left: 0 }]} />
              <View style={[styles.trimMaskSide, { width: wR, right: 0 }]} />
            </>
          ) : null}

          <GestureDetector gesture={leftPan}>
            <View style={[styles.trimHandle, { left: leftHandleLeft }]} accessibilityLabel="Начало обрезки">
              <View style={styles.trimHandleGrip} />
            </View>
          </GestureDetector>
          <GestureDetector gesture={rightPan}>
            <View style={[styles.trimHandle, { left: rightHandleLeft }]} accessibilityLabel="Конец обрезки">
              <View style={styles.trimHandleGrip} />
            </View>
          </GestureDetector>

          <View style={styles.trimCenterPillWrap} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => void togglePreview()}
              style={styles.trimPillTouchable}
              disabled={!uri}
              accessibilityLabel={status.playing ? 'Пауза' : 'Воспроизвести'}
            >
              {status.playing ? (
                <Pause size={14} color={V.accentSage} strokeWidth={1.5} />
              ) : (
                <View style={styles.trimPillPlayOffset}>
                  <Play size={14} color={V.accentSage} strokeWidth={1.5} />
                </View>
              )}
              <Text style={styles.trimPillTime}>{fmtDur(pillDur)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={onSend} style={styles.sendSlot}>
        <SendHorizontal size={18} color={V.accentSage} strokeWidth={1.5} />
      </TouchableOpacity>
    </View>
  );
}
