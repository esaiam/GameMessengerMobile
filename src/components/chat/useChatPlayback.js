import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVoicePlayer } from '../../hooks/useVoicePlayer';
import { useChatMediaPlayback } from '../../hooks/useChatMediaPlayback';
import { MAX_RENDERED_VIDEOS } from './chatViewConstants';

/**
 * Voice/video playback in chat: player hooks, video unlock set, pause voice while recording.
 * Depends on: roomId, formattedMessages, isRecordingVoice.
 */
export default function useChatPlayback({ roomId, formattedMessages, isRecordingVoice }) {
  const [unlockedVideoIds, setUnlockedVideoIds] = useState(() => new Set());

  const {
    play: playVoice,
    activeUri: activeVoiceUri,
    status: activePlayerStatus,
    pause: pauseVoice,
  } = useVoicePlayer();

  const {
    activeVideoId,
    activeVoiceMessageId,
    activatedVideoIds,
    setActiveVideoId,
    playVoiceMessage,
    activateVideo,
    stopVideo,
  } = useChatMediaPlayback({
    playVoice,
    pauseVoice,
    activeVoiceUri,
    roomId,
  });

  useEffect(() => {
    if (!isRecordingVoice) return;
    pauseVoice();
  }, [isRecordingVoice, pauseVoice]);

  const onUnlockVideo = useCallback((id) => {
    setUnlockedVideoIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const renderableVideoIds = useMemo(() => {
    const ids = new Set(unlockedVideoIds);
    let count = 0;
    for (const msg of formattedMessages) {
      if (msg.message_type === 'video') {
        if (count < MAX_RENDERED_VIDEOS) {
          ids.add(msg.id);
          count++;
        }
      }
    }
    return ids;
  }, [formattedMessages, unlockedVideoIds]);

  return {
    activeVoiceUri,
    activePlayerStatus,
    activeVideoId,
    activeVoiceMessageId,
    activatedVideoIds,
    setActiveVideoId,
    playVoiceMessage,
    activateVideo,
    stopVideo,
    onUnlockVideo,
    renderableVideoIds,
  };
}
