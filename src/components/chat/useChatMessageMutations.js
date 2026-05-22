import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { buildHiddenForEveryone } from './buildHiddenForEveryone';

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
  chatSyncRef }) {
  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      const reactions = { ...(msg.reactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(nickname)) {
        reactions[emoji] = users.filter((u) => u !== nickname);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, nickname];
      }
      const { error } = await supabase.from('messages').update({ reactions }).eq('id', messageId);
      if (error) {
        Alert.alert('Ошибка', error.message || 'Не удалось поставить реакцию');
        return;
      }
    },
    [messages, nickname],
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
          Alert.alert('Не удалось удалить', error.message);
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
          error.message || 'Не удалось скрыть сообщение',
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    },
    [isAriaChat, deleteAriaMessage, messages, nickname, popMessage, setMessages, setDeletingIds],
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
        Alert.alert('Не удалось удалить у всех', roomErr.message);
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
          error.message || 'Не удалось удалить у всех',
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      chatSyncRef?.current?.hideMessage?.(messageId);
    },
    [isAriaChat, deleteAriaMessage, messages, nickname, peerName, popMessage, roomId, setMessages, setDeletingIds, chatSyncRef],
  );

  return {
    toggleReaction,
    deleteMessageForMe,
    deleteMessageForAll,
    closeDeleteConfirm };
}
