import { useEffect, useRef, useState } from 'react';
import {
  buildFormattedMessagesCached,
  prependFormattedWhenTailAppended,
} from '../components/chat/chatMessageListFormat';

/**
 * Кэшированное форматирование ленты + инкрементальный append хвоста.
 * При смене / отсутствии roomId кэш сбрасывается (как в Chat до рефакторинга).
 */
export function useChatFormattedMessagesState(messages, roomId) {
  const formattedMessagesCacheRef = useRef(new Map());
  const messagesStrictPrevRef = useRef(null);
  const formattedMessagesAppendRef = useRef([]);
  const [formattedMessages, setFormattedMessages] = useState([]);

  useEffect(() => {
    formattedMessagesCacheRef.current.clear();
    messagesStrictPrevRef.current = null;
    formattedMessagesAppendRef.current = [];
    if (!roomId) {
      setFormattedMessages([]);
    }
  }, [roomId]);

  useEffect(() => {
    const prevMsg = messagesStrictPrevRef.current;
    const cache = formattedMessagesCacheRef.current;
    const prevFmt = formattedMessagesAppendRef.current;

    let nextFormatted;
    if (prevMsg != null) {
      const quick = prependFormattedWhenTailAppended(prevMsg, messages, prevFmt, cache);
      if (quick != null) {
        nextFormatted = quick;
      }
    }
    if (nextFormatted == null) {
      nextFormatted = buildFormattedMessagesCached(messages, cache);
    }

    formattedMessagesAppendRef.current = nextFormatted;
    messagesStrictPrevRef.current = messages;
    setFormattedMessages(nextFormatted);
  }, [messages]);

  return formattedMessages;
}
