import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Square } from '../../icons/lucideIcons';

const WAVE_MAX = 40;
const POLL_MS = 100;
const BAR_GAP = 2;
const BAR_RADIUS = 2;
const ACCENT = '#5A9E9A';

function meteringToBarHeight(metering: number | undefined): number {
  const db = typeof metering === 'number' && !Number.isNaN(metering) ? metering : -160;
  return Math.max(4, ((db + 160) / 160) * 40);
}

export type AudioRecorderPayload = {
  uri: string;
  waveformData: number[];
  durationMillis: number;
};

type Props = {
  /** После остановки записи: uri + финальный waveform. */
  onRecorded: (payload: AudioRecorderPayload) => void;
  onRecordingChange?: (active: boolean) => void;
};

/**
 * Запись expo-av: metering каждые 100 мс → последние 40 высот столбиков.
 */
export default function AudioRecorder({ onRecorded, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      const r = recordingRef.current;
      if (r) {
        recordingRef.current = null;
        r.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const pushSample = useCallback((height: number) => {
    setWaveformData((prev) => {
      const next = prev.length >= WAVE_MAX ? prev.slice(1) : [...prev];
      next.push(height);
      waveformRef.current = next;
      return next;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (rec: Audio.Recording) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await rec.getStatusAsync();
          if (!status.isRecording) return;
          const h = meteringToBarHeight(status.metering);
          pushSample(h);
        } catch {
          /* ignore */
        }
      }, POLL_MS);
    },
    [pushSample, stopPolling],
  );

  const stopRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    stopPolling();
    recordingRef.current = null;

    let uri: string | null = null;
    let durationMillis = 0;
    try {
      const last = await rec.getStatusAsync();
      if (typeof last.durationMillis === 'number') {
        durationMillis = last.durationMillis;
      }
      await rec.stopAndUnloadAsync();
      uri = rec.getURI() ?? null;
    } catch (e) {
      console.warn('[AudioRecorder] stop failed', e);
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
      /* ignore */
    }

    const snapshot = [...waveformRef.current];
    waveformRef.current = [];
    setWaveformData([]);
    setRecording(false);
    onRecordingChange?.(false);

    if (uri && mountedRef.current) {
      onRecorded({
        uri,
        waveformData: snapshot,
        durationMillis,
      });
    }
  }, [onRecorded, onRecordingChange, stopPolling]);

  const startRecording = useCallback(async () => {
    if (recordingRef.current || busy) return;
    setBusy(true);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите запись аудио в настройках');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await rec.startAsync();
      recordingRef.current = rec;
      waveformRef.current = [];
      setWaveformData([]);
      setRecording(true);
      onRecordingChange?.(true);
      startPolling(rec);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Ошибка записи', msg);
      console.warn('[AudioRecorder]', e);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, onRecordingChange, startPolling]);

  const onPressMain = useCallback(() => {
    if (recording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  return (
    <View style={styles.root}>
      <TouchableOpacity
        onPress={onPressMain}
        disabled={busy}
        activeOpacity={0.85}
        style={styles.mainTap}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Остановить запись' : 'Начать запись'}
      >
        {busy && !recording ? (
          <ActivityIndicator color={ACCENT} />
        ) : recording ? (
          <Square size={18} color={ACCENT} strokeWidth={1.5} />
        ) : (
          <Mic size={20} color={ACCENT} strokeWidth={1.5} />
        )}
      </TouchableOpacity>

      {recording && (
        <View style={styles.waveRow}>
          {waveformData.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: h,
                  marginRight: i === waveformData.length - 1 ? 0 : BAR_GAP,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  mainTap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: WAVE_MAX,
    marginLeft: 8,
    flex: 1,
  },
  bar: {
    width: 3,
    borderRadius: BAR_RADIUS,
    backgroundColor: ACCENT,
  },
});
