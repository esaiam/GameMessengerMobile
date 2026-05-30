import { useRef, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';
import roomMessagesCache from '../../utils/roomMessagesCache';

export const OPT_TEXT_PREFIX = '__opt_text_';

export function isOptimisticTextMessage(m) {
  return Boolean(m?._isOptimistic && String(m?.id ?? '').startsWith(OPT_TEXT_PREFIX));
}

/** Сохранить pending optimistic rows при sync с сервером (первые 30). */
export function mergeMessagesKeepingOptimisticText(serverRows, prevRows, pendingTempIds) {
  if (!pendingTempIds?.length) return serverRows;
  const pendingSet = new Set(pendingTempIds);
  const pendingRows = prevRows.filter((m) => pendingSet.has(m.id));
  if (pendingRows.length === 0) return serverRows;
  const serverIds = new Set(serverRows.map((m) => m.id));
  const stillPending = pendingRows.filter((p) => !serverIds.has(p.id));
  if (stillPending.length === 0) return serverRows;
  return [...serverRows, ...stillPending];
}

function transferRowAnims(tempId, serverId, fadeAnims, scaleAnims) {
  if (fadeAnims[tempId] != null && scaleAnims[tempId] != null) {
    fadeAnims[serverId] = fadeAnims[tempId];
    scaleAnims[serverId] = scaleAnims[tempId];
    delete fadeAnims[tempId];
    delete scaleAnims[tempId];
    return;
  }
  fadeAnims[serverId] = new Animated.Value(1);
  scaleAnims[serverId] = new Animated.Value(1);
}

/**
 * Optimistic text в ленте + FIFO очередь temp id для reconcile (insert response / realtime).
 */
export default function useChatOptimisticText({
  roomId,
  nickname,
  setMessages,
  filterHiddenForMeKeepingDeleting,
  filterExpired,
  fadeAnims,
  scaleAnims,
}) {
  const optimisticTextTempIdsRef = useRef([]);

  useEffect(() => {
    optimisticTextTempIdsRef.current = [];
  }, [roomId]);

  const dropPendingTempId = useCallback((tempId) => {
    optimisticTextTempIdsRef.current = optimisticTextTempIdsRef.current.filter((id) => id !== tempId);
  }, []);

  const appendOptimisticText = useCallback(
    ({ plainText, replyTo, ephemeralSec }) => {
      const tempId = `${OPT_TEXT_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      optimisticTextTempIdsRef.current.push(tempId);

      fadeAnims[tempId] = new Animated.Value(0);
      scaleAnims[tempId] = new Animated.Value(0.85);
      Animated.parallel([
        Animated.timing(fadeAnims[tempId], { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnims[tempId], { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }),
      ]).start();

      const now = new Date().toISOString();
      const row = {
        id: tempId,
        clientRowKey: tempId,
        room_id: roomId,
        player_name: nickname,
        message_type: 'text',
        text: plainText,
        created_at: now,
        read_at: null,
        reply_to: replyTo?.id ?? null,
        _isOptimistic: true,
      };
      if (ephemeralSec) {
        row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
      }

      setMessages((prev) => {
        const next = filterHiddenForMeKeepingDeleting(filterExpired([...prev, row]));
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });

      return tempId;
    },
    [
      roomId,
      nickname,
      fadeAnims,
      scaleAnims,
      setMessages,
      filterHiddenForMeKeepingDeleting,
      filterExpired,
    ],
  );

  const removeOptimisticText = useCallback(
    (tempId) => {
      dropPendingTempId(tempId);
      delete fadeAnims[tempId];
      delete scaleAnims[tempId];
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== tempId);
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
    },
    [roomId, dropPendingTempId, fadeAnims, scaleAnims, setMessages],
  );

  const reconcileOptimisticText = useCallback(
    (tempId, serverMsg) => {
      dropPendingTempId(tempId);
      transferRowAnims(tempId, serverMsg.id, fadeAnims, scaleAnims);
      setMessages((prev) => {
        const withoutDup = prev.filter((m) => m.id !== serverMsg.id && m.id !== tempId);
        const next = filterHiddenForMeKeepingDeleting(
          filterExpired([
            ...withoutDup,
            { ...serverMsg, clientRowKey: tempId, _isOptimistic: false },
          ]),
        );
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
    },
    [
      roomId,
      dropPendingTempId,
      fadeAnims,
      scaleAnims,
      setMessages,
      filterHiddenForMeKeepingDeleting,
      filterExpired,
    ],
  );

  return {
    optimisticTextTempIdsRef,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
  };
}

export function isOwnTextMessage(msg, nickname) {
  return (
    msg?.player_name === nickname &&
    (!msg.message_type || msg.message_type === 'text') &&
    !msg.media_url
  );
}

export { transferRowAnims };
