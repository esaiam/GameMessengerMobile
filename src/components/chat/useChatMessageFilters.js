import { useEffect, useCallback, useMemo } from 'react';
import { ensureUserIdentityKeys } from '../../utils/VaultKeyServer';
import { refreshChatsListAfterMessage } from '../../lib/chatsListSync';
import { createDecryptMsg, decryptMessagesBatch } from './messageDecrypt';
import {
  filterExpiredMessages,
  filterHiddenForUser,
  filterHiddenForUserKeepingDeleting,
} from './messageFilters';
import useChatReplyHelpers from './useChatReplyHelpers';

/**
 * Message decrypt/filter pipeline, reply lookup, peer name, E2E key init, chats list refresh on room open.
 * Depends on: messages, nickname, peerName, roomId, isAriaChat, setReplyTarget, deletingIdsRef.
 */
export default function useChatMessageFilters({
  messages,
  nickname,
  peerName,
  roomId,
  isAriaChat,
  setReplyTarget,
  deletingIdsRef,
}) {
  const messagesMap = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  );

  const { getReplyMessage, replyToMessage } = useChatReplyHelpers(messagesMap, setReplyTarget);

  const otherPlayerName = useMemo(() => {
    const explicitPeer = typeof peerName === 'string' ? peerName.trim() : '';
    if (explicitPeer) return explicitPeer;
    return messages.find((m) => m.player_name !== nickname)?.player_name ?? null;
  }, [messages, nickname, peerName]);

  useEffect(() => {
    const initE2E = async () => {
      try {
        await ensureUserIdentityKeys(nickname);
      } catch {
        /* ignore */
      }
    };
    if (nickname) initE2E();
  }, [nickname]);

  useEffect(() => {
    if (!roomId || !nickname || isAriaChat) return;
    void refreshChatsListAfterMessage(
      nickname,
      roomId,
      peerName ? { contactName: peerName } : {},
    );
  }, [roomId, nickname, peerName, isAriaChat]);

  const decryptMsg = useMemo(() => createDecryptMsg({ nickname }), [nickname]);

  const decryptBatch = useCallback(
    async (msgs) => decryptMessagesBatch(msgs, decryptMsg, nickname),
    [decryptMsg, nickname],
  );

  const filterExpired = useCallback((msgs) => filterExpiredMessages(msgs), []);

  const filterHiddenForMe = useCallback(
    (msgs) => filterHiddenForUser(msgs, nickname),
    [nickname],
  );

  const filterHiddenForMeKeepingDeleting = useCallback(
    (msgs) =>
      filterHiddenForUserKeepingDeleting(msgs, nickname, (id) => deletingIdsRef.current?.has?.(id)),
    [nickname],
  );

  return {
    decryptMsg,
    decryptBatch,
    filterExpired,
    filterHiddenForMe,
    filterHiddenForMeKeepingDeleting,
    otherPlayerName,
    getReplyMessage,
    replyToMessage,
  };
}
