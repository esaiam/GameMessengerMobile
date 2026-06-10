import React, {
  useState,
  useEffect,
  useRef,
  useCallback } from 'react';
import {
  View,
  useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatRoomHeader from './ChatRoomHeader';
import ChatOverlays from './chat/ChatOverlays';
import { EphemeralClockContext } from './chat/ephemeralClockContext';
import useChatMessageListRender from './chat/useChatMessageListRender';
import ChatMessageList from './chat/ChatMessageList';
import ChatComposer from './chat/ChatComposer';
import ChatRoomWallpaper from './chat/ChatRoomWallpaper';
import useChatMessagePipeline from './chat/useChatMessagePipeline';
import useChatMutationsBundle from './chat/useChatMutationsBundle';
import useChatComposerSend from './chat/useChatComposerSend';
import useChatMediaInline from './chat/useChatMediaInline';
import useChatPlayback from './chat/useChatPlayback';
import useChatHeaderOverlay from './chat/useChatHeaderOverlay';
import useChatComposerChrome from './chat/useChatComposerChrome';
import { useAriaChatListBootstrap } from './chat/useAriaChatListBootstrap';
import AriaStateGauges from './chat/AriaStateGauges';
import Reanimated, { useSharedValue } from 'react-native-reanimated';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { V } from '../theme';
import { useChatEphemeralClockTick } from '../hooks/useChatEphemeralClockTick';
import { useChatFormattedMessagesState } from '../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../hooks/useChatInvertedListScroll';
import useChatMessageFilters from './chat/useChatMessageFilters';
import ChatPinnedBar from './chat/ChatPinnedBar';
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
    <EphemeralClockContext.Provider value={ephemeralClockTick}>
    <Reanimated.View
      style={[
        tw`flex-1`,
        {
          backgroundColor: V.bgApp,
          overflow: chatRoomHeader ? 'visible' : 'hidden'}]}
    >
      <ChatRoomWallpaper />
      <ChatOverlays
        uiReady={uiReady}
        uploading={uploading}
        fullScreenImage={fullScreenImage}
        onCloseFullScreenImage={() => setFullScreenImage(null)}
        calendarOverlay={calendarOverlay}
        daysWithMessages={daysWithMessages}
        onCalendarDayPress={handleCalendarDayPress}
        onCloseCalendar={() => setCalendarOverlay(null)}
        menuVisible={menuVisible}
        menuPosition={menuPosition}
        selectedMessage={selectedMessage}
        onCloseMenu={() => setMenuVisible(false)}
        onReplyToMessage={setReplyTarget}
        onEditMessage={startEditMessage}
        canEditSelectedMessage={canEditSelectedMessage}
        onRequestDeleteConfirm={() => {
          setMenuVisible(false);
          setDeleteConfirmVisible(true);
        }}
        onOpenImage={(uri) => setFullScreenImage({ uris: [uri], index: 0 })}
        onPinMessage={togglePinForMessage}
        pinLabel={contextMenuPinLabel}
        pinDisabled={pinDisabled}
        deleteConfirmVisible={deleteConfirmVisible}
        onCloseDeleteConfirm={closeDeleteConfirm}
        onDeleteForMe={deleteMessageForMe}
        onDeleteForAll={deleteMessageForAll}
        overflowMenuVisible={overflowMenuVisible}
        onCloseOverflowMenu={() => setOverflowMenuVisible(false)}
        onClearHistory={() => setClearHistoryConfirmVisible(true)}
        onDeleteChatFromList={() => setDeleteChatConfirmVisible(true)}
        clearHistoryConfirmVisible={clearHistoryConfirmVisible}
        onCloseClearHistoryConfirm={() => setClearHistoryConfirmVisible(false)}
        onConfirmClearHistory={executeClearHistory}
        deleteChatConfirmVisible={deleteChatConfirmVisible}
        onCloseDeleteChatConfirm={closeDeleteChatConfirm}
        onConfirmDeleteChat={confirmDeleteChatFromList}
        deleteChatConfirmDisabled={deleteChatInProgress}
        showAttachMenu={showAttachMenu}
        onCloseAttachMenu={() => setShowAttachMenu(false)}
        takePhoto={takePhoto}
        pickImageFromGallery={pickImageFromGallery}
        sendCurrentLocation={sendCurrentLocation}
        ephemeralSec={ephemeralSec}
        setEphemeralSec={setEphemeralSec}
      />

      <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Reanimated.View style={[{ flex: 1 }, listViewportStyle]}>
        <ChatMessageList
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
          chatRoomHeader={chatRoomHeader}
          listPaddingTop={listPaddingTop}
          listFooterPaddingTop={listFooterPaddingTop}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          exitSelectionMode={exitSelectionMode}
          batchDeleteForMe={batchDeleteForMe}
          overscrollEnabled={overscrollEnabled}
          loadingOlder={loadingOlder}
          onLoadOlderMessages={loadOlderMessages}
        />
        </Reanimated.View>

        <KeyboardStickyView
          pointerEvents="box-none"
          offset={{ closed: 0, opened: 0 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            elevation: 2,
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(13, 15, 20, 0.35)']}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 80 }}
          />
          <ChatComposer
            inputBarRef={inputBarRef}
            reportComposerBaseHeight={reportComposerBaseHeight}
            insets={insets}
            visibleReplyTo={visibleReplyTo}
            visibleEditTarget={visibleEditTarget}
            replyTargetAnimatedStyle={replyTargetAnimatedStyle}
            emojiPanelAnimatedStyle={emojiPanelAnimatedStyle}
            emojiContentAnimatedStyle={emojiContentAnimatedStyle}
            onDismissReply={() => setReplyTarget(null)}
            onDismissEdit={cancelEditMessage}
            isEditingMessage={!!editTarget}
            uiReady={uiReady}
            showEmojiPicker={showEmojiPicker}
            toggleEmojiPicker={toggleEmojiPicker}
            insertEmoji={insertEmoji}
            emojiWobbleRotate={emojiWobbleRotate}
            inputRef={inputRef}
            ephemeralSec={ephemeralSec}
            text={text}
            setText={setText}
            sendMessage={sendMessage}
            isRecordingVoice={isRecordingVoice}
            setShowAttachMenu={setShowAttachMenu}
            handleSendVoice={handleSendVoiceForComposer}
            setIsRecordingVoice={setIsRecordingVoice}
            uploadMedia={uploadMedia}
            sendMediaMessage={sendMediaMessage}
            onVoiceRecorderOpen={onVoiceRecorderOpen}
            handleVideoRecorded={handleVideoRecorded}
            handleVideoSendError={handleVideoSendError}
            handleVideoUploadFinished={handleVideoUploadFinished}
            collapseEmojiForKeyboard={collapseEmojiForKeyboard}
            emojiPanelGifQuery={emojiPanelGifQuery}
            onEmojiPanelGifQueryChange={setEmojiPanelGifQuery}
            {...mediaInline}
            onEmojiPanelGifSearchFocus={() => {
              setEmojiPanelGifSearchFocused(true);
              prepareEmojiPanelGifSearch();
            }}
            onEmojiPanelGifSearchBlur={() => {
              setEmojiPanelGifSearchFocused(false);
              releaseEmojiPanelGifSearch();
            }}
            onEmojiPanelGifTabExit={() => {
              setEmojiPanelGifSearchFocused(false);
              exitGifTabLayout();
            }}
            {...ariaComposerSurfaceProps}
          />
        </KeyboardStickyView>
      </View>

      {chatRoomHeader != null ? (
        <>
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              elevation: 50 }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setHeaderOverlayH(h);
            }}
          >
            <ChatRoomHeader
              title={chatRoomHeader.title}
              peerHandle={chatRoomHeader.peerHandle}
              contactOnline={chatRoomHeader.contactOnline}
              navigation={chatRoomHeader.navigation}
              ariaOnline={chatRoomHeader.ariaOnline}
              headerRight={chatRoomHeader.headerRight}
              headerRightTrailing={headerRightTrailingEl}
              topPaddingOverride={chatRoomHeader.topPaddingOverride}
              onAriaStateChange={isAriaChat ? setAriaState : undefined}
              onHeaderPress={chatRoomHeader.onHeaderPress}
              selectionMode={selectionMode}
              selectedCount={selectedIds.size}
              onExitSelection={exitSelectionMode}
              onCopy={batchCopySelected}
              onForward={batchForwardSelected}
              onDelete={batchDeleteForMe}
            />
          </View>

          {isAriaChat ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: headerOverlayH,
                left: 0,
                right: 0,
                zIndex: 49,
                elevation: 49 }}
            >
              <AriaStateGauges state={ariaState} onHeightChange={setAriaGaugesH} />
            </View>
          ) : pinnedMessage ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: headerOverlayH,
                left: 0,
                right: 0,
                zIndex: 49,
                elevation: 49 }}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && h !== pinnedBarH) setPinnedBarH(h);
              }}
            >
              <ChatPinnedBar
                message={pinnedMessage}
                onPress={() => scrollToMessageById(pinnedMessage.id)}
                onUnpin={unpinMessage}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Reanimated.View>
    </EphemeralClockContext.Provider>
  );
}
