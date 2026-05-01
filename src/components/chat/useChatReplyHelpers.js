import { useCallback } from 'react';

/**
 * Поиск сообщения по id для превью ответа и установка цели ответа в композере.
 */
export default function useChatReplyHelpers(messagesMap, setReplyTarget) {
  const getReplyMessage = useCallback(
    (replyToId) => (replyToId ? messagesMap.get(replyToId) ?? null : null),
    [messagesMap],
  );

  const replyToMessage = useCallback(
    (msg) => {
      setReplyTarget(msg);
    },
    [setReplyTarget],
  );

  return { getReplyMessage, replyToMessage };
}
