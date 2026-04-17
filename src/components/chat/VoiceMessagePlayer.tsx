import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Pause } from '../../icons/lucideIcons';
import { V } from '../../theme';

const BAR_W = 2;
const BAR_GAP = 1;
const WAVE_MAX_H = 20;
/** Было 160px; +25% длина пузыря голосового. */
const VOICE_BUBBLE_WIDTH = 200;
const WAVE_UNPLAYED = 'rgba(255,255,255,0.25)';

function formatDurSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function WaveBars({
  heights,
  progress,
}: {
  heights: readonly number[];
  progress: number;
}) {
  const list = heights.length > 0 ? heights : Array(40).fill(4);
  const n = list.length;
  const p = Math.min(1, Math.max(0, progress));
  const playedEnd = Math.min(n, Math.floor(p * n + 1e-6));
  return (
    <View style={styles.waveWrap}>
      <View style={styles.waveRow}>
        {list.map((h, i) => (
          <View
            key={`vb-${i}`}
            style={{
              width: BAR_W,
              height: Math.min(WAVE_MAX_H, Math.max(3, h * 0.45)),
              marginRight: i === n - 1 ? 0 : BAR_GAP,
              borderRadius: 2,
              backgroundColor: i < playedEnd ? '#FFFFFF' : WAVE_UNPLAYED,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export type VoiceMessagePlayerProps = {
  resolvedUri: string;
  messageId: string | number;
  waveformHeights: number[];
  isPlaying: boolean;
  progress: number;
  /** Длительность из `useAudioPlayerStatus` только для активной дорожки; иначе 0. */
  duration: number;
  /** Длительность из подписи сообщения (сек), когда плеер не активен — для статичного таймера. */
  idleDurationSec: number;
  onPlay: (uri: string, id: string | number) => void;
  isRecordingVoice: boolean;
};

/**
 * UI голосового: воспроизведение управляется снаружи (один плеер в Chat).
 */
export default function VoiceMessagePlayer({
  resolvedUri,
  messageId,
  waveformHeights,
  isPlaying,
  progress,
  duration,
  idleDurationSec,
  onPlay,
  isRecordingVoice,
}: VoiceMessagePlayerProps) {
  const onPress = useCallback(() => {
    if (isRecordingVoice) return;
    onPlay(resolvedUri, messageId);
  }, [isRecordingVoice, onPlay, resolvedUri, messageId]);

  const p = Math.min(1, Math.max(0, progress));
  const timerSec =
    duration > 0 ? p * duration : idleDurationSec > 0 ? idleDurationSec : 0;

  return (
    <View style={styles.bubble}>
      <TouchableOpacity
        onPress={onPress}
        style={styles.playHit}
        accessibilityRole="button"
        disabled={isRecordingVoice}
      >
        {isPlaying ? (
          <Pause size={22} color="#FFFFFF" strokeWidth={1.5} />
        ) : (
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 7,
              borderBottomWidth: 7,
              borderLeftWidth: 12,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: '#FFFFFF',
              marginLeft: 3,
            }}
          />
        )}
      </TouchableOpacity>
      <View style={styles.rightCol}>
        <WaveBars heights={waveformHeights} progress={p} />
        <Text style={styles.timer} numberOfLines={1}>
          {formatDurSec(timerSec)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    width: VOICE_BUBBLE_WIDTH,
    minWidth: 0,
  },
  playHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: V.accentSage,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: V.accentSage,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 7,
  },
  rightCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  waveWrap: {
    height: WAVE_MAX_H,
    justifyContent: 'center',
    minWidth: 0,
    overflow: 'hidden',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVE_MAX_H,
  },
  timer: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
});
