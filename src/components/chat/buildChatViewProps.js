/** Assembles spread-ready prop bundles for ChatView from hook outputs. */
export default function buildChatViewProps({
  ephemeralClockTick,
  chatRoomHeader,
  isAriaChat,
  uiReady,
  insets,
  listViewportStyle,
  overscrollEnabled,
  overlay,
  list,
  composer,
  headerShell,
}) {
  const {
    uploading,
    fullScreenImage,
    setFullScreenImage,
    calendarOverlay,
    daysWithMessages,
    handleCalendarDayPress,
    setCalendarOverlay,
    menuVisible,
    menuPosition,
    selectedMessage,
    setMenuVisible,
    setReplyTarget,
    startEditMessage,
    canEditSelectedMessage,
    setDeleteConfirmVisible,
    togglePinForMessage,
    contextMenuPinLabel,
    pinDisabled,
    deleteConfirmVisible,
    closeDeleteConfirm,
    deleteMessageForMe,
    deleteMessageForAll,
    overflowMenuVisible,
    setOverflowMenuVisible,
    setClearHistoryConfirmVisible,
    setDeleteChatConfirmVisible,
    clearHistoryConfirmVisible,
    executeClearHistory,
    deleteChatConfirmVisible,
    closeDeleteChatConfirm,
    confirmDeleteChatFromList,
    deleteChatInProgress,
    showAttachMenu,
    setShowAttachMenu,
    takePhoto,
    pickImageFromGallery,
    sendCurrentLocation,
    ephemeralSec,
    setEphemeralSec,
  } = overlay;

  const overlayProps = {
    uiReady,
    uploading,
    fullScreenImage,
    onCloseFullScreenImage: () => setFullScreenImage(null),
    calendarOverlay,
    daysWithMessages,
    onCalendarDayPress: handleCalendarDayPress,
    onCloseCalendar: () => setCalendarOverlay(null),
    menuVisible,
    menuPosition,
    selectedMessage,
    onCloseMenu: () => setMenuVisible(false),
    onReplyToMessage: setReplyTarget,
    onEditMessage: startEditMessage,
    canEditSelectedMessage,
    onRequestDeleteConfirm: () => {
      setMenuVisible(false);
      setDeleteConfirmVisible(true);
    },
    onOpenImage: (uri) => setFullScreenImage({ uris: [uri], index: 0 }),
    onPinMessage: togglePinForMessage,
    pinLabel: contextMenuPinLabel,
    pinDisabled,
    deleteConfirmVisible,
    onCloseDeleteConfirm: closeDeleteConfirm,
    onDeleteForMe: deleteMessageForMe,
    onDeleteForAll: deleteMessageForAll,
    overflowMenuVisible,
    onCloseOverflowMenu: () => setOverflowMenuVisible(false),
    onClearHistory: () => setClearHistoryConfirmVisible(true),
    onDeleteChatFromList: () => setDeleteChatConfirmVisible(true),
    clearHistoryConfirmVisible,
    onCloseClearHistoryConfirm: () => setClearHistoryConfirmVisible(false),
    onConfirmClearHistory: executeClearHistory,
    deleteChatConfirmVisible,
    onCloseDeleteChatConfirm: closeDeleteChatConfirm,
    onConfirmDeleteChat: confirmDeleteChatFromList,
    deleteChatConfirmDisabled: deleteChatInProgress,
    showAttachMenu,
    onCloseAttachMenu: () => setShowAttachMenu(false),
    takePhoto,
    pickImageFromGallery,
    sendCurrentLocation,
    ephemeralSec,
    setEphemeralSec,
  };

  const listProps = {
    ...list,
    chatRoomHeader,
    overscrollEnabled,
  };

  const {
    mediaInline,
    ariaComposerSurfaceProps,
    setReplyTarget: composerSetReplyTarget,
    cancelEditMessage,
    editTarget,
    setEmojiPanelGifSearchFocused,
    prepareEmojiPanelGifSearch,
    releaseEmojiPanelGifSearch,
    exitGifTabLayout,
    setEmojiPanelGifQuery,
    handleSendVoiceForComposer,
    ...composerRest
  } = composer;

  const composerProps = {
    ...mediaInline,
    ...ariaComposerSurfaceProps,
    ...composerRest,
    handleSendVoice: handleSendVoiceForComposer,
    onDismissReply: () => composerSetReplyTarget(null),
    onDismissEdit: cancelEditMessage,
    isEditingMessage: !!editTarget,
    uiReady,
    onEmojiPanelGifQueryChange: setEmojiPanelGifQuery,
    onEmojiPanelGifSearchFocus: () => {
      setEmojiPanelGifSearchFocused(true);
      prepareEmojiPanelGifSearch();
    },
    onEmojiPanelGifSearchBlur: () => {
      setEmojiPanelGifSearchFocused(false);
      releaseEmojiPanelGifSearch();
    },
    onEmojiPanelGifTabExit: () => {
      setEmojiPanelGifSearchFocused(false);
      exitGifTabLayout();
    },
  };

  return {
    ephemeralClockTick,
    chatRoomHeader,
    isAriaChat,
    uiReady,
    insets,
    listViewportStyle,
    overlayProps,
    listProps,
    composerProps,
    headerShell,
  };
}
