import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo } from 'react';
import {
  View,
  useWindowDimensions,
  Alert,
  TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { useChatMediaPlayback } from '../hooks/useChatMediaPlayback';
import ChatRoomHeader, { ICON_SELECTION_ACTION } from './ChatRoomHeader';
import ChatOverlays from './chat/ChatOverlays';
import { EphemeralClockContext } from './chat/ephemeralClockContext';
import useChatMessageListRender from './chat/useChatMessageListRender';
import ChatMessageList from './chat/ChatMessageList';
import ChatComposer from './chat/ChatComposer';
import ChatRoomWallpaper from './chat/ChatRoomWallpaper';
import useMessageRowAnimations from './chat/useMessageRowAnimations';
import useChatRoomEffects from './chat/useChatRoomEffects';
import useChatMediaActions from './chat/useChatMediaActions';
import useChatSendText from './chat/useChatSendText';
import useChatSelection from './chat/useChatSelection';
import useChatMessageMutations from './chat/useChatMessageMutations';
import useChatMessageFilters from './chat/useChatMessageFilters';
import useChatOptimisticVideo from './chat/useChatOptimisticVideo';
import useChatOptimisticText from './chat/useChatOptimisticText';
import useChatOptimisticMedia from './chat/useChatOptimisticMedia';
import useChatMessagePagination from './chat/useChatMessagePagination';
import useChatEditMessage from './chat/useChatEditMessage';
import { canEditMessage } from './chat/chatEditMessageUtils';
import useChatComposerChrome from './chat/useChatComposerChrome';
import { sendAriaChatTextMessage } from './chat/ariaTextComposerSend';
import { startAriaVoiceComposerSend } from './chat/ariaVoiceComposerSend';
import { useAriaChatListBootstrap } from './chat/useAriaChatListBootstrap';
import { getAriaComposerSurfaceProps } from './chat/ariaComposerSurfaceProps';
import AriaStateGauges from './chat/AriaStateGauges';
import Reanimated, { useSharedValue } from 'react-native-reanimated';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { V } from '../theme';
import {
  MAX_RENDERED_VIDEOS,
  CHAT_HEADER_TO_LIST_GAP_PX } from './chat/chatViewConstants';
import { useChatEphemeralClockTick } from '../hooks/useChatEphemeralClockTick';
import { useChatFormattedMessagesState } from '../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../hooks/useChatInvertedListScroll';
import { EllipsisVertical } from '../icons/lucideIcons';
import usePicInlineSearch from '../hooks/usePicInlineSearch';
import useGifInlineSearch from '../hooks/useGifInlineSearch';
import usePanelGifSearch from '../hooks/usePanelGifSearch';
import { parseActiveInlineMediaQuery } from '../lib/parseInlineTrigger';
import { parsePicInlineQuery } from '../lib/parsePicInlineQuery';
import { parseGifInlineQuery } from '../lib/parseGifInlineQuery';
import useChatInlineMediaSend from './chat/useChatInlineMediaSend';
import useChatClearHistory from './chat/useChatClearHistory';
import useChatPinnedMessage from './chat/useChatPinnedMessage';
import ChatPinnedBar, { CHAT_PINNED_BAR_H } from './chat/ChatPinnedBar';
import useChatInputSettling from './chat/useChatInputSettling';
import useChatOverlayState from './chat/useChatOverlayState';
import useChatCoreComposerState from './chat/useChatCoreComposerState';
import useChatCalendarNavigation from './chat/useChatCalendarNavigation';
import useChatListKeyboardLayout from './chat/useChatListKeyboardLayout';
import { useNavigation } from '@react-navigation/native';
import { deleteChatsFromList } from '../lib/hideRoomMessagesForDelete';
import { safeGoBackToMessengerList } from '../lib/safeGoBack';

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

  const [unlockedVideoIds, setUnlockedVideoIds] = useState(() => new Set());

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

  const [headerOverlayH, setHeaderOverlayH] = useState(0);
  const [pinnedBarH, setPinnedBarH] = useState(0);
  const [ariaGaugesH, setAriaGaugesH] = useState(48);
  /** Зеркалит `ariaState` из `ChatRoomHeader` (тот же fetch, что был у колец) для `AriaStateGauges`. */
  const [ariaState, setAriaState] = useState(null);

  useEffect(() => {
    if (chatRoomHeader == null) return;
    if (headerOverlayH <= 0) return;
    const gaugesH = isAriaChat ? ariaGaugesH : 0;
    const pinH = !isAriaChat && pinnedBarH > 0 ? pinnedBarH : 0;
    onTopOverlayHeight?.(headerOverlayH + gaugesH + pinH);
  }, [chatRoomHeader, headerOverlayH, isAriaChat, ariaGaugesH, pinnedBarH, onTopOverlayHeight]);

  const { armComposerInsetSettling, listScrollSuppressRefs, keyboardSettlingRef } =
    useChatInputSettling(showEmojiPicker);

  const {
    play: playVoice,
    activeUri: activeVoiceUri,
    status: activePlayerStatus,
    pause: pauseVoice,
  } = useVoicePlayer();

  const {
    activeVideoId,
    activeVoiceMessageId,
    activatedVideoIds,
    setActiveVideoId,
    playVoiceMessage,
    activateVideo,
    stopVideo,
  } = useChatMediaPlayback({
    playVoice,
    pauseVoice,
    activeVoiceUri,
    roomId,
  });

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const listOpacity = useSharedValue(0);
  const vaultChatSyncRef = useRef(null);

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

  const onUnlockVideo = useCallback((id) => {
    setUnlockedVideoIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const renderableVideoIds = useMemo(() => {
    const ids = new Set(unlockedVideoIds);
    let count = 0;
    for (const msg of formattedMessages) {
      if (msg.message_type === 'video') {
        if (count < MAX_RENDERED_VIDEOS) {
          ids.add(msg.id);
          count++;
        }
      }
    }
    return ids;
  }, [formattedMessages, unlockedVideoIds]);

  const inputRef = useRef(null);
  const sendInProgressRef = useRef(false);
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

  useEffect(() => {
    if (!isRecordingVoice) return;
    pauseVoice();
  }, [isRecordingVoice, pauseVoice]);

  useAriaChatListBootstrap(isAriaChat, setMessagesLoading, listOpacity);

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
  }, [roomId]);

  useEffect(() => {
    if (!pinnedMessage) setPinnedBarH(0);
  }, [pinnedMessage]);

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
    batchForwardSelected } = useChatSelection({
    messages,
    setMessages,
    nickname,
    roomId,
    isAriaChat,
    filterHiddenForMe,
    filterExpired,
    formattedMessages,
    decryptMsg,
    onOpenMessageMenu });

  const { fadeAnims, scaleAnims, ensureMessageAnims, popMessage } = useMessageRowAnimations(messages);

  const {
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    handleVideoRecorded,
    handleVideoSendError,
    handleVideoUploadFinished } = useChatOptimisticVideo({
    roomId,
    nickname,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
    fadeAnims,
    scaleAnims });

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
    scaleAnims });

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
    scaleAnims });

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
    closeDeleteConfirm } = useChatMessageMutations({
    messages,
    setMessages,
    nickname,
    peerName,
    roomId,
    isAriaChat,
    popMessage,
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
    [executeClearHistoryCore],
  );

  const closeDeleteChatConfirm = useCallback(() => {
    if (deleteChatInProgress) return;
    setDeleteChatConfirmVisible(false);
  }, [deleteChatInProgress]);

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
    [roomId, nickname, deleteChatInProgress, otherPlayerName, navigation],
  );

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
    onRoomDeleted });

  const {
    uploadMedia,
    sendMediaMessage,
    pickImageFromGallery,
    takePhoto,
    sendCurrentLocation,
    handleSendVoice } = useChatMediaActions({
    roomId,
    nickname,
    peerName,
    replyTo,
    ephemeralSec,
    setReplyTarget,
    setUploading,
    setShowAttachMenu,
    appendOptimisticImage,
    appendOptimisticImages,
    handleImageUploadFinished,
    handleImageSendError,
    appendOptimisticVoice,
    handleVoiceUploadFinished,
    handleVoiceSendError,
  });

  const inlineMediaEnabled = !isAriaChat && Boolean(roomId);
  const activeInlineMedia = useMemo(
    () => (inlineMediaEnabled ? parseActiveInlineMediaQuery(text) : null),
    [text, inlineMediaEnabled],
  );
  const picInline = usePicInlineSearch(text, {
    enabled: inlineMediaEnabled && activeInlineMedia?.kind === 'pic' });
  const gifInline = useGifInlineSearch(text, {
    enabled: inlineMediaEnabled && activeInlineMedia?.kind === 'gif' });
  const emojiPanelGif = usePanelGifSearch(emojiPanelGifQuery, {
    enabled: inlineMediaEnabled && showEmojiPicker });
  useEffect(() => {
    if ((picInline.active || gifInline.active) && showEmojiPicker) {
      setShowEmojiPicker(false);
    }
  }, [picInline.active, gifInline.active, showEmojiPicker]);

  const {
    handlePicInlineSelect,
    handleGifInlineSelect,
    handleEmojiPanelGifSelect,
  } = useChatInlineMediaSend({
    text,
    setText,
    setUploading,
    uploadMedia,
    sendMediaMessage,
  });

  const { sendMessage: sendVaultTextMessage } = useChatSendText({
    text,
    setText,
    replyTo,
    setReplyTarget,
    roomId,
    nickname,
    ephemeralSec,
    otherPlayerName,
    sendInProgressRef,
    appendOptimisticText,
    removeOptimisticText,
    reconcileOptimisticText,
  });

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (parsePicInlineQuery(trimmed) || parseGifInlineQuery(trimmed)) return;
    if (isAriaChat && chatRoomHeader?.ariaOnline === false) return;

    if (editTarget) {
      const result = await saveEditedMessage({
        messageId: editTarget.id,
        previousText: editTarget.text,
        previousEditedAt: editTarget.edited_at,
        newText: trimmed,
      });
      if (result === true || result === 'unchanged') {
        cancelEditMessage();
      } else if (result === false) {
        setEditTarget((prev) => prev ?? editTarget);
      }
      return;
    }

    if (isAriaChat && sendToAria) {
      await sendAriaChatTextMessage({
        trimmed,
        sendToAria,
        sendInProgressRef,
        setText,
        setReplyTarget });
      return;
    }
    await sendVaultTextMessage();
  }, [
    isAriaChat,
    chatRoomHeader?.ariaOnline,
    sendToAria,
    text,
    editTarget,
    saveEditedMessage,
    cancelEditMessage,
    sendVaultTextMessage,
    setText,
    setReplyTarget,
  ]);

  const handleSendVoiceForComposer = useCallback(
    async (uri, duration, waveform) => {
      if (isAriaChat && sendToAria) {
        if (chatRoomHeader?.ariaOnline === false) return;
        if (!ariaControlled) return;
        startAriaVoiceComposerSend({
          uri,
          nickname,
          setMessages,
          sendToAria,
          sendInProgressRef });
        return;
      }
      await handleSendVoice(uri, duration, waveform);
    },
    [
      isAriaChat,
      sendToAria,
      chatRoomHeader?.ariaOnline,
      handleSendVoice,
      ariaControlled,
      nickname,
      setMessages]
  );

  const onVoiceRecorderOpen = useCallback(() => {
    stopVideo();
  }, [stopVideo]);

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

  const listFooterPaddingTop =
    chatRoomHeader != null &&
    typeof listPaddingTop === 'number' &&
    listPaddingTop > 0
      ? listPaddingTop + CHAT_HEADER_TO_LIST_GAP_PX + (pinnedBarH > 0 ? pinnedBarH : 0)
      : listPaddingTop;

  const ariaComposerSurfaceProps = useMemo(
    () => getAriaComposerSurfaceProps(isAriaChat, chatRoomHeader?.ariaOnline),
    [isAriaChat, chatRoomHeader?.ariaOnline]
  );

  const headerRightTrailingEl = useMemo(() => {
    if (isAriaChat || !roomId || !chatRoomHeader?.headerRight) return undefined;
    return (
      <TouchableOpacity
        onPress={() => setOverflowMenuVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Меню чата"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      >
        <EllipsisVertical size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
      </TouchableOpacity>
    );
  }, [isAriaChat, roomId, chatRoomHeader?.headerRight]);

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
            picInlineVisible={picInline.active}
            picInlineNeedsQuery={picInline.needsQuery}
            picInlineLoading={picInline.loading}
            picInlineError={picInline.error}
            picInlineResults={picInline.results}
            picInlineHasMore={picInline.hasMore}
            onPicInlineSelect={handlePicInlineSelect}
            onPicInlineLoadMore={picInline.loadMore}
            gifInlineVisible={gifInline.active}
            gifInlineNeedsQuery={gifInline.needsQuery}
            gifInlineLoading={gifInline.loading}
            gifInlineError={gifInline.error}
            gifInlineResults={gifInline.results}
            gifInlineHasMore={gifInline.hasMore}
            onGifInlineSelect={handleGifInlineSelect}
            onGifInlineLoadMore={gifInline.loadMore}
            emojiPanelGifQuery={emojiPanelGifQuery}
            onEmojiPanelGifQueryChange={setEmojiPanelGifQuery}
            emojiPanelGifLoading={emojiPanelGif.loading}
            trendingGifs={emojiPanelGif.trendingResults}
            emojiPanelGifError={emojiPanelGif.error}
            emojiPanelGifResults={emojiPanelGif.results}
            emojiPanelGifHasMore={emojiPanelGif.hasMore}
            onEmojiPanelGifSelect={handleEmojiPanelGifSelect}
            onEmojiPanelGifLoadMore={emojiPanelGif.loadMore}
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
