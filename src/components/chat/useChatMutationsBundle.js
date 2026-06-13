import { useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import useChatPinnedMessage from './useChatPinnedMessage';
import useChatSelection from './useChatSelection';
import useChatEditMessage from './useChatEditMessage';
import useChatMessageMutations from './useChatMessageMutations';
import useChatClearHistory from './useChatClearHistory';
import { canEditMessage } from './chatEditMessageUtils';
import { deleteChatsFromList } from '../../lib/hideRoomMessagesForDelete';

/**
 * Pin, selection, edit, delete/clear mutations, and overflow delete-chat confirms.
 * Depends on pipeline refs (messagesRef, vaultChatSyncRef, popMessage) and overlay/composer setters.
 */
export default function useChatMutationsBundle({
  roomId,
  nickname,
  peerName,
  isAriaChat,
  messages,
  setMessages,
  formattedMessages,
  otherPlayerName,
  decryptMsg,
  filterHiddenForMe,
  filterExpired,
  filterHiddenForMeKeepingDeleting,
  selectedMessage,
  onOpenMessageMenu,
  setDeletingIds,
  setDeleteConfirmVisible,
  setSelectedMessage,
  setClearHistoryConfirmVisible,
  deleteChatInProgress,
  setDeleteChatInProgress,
  setDeleteChatConfirmVisible,
  messagesRef,
  vaultChatSyncRef,
  popMessage,
  restoreMessage,
  editInProgressRef,
  navigation,
  setPinnedBarH,
}) {
  const {
    pinnedMessage,
    togglePinForMessage,
    unpinMessage,
    isMessagePinned,
  } = useChatPinnedMessage({
    roomId,
    isAriaChat,
    nickname,
    messages,
    setMessages,
    decryptMsg,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
  });

  const unpinMessageIfMatches = useCallback(
    async (messageId) => {
      if (isMessagePinned(messageId)) {
        await unpinMessage();
      }
    },
    [isMessagePinned, unpinMessage],
  );

  useEffect(() => {
    setPinnedBarH(0);
  }, [roomId, setPinnedBarH]);

  useEffect(() => {
    if (!pinnedMessage) setPinnedBarH(0);
  }, [pinnedMessage, setPinnedBarH]);

  const pinDisabled =
    isAriaChat ||
    !roomId ||
    selectedMessage?._isOptimistic === true;

  const contextMenuPinLabel = useMemo(() => {
    if (!selectedMessage?.id) return 'Закрепить';
    return isMessagePinned(selectedMessage.id) ? 'Открепить' : 'Закрепить';
  }, [selectedMessage?.id, isMessagePinned]);

  const {
    selectionMode,
    selectedIds,
    selectedHash,
    exitSelectionMode,
    handleMessagePress,
    handleMessageLongPress,
    batchDeleteForMe,
    batchCopySelected,
    batchForwardSelected,
  } = useChatSelection({
    messages,
    setMessages,
    nickname,
    roomId,
    isAriaChat,
    filterHiddenForMe,
    filterExpired,
    formattedMessages,
    decryptMsg,
    onOpenMessageMenu,
  });

  const { saveEditedMessage } = useChatEditMessage({
    roomId,
    nickname,
    otherPlayerName,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
    editInProgressRef,
  });

  const canEditSelectedMessage = useMemo(
    () => canEditMessage(selectedMessage, nickname, isAriaChat),
    [selectedMessage, nickname, isAriaChat],
  );

  const {
    toggleReaction,
    deleteMessageForMe,
    deleteMessageForAll,
    closeDeleteConfirm,
  } = useChatMessageMutations({
    messages,
    setMessages,
    nickname,
    peerName,
    roomId,
    isAriaChat,
    popMessage,
    restoreMessage,
    setDeletingIds,
    setDeleteConfirmVisible,
    setSelectedMessage,
    chatSyncRef: vaultChatSyncRef,
    unpinMessageIfMatches,
  });

  const { executeClearHistory: executeClearHistoryCore } = useChatClearHistory({
    roomId,
    nickname,
    otherPlayerName,
    messagesRef,
    setMessages,
    chatSyncRef: vaultChatSyncRef,
    unpinMessage,
  });

  const executeClearHistory = useCallback(
    async (deleteForEveryone) => {
      setClearHistoryConfirmVisible(false);
      await executeClearHistoryCore(deleteForEveryone);
    },
    [executeClearHistoryCore, setClearHistoryConfirmVisible],
  );

  const closeDeleteChatConfirm = useCallback(() => {
    if (deleteChatInProgress) return;
    setDeleteChatConfirmVisible(false);
  }, [deleteChatInProgress, setDeleteChatConfirmVisible]);

  const confirmDeleteChatFromList = useCallback(
    async (deleteForEveryone) => {
      if (!roomId || !nickname || deleteChatInProgress) return;
      setDeleteChatInProgress(true);
      try {
        await deleteChatsFromList({
          nickname,
          roomIds: [roomId],
          peerByRoomId: new Map([[roomId, otherPlayerName ?? null]]),
          deleteForEveryone: !!deleteForEveryone,
        });
        setDeleteChatConfirmVisible(false);
        navigation?.goBack?.();
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось удалить чат');
      } finally {
        setDeleteChatInProgress(false);
      }
    },
    [
      roomId,
      nickname,
      deleteChatInProgress,
      otherPlayerName,
      navigation,
      setDeleteChatInProgress,
      setDeleteChatConfirmVisible,
    ],
  );

  return {
    pinnedMessage,
    togglePinForMessage,
    unpinMessage,
    pinDisabled,
    contextMenuPinLabel,
    selectionMode,
    selectedIds,
    selectedHash,
    exitSelectionMode,
    handleMessagePress,
    handleMessageLongPress,
    batchDeleteForMe,
    batchCopySelected,
    batchForwardSelected,
    saveEditedMessage,
    canEditSelectedMessage,
    toggleReaction,
    deleteMessageForMe,
    deleteMessageForAll,
    closeDeleteConfirm,
    executeClearHistory,
    closeDeleteChatConfirm,
    confirmDeleteChatFromList,
  };
}
