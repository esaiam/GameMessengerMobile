import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { chatMutationErrorMessage } from './chatMutationErrorMessage';
import { mergeMessagesById, MESSAGE_LIST_SELECT } from './chatMessageMerge';

const SERVER_MESSAGE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isServerMessageId(id) {
  return typeof id === 'string' && SERVER_MESSAGE_ID_RE.test(id);
}

/**
 * Закрепление одного сообщения на комнату (`rooms.pinned_message_id`).
 */
export default function useChatPinnedMessage({
  roomId,
  isAriaChat = false,
  nickname,
  messages,
  setMessages,
  decryptMsg,
  filterHiddenForMeKeepingDeleting,
  filterExpired,
}) {
  const [pinnedMessageId, setPinnedMessageId] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const resolveGenRef = useRef(0);

  const resolvePinnedMessage = useCallback(
    async (messageId) => {
      if (!messageId) return null;

      const local = messages.find((m) => m.id === messageId);
      if (local) {
        const visible = filterHiddenForMeKeepingDeleting(filterExpired([local]));
        return visible[0] ?? null;
      }

      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_LIST_SELECT)
        .eq('id', messageId)
        .maybeSingle();

      if (error || !data) return null;
      if ((data.hidden_for || []).includes(nickname)) return null;

      const decrypted = await decryptMsg(data);
      const visible = filterHiddenForMeKeepingDeleting(filterExpired([decrypted]));
      if (visible.length === 0) return null;

      setMessages((prev) => {
        const merged = mergeMessagesById(prev, visible);
        if (roomId) roomMessagesCache.set(roomId, merged);
        return merged;
      });
      return visible[0];
    },
    [
      messages,
      nickname,
      decryptMsg,
      filterHiddenForMeKeepingDeleting,
      filterExpired,
      setMessages,
      roomId,
    ],
  );

  useEffect(() => {
    if (!roomId || isAriaChat) {
      setPinnedMessageId(null);
      setPinnedMessage(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('pinned_message_id')
        .eq('id', roomId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        if (__DEV__) console.warn('[chat pin] load room', error.message);
        return;
      }
      setPinnedMessageId(data?.pinned_message_id ?? null);
    })();

    const channel = supabase
      .channel(`room-pin-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const nextId = payload.new?.pinned_message_id ?? null;
          const prevId = payload.old?.pinned_message_id ?? null;
          if (nextId !== prevId) {
            setPinnedMessageId(nextId);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, isAriaChat]);

  useEffect(() => {
    if (!pinnedMessageId || isAriaChat) {
      setPinnedMessage(null);
      return undefined;
    }

    const local = messages.find((m) => m.id === pinnedMessageId);
    if (local) {
      const visible = filterHiddenForMeKeepingDeleting(filterExpired([local]));
      setPinnedMessage(visible[0] ?? null);
      return undefined;
    }

    const gen = ++resolveGenRef.current;
    let cancelled = false;

    (async () => {
      const resolved = await resolvePinnedMessage(pinnedMessageId);
      if (cancelled || gen !== resolveGenRef.current) return;
      setPinnedMessage(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pinnedMessageId,
    isAriaChat,
    messages,
    resolvePinnedMessage,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
  ]);

  const applyPinId = useCallback((nextId) => {
    setPinnedMessageId(nextId);
  }, []);

  const pinMessage = useCallback(
    async (message) => {
      if (!roomId || isAriaChat || !message?.id || message._isOptimistic) return false;

      if (!isServerMessageId(message.id)) {
        Alert.alert('Ошибка', 'Дождитесь отправки сообщения и попробуйте закрепить снова.');
        return false;
      }

      const prevId = pinnedMessageId;
      applyPinId(message.id);

      const { error } = await supabase
        .from('rooms')
        .update({ pinned_message_id: message.id })
        .eq('id', roomId);

      if (error) {
        applyPinId(prevId);
        if (__DEV__) console.warn('[chat pin] update', error.code, error.message);
        Alert.alert(
          'Ошибка',
          chatMutationErrorMessage(error, 'Не удалось закрепить сообщение'),
        );
        return false;
      }
      return true;
    },
    [roomId, isAriaChat, pinnedMessageId, applyPinId],
  );

  const unpinMessage = useCallback(async () => {
    if (!roomId || isAriaChat || !pinnedMessageId) return false;

    const prevId = pinnedMessageId;
    applyPinId(null);

    const { error } = await supabase
      .from('rooms')
      .update({ pinned_message_id: null })
      .eq('id', roomId);

    if (error) {
      applyPinId(prevId);
      Alert.alert(
        'Ошибка',
        chatMutationErrorMessage(error, 'Не удалось открепить сообщение'),
      );
      return false;
    }
    return true;
  }, [roomId, isAriaChat, pinnedMessageId, applyPinId]);

  const togglePinForMessage = useCallback(
    async (message) => {
      if (!message?.id) return;
      if (pinnedMessageId === message.id) {
        await unpinMessage();
        return;
      }
      await pinMessage(message);
    },
    [pinnedMessageId, pinMessage, unpinMessage],
  );

  const isMessagePinned = useCallback(
    (messageId) => Boolean(messageId && pinnedMessageId === messageId),
    [pinnedMessageId],
  );

  return {
    pinnedMessageId,
    pinnedMessage,
    pinMessage,
    unpinMessage,
    togglePinForMessage,
    isMessagePinned,
  };
}
