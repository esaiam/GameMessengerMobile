import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useIsSplitLayout } from '../../hooks/useIsSplitLayout';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import useChatMessageListRender from './useChatMessageListRender';
import useChatMessagePipeline from './useChatMessagePipeline';
import useChatMutationsBundle from './useChatMutationsBundle';
import useChatComposerSend from './useChatComposerSend';
import useChatMediaInline from './useChatMediaInline';
import useChatPlayback from './useChatPlayback';
import useChatHeaderOverlay from './useChatHeaderOverlay';
import useChatComposerChrome from './useChatComposerChrome';
import { useAriaChatListBootstrap } from './useAriaChatListBootstrap';
import { useChatFormattedMessagesState } from '../../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../../hooks/useChatInvertedListScroll';
import useChatMessageFilters from './useChatMessageFilters';
import useChatInputSettling from './useChatInputSettling';
import useChatOverlayState from './useChatOverlayState';
import useChatCoreComposerState from './useChatCoreComposerState';
import useChatCalendarNavigation from './useChatCalendarNavigation';
import useChatListKeyboardLayout from './useChatListKeyboardLayout';
import buildChatViewProps from './buildChatViewProps';

/**
 * Wires chat domain hooks and returns grouped props for ChatView.
 * GameScreen refs (renderPausedRef, diceBusyRef, …) pass through to pipeline unchanged.
 */
export default function useChatController({
  roomId,
  nickname,
  peerName,
  isAriaChat = false,
  ariaMessages,
  setAriaMessages,
  sendToAria,
  onInputBarHeight,
  onInputBarTopY,
  onEmojiPickerChange,
  listPaddingTop,
  chatRoomHeader,
  onTopOverlayHeight,
  /** GameScreen tablet + gameExpanded — listExtra.suppressHeavyMedia */
  suppressHeavyMedia = false,
  renderPausedRef,
  diceBusyRef,
  chatFlushDeferredRef,
  diceAnimating = false,
  showAnimDice = false,
  overscrollEnabled = true,
  roomFocused = false,
  onAriaRevealComplete,
  onAriaFeedback,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = useIsSplitLayout();
  const insets = useSafeAreaInsets();
  const inputBarRef = useRef(null);

  const {
    ariaControlled,
    messages,
    setMessages,
    messagesLoading,
    setMessagesLoading,
    initialHistoryReady,
    setInitialHistoryReady,
    historyDataReady,
    setHistoryDataReady,
    text,
    setText,
    replyTo,
    visibleReplyTo,
    setVisibleReplyTo,
    editTarget,
    setEditTarget,
    visibleEditTarget,
    setVisibleEditTarget,
    ephemeralSec,
    setEphemeralSec,
    setDeletingIds,
    deletingIdsRef,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiPanelGifQuery,
    setEmojiPanelGifQuery,
    emojiPanelGifSearchFocused,
    setEmojiPanelGifSearchFocused,
    isRecordingVoice,
    setIsRecordingVoice,
    uploading,
    setUploading,
    setReplyTarget,
    cancelEditMessage,
    startEditMessage,
  } = useChatCoreComposerState({
    roomId,
    isAriaChat,
    ariaMessages,
    setAriaMessages,
    nickname,
    onEmojiPickerChange,
  });

  const {
    decryptMsg,
    decryptBatch,
    filterExpired,
    filterHiddenForMe,
    filterHiddenForMeKeepingDeleting,
    otherPlayerName,
    getReplyMessage,
    replyToMessage,
  } = useChatMessageFilters({
    messages,
    nickname,
    peerName,
    roomId,
    isAriaChat,
    setReplyTarget,
    deletingIdsRef,
  });

  const overlay = useChatOverlayState();

  const {
    headerOverlayH,
    setHeaderOverlayH,
    pinnedBarH,
    setPinnedBarH,
    ariaState,
    setAriaState,
    setAriaGaugesH,
    listFooterPaddingTop,
    ariaComposerSurfaceProps,
    headerRightTrailingEl,
  } = useChatHeaderOverlay({
    chatRoomHeader,
    onTopOverlayHeight,
    isAriaChat,
    listPaddingTop,
    roomId,
    setOverflowMenuVisible: overlay.setOverflowMenuVisible,
  });

  const { armComposerInsetSettling, listScrollSuppressRefs, keyboardSettlingRef } =
    useChatInputSettling(showEmojiPicker);

  const listOpacity = useSharedValue(0);

  const {
    flatListRef,
    onScroll: onListScroll,
    onListLayoutReady,
  } = useChatInvertedListScroll(
    roomId,
    messages,
    listScrollSuppressRefs,
    isAriaChat ? null : listOpacity,
    initialHistoryReady,
    historyDataReady,
  );


  const formattedMessages = useChatFormattedMessagesState(messages, roomId);

  const {
    activeVoiceUri,
    activePlayerStatus,
    activeVideoId,
    activeVoiceMessageId,
    activatedVideoIds,
    setActiveVideoId,
    playVoiceMessage,
    activateVideo,
    stopVideo,
    onUnlockVideo,
    renderableVideoIds,
  } = useChatPlayback({
    roomId,
    formattedMessages,
    isRecordingVoice,
  });

  useEffect(() => {
    if (!suppressHeavyMedia) return;
    stopVideo();
  }, [suppressHeavyMedia, stopVideo]);

  const {
    daysWithMessages,
    openCalendarFromSeparator,
    handleCalendarDayPress,
    scrollToMessageById,
  } = useChatCalendarNavigation({
    messages,
    formattedMessages,
    flatListRef,
    isAriaChat,
    setCalendarOverlay: overlay.setCalendarOverlay,
  });

  const inputRef = useRef(null);
  const editInProgressRef = useRef(false);

  useEffect(() => {
    if (!editTarget) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus?.();
    });
    return () => cancelAnimationFrame(raf);
  }, [editTarget?.id]);

  const {
    keyboardHeightLib,
    emojiPanelHeightShared,
    replyTargetAnimatedStyle,
    emojiPanelAnimatedStyle,
    emojiContentAnimatedStyle,
    emojiWobbleRotate,
    collapseEmojiForKeyboard,
    releaseComposerKeyboard,
    toggleEmojiPicker,
    insertEmoji,
    prepareEmojiPanelGifSearch,
    releaseEmojiPanelGifSearch,
    exitGifTabLayout,
  } = useChatComposerChrome({
    replyTo,
    editTarget,
    setVisibleReplyTo,
    setVisibleEditTarget,
    inputRef,
    showEmojiPicker,
    setShowEmojiPicker,
    setText,
    emojiPanelGifSearchFocused,
  });

  const {
    reportComposerBaseHeight,
    listAnimatedStyle,
    listViewportStyle,
    listBottomSpacerStyle,
  } = useChatListKeyboardLayout({
    insets,
    armComposerInsetSettling,
    keyboardSettlingRef,
    listOpacity,
    keyboardHeightLib,
    emojiPanelHeightShared,
    inputBarRef,
    onInputBarTopY,
    onInputBarHeight,
  });

  const navigation = useNavigation();

  useEffect(() => {
    const addListener = navigation?.addListener;
    if (typeof addListener !== 'function') return undefined;
    const unsub = addListener('beforeRemove', () => {
      releaseComposerKeyboard();
    });
    return unsub;
  }, [navigation, releaseComposerKeyboard]);

  useAriaChatListBootstrap(isAriaChat, setMessagesLoading, listOpacity);

  const {
    messagesRef,
    vaultChatSyncRef,
    ensureMessageAnims,
    popMessage,
    restoreMessage,
    handleVideoRecorded,
    handleVideoSendError,
    handleVideoUploadFinished,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
    appendOptimisticImage,
    appendOptimisticImages,
    appendOptimisticVoice,
    handleImageSendError,
    handleVoiceSendError,
    handleImageUploadFinished,
    handleVoiceUploadFinished,
    loadingOlder,
    loadOlderMessages,
  } = useChatMessagePipeline({
    roomId,
    nickname,
    isAriaChat,
    messages,
    setMessages,
    messagesLoading,
    setMessagesLoading,
    setInitialHistoryReady,
    setHistoryDataReady,
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
  });

  const {
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
  } = useChatMutationsBundle({
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
    selectedMessage: overlay.selectedMessage,
    onOpenMessageMenu: overlay.onOpenMessageMenu,
    setDeletingIds,
    setDeleteConfirmVisible: overlay.setDeleteConfirmVisible,
    setSelectedMessage: overlay.setSelectedMessage,
    setClearHistoryConfirmVisible: overlay.setClearHistoryConfirmVisible,
    deleteChatInProgress: overlay.deleteChatInProgress,
    setDeleteChatInProgress: overlay.setDeleteChatInProgress,
    setDeleteChatConfirmVisible: overlay.setDeleteChatConfirmVisible,
    messagesRef,
    vaultChatSyncRef,
    popMessage,
    restoreMessage,
    editInProgressRef,
    navigation,
    setPinnedBarH,
  });

  const {
    uploadMedia,
    sendMediaMessage,
    pickImageFromGallery,
    takePhoto,
    sendCurrentLocation,
    sendMessage,
    handleSendVoiceForComposer,
    onVoiceRecorderOpen,
  } = useChatComposerSend({
    roomId,
    nickname,
    peerName,
    isAriaChat,
    ariaControlled,
    text,
    setText,
    replyTo,
    setReplyTarget,
    ephemeralSec,
    otherPlayerName,
    editTarget,
    setEditTarget,
    cancelEditMessage,
    saveEditedMessage,
    sendToAria,
    chatRoomHeader,
    setMessages,
    setUploading,
    setShowAttachMenu: overlay.setShowAttachMenu,
    appendOptimisticImage,
    appendOptimisticImages,
    handleImageUploadFinished,
    handleImageSendError,
    appendOptimisticVoice,
    handleVoiceUploadFinished,
    handleVoiceSendError,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
    stopVideo,
  });

  const mediaInline = useChatMediaInline({
    text,
    setText,
    setUploading,
    emojiPanelGifQuery,
    showEmojiPicker,
    setShowEmojiPicker,
    isAriaChat,
    roomId,
    uploadMedia,
    sendMediaMessage,
  });

  const { renderItem, listExtraDataStable } = useChatMessageListRender({
    formattedMessages,
    nickname,
    windowWidth,
    isTablet,
    selectedIds,
    getReplyMessage,
    ensureMessageAnims,
    setFullScreenImage: overlay.openFullScreenImage,
    handleMessagePress,
    handleMessageLongPress,
    toggleReaction,
    playVoiceMessage,
    activateVideo,
    activatedVideoIds,
    replyToMessage,
    isAriaChat,
    openCalendarFromSeparator,
    suppressHeavyMedia,
    activeVoiceUri,
    activePlayerStatus,
    activeVoiceMessageId,
    activeVideoId,
    isRecordingVoice,
    selectionMode,
    selectedHash,
    renderableVideoIds,
    onUnlockVideo,
    ephemeralTickPausedRef: renderPausedRef,
    onAriaRevealComplete,
    onAriaFeedback,
  });

  return buildChatViewProps({
    chatRoomHeader,
    isAriaChat,
    uiReady: overlay.uiReady,
    insets,
    listViewportStyle,
    overscrollEnabled,
    overlay: {
      ...overlay,
      uploading,
      daysWithMessages,
      handleCalendarDayPress,
      setReplyTarget,
      startEditMessage,
      canEditSelectedMessage,
      togglePinForMessage,
      contextMenuPinLabel,
      pinDisabled,
      closeDeleteConfirm,
      deleteMessageForMe,
      deleteMessageForAll,
      executeClearHistory,
      closeDeleteChatConfirm,
      confirmDeleteChatFromList,
      takePhoto,
      pickImageFromGallery,
      sendCurrentLocation,
      ephemeralSec,
      setEphemeralSec,
    },
    list: {
      roomId,
      flatListRef,
      formattedMessages,
      renderItem,
      listExtraDataStable,
      listAnimatedStyle,
      listBottomSpacerStyle,
      onListScroll,
      onListLayoutReady,
      messagesLoading,
      listPaddingTop,
      listFooterPaddingTop,
      selectionMode,
      selectedIds,
      exitSelectionMode,
      batchDeleteForMe,
      loadingOlder,
      loadOlderMessages,
    },
    composer: {
      inputBarRef,
      reportComposerBaseHeight,
      insets,
      visibleReplyTo,
      visibleEditTarget,
      replyTargetAnimatedStyle,
      emojiPanelAnimatedStyle,
      emojiContentAnimatedStyle,
      cancelEditMessage,
      editTarget,
      showEmojiPicker,
      toggleEmojiPicker,
      insertEmoji,
      emojiWobbleRotate,
      inputRef,
      ephemeralSec,
      text,
      setText,
      sendMessage,
      isRecordingVoice,
      handleSendVoiceForComposer,
      setIsRecordingVoice,
      uploadMedia,
      sendMediaMessage,
      onVoiceRecorderOpen,
      handleVideoRecorded,
      handleVideoSendError,
      handleVideoUploadFinished,
      collapseEmojiForKeyboard,
      emojiPanelGifQuery,
      setEmojiPanelGifQuery,
      mediaInline,
      setReplyTarget,
      setShowAttachMenu: overlay.setShowAttachMenu,
      setEmojiPanelGifSearchFocused,
      prepareEmojiPanelGifSearch,
      releaseEmojiPanelGifSearch,
      exitGifTabLayout,
      ariaComposerSurfaceProps,
    },
    headerShell: {
      headerOverlayH,
      pinnedBarH,
      headerRightTrailingEl,
      ariaState,
      pinnedMessage,
      selectionMode,
      selectedIds,
      setHeaderOverlayH,
      setPinnedBarH,
      setAriaState,
      setAriaGaugesH,
      exitSelectionMode,
      batchCopySelected,
      batchForwardSelected,
      batchDeleteForMe,
      scrollToMessageById,
      unpinMessage,
    },
  });
}
