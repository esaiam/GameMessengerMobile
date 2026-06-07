import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { encryptMessage } from '../../utils/VaultCrypto';
import { refreshChatsListAfterMessage } from '../../lib/chatsListSync';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { invalidatePreviewCache } from '../../screens/chats/chatsPreviewCache';
import {
  invalidateDecryptCache,
  primeDecryptPlainCache,
} from './messageDecrypt';
import { chatMutationErrorMessage } from './chatMutationErrorMessage';

/**
 * Редактирование своих текстовых сообщений: optimistic UI + VM2 UPDATE.
 */
export default function useChatEditMessage({
  roomId,
  nickname,
  otherPlayerName,
  setMessages,
  filterHiddenForMeKeepingDeleting,
  filterExpired,
  editInProgressRef,
}) {
  const saveEditedMessage = useCallback(
    async ({ messageId, previousText, previousEditedAt, newText }) => {
      const trimmed = newText.trim();
      if (!trimmed || !messageId || !otherPlayerName) return false;
      if (editInProgressRef?.current) return false;

      if (trimmed === (previousText || '').trim()) {
        return 'unchanged';
      }

      editInProgressRef.current = true;
      const editedAt = new Date().toISOString();

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === messageId ? { ...m, text: trimmed, edited_at: editedAt } : m,
        );
        const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
        roomMessagesCache.set(roomId, filtered);
        return filtered;
      });
      invalidateDecryptCache(messageId);
      invalidatePreviewCache(messageId);

      try {
        const forRecipient = await encryptMessage(trimmed, otherPlayerName, nickname);
        const forSelf = await encryptMessage(trimmed, nickname, nickname);
        const cipherText = 'VM2:' + JSON.stringify({ r: forRecipient, s: forSelf });

        const { data, error } = await supabase
          .from('messages')
          .update({ text: cipherText, edited_at: editedAt })
          .eq('id', messageId)
          .eq('player_name', nickname)
          .select('*')
          .single();

        if (error) throw error;

        const serverEditedAt = data?.edited_at ?? editedAt;
        primeDecryptPlainCache(messageId, cipherText, trimmed, nickname);

        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === messageId
              ? { ...m, ...data, text: trimmed, edited_at: serverEditedAt }
              : m,
          );
          const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
          roomMessagesCache.set(roomId, filtered);
          return filtered;
        });
        invalidatePreviewCache(messageId);
        await refreshChatsListAfterMessage(nickname, roomId);
        return true;
      } catch (e) {
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === messageId
              ? { ...m, text: previousText, edited_at: previousEditedAt ?? null }
              : m,
          );
          const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
          roomMessagesCache.set(roomId, filtered);
          return filtered;
        });
        invalidatePreviewCache(messageId);
        const detail = chatMutationErrorMessage(e, 'Не удалось изменить сообщение');
        if (__DEV__) console.warn('Chat edit error:', detail);
        Alert.alert('Ошибка', detail);
        return false;
      } finally {
        editInProgressRef.current = false;
      }
    },
    [
      roomId,
      nickname,
      otherPlayerName,
      setMessages,
      filterHiddenForMeKeepingDeleting,
      filterExpired,
      editInProgressRef,
    ],
  );

  return { saveEditedMessage };
}
