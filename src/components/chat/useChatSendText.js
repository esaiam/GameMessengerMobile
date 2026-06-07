import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { encryptMessage } from '../../utils/VaultCrypto';
import { refreshChatsListAfterMessage } from '../../lib/chatsListSync';
import { chatMutationErrorMessage } from './chatMutationErrorMessage';
import { isBlocked } from '../../lib/blockedContacts';

export default function useChatSendText({
  text,
  setText,
  replyTo,
  setReplyTarget,
  roomId,
  nickname,
  ephemeralSec,
  otherPlayerName,
  sendInProgressRef,
  appendOptimisticText,
  removeOptimisticText,
  reconcileOptimisticText,
}) {
  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (sendInProgressRef.current) return;

    if (!otherPlayerName) {
      Alert.alert('Ошибка', 'Не удалось определить получателя');
      return;
    }

    if (await isBlocked(nickname, otherPlayerName)) {
      Alert.alert(
        'Контакт заблокирован',
        'Разблокируйте в Профиль → Заблокированные контакты.',
      );
      return;
    }

    sendInProgressRef.current = true;
    const replySnapshot = replyTo;
    const replyId = replyTo?.id || null;

    const tempId = appendOptimisticText({
      plainText: trimmed,
      replyTo: replySnapshot,
      ephemeralSec,
    });

    setText('');
    setReplyTarget(null);

    try {
      const forRecipient = await encryptMessage(trimmed, otherPlayerName, nickname);
      const forSelf = await encryptMessage(trimmed, nickname, nickname);
      const cipherText = 'VM2:' + JSON.stringify({ r: forRecipient, s: forSelf });

      const row = {
        room_id: roomId,
        player_name: nickname,
        text: cipherText,
        message_type: 'text',
        reply_to: replyId,
      };
      if (ephemeralSec) {
        row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
      }

      const { data, error } = await supabase.from('messages').insert(row).select('*').single();
      if (error) throw error;

      if (data?.id) {
        reconcileOptimisticText(tempId, { ...data, text: trimmed });
      }
      await refreshChatsListAfterMessage(nickname, roomId, {
        contactName: otherPlayerName,
        last: data ? { ...data, text: trimmed } : null,
      });
    } catch (e) {
      removeOptimisticText(tempId);
      setText(trimmed);
      setReplyTarget(replySnapshot);
      const detail = e?.message || String(e);
      if (__DEV__) console.warn('Chat insert error:', detail);
      Alert.alert(
        'Ошибка',
        chatMutationErrorMessage(e, detail || 'Не удалось отправить сообщение'),
      );
    } finally {
      sendInProgressRef.current = false;
    }
  }, [
    text,
    replyTo,
    roomId,
    nickname,
    ephemeralSec,
    otherPlayerName,
    setReplyTarget,
    setText,
    sendInProgressRef,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
  ]);

  return { sendMessage };
}
