import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setIsAudioActiveAsync,
} from 'expo-audio';
import { SendHorizontal, Trash2, Pause, Play } from '../../icons/lucideIcons';
import { V, TAB_BAR_LAYOUT, COMPOSER_LAYOUT, COMPOSER_CAPSULE_RADIUS } from '../../theme';
import { setAudioModeAsync } from '../../utils/audioMode';
import {
  DEPTH,
  MIC_OUTER,
  TRIM_HANDLE_W,
  TRIM_HANDLE_H,
  TRIM_MIN_SPAN,
} from './voiceRecorderConstants';
import { fmtDur } from './voiceWaveformUtils';
import { WaveformSvg } from './VoiceWaveformSvg';

export interface PausedPreviewBarProps {
  uri: string | null | undefined;
  bars: number[];
  dur: number;
  onTrim: (start: number, end: number) => void;
  onCancel: () => void;
  onSend: () => void;
}

/** Предпросмотр с обрезкой (как в референсе), цвета Vault */
export function PausedPreviewBar({
  uri,
  bars,
  dur,
  onTrim,
  onCancel,
  onSend,
}: PausedPreviewBarProps) {
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
  const moveLeft = useCallback((tx: number) => {
    const tw = trackWRef.current;
    if (tw < 48) return;
    const d = tx / tw;
    const start = dragStartRef.current;
    const nextS = Math.min(
      Math.max(0, start.s + d),
      trimDragRef.current.e - TRIM_MIN_SPAN,
    );
    setTrim((prev) => ({ s: nextS, e: prev.e }));
  }, []);

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

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: DEPTH,
    left: DEPTH,
    right: DEPTH,
    bottom: DEPTH,
    borderRadius: COMPOSER_CAPSULE_RADIUS,
    backgroundColor: V.bgSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
    minHeight: COMPOSER_LAYOUT.innerHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    overflow: 'hidden',
  },
  iconSlot: {
    width: 40,
    height: COMPOSER_LAYOUT.innerHeight,
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
    height: COMPOSER_LAYOUT.innerHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
