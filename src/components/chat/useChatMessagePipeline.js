import { useRef, useCallback } from 'react';
import useMessageRowAnimations from './useMessageRowAnimations';
import useChatOptimisticVideo from './useChatOptimisticVideo';
import useChatOptimisticText from './useChatOptimisticText';
import useChatOptimisticMedia from './useChatOptimisticMedia';
import useChatMessagePagination from './useChatMessagePagination';
import useChatRoomEffects from './useChatRoomEffects';
import { safeGoBackToMessengerList } from '../../lib/safeGoBack';

/**
 * Message pipeline wiring: row animations, optimistic send, pagination, realtime room effects.
 * Depends on Chat filters/playback props; returns refs and handlers for mutations/media/send layers.
 */
export default function useChatMessagePipeline({
  roomId,
  nickname,
  isAriaChat,
  messages,
  setMessages,
  messagesLoading,
  setMessagesLoading,
  setInitialHistoryReady,
  decryptMsg,
  decryptBatch,
  filterExpired,
  filterHiddenForMeKeepingDeleting,
  deletingIdsRef,
  listOpacity,
  renderPausedRef,
  diceBusyRef,
  chatFlushDeferredRef,
  diceAnimating,
  showAnimDice,
  roomFocused,
  activatedVideoIds,
  setActiveVideoId,
  navigation,
}) {
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const vaultChatSyncRef = useRef(null);

  const { fadeAnims, scaleAnims, ensureMessageAnims, popMessage } = useMessageRowAnimations(messages);

  const {
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    handleVideoRecorded,
    handleVideoSendError,
    handleVideoUploadFinished,
  } = useChatOptimisticVideo({
    roomId,
    nickname,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
    fadeAnims,
    scaleAnims,
  });

  const {
    optimisticTextTempIdsRef,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
  } = useChatOptimisticText({
    roomId,
    nickname,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
    fadeAnims,
    scaleAnims,
  });

  const {
    optimisticImageTempIdRef,
    optimisticVoiceTempIdRef,
    appendOptimisticImage,
    appendOptimisticImages,
    appendOptimisticVoice,
    handleImageSendError,
    handleVoiceSendError,
    handleImageUploadFinished,
    handleVoiceUploadFinished,
  } = useChatOptimisticMedia({
    roomId,
    nickname,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
    fadeAnims,
    scaleAnims,
  });

  const { loadingOlder, loadOlderMessages, onInitialPageLoaded } = useChatMessagePagination({
    roomId,
    nickname,
    isAriaChat,
    messagesRef,
    setMessages,
    decryptBatch,
    filterExpired,
    filterHiddenForMeKeepingDeleting,
    optimisticTextTempIdsRef,
    messagesLoading,
  });

  const handleInitialPageLoaded = useCallback(
    (fetchedCount) => {
      onInitialPageLoaded(fetchedCount);
      setInitialHistoryReady(true);
    },
    [onInitialPageLoaded, setInitialHistoryReady],
  );

  const onRoomDeleted = useCallback(() => {
    safeGoBackToMessengerList(navigation);
  }, [navigation]);

  useChatRoomEffects({
    roomId,
    nickname,
    isAriaChat,
    renderPausedRef,
    diceBusyRef,
    chatFlushDeferredRef,
    diceAnimating,
    showAnimDice,
    listOpacity,
    decryptMsg,
    decryptBatch,
    filterExpired,
    filterHiddenForMeKeepingDeleting,
    fadeAnims,
    scaleAnims,
    optimisticVideoTempIdRef,
    optimisticImageTempIdRef,
    optimisticVoiceTempIdRef,
    optimisticTextTempIdsRef,
    pendingVideoActiveIdMigrationRef,
    activatedVideoIds,
    setActiveVideoId,
    deletingIdsRef,
    messages,
    setMessages,
    setMessagesLoading,
    messagesRef,
    onInitialPageLoaded: handleInitialPageLoaded,
    roomFocused,
    chatSyncRef: vaultChatSyncRef,
    onRoomDeleted,
  });

  return {
    messagesRef,
    vaultChatSyncRef,
    fadeAnims,
    scaleAnims,
    ensureMessageAnims,
    popMessage,
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    handleVideoRecorded,
    handleVideoSendError,
    handleVideoUploadFinished,
    optimisticTextTempIdsRef,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
    optimisticImageTempIdRef,
    optimisticVoiceTempIdRef,
    appendOptimisticImage,
    appendOptimisticImages,
    appendOptimisticVoice,
    handleImageSendError,
    handleVoiceSendError,
    handleImageUploadFinished,
    handleVoiceUploadFinished,
    loadingOlder,
    loadOlderMessages,
  };
}
