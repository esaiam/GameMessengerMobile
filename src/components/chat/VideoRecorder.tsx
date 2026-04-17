/**
 * VideoRecorder.tsx — Vault Messenger
 * Удержание кнопки микрофона (видеорежим): запись в круглом превью над инпутом, без полноэкранной камеры.
 */

import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  Alert,
  Platform,
  InteractionManager,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import type { VideoCodec } from 'expo-camera';
import { setIsAudioActiveAsync } from 'expo-audio';
import { Trash2, SendHorizontal } from 'lucide-react-native';
import { V, TAB_BAR_LAYOUT, TAB_BAR_INNER_ROW_H } from '../../theme';
import { setAudioModeAsync } from '../../utils/audioMode';

export interface VideoRecorderHandle {
  beginInlineHold: () => Promise<void>;
  endInlineHold: (opts: { cancelSlide: boolean }) => void;
  onPanUpdate: (tx: number, ty: number) => void;
  lock: () => void;
  cancelLocked: () => void;
  getIsLocked: () => boolean;
}

interface VideoRecorderProps {
  uploadMedia: (uri: string, folder: string, ext: string, contentType: string) => Promise<string>;
  sendMediaMessage: (type: string, url: string, extra?: Record<string, unknown>) => Promise<void>;
  onOpen?: () => void;
  onRecordingChange?: (active: boolean) => void;
  cancelActive?: boolean;
}

const MAX_DURATION_MS = 60_000;
/** Диаметр круга превью над кнопкой */
const INLINE_CIRCLE = 168;
const MIC_OUTER = 52;

const VideoRecorder = forwardRef<VideoRecorderHandle, VideoRecorderProps>(
  function VideoRecorder({ uploadMedia, sendMediaMessage, onOpen, onRecordingChange, cancelActive }, ref) {
    const insets = useSafeAreaInsets();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    const [inlineVisible, setInlineVisible] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);

    const cameraRef = useRef<CameraView>(null);
    const cameraReadyRef = useRef(false);
    /** Прервать только фазу ожидания камеры (до старта recordAsync) */
    const abortOpeningRef = useRef(false);
    const discardResultRef = useRef(false);
    const isRecordingNativeRef = useRef(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const circleTranslateX = useRef(new Animated.Value(0)).current;
    const circleTranslateY = useRef(new Animated.Value(0)).current;
    const circleScale = useRef(new Animated.Value(1)).current;
    const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const elapsedInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTime = useRef(0);

    const prepareRecordingAudioSession = useCallback(async () => {
      try {
        if (Platform.OS === 'ios') {
          await setIsAudioActiveAsync(false);
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            allowsRecording: true,
            shouldRouteThroughEarpiece: false,
          });
        }
        // На Android аудио сессию не трогаем — expo-camera управляет ей сама
      } catch {
        /* ignore */
      }
    }, []);

    const clearRecordingTimers = useCallback(() => {
      progressAnimation.current?.stop();
      if (elapsedInterval.current) {
        clearInterval(elapsedInterval.current);
        elapsedInterval.current = null;
      }
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
        recordingTimeout.current = null;
      }
    }, []);

    const runRecordSession = useCallback(async () => {
      if (!cameraRef.current) return;
      try {
        isRecordingNativeRef.current = true;
        setIsRecording(true);
        onRecordingChange?.(true);
        Animated.spring(circleScale, {
          toValue: 1.35,
          damping: 14,
          stiffness: 140,
          useNativeDriver: true,
        }).start();
        startTime.current = Date.now();

        progressAnimation.current = Animated.timing(progressAnim, {
          toValue: 1,
          duration: MAX_DURATION_MS,
          useNativeDriver: false,
        });
        progressAnimation.current.start();

        elapsedInterval.current = setInterval(() => {
          setElapsedMs(Date.now() - startTime.current);
        }, 250);

        recordingTimeout.current = setTimeout(() => {
          cameraRef.current?.stopRecording();
        }, MAX_DURATION_MS);

        const recordOpts: { maxDuration: number; codec?: VideoCodec } = { maxDuration: 60 };
        if (Platform.OS === 'ios') {
          recordOpts.codec = 'avc1';
        }

        const result = await cameraRef.current.recordAsync(recordOpts);

        clearRecordingTimers();
        isRecordingNativeRef.current = false;
        setIsRecording(false);
        onRecordingChange?.(false);
        Animated.spring(circleScale, {
          toValue: 1,
          damping: 14,
          stiffness: 140,
          useNativeDriver: true,
        }).start();
        circleTranslateX.setValue(0);
        circleTranslateY.setValue(0);
        progressAnim.setValue(0);

        if (discardResultRef.current) {
          setInlineVisible(false);
          return;
        }

        if (result?.uri) {
          setInlineVisible(false);
          try {
            const url = await uploadMedia(result.uri, 'video', 'mp4', 'video/mp4');
            await sendMediaMessage('video', url);
          } catch (e) {
            Alert.alert('Ошибка', 'Не удалось отправить видео. Попробуй ещё раз.');
            console.error('VideoRecorder: ошибка отправки', e);
          }
        }
      } catch (e) {
        clearRecordingTimers();
        isRecordingNativeRef.current = false;
        setIsRecording(false);
        onRecordingChange?.(false);
        Animated.spring(circleScale, {
          toValue: 1,
          damping: 14,
          stiffness: 140,
          useNativeDriver: true,
        }).start();
        circleTranslateX.setValue(0);
        circleTranslateY.setValue(0);
        progressAnim.setValue(0);
        setInlineVisible(false);
        console.warn('VideoRecorder: ошибка записи', e);
      }
    }, [
      clearRecordingTimers,
      progressAnim,
      onRecordingChange,
      circleScale,
      circleTranslateX,
      circleTranslateY,
      uploadMedia,
      sendMediaMessage,
    ]);

    const openRecorder = useCallback(async () => {
      onOpen?.();
      abortOpeningRef.current = false;
      discardResultRef.current = false;
      const cam = cameraPermission?.granted ? true : (await requestCameraPermission()).granted;
      const mic = micPermission?.granted ? true : (await requestMicPermission()).granted;
      if (!cam || !mic) {
        Alert.alert('Разрешения', 'Для записи видео нужен доступ к камере и микрофону.', [{ text: 'OK' }]);
        return;
      }
      if (abortOpeningRef.current) return;

      await prepareRecordingAudioSession();
      if (abortOpeningRef.current) return;

      cameraReadyRef.current = false;
      setElapsedMs(0);
      progressAnim.setValue(0);
      setInlineVisible(true);

      let spins = 0;
      while (!cameraReadyRef.current && !abortOpeningRef.current && spins < 40) {
        await new Promise<void>((r) => setTimeout(r, 50));
        spins++;
      }
      if (abortOpeningRef.current) {
        setInlineVisible(false);
        return;
      }
      if (!cameraReadyRef.current) {
        setInlineVisible(false);
        Alert.alert('Камера', 'Сессия камеры не успела запуститься. Попробуй ещё раз.');
        return;
      }

      await new Promise<void>((r) => InteractionManager.runAfterInteractions(() => r()));
      if (abortOpeningRef.current) {
        setInlineVisible(false);
        return;
      }

      await runRecordSession();
    }, [
      cameraPermission,
      micPermission,
      requestCameraPermission,
      requestMicPermission,
      prepareRecordingAudioSession,
      runRecordSession,
      progressAnim,
      onOpen,
    ]);

    const endInlineHold = useCallback(
      (opts: { cancelSlide: boolean }) => {
        if (opts.cancelSlide) {
          discardResultRef.current = true;
        }
        try {
          cameraRef.current?.stopRecording();
        } catch {
          /* ignore */
        }
        if (!isRecordingNativeRef.current) {
          abortOpeningRef.current = true;
          clearRecordingTimers();
          setIsRecording(false);
          onRecordingChange?.(false);
          Animated.spring(circleScale, {
            toValue: 1,
            damping: 14,
            stiffness: 140,
            useNativeDriver: true,
          }).start();
          circleTranslateX.setValue(0);
          circleTranslateY.setValue(0);
          progressAnim.setValue(0);
          setInlineVisible(false);
        }
      },
      [
        clearRecordingTimers,
        progressAnim,
        onRecordingChange,
        circleScale,
        circleTranslateX,
        circleTranslateY,
      ],
    );

    const onPanUpdate = useCallback(
      (tx: number, ty: number) => {
        circleTranslateX.setValue(tx);
        circleTranslateY.setValue(ty);
      },
      [circleTranslateX, circleTranslateY],
    );

    const lock = useCallback(() => {
      console.log('[VideoRecorder] lock called');
      setIsLocked(true);
      circleTranslateX.setValue(0);
      circleTranslateY.setValue(0);
      onRecordingChange?.(true);
    }, [circleTranslateX, circleTranslateY, onRecordingChange]);

    const cancelLocked = useCallback(() => {
      discardResultRef.current = true;
      setIsLocked(false);
      try {
        cameraRef.current?.stopRecording();
      } catch {
        /* ignore */
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        beginInlineHold: () => openRecorder(),
        endInlineHold: (o) => endInlineHold(o),
        onPanUpdate: (tx, ty) => onPanUpdate(tx, ty),
        lock: () => lock(),
        cancelLocked: () => cancelLocked(),
        getIsLocked: () => isLocked,
      }),
      [openRecorder, endInlineHold, onPanUpdate, lock, cancelLocked, isLocked],
    );

    const formatTime = (ms: number) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    };

    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    const bottomOffset =
      insets.bottom +
      TAB_BAR_LAYOUT.floatBottom +
      TAB_BAR_INNER_ROW_H +
      TAB_BAR_LAYOUT.topPad +
      52;

    return inlineVisible ? (
          <View style={styles.inlineLayer} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.inlineCircleWrap,
                {
                  width: INLINE_CIRCLE,
                  height: INLINE_CIRCLE,
                  borderRadius: INLINE_CIRCLE / 2,
                  bottom: bottomOffset,
                  transform: [
                    { translateX: circleTranslateX },
                    { translateY: circleTranslateY },
                    { scale: circleScale },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing="front"
                mode="video"
                videoQuality="480p"
                mute={false}
                onCameraReady={() => {
                  cameraReadyRef.current = true;
                }}
              />
              <View style={styles.circleOverlay} pointerEvents="none">
                <View style={styles.circleRing} />
                {isRecording ? (
                  <View style={styles.timerPill}>
                    <View style={styles.recDot} />
                    <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
                  </View>
                ) : null}
                <View style={styles.progressArc}>
                  <Animated.View
                    style={[
                      styles.progressArcFill,
                      { width: progressWidth },
                      isRecording && { backgroundColor: '#E05A5A' },
                    ]}
                  />
                </View>
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents={isLocked ? 'box-none' : 'none'}
              style={[
                styles.overlay,
                { opacity: isRecording || isLocked ? 1 : 0 },
              ]}
            >
              {isLocked ? (
                <View style={styles.lockedRow}>
                  <TouchableOpacity
                    onPress={cancelLocked}
                    style={styles.lockedCancelBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Trash2 size={18} color={V.dangerMuted} strokeWidth={1.5} />
                  </TouchableOpacity>
                  <View style={styles.timerRow}>
                    <View style={styles.recDotOverlay} />
                    <Text style={styles.timerOverlayText}>{formatTime(elapsedMs)}</Text>
                  </View>
                  <View style={styles.lockedRowSpacer} />
                  <TouchableOpacity
                    onPress={() => {
                      setIsLocked(false);
                      try {
                        cameraRef.current?.stopRecording();
                      } catch {
                        /* ignore */
                      }
                    }}
                    style={styles.sendSlot}
                  >
                    <SendHorizontal size={18} color={V.accentSage} strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>
              ) : isRecording ? (
                <>
                  <View style={styles.timerRow}>
                    <View style={styles.recDotOverlay} />
                    <Text style={styles.timerOverlayText}>{formatTime(elapsedMs)}</Text>
                  </View>
                  <Text
                    style={[styles.hintText, cancelActive && styles.hintActive]}
                    numberOfLines={1}
                  >
                    {'← Slide to cancel'}
                  </Text>
                  <View style={styles.micSpacer} />
                </>
              ) : null}
            </Animated.View>
          </View>
    ) : null;
  },
);

export default VideoRecorder;

const styles = StyleSheet.create({
  inlineLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    elevation: 15,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: TAB_BAR_LAYOUT.borderRadius,
    backgroundColor: V.bgSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
    minHeight: TAB_BAR_INNER_ROW_H,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    overflow: 'hidden',
    zIndex: 201,
    elevation: 201,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  recDotOverlay: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: V.dangerMuted,
  },
  timerOverlayText: {
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
  micSpacer: {
    width: MIC_OUTER,
    height: TAB_BAR_INNER_ROW_H,
  },
  lockedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  sendSlot: {
    width: MIC_OUTER,
    height: TAB_BAR_INNER_ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCircleWrap: {
    position: 'absolute',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: V.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
  },
  circleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  circleRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INLINE_CIRCLE / 2,
    borderWidth: 3,
    borderColor: 'rgba(90,158,154,0.45)',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: V.dangerMuted,
  },
  timerText: {
    color: V.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  /** Узкая полоска прогресса у нижнего края круга */
  progressArc: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  progressArcFill: {
    height: '100%',
    backgroundColor: V.accentSage,
    borderRadius: 2,
  },
});
