import React, { useMemo, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useVoicePlayerResolvedUri } from '../../hooks/useVoicePlayerResolvedUri';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import VoiceWaveformBars from './VoiceWaveformBars';
import { DEFAULT_VOICE_WAVEFORM, parseStoredVoiceWaveform } from './voiceWaveformSamples';
import { V, COMPOSER_LAYOUT } from '../../theme';
import {
  registerActivePlaybackUri,
  unregisterActivePlaybackUri,
  updateFileAccess,
} from '../../storage/CacheManager';

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

  const preparingRemote =
    typeof url === 'string' && /^https?:\/\//i.test(url) && resolvedUri == null;

  const isActiveRow =
    !!url &&
    !!resolvedUri &&
    !preparingRemote &&
    !isRecordingVoice &&
    activeVoiceMessageId != null &&
    activeVoiceMessageId === messageId;

  const isPlaying = !!(isActiveRow && activePlayerStatus?.playing);

  const isLocalFile =
    typeof resolvedUri === 'string' &&
    resolvedUri.length > 0 &&
    !/^https?:\/\//i.test(resolvedUri);

  useEffect(() => {
    if (!isLocalFile || !resolvedUri) return;
    if (isPlaying) {
      updateFileAccess(resolvedUri).catch(() => {});
      registerActivePlaybackUri(resolvedUri);
      return () => unregisterActivePlaybackUri(resolvedUri);
    }
    return undefined;
  }, [isPlaying, resolvedUri, isLocalFile]);

  const parsedHeights = useMemo(
    () => parseStoredVoiceWaveform(waveformRaw),
    [typeof waveformRaw === 'string' ? waveformRaw : JSON.stringify(waveformRaw ?? null)]
  );
  const displayHeights = useMemo(
    () => parsedHeights ?? DEFAULT_VOICE_WAVEFORM(),
    [parsedHeights]
  );

  if (!url) return null;

  if (preparingRemote) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 200,
          minHeight: COMPOSER_LAYOUT.innerHeight - 4,
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

  const duration = isActiveRow ? activePlayerStatus?.duration ?? 0 : 0;
  const progress =
    isActiveRow && (activePlayerStatus?.duration ?? 0) > 0
      ? (activePlayerStatus?.currentTime ?? 0) / (activePlayerStatus?.duration ?? 1)
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
