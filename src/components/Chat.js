import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo } from 'react';
import {
  View,
  useWindowDimensions,
  Alert,
  TouchableOpacity,
  Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureUserIdentityKeys } from '../utils/VaultKeyServer';
import { refreshChatsListAfterMessage } from '../lib/chatsListSync';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { useChatMediaPlayback } from '../hooks/useChatMediaPlayback';
import ChatRoomHeader, { ICON_SELECTION_ACTION } from './ChatRoomHeader';
import ChatOverlays from './chat/ChatOverlays';
import { EphemeralClockContext } from './chat/ephemeralClockContext';
import { configureReplyTargetLayoutAnimation } from './chat/replyTargetLayoutAnimation';
import useChatMessageListRender from './chat/useChatMessageListRender';
import ChatMessageList from './chat/ChatMessageList';
import ChatComposer from './chat/ChatComposer';
import ChatRoomWallpaper from './chat/ChatRoomWallpaper';
import { createDecryptMsg, decryptMessagesBatch } from './chat/messageDecrypt';
import {
  filterExpiredMessages,
  filterHiddenForUser,
  filterHiddenForUserKeepingDeleting } from './chat/messageFilters';
import useMessageRowAnimations from './chat/useMessageRowAnimations';
import useChatRoomEffects from './chat/useChatRoomEffects';
import useChatMediaActions from './chat/useChatMediaActions';
import useChatSendText from './chat/useChatSendText';
import useChatSelection from './chat/useChatSelection';
import useChatMessageMutations from './chat/useChatMessageMutations';
import useChatReplyHelpers from './chat/useChatReplyHelpers';
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
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS } from 'react-native-reanimated';
import { useKeyboardHandler, KeyboardController, AndroidSoftInputModes, KeyboardStickyView } from 'react-native-keyboard-controller';
import { V } from '../theme';
import {
  MAX_RENDERED_VIDEOS,
  CHAT_HEADER_TO_LIST_GAP_PX,
  estimateComposerStackHeight,
  computeChatListScrollSpacer,
  computeChatListEmojiPanelInset } from './chat/chatViewConstants';
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
import { formatDateKey } from './chat/chatMessageListFormat';
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
  const lastComposerLayoutHRef = useRef(0);
  const pendingComposerHeightRef = useRef(null);
  const [internalMessages, setInternalMessages] = useState([]);
  const ariaControlled =
    isAriaChat === true && typeof setAriaMessages === 'function' && Array.isArray(ariaMessages);
  const messages = ariaControlled ? ariaMessages : internalMessages;
  const setMessages = ariaControlled ? setAriaMessages : setInternalMessages;
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [initialHistoryReady, setInitialHistoryReady] = useState(isAriaChat);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [visibleReplyTo, setVisibleReplyTo] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [visibleEditTarget, setVisibleEditTarget] = useState(null);
  const [unlockedVideoIds, setUnlockedVideoIds] = useState(() => new Set());
  const [ephemeralSec, setEphemeralSec] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [clearHistoryConfirmVisible, setClearHistoryConfirmVisible] = useState(false);
  const [deleteChatConfirmVisible, setDeleteChatConfirmVisible] = useState(false);
  const [deleteChatInProgress, setDeleteChatInProgress] = useState(false);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPanelGifQuery, setEmojiPanelGifQuery] = useState('');
  const [emojiPanelGifSearchFocused, setEmojiPanelGifSearchFocused] = useState(false);
  useEffect(() => { onEmojiPickerChange?.(showEmojiPicker); }, [showEmojiPicker, onEmojiPickerChange]);
  useEffect(() => {
    if (!showEmojiPicker) {
      setEmojiPanelGifQuery('');
      setEmojiPanelGifSearchFocused(false);
    }
  }, [showEmojiPicker]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [calendarOverlay, setCalendarOverlay] = useState(null);
  const [uiReady, setUiReady] = useState(false);
  const [headerOverlayH, setHeaderOverlayH] = useState(0);
  const [pinnedBarH, setPinnedBarH] = useState(0);
  const [ariaGaugesH, setAriaGaugesH] = useState(48);
  /** Зеркалит `ariaState` из `ChatRoomHeader` (тот же fetch, что был у колец) для `AriaStateGauges`. */
  const [ariaState, setAriaState] = useState(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

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

  const setReplyTarget = useCallback((nextReply) => {
    configureReplyTargetLayoutAnimation();
    if (nextReply) setEditTarget(null);
    setReplyTo(nextReply);
  }, []);

  const cancelEditMessage = useCallback(() => {
    configureReplyTargetLayoutAnimation();
    setEditTarget(null);
    setText('');
  }, []);

  const startEditMessage = useCallback((msg) => {
    if (!canEditMessage(msg, nickname, isAriaChat)) return;
    configureReplyTargetLayoutAnimation();
    setReplyTarget(null);
    setEditTarget(msg);
    setText(msg.text || '');
  }, [nickname, isAriaChat, setReplyTarget, setText]);

  useEffect(() => {
    setEditTarget(null);
  }, [roomId]);

  useEffect(() => {
    setInitialHistoryReady(isAriaChat);
  }, [roomId, isAriaChat]);

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

  const daysWithMessages = useMemo(() => {
    const set = new Set();
    for (const m of messages) {
      const k = formatDateKey(m.created_at);
      if (k) set.add(k);
    }
    return set;
  }, [messages]);

  const dateKeyToIndexMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < formattedMessages.length; i++) {
      const row = formattedMessages[i];
      if (row._showDate && row._dateKey) map.set(row._dateKey, i);
    }
    return map;
  }, [formattedMessages]);

  const messageIdToIndexMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < formattedMessages.length; i++) {
      const row = formattedMessages[i];
      if (row?.id != null) map.set(row.id, i);
    }
    return map;
  }, [formattedMessages]);

  const openCalendarFromSeparator = useCallback((anchor, dateKey, _dateLabel) => {
    setCalendarOverlay({ anchor, dateKey });
  }, []);

  const handleCalendarDayPress = useCallback((selectedKey) => {
    if (isAriaChat) {
      // Заглушка для Арии — просто закрываем
      setCalendarOverlay(null);
      return;
    }
    const idx = dateKeyToIndexMap.get(selectedKey);
    setCalendarOverlay(null);
    if (idx == null) return;
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5 });
    }, 180);
  }, [isAriaChat, dateKeyToIndexMap, flatListRef]);

  const scrollToMessageById = useCallback((messageId) => {
    const idx = messageIdToIndexMap.get(messageId);
    if (idx == null) {
      Alert.alert('Сообщение', 'Не удалось найти сообщение в ленте.');
      return;
    }
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
    }, 120);
  }, [messageIdToIndexMap, flatListRef]);

  const messagesMap = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );

  const { getReplyMessage, replyToMessage } = useChatReplyHelpers(messagesMap, setReplyTarget);

  const otherPlayerName = useMemo(() => {
    const explicitPeer = typeof peerName === 'string' ? peerName.trim() : '';
    if (explicitPeer) return explicitPeer;
    return messages.find((m) => m.player_name !== nickname)?.player_name ?? null;
  }, [messages, nickname, peerName]);

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

  const deletingIdsRef = useRef(deletingIds);
  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  const composerStackHeightShared = useSharedValue(estimateComposerStackHeight(insets));

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

  const navigation = useNavigation();

  useEffect(() => {
    const addListener = navigation?.addListener;
    if (typeof addListener !== 'function') return undefined;
    const unsub = addListener('beforeRemove', () => {
      releaseComposerKeyboard();
    });
    return unsub;
  }, [navigation, releaseComposerKeyboard]);

  const applyComposerStackHeight = useCallback((layoutH) => {
    if (typeof layoutH !== 'number' || layoutH <= 0) return;
    if (Math.abs(layoutH - lastComposerLayoutHRef.current) < 0.5) return;
    lastComposerLayoutHRef.current = layoutH;
    composerStackHeightShared.value = layoutH;
    armComposerInsetSettling();
  }, [armComposerInsetSettling, composerStackHeightShared]);

  const flushPendingComposerStackHeight = useCallback(() => {
    const pending = pendingComposerHeightRef.current;
    if (pending == null) return;
    pendingComposerHeightRef.current = null;
    applyComposerStackHeight(pending);
  }, [applyComposerStackHeight]);

  /** Layout во время KB часто stale — на close сбрасываем, не применяем (рывок marginBottom). */
  const discardPendingComposerHeight = useCallback(() => {
    pendingComposerHeightRef.current = null;
  }, []);

  const reportComposerBaseHeight = useCallback((layoutH) => {
    if (typeof layoutH !== 'number' || layoutH <= 0) return;
    if (Math.abs(layoutH - lastComposerLayoutHRef.current) < 0.5) return;
    if (keyboardSettlingRef.current) {
      pendingComposerHeightRef.current = layoutH;
      return;
    }
    applyComposerStackHeight(layoutH);
  }, [applyComposerStackHeight, keyboardSettlingRef]);

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value }));

  /**
   * Лента на всю высоту под glass-капсулой; marginBottom — только emoji-панель (opaque).
   * KB — translateY; scroll spacer — ListHeader (inverted bottom).
   */
  const listViewportStyle = useAnimatedStyle(() => ({
    marginBottom: computeChatListEmojiPanelInset(
      emojiPanelHeightShared.value,
      keyboardHeightLib.value,
    ),
    transform: [{ translateY: keyboardHeightLib.value }],
  }));

  const listBottomSpacerStyle = useAnimatedStyle(() => ({
    height: computeChatListScrollSpacer(
      composerStackHeightShared.value,
      emojiPanelHeightShared.value,
      keyboardHeightLib.value,
    ),
  }));

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        if (e.height <= 0) {
          runOnJS(discardPendingComposerHeight)();
        }
      },
      onEnd: (e) => {
        'worklet';
        if (e.height <= 0) {
          runOnJS(discardPendingComposerHeight)();
        } else {
          runOnJS(flushPendingComposerStackHeight)();
        }
      },
    },
    [discardPendingComposerHeight, flushPendingComposerStackHeight],
  );

  /** Только manual lift; без resize окна (двойной offset). */
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    return () => {
      KeyboardController.setDefaultMode();
    };
  }, []);

  useEffect(() => {
    if (!isRecordingVoice) return;
    pauseVoice();
  }, [isRecordingVoice, pauseVoice]);

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

  useAriaChatListBootstrap(isAriaChat, setMessagesLoading, listOpacity);

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

  const onOpenMessageMenu = useCallback((event, item) => {
    const x = event?.nativeEvent?.pageX ?? 0;
    const y = event?.nativeEvent?.pageY ?? 0;
    setMenuPosition({ x, y });
    setSelectedMessage(item);
    setMenuVisible(true);
  }, []);

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
    [onInitialPageLoaded],
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
    setFullScreenImage,
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
        onOpenImage={(uri) => setFullScreenImage(uri)}
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
