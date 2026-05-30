import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchPublicKeys } from '../../utils/VaultKeyServer';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { mergeMessagesKeepingOptimisticText } from './useChatOptimisticText';
import {
  mergeMessagesById,
  MESSAGES_PAGE_SIZE,
  MESSAGE_LIST_SELECT,
  serverHiddenForMeIdSet,
} from './chatMessageMerge';

/**
 * Подгрузка старых сообщений при скролле вверх (inverted FlatList → onEndReached).
 */
export default function useChatMessagePagination({
  roomId,
  nickname,
  isAriaChat,
  messagesRef,
  setMessages,
  decryptBatch,
  filterExpired,
  filterHiddenForMeKeepingDeleting,
  optimisticTextTempIdsRef,
  messagesLoading,
}) {
  const hasMoreOlderRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    hasMoreOlderRef.current = true;
    loadingOlderRef.current = false;
    setLoadingOlder(false);
  }, [roomId]);

  const onInitialPageLoaded = useCallback((fetchedCount) => {
    hasMoreOlderRef.current = fetchedCount >= MESSAGES_PAGE_SIZE;
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!roomId || isAriaChat || messagesLoading) return;
    if (!hasMoreOlderRef.current || loadingOlderRef.current) return;

    const current = messagesRef.current;
    const oldest = current[0];
    if (!oldest?.created_at) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_LIST_SELECT)
        .eq('room_id', roomId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (error) {
        if (__DEV__) console.warn('[chat pagination]', error.message);
        return;
      }

      const rows = data ?? [];
      hasMoreOlderRef.current = rows.length >= MESSAGES_PAGE_SIZE;
      if (rows.length === 0) return;

      const chronological = [...rows].reverse();
      const uniquePlayers = [...new Set(chronological.map((m) => m.player_name))];
      try {
        await fetchPublicKeys(uniquePlayers);
      } catch {}

      const decrypted = await decryptBatch(chronological);
      const filtered = filterHiddenForMeKeepingDeleting(filterExpired(decrypted));
      const serverHiddenForMeIds = serverHiddenForMeIdSet(nickname, chronological);

      setMessages((prev) => {
        const merged = mergeMessagesById(filtered, prev).filter(
          (m) => !serverHiddenForMeIds.has(m.id),
        );
        const withOptimistic = mergeMessagesKeepingOptimisticText(
          merged,
          prev,
          optimisticTextTempIdsRef?.current ?? [],
        );
        roomMessagesCache.set(roomId, withOptimistic);
        return withOptimistic;
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [
    roomId,
    nickname,
    isAriaChat,
    messagesLoading,
    messagesRef,
    setMessages,
    decryptBatch,
    filterExpired,
    filterHiddenForMeKeepingDeleting,
    optimisticTextTempIdsRef,
  ]);

  return {
    loadingOlder,
    loadOlderMessages,
    onInitialPageLoaded,
    hasMoreOlderRef,
  };
}
