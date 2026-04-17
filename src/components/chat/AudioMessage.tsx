import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { Play, Pause } from '../../icons/lucideIcons';

const ACCENT = '#5A9E9A';
const ACCENT_DIM = 'rgba(90,158,154,0.3)';
const TIMER_COLOR = 'rgba(255,255,255,0.5)';
const BAR_W = 3;
const BAR_GAP = 2;
const BAR_RADIUS = 2;
const WAVE_H = 40;
const BUBBLE_MAX_W = 260;

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export type AudioMessageProps = {
  uri: string;
  /** Высоты столбиков 4…40 в порядке времени (до 40 шт.), как при записи. */
  waveformData: number[];
};

/**
 * Пузырь: play/pause (expo-av Sound), статичная waveform с прогрессом, таймер.
 */
export default function AudioMessage({ uri, waveformData }: AudioMessageProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const mountedRef = useRef(true);

  const bars = waveformData.length > 0 ? waveformData : Array(40).fill(4);

  useEffect(() => {
    mountedRef.current = true;
    let sound: Audio.Sound | null = null;

    (async () => {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, progressUpdateIntervalMillis: 100 },
          (status: AVPlaybackStatus) => {
            if (!mountedRef.current || !status.isLoaded) return;
            setPositionMillis(status.positionMillis ?? 0);
            if (typeof status.durationMillis === 'number') {
              setDurationMillis(status.durationMillis);
            }
            setPlaying(status.isPlaying ?? false);
            if (status.didJustFinish) {
              setPositionMillis(0);
              setPlaying(false);
            }
          },
        );
        sound = s;
        soundRef.current = s;
        if (mountedRef.current) setLoaded(true);
      } catch (e) {
        console.warn('[AudioMessage] load failed', e);
      }
    })();

    return () => {
      mountedRef.current = false;
      soundRef.current = null;
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [uri]);

  const onTogglePlay = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;
      if (st.isPlaying) {
        await s.pauseAsync();
      } else {
        const atEnd =
          typeof st.durationMillis === 'number' &&
          st.durationMillis > 0 &&
          (st.positionMillis ?? 0) >= st.durationMillis - 80;
        if (atEnd) {
          await s.setPositionAsync(0);
        }
        await s.playAsync();
      }
    } catch (e) {
      console.warn('[AudioMessage] play/pause', e);
    }
  }, []);

  const dur = durationMillis > 0 ? durationMillis : 1;
  const progress = Math.min(1, Math.max(0, positionMillis / dur));
  const playedCount = Math.min(bars.length, Math.floor(progress * bars.length + 1e-6));

  const timerMs =
    playing || positionMillis > 0 ? positionMillis : durationMillis > 0 ? durationMillis : 0;

  return (
    <View style={styles.bubble} accessibilityRole="none">
      <TouchableOpacity
        onPress={onTogglePlay}
        disabled={!loaded}
        style={styles.playHit}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? (
          <Pause size={20} color={ACCENT} strokeWidth={1.5} />
        ) : (
          <Play size={20} color={ACCENT} strokeWidth={1.5} />
        )}
      </TouchableOpacity>

      <View style={styles.waveWrap}>
        <View style={styles.waveRow}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.min(WAVE_H, Math.max(4, h)),
                  marginRight: i === bars.length - 1 ? 0 : BAR_GAP,
                  backgroundColor: i < playedCount ? ACCENT : ACCENT_DIM,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.timer} numberOfLines={1}>
        {formatMmSs(timerMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: BUBBLE_MAX_W,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(90,158,154,0.15)',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 7,
    elevation: 5,
  },
  waveWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: WAVE_H,
  },
  bar: {
    width: BAR_W,
    borderRadius: BAR_RADIUS,
  },
  timer: {
    marginLeft: 8,
    minWidth: 36,
    fontSize: 12,
    fontWeight: '400',
    color: TIMER_COLOR,
    textAlign: 'right',
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
});
