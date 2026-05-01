import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

/**
 * Оптимистичное видео в ленте + refs для синка с realtime (temp id → server id).
 */
export default function useChatOptimisticVideo({
  roomId,
  nickname,
  setMessages,
  filterHiddenForMeKeepingDeleting,
  filterExpired,
  fadeAnims,
  scaleAnims,
}) {
  /** Temp ID оптимистичного видеосообщения, ожидающего подтверждения от сервера */
  const optimisticVideoTempIdRef = useRef(null);
  /** После INSERT: tempId → реальный id, чтобы не сбрасывать открытое видео при замене плейсхолдера */
  const pendingVideoActiveIdMigrationRef = useRef(null);

  const handleVideoRecorded = useCallback(
    (localUri) => {
      const tempId = `__opt_video_${Date.now()}`;
      optimisticVideoTempIdRef.current = tempId;
      fadeAnims[tempId] = new Animated.Value(0);
      scaleAnims[tempId] = new Animated.Value(0.85);
      Animated.parallel([
        Animated.timing(fadeAnims[tempId], { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnims[tempId], { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();
      setMessages((prev) =>
        filterHiddenForMeKeepingDeleting(
          filterExpired([
            ...prev,
            {
              id: tempId,
              clientRowKey: tempId,
              room_id: roomId,
              player_name: nickname,
              message_type: 'video',
              media_url: localUri,
              created_at: new Date().toISOString(),
              _isOptimistic: true,
            },
          ]),
        ),
      );
    },
    [roomId, nickname, fadeAnims, scaleAnims, setMessages, filterHiddenForMeKeepingDeleting, filterExpired],
  );

  const handleVideoSendError = useCallback(() => {
    const tempId = optimisticVideoTempIdRef.current;
    if (!tempId) return;
    optimisticVideoTempIdRef.current = null;
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }, [setMessages]);

  return {
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    handleVideoRecorded,
    handleVideoSendError,
  };
}
