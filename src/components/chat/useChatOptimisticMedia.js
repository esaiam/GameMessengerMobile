import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { DEFAULT_VOICE_WAVEFORM } from './voiceWaveformSamples';
import { formatDuration } from './chatMessageListFormat';

export const OPT_IMAGE_PREFIX = '__opt_image_';
export const OPT_VOICE_PREFIX = '__opt_voice_media_';

function startRowAnims(tempId, fadeAnims, scaleAnims) {
  fadeAnims[tempId] = new Animated.Value(0);
  scaleAnims[tempId] = new Animated.Value(0.85);
  Animated.parallel([
    Animated.timing(fadeAnims[tempId], { toValue: 1, duration: 200, useNativeDriver: true }),
    Animated.spring(scaleAnims[tempId], { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
  ]).start();
}

/**
 * Optimistic image / voice в ленте + refs для reconcile через realtime (temp id → server id).
 */
export default function useChatOptimisticMedia({
  roomId,
  nickname,
  setMessages,
  filterHiddenForMeKeepingDeleting,
  filterExpired,
  fadeAnims,
  scaleAnims,
}) {
  const optimisticImageTempIdRef = useRef(null);
  const optimisticVoiceTempIdRef = useRef(null);

  const appendRow = useCallback(
    (row, tempIdRef) => {
      tempIdRef.current = row.id;
      startRowAnims(row.id, fadeAnims, scaleAnims);
      setMessages((prev) => {
        const next = filterHiddenForMeKeepingDeleting(filterExpired([...prev, row]));
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
      return row.id;
    },
    [roomId, fadeAnims, scaleAnims, setMessages, filterHiddenForMeKeepingDeleting, filterExpired],
  );

  const appendOptimisticImage = useCallback(
    (localUri) => {
      const tempId = `${OPT_IMAGE_PREFIX}${Date.now()}`;
      return appendRow(
        {
          id: tempId,
          clientRowKey: tempId,
          room_id: roomId,
          player_name: nickname,
          message_type: 'image',
          media_url: localUri,
          text: '',
          created_at: new Date().toISOString(),
          _isOptimistic: true,
        },
        optimisticImageTempIdRef,
      );
    },
    [appendRow, roomId, nickname],
  );

  const appendOptimisticVoice = useCallback(
    ({ localUri, duration, waveform }) => {
      const tempId = `${OPT_VOICE_PREFIX}${Date.now()}`;
      const wf =
        Array.isArray(waveform) && waveform.length > 0 ? [...waveform] : DEFAULT_VOICE_WAVEFORM();
      return appendRow(
        {
          id: tempId,
          clientRowKey: tempId,
          room_id: roomId,
          player_name: nickname,
          message_type: 'voice',
          media_url: localUri,
          text: `🎤 ${formatDuration(duration)}`,
          waveform: wf,
          created_at: new Date().toISOString(),
          _isOptimistic: true,
        },
        optimisticVoiceTempIdRef,
      );
    },
    [appendRow, roomId, nickname],
  );

  const removeOptimistic = useCallback(
    (tempIdRef) => {
      const tempId = tempIdRef.current;
      if (!tempId) return;
      tempIdRef.current = null;
      delete fadeAnims[tempId];
      delete scaleAnims[tempId];
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== tempId);
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
    },
    [roomId, fadeAnims, scaleAnims, setMessages],
  );

  const clearOptimisticFlag = useCallback(
    (tempIdRef) => {
      const tempId = tempIdRef.current;
      if (!tempId) return;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === tempId ? { ...m, _isOptimistic: false } : m));
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
    },
    [roomId, setMessages],
  );

  const handleImageSendError = useCallback(
    () => removeOptimistic(optimisticImageTempIdRef),
    [removeOptimistic],
  );

  const handleVoiceSendError = useCallback(
    () => removeOptimistic(optimisticVoiceTempIdRef),
    [removeOptimistic],
  );

  const handleImageUploadFinished = useCallback(
    () => clearOptimisticFlag(optimisticImageTempIdRef),
    [clearOptimisticFlag],
  );

  const handleVoiceUploadFinished = useCallback(
    () => clearOptimisticFlag(optimisticVoiceTempIdRef),
    [clearOptimisticFlag],
  );

  return {
    optimisticImageTempIdRef,
    optimisticVoiceTempIdRef,
    appendOptimisticImage,
    appendOptimisticVoice,
    handleImageSendError,
    handleVoiceSendError,
    handleImageUploadFinished,
    handleVoiceUploadFinished,
  };
}

export function isOwnImageMessage(msg, nickname) {
  return msg?.player_name === nickname && msg?.message_type === 'image';
}

export function isOwnVoiceMessage(msg, nickname) {
  return (
    msg?.player_name === nickname &&
    (msg?.message_type === 'voice' || msg?.message_type === 'audio')
  );
}
