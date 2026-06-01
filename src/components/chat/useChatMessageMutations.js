import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { buildHiddenForEveryone } from './buildHiddenForEveryone';
import { chatMutationErrorMessage } from './chatMutationErrorMessage';
import { invalidatePreviewCache } from '../../screens/chats/chatsPreviewCache';

/** `aria-db-{uuid}` → uuid в `aria_messages`. */
function ariaDbRowId(messageId) {
  if (typeof messageId !== 'string' || !messageId.startsWith('aria-db-')) return null;
  const raw = messageId.slice('aria-db-'.length);
  return raw.length > 0 ? raw : null;
}

/**
 * Реакции на сообщение и удаление (у меня / у всех через hidden_for), плюс закрытие модалки подтверждения.
 */
export default function useChatMessageMutations({
  messages,
  setMessages,
  nickname,
  peerName,
  roomId,
  isAriaChat = false,
  popMessage,
  setDeletingIds,
  setDeleteConfirmVisible,
  setSelectedMessage,
  chatSyncRef,
  unpinMessageIfMatches,
}) {
  const removeMessageFromState = useCallback(
    (messageId) => {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== messageId);
        if (roomId) roomMessagesCache.set(roomId, next);
        return next;
      });
      invalidatePreviewCache(messageId);
    },
    [roomId, setMessages],
  );

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      let nextReactions;
      let prevReactions;

      setMessages((prev) => {
        const msg = prev.find((m) => m.id === messageId);
        if (!msg) return prev;
        prevReactions = msg.reactions;
        nextReactions = { ...(msg.reactions || {}) };
        const users = nextReactions[emoji] || [];
        if (users.includes(nickname)) {
          nextReactions[emoji] = users.filter((u) => u !== nickname);
          if (nextReactions[emoji].length === 0) delete nextReactions[emoji];
        } else {
          nextReactions[emoji] = [...users, nickname];
        }
        return prev.map((m) =>
          m.id === messageId ? { ...m, reactions: nextReactions } : m,
        );
      });

      if (!nextReactions) return;

      const { error } = await supabase
        .from('messages')
        .update({ reactions: nextReactions })
        .eq('id', messageId);

      if (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: prevReactions } : m,
          ),
        );
        Alert.alert(
          'Ошибка',
          chatMutationErrorMessage(error, 'Не удалось поставить реакцию'),
        );
      }
    },
    [nickname, setMessages],
  );

  const deleteAriaMessage = useCallback(
    async (messageId) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      setDeletingIds((prev) => new Set(prev).add(messageId));
      await popMessage(messageId, { duration: 200, toScale: 0.55 });

      const dbId = ariaDbRowId(messageId);
      if (dbId) {
        const { error } = await supabase.from('aria_messages').delete().eq('id', dbId);
        if (error) {
          Alert.alert(
            'Не удалось удалить',
            chatMutationErrorMessage(error, 'Не удалось удалить сообщение'),
          );
          setDeletingIds((prev) => {
            const next = new Set(prev);
            next.delete(messageId);
            return next;
          });
          return;
        }
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    },
    [messages, popMessage, setMessages, setDeletingIds],
  );

  const deleteMessageForMe = useCallback(
    async (messageId) => {
      if (isAriaChat) {
        await deleteAriaMessage(messageId);
        return;
      }
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      setDeletingIds((prev) => new Set(prev).add(messageId));
      await popMessage(messageId, { duration: 200, toScale: 0.55 });
      const hidden = [...(msg.hidden_for || []), nickname];
      const { error } = await supabase
        .from('messages')
        .update({ hidden_for: hidden })
        .eq('id', messageId);
      if (error) {
        Alert.alert(
          'Не удалось скрыть сообщение',
          chatMutationErrorMessage(error, 'Не удалось скрыть сообщение'),
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }
      removeMessageFromState(messageId);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    },
    [isAriaChat, deleteAriaMessage, messages, nickname, popMessage, removeMessageFromState, setDeletingIds],
  );

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmVisible(false);
    setSelectedMessage(null);
  }, [setDeleteConfirmVisible, setSelectedMessage]);

  const deleteMessageForAll = useCallback(
    async (messageId) => {
      if (isAriaChat) {
        await deleteAriaMessage(messageId);
        return;
      }
      setDeletingIds((prev) => new Set(prev).add(messageId));
      await popMessage(messageId, { duration: 200, toScale: 0.55 });

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('id, user1_id, user2_id')
        .eq('id', roomId)
        .maybeSingle();

      const explicitPeer = typeof peerName === 'string' ? peerName.trim() : '';
      const inferredPeer =
        explicitPeer || messages.find((m) => m.player_name !== nickname)?.player_name || null;
      const hiddenForAll = buildHiddenForEveryone(room, nickname, {
        peerName: inferredPeer,
        messagesSnapshot: messages });

      if (roomErr) {
        Alert.alert(
          'Не удалось удалить у всех',
          chatMutationErrorMessage(roomErr, 'Не удалось загрузить данные комнаты'),
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }

      const { error } = await supabase
        .from('messages')
        .update({ hidden_for: hiddenForAll })
        .eq('id', messageId);

      if (error) {
        Alert.alert(
          'Не удалось удалить у всех',
          chatMutationErrorMessage(error, 'Не удалось удалить у всех'),
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }

      removeMessageFromState(messageId);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      await unpinMessageIfMatches?.(messageId);
      chatSyncRef?.current?.hideMessage?.(messageId);
    },
    [isAriaChat, deleteAriaMessage, messages, nickname, peerName, popMessage, removeMessageFromState, roomId, setDeletingIds, chatSyncRef, unpinMessageIfMatches],
  );

  return {
    toggleReaction,
    deleteMessageForMe,
    deleteMessageForAll,
    closeDeleteConfirm };
}
