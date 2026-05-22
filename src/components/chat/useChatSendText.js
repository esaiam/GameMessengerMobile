import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { encryptMessage } from '../../utils/VaultCrypto';

export default function useChatSendText({
  text,
  setText,
  replyTo,
  setReplyTarget,
  roomId,
  nickname,
  ephemeralSec,
  otherPlayerName,
  sendInProgressRef }) {
  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (sendInProgressRef.current) return;
    sendInProgressRef.current = true;
    const replySnapshot = replyTo;
    const replyId = replyTo?.id || null;
    let cipherText;
    try {
      if (!otherPlayerName) {
        throw new Error('Не удалось определить получателя');
      }
      const forRecipient = await encryptMessage(trimmed, otherPlayerName);
      const forSelf = await encryptMessage(trimmed, nickname);
      cipherText = 'VM2:' + JSON.stringify({ r: forRecipient, s: forSelf });
    } catch (e) {
      const detail = e?.message || 'Не удалось зашифровать сообщение';
      if (__DEV__) console.warn('[Vault E2E] Ошибка шифрования:', detail);
      Alert.alert('Ошибка', detail);
      sendInProgressRef.current = false;
      return;
    }
    const row = {
      room_id: roomId,
      player_name: nickname,
      text: cipherText,
      reply_to: replyId };
    if (ephemeralSec) {
      row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
    }
    setText('');
    setReplyTarget(null);
    try {
      const { error } = await supabase.from('messages').insert(row);
      if (error) {
        if (__DEV__) console.warn('Chat insert error:', error.message);
        setText(trimmed);
        setReplyTarget(replySnapshot);
        Alert.alert('Ошибка', error.message || 'Не удалось отправить сообщение');
      }
    } catch (e) {
      const detail = e?.message || String(e);
      if (__DEV__) console.warn('Chat insert error:', detail);
      setText(trimmed);
      setReplyTarget(replySnapshot);
      Alert.alert('Ошибка', detail);
    } finally {
      sendInProgressRef.current = false;
    }
  }, [text, replyTo, roomId, nickname, ephemeralSec, otherPlayerName, setReplyTarget, setText, sendInProgressRef]);

  return { sendMessage };
}
