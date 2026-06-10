import React, {
  useEffect,
  useRef,
  useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useChatMessageListRender from './chat/useChatMessageListRender';
import useChatMessagePipeline from './chat/useChatMessagePipeline';
import useChatMutationsBundle from './chat/useChatMutationsBundle';
import useChatComposerSend from './chat/useChatComposerSend';
import useChatMediaInline from './chat/useChatMediaInline';
import useChatPlayback from './chat/useChatPlayback';
import useChatHeaderOverlay from './chat/useChatHeaderOverlay';
import useChatComposerChrome from './chat/useChatComposerChrome';
import { useAriaChatListBootstrap } from './chat/useAriaChatListBootstrap';
import ChatView from './chat/ChatView';
import { useChatEphemeralClockTick } from '../hooks/useChatEphemeralClockTick';
import { useChatFormattedMessagesState } from '../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../hooks/useChatInvertedListScroll';
import useChatMessageFilters from './chat/useChatMessageFilters';
import useChatInputSettling from './chat/useChatInputSettling';
import useChatOverlayState from './chat/useChatOverlayState';
import useChatCoreComposerState from './chat/useChatCoreComposerState';
import useChatCalendarNavigation from './chat/useChatCalendarNavigation';
import useChatListKeyboardLayout from './chat/useChatListKeyboardLayout';
import { useNavigation } from '@react-navigation/native';

export default function Chat({
  roomId,
  roomCode,
  nickname,
  peerName,
  /** Локальный чат Aria без записей в `messages`. */
  isAriaChat = false,
  /** Состояние ленты Aria (поднимается из ChatRoomScreen). */
  ariaMessages,
  setAriaMessages,
  /** POST на ARIA_API_URL + очистка typing (реализовано в ChatRoomScreen). */
  sendToAria,
  onInputBarHeight,
  onInputBarTopY,
  /** GameScreen: сообщает когда emoji picker открыт/закрыт (чтобы скрыть доску). */
  onEmojiPickerChange,
  /** Отступ сверху у ленты (под «парящую» шапку с blur), px */
  listPaddingTop,
  /** Данные для frosted-шапки (рендер внутри Chat); если null — шапки нет. */
  chatRoomHeader,
  onTopOverlayHeight,
  /** GameScreen: true — не трогать JS-таймеры эфемерки (бросок кубиков) */
  renderPausedRef,
  /** GameScreen: ref — отложенные chat INSERT/UPDATE во время 3D-броска */
  diceBusyRef,
  chatFlushDeferredRef,
  diceAnimating = false,
  showAnimDice = false,
  /** false в `RoomChatContainer` (нарды) — без вертикального bounce ленты */
  overscrollEnabled = true,
  /** Экран комнаты в фокусе (read receipts / cursor только тогда). */
  roomFocused = false }) {
  const { width: windowWidth } = useWindowDimensions();
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

  const {
    menuVisible,
    setMenuVisible,
    menuPosition,
    selectedMessage,
    setSelectedMessage,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    overflowMenuVisible,
    setOverflowMenuVisible,
    clearHistoryConfirmVisible,
    setClearHistoryConfirmVisible,
    deleteChatConfirmVisible,
    setDeleteChatConfirmVisible,
    deleteChatInProgress,
    setDeleteChatInProgress,
    showAttachMenu,
    setShowAttachMenu,
    fullScreenImage,
    setFullScreenImage,
    openFullScreenImage,
    calendarOverlay,
    setCalendarOverlay,
    uiReady,
    onOpenMessageMenu,
  } = useChatOverlayState();

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
    setOverflowMenuVisible,
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
  );

  const ephemeralClockTick = useChatEphemeralClockTick(messages, renderPausedRef);

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
    setCalendarOverlay,
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
    exitGifTabLayout } = useChatComposerChrome({
    replyTo,
    editTarget,
    setVisibleReplyTo,
    setVisibleEditTarget,
    inputRef,
    showEmojiPicker,
    setShowEmojiPicker,
    setText,
    emojiPanelGifSearchFocused });

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
    setShowAttachMenu,
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
    selectedIds,
    getReplyMessage,
    ensureMessageAnims,
    setFullScreenImage: openFullScreenImage,
    handleMessagePress,
    handleMessageLongPress,
    toggleReaction,
    playVoiceMessage,
    activateVideo,
    activatedVideoIds,
    replyToMessage,
    isAriaChat,
    openCalendarFromSeparator,
    activeVoiceUri,
    activePlayerStatus,
    activeVoiceMessageId,
    activeVideoId,
    isRecordingVoice,
    selectionMode,
    selectedHash,
    renderableVideoIds,
    onUnlockVideo,
  });

  return (
    <ChatView
      ephemeralClockTick={ephemeralClockTick}
      chatRoomHeader={chatRoomHeader}
      uiReady={uiReady}
      uploading={uploading}
      fullScreenImage={fullScreenImage}
      setFullScreenImage={setFullScreenImage}
      calendarOverlay={calendarOverlay}
      daysWithMessages={daysWithMessages}
      handleCalendarDayPress={handleCalendarDayPress}
      setCalendarOverlay={setCalendarOverlay}
      menuVisible={menuVisible}
      menuPosition={menuPosition}
      selectedMessage={selectedMessage}
      setMenuVisible={setMenuVisible}
      setReplyTarget={setReplyTarget}
      startEditMessage={startEditMessage}
      canEditSelectedMessage={canEditSelectedMessage}
      setDeleteConfirmVisible={setDeleteConfirmVisible}
      togglePinForMessage={togglePinForMessage}
      contextMenuPinLabel={contextMenuPinLabel}
      pinDisabled={pinDisabled}
      deleteConfirmVisible={deleteConfirmVisible}
      closeDeleteConfirm={closeDeleteConfirm}
      deleteMessageForMe={deleteMessageForMe}
      deleteMessageForAll={deleteMessageForAll}
      overflowMenuVisible={overflowMenuVisible}
      setOverflowMenuVisible={setOverflowMenuVisible}
      setClearHistoryConfirmVisible={setClearHistoryConfirmVisible}
      setDeleteChatConfirmVisible={setDeleteChatConfirmVisible}
      clearHistoryConfirmVisible={clearHistoryConfirmVisible}
      executeClearHistory={executeClearHistory}
      deleteChatConfirmVisible={deleteChatConfirmVisible}
      closeDeleteChatConfirm={closeDeleteChatConfirm}
      confirmDeleteChatFromList={confirmDeleteChatFromList}
      deleteChatInProgress={deleteChatInProgress}
      showAttachMenu={showAttachMenu}
      setShowAttachMenu={setShowAttachMenu}
      takePhoto={takePhoto}
      pickImageFromGallery={pickImageFromGallery}
      sendCurrentLocation={sendCurrentLocation}
      ephemeralSec={ephemeralSec}
      setEphemeralSec={setEphemeralSec}
      roomId={roomId}
      flatListRef={flatListRef}
      formattedMessages={formattedMessages}
      renderItem={renderItem}
      listExtraDataStable={listExtraDataStable}
      listAnimatedStyle={listAnimatedStyle}
      listBottomSpacerStyle={listBottomSpacerStyle}
      onListScroll={onListScroll}
      onListLayoutReady={onListLayoutReady}
      messagesLoading={messagesLoading}
      listPaddingTop={listPaddingTop}
      listFooterPaddingTop={listFooterPaddingTop}
      selectionMode={selectionMode}
      selectedIds={selectedIds}
      exitSelectionMode={exitSelectionMode}
      batchDeleteForMe={batchDeleteForMe}
      batchCopySelected={batchCopySelected}
      batchForwardSelected={batchForwardSelected}
      overscrollEnabled={overscrollEnabled}
      loadingOlder={loadingOlder}
      loadOlderMessages={loadOlderMessages}
      listViewportStyle={listViewportStyle}
      inputBarRef={inputBarRef}
      reportComposerBaseHeight={reportComposerBaseHeight}
      insets={insets}
      visibleReplyTo={visibleReplyTo}
      visibleEditTarget={visibleEditTarget}
      replyTargetAnimatedStyle={replyTargetAnimatedStyle}
      emojiPanelAnimatedStyle={emojiPanelAnimatedStyle}
      emojiContentAnimatedStyle={emojiContentAnimatedStyle}
      cancelEditMessage={cancelEditMessage}
      editTarget={editTarget}
      showEmojiPicker={showEmojiPicker}
      toggleEmojiPicker={toggleEmojiPicker}
      insertEmoji={insertEmoji}
      emojiWobbleRotate={emojiWobbleRotate}
      inputRef={inputRef}
      text={text}
      setText={setText}
      sendMessage={sendMessage}
      isRecordingVoice={isRecordingVoice}
      handleSendVoiceForComposer={handleSendVoiceForComposer}
      setIsRecordingVoice={setIsRecordingVoice}
      uploadMedia={uploadMedia}
      sendMediaMessage={sendMediaMessage}
      onVoiceRecorderOpen={onVoiceRecorderOpen}
      handleVideoRecorded={handleVideoRecorded}
      handleVideoSendError={handleVideoSendError}
      handleVideoUploadFinished={handleVideoUploadFinished}
      collapseEmojiForKeyboard={collapseEmojiForKeyboard}
      emojiPanelGifQuery={emojiPanelGifQuery}
      setEmojiPanelGifQuery={setEmojiPanelGifQuery}
      mediaInline={mediaInline}
      setEmojiPanelGifSearchFocused={setEmojiPanelGifSearchFocused}
      prepareEmojiPanelGifSearch={prepareEmojiPanelGifSearch}
      releaseEmojiPanelGifSearch={releaseEmojiPanelGifSearch}
      exitGifTabLayout={exitGifTabLayout}
      ariaComposerSurfaceProps={ariaComposerSurfaceProps}
      headerOverlayH={headerOverlayH}
      setHeaderOverlayH={setHeaderOverlayH}
      headerRightTrailingEl={headerRightTrailingEl}
      isAriaChat={isAriaChat}
      ariaState={ariaState}
      setAriaState={setAriaState}
      setAriaGaugesH={setAriaGaugesH}
      pinnedMessage={pinnedMessage}
      pinnedBarH={pinnedBarH}
      setPinnedBarH={setPinnedBarH}
      scrollToMessageById={scrollToMessageById}
      unpinMessage={unpinMessage}
    />
  );
}
