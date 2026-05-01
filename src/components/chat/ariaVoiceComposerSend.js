import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  ARIA_CONTACT,
  ARIA_MESSAGE_TYPING,
  ARIA_TYPING_ROW_ID,
  createAriaMessageBaseRow,
  transcribeAriaVoice,
} from '../../lib/aria';
import { readUriAsBase64 } from './chatMediaIo';

/**
 * Локальный чат Aria: оптимистичные строки (голос пользователя + typing), транскрипция, sendToAria.
 * Стартует асинхронную цепочку и сразу возвращает управление (как прежний IIFE в Chat.js).
 *
 * @param {{ uri: string, nickname: string, setMessages: Function, sendToAria: Function, sendInProgressRef: import('react').MutableRefObject<boolean> }} p
 */
export function startAriaVoiceComposerSend({ uri, nickname, setMessages, sendToAria, sendInProgressRef }) {
  const userMsgId = `aria-user-voice-${Date.now()}`;
  const typingId = ARIA_TYPING_ROW_ID;
  const now = new Date().toISOString();

  const baseRow = createAriaMessageBaseRow();

  const userRow = {
    ...baseRow,
    id: userMsgId,
    player_name: nickname,
    text: '',
    created_at: now,
    read_at: now,
    message_type: 'text',
    aria_voice_message: true,
    audio_uri: uri,
    transcription: null,
  };

  const typingRow = {
    ...baseRow,
    id: typingId,
    player_name: ARIA_CONTACT.display_name,
    text: '',
    created_at: now,
    read_at: null,
    message_type: ARIA_MESSAGE_TYPING,
    isTyping: true,
  };

  setMessages((prev) => [...prev, userRow, typingRow]);

  void (async () => {
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user_id = auth?.user?.id;
      if (!user_id) throw new Error('no_user');
      const audio_base64 = await readUriAsBase64(uri);
      const text = await transcribeAriaVoice(audio_base64, user_id);
      const trimmed = (text || '').trim();
      if (!trimmed) throw new Error('empty');

      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, transcription: trimmed } : m))
      );

      if (sendInProgressRef.current) return;
      sendInProgressRef.current = true;
      try {
        await sendToAria(trimmed, { skipOptimisticUserTyping: true });
      } finally {
        sendInProgressRef.current = false;
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== typingId));
      Alert.alert('Голосовые сообщения пока недоступны');
    }
  })();
}
