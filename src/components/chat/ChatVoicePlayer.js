import React, { useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useVoicePlayerResolvedUri } from '../../hooks/useVoicePlayerResolvedUri';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import VoiceWaveformBars from './VoiceWaveformBars';
import { DEFAULT_VOICE_WAVEFORM, parseStoredVoiceWaveform } from './voiceWaveformSamples';
import { V, TAB_BAR_INNER_ROW_H } from '../../theme';

export default function ChatVoicePlayer({
  url,
  messageId,
  isRecordingVoice,
  waveformRaw,
  onPlay,
  activeVoiceMessageId,
  activePlayerStatus,
  idleDurationSec,
}) {
  const resolvedUri = useVoicePlayerResolvedUri(url);
  const parsedHeights = useMemo(
    () => parseStoredVoiceWaveform(waveformRaw),
    [typeof waveformRaw === 'string' ? waveformRaw : JSON.stringify(waveformRaw ?? null)]
  );
  const displayHeights = useMemo(
    () => parsedHeights ?? DEFAULT_VOICE_WAVEFORM(),
    [parsedHeights]
  );

  if (!url) return null;

  const preparingRemote =
    typeof url === 'string' && /^https?:\/\//i.test(url) && resolvedUri == null;

  if (preparingRemote) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 200,
          minHeight: TAB_BAR_INNER_ROW_H - 4,
          minWidth: 0,
        }}
      >
        <ActivityIndicator size="small" color={V.accentSage} />
        <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
          <VoiceWaveformBars heights={displayHeights} progress={0} idle />
        </View>
      </View>
    );
  }

  if (!resolvedUri) return null;

  const isActiveRow =
    !isRecordingVoice && activeVoiceMessageId != null && activeVoiceMessageId === messageId;
  const isPlaying = isActiveRow && activePlayerStatus.playing;
  const duration = isActiveRow ? activePlayerStatus.duration : 0;
  const progress =
    isActiveRow && activePlayerStatus.duration > 0
      ? activePlayerStatus.currentTime / activePlayerStatus.duration
      : 0;

  return (
    <VoiceMessagePlayer
      resolvedUri={resolvedUri}
      messageId={messageId}
      waveformHeights={displayHeights}
      isPlaying={isPlaying}
      progress={progress}
      duration={duration}
      idleDurationSec={idleDurationSec}
      onPlay={onPlay}
      isRecordingVoice={isRecordingVoice}
    />
  );
}
