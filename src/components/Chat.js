import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Platform,
  Keyboard,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARIA_CONTACT } from '../lib/aria';
import { deriveKey } from '../utils/crypto';
import { getOrCreateKeyPair } from '../utils/VaultKeyStore';
import { publishMyPublicKey } from '../utils/VaultKeyServer';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import ChatRoomHeader from './ChatRoomHeader';
import ChatMessageContextMenuHost from './chat/ChatMessageContextMenuHost';
import { EphemeralClockContext } from './chat/ephemeralClockContext';
import { configureReplyTargetLayoutAnimation } from './chat/replyTargetLayoutAnimation';
import MessageRow from './chat/MessageRow';
import { createRenderMessageContent } from './chat/createRenderMessageContent';
import ChatComposer from './chat/ChatComposer';
import ChatAttachMenuModal from './chat/ChatAttachMenuModal';
import ChatFullScreenImageModal from './chat/ChatFullScreenImageModal';
import ChatDeleteMessageModal from './chat/ChatDeleteMessageModal';
import ChatUploadOverlay from './chat/ChatUploadOverlay';
import ChatListFooter from './chat/ChatListFooter';
import ChatRoomWallpaper from './chat/ChatRoomWallpaper';
import ChatMessagesLoadingOverlay from './chat/ChatMessagesLoadingOverlay';
import { createDecryptMsg, decryptMessagesBatch } from './chat/messageDecrypt';
import {
  filterExpiredMessages,
  filterHiddenForUser,
  filterHiddenForUserKeepingDeleting,
} from './chat/messageFilters';
import useMessageRowAnimations from './chat/useMessageRowAnimations';
import useChatRoomEffects from './chat/useChatRoomEffects';
import useChatMediaActions from './chat/useChatMediaActions';
import useChatSendText from './chat/useChatSendText';
import useChatSelection from './chat/useChatSelection';
import useChatMessageMutations from './chat/useChatMessageMutations';
import useChatReplyHelpers from './chat/useChatReplyHelpers';
import useChatOptimisticVideo from './chat/useChatOptimisticVideo';
import useChatComposerChrome from './chat/useChatComposerChrome';
import { sendAriaChatTextMessage } from './chat/ariaTextComposerSend';
import { startAriaVoiceComposerSend } from './chat/ariaVoiceComposerSend';
import { useAriaChatListBootstrap } from './chat/useAriaChatListBootstrap';
import { getAriaComposerSurfaceProps } from './chat/ariaComposerSurfaceProps';
import AriaStateGauges from './chat/AriaStateGauges';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { V, chatListBottomFadeBottom } from '../theme';
import {
  MAX_RENDERED_VIDEOS,
  CHAT_HEADER_TO_LIST_GAP_PX,
} from './chat/chatViewConstants';
import { useChatEphemeralClockTick } from '../hooks/useChatEphemeralClockTick';
import { useChatFormattedMessagesState } from '../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../hooks/useChatInvertedListScroll';

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
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const inputBarRef = useRef(null);
  /** Не дергать scrollToOffset (стык клавиатуры / смена высоты композера) — резкие рывки ленты */
  const keyboardSettlingRef = useRef(false);
  const keyboardSettleTimerRef = useRef(null);
  const composerInsetSettlingRef = useRef(false);
  const composerInsetSettleTimerRef = useRef(null);
  const lastComposerLayoutHRef = useRef(0);

  const armComposerInsetSettling = useCallback(() => {
    composerInsetSettlingRef.current = true;
    if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    composerInsetSettleTimerRef.current = setTimeout(() => {
      composerInsetSettlingRef.current = false;
      composerInsetSettleTimerRef.current = null;
    }, 320);
  }, []);

  const reportInputBar = useCallback((layoutH) => {
    if (typeof layoutH === 'number' && layoutH > 0) {
      onInputBarHeight?.(layoutH);
    }
    inputBarRef.current?.measureInWindow((x, y) => {
      if (typeof y === 'number') onInputBarTopY?.(y);
    });
  }, [onInputBarHeight, onInputBarTopY]);
  const [internalMessages, setInternalMessages] = useState([]);
  const ariaControlled =
    isAriaChat === true && typeof setAriaMessages === 'function' && Array.isArray(ariaMessages);
  const messages = ariaControlled ? ariaMessages : internalMessages;
  const setMessages = ariaControlled ? setAriaMessages : setInternalMessages;
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [visibleReplyTo, setVisibleReplyTo] = useState(null);
  const [unlockedVideoIds, setUnlockedVideoIds] = useState(() => new Set());
  const [ephemeralSec, setEphemeralSec] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  useEffect(() => { onEmojiPickerChange?.(showEmojiPicker); }, [showEmojiPicker, onEmojiPickerChange]);
  useEffect(() => {
    armComposerInsetSettling();
    return () => {
      if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    };
  }, [showEmojiPicker, armComposerInsetSettling]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [uiReady, setUiReady] = useState(false);
  const [headerOverlayH, setHeaderOverlayH] = useState(0);
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
    onTopOverlayHeight?.(headerOverlayH + gaugesH);
  }, [chatRoomHeader, headerOverlayH, isAriaChat, ariaGaugesH, onTopOverlayHeight]);

  useEffect(() => {
    const settlingPadMs = Platform.OS === 'ios' ? 130 : 150;
    const armSettling = (ms) => {
      keyboardSettlingRef.current = true;
      if (keyboardSettleTimerRef.current) clearTimeout(keyboardSettleTimerRef.current);
      keyboardSettleTimerRef.current = setTimeout(() => {
        keyboardSettlingRef.current = false;
        keyboardSettleTimerRef.current = null;
      }, ms);
    };
    const keyboardAnimMs = (e) =>
      typeof e.duration === 'number' && e.duration > 0 ? e.duration : 250;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => {
      armSettling(keyboardAnimMs(e) + settlingPadMs);
    });
    const subHide = Keyboard.addListener(hideEvt, (e) => {
      const base =
        Platform.OS === 'ios' && typeof e?.duration === 'number' && e.duration > 0
          ? e.duration
          : 250;
      armSettling(base + settlingPadMs);
    });
    return () => {
      subShow.remove();
      subHide.remove();
      if (keyboardSettleTimerRef.current) clearTimeout(keyboardSettleTimerRef.current);
      if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    };
  }, []);

  const {
    play: handleVoicePlay,
    activeUri: activeVoiceUri,
    status: activePlayerStatus,
    pause: pauseVoice,
  } = useVoicePlayer();

  const [activeVideoId, setActiveVideoId] = useState(null);
  const activatedVideoIds = useRef(new Set());
  const [activeVoiceMessageId, setActiveVoiceMessageId] = useState(null);

  const setReplyTarget = useCallback((nextReply) => {
    configureReplyTargetLayoutAnimation();
    setReplyTo(nextReply);
  }, []);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const listOpacity = useSharedValue(0);
  const headerMeasured = useSharedValue(0);

  const listScrollSuppressRefs = useMemo(
    () => [keyboardSettlingRef, composerInsetSettlingRef],
    [],
  );

  const {
    flatListRef,
    stickToBottomRef,
    layoutReadyRef,
    initialScrollDoneRef,
    onScroll: onListScroll,
  } = useChatInvertedListScroll(roomId, messages, headerMeasured, listScrollSuppressRefs);

  const ephemeralClockTick = useChatEphemeralClockTick(messages, renderPausedRef);

  const formattedMessages = useChatFormattedMessagesState(messages, roomId);

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

  const rowEnvRef = useRef({});
  /** Голос/видео плеер — обновляется каждый рендер; renderMessageContent читает .current, чтобы не пересоздавать замыкание на каждый тик статуса. */
  const playbackEnvRef = useRef({});
  /** Пропсы строки с частым обновлением — через ref, чтобы renderItem FlatList оставался стабильным между тиками прогресса. */
  const messageRowLiveRef = useRef({});
  const fmtLenRef = useRef(0);
  const inputRef = useRef(null);
  const sendInProgressRef = useRef(false);

  const deletingIdsRef = useRef(deletingIds);
  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  const legacyCryptoKey = useMemo(() => (roomCode ? deriveKey(roomCode) : null), [roomCode]);

  const composerStackHeightShared = useSharedValue(0);

  const {
    keyboardHeightLib,
    emojiPanelHeightShared,
    replyTargetAnimatedStyle,
    emojiPanelAnimatedStyle,
    emojiContentAnimatedStyle,
    emojiWobbleRotate,
    collapseEmojiForKeyboard,
    toggleEmojiPicker,
    insertEmoji,
  } = useChatComposerChrome({
    replyTo,
    setVisibleReplyTo,
    inputRef,
    showEmojiPicker,
    setShowEmojiPicker,
    setText,
  });

  const reportComposerBaseHeight = useCallback((layoutH) => {
    if (typeof layoutH !== 'number' || layoutH <= 0) return;
    if (Math.abs(layoutH - lastComposerLayoutHRef.current) < 0.5) return;
    lastComposerLayoutHRef.current = layoutH;
    composerStackHeightShared.value = layoutH;
    armComposerInsetSettling();
  }, [armComposerInsetSettling, composerStackHeightShared]);

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  /**
   * Inverted spacer: baseComposerH + visualEmojiH + kbH = константа при переходе emoji→keyboard.
   * baseComposerH — reply + капсула + safe area (без emoji).
   * visualEmojiH = max(0, emojiPanelH + keyboardHeightLib) — убывает синхронно с ростом клавиатуры.
   * kbH = -keyboardHeightLib.
   */
  const listBottomSpacerStyle = useAnimatedStyle(() => {
    const baseComposerH = composerStackHeightShared.value;
    const visualEmojiH = Math.max(0, emojiPanelHeightShared.value + keyboardHeightLib.value);
    const kbH = -keyboardHeightLib.value;
    return { height: baseComposerH + visualEmojiH + kbH };
  });

  const composerWrapperAnimatedStyle = useAnimatedStyle(() => ({
    bottom: -keyboardHeightLib.value,
  }));

  const ListBottomInsetHeader = useCallback(
    () => <Reanimated.View collapsable={false} style={listBottomSpacerStyle} />,
    [listBottomSpacerStyle],
  );

  useEffect(() => {
    if (!isRecordingVoice) return;
    pauseVoice();
  }, [isRecordingVoice, pauseVoice]);

  // Сбрасываем activeVoiceMessageId когда плеер останавливается
  useEffect(() => {
    if (!activeVoiceUri) setActiveVoiceMessageId(null);
  }, [activeVoiceUri]);

  useEffect(() => {
    const initE2E = async () => {
      try {
        await getOrCreateKeyPair();
        await publishMyPublicKey(nickname);
      } catch {
        /* ignore */
      }
    };
    if (nickname) initE2E();
  }, [nickname]);

  useAriaChatListBootstrap(isAriaChat, setMessagesLoading, listOpacity);

  useEffect(() => {
    pauseVoice();
  }, [roomId, pauseVoice]);

  const decryptMsg = useMemo(
    () => createDecryptMsg({ nickname, cryptoKey: legacyCryptoKey }),
    [nickname, legacyCryptoKey],
  );

  const decryptBatch = useCallback(async (msgs) => decryptMessagesBatch(msgs, decryptMsg), [decryptMsg]);

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
    batchForwardSelected,
  } = useChatSelection({
    messages,
    setMessages,
    nickname,
    isAriaChat,
    filterHiddenForMe,
    filterExpired,
    formattedMessages,
    decryptMsg,
    onOpenMessageMenu,
  });

  const { fadeAnims, scaleAnims, ensureMessageAnims, popMessage } = useMessageRowAnimations(messages);

  const {
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    handleVideoRecorded,
    handleVideoSendError,
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
    toggleReaction,
    deleteMessageForMe,
    deleteMessageForAll,
    closeDeleteConfirm,
  } = useChatMessageMutations({
    messages,
    setMessages,
    nickname,
    roomId,
    popMessage,
    setDeletingIds,
    setDeleteConfirmVisible,
    setSelectedMessage,
  });

  useChatRoomEffects({
    roomId,
    nickname,
    isAriaChat,
    renderPausedRef,
    listOpacity,
    decryptMsg,
    decryptBatch,
    filterExpired,
    filterHiddenForMeKeepingDeleting,
    fadeAnims,
    scaleAnims,
    optimisticVideoTempIdRef,
    pendingVideoActiveIdMigrationRef,
    activatedVideoIds,
    setActiveVideoId,
    deletingIdsRef,
    messages,
    setMessages,
    setMessagesLoading,
    messagesRef,
  });

  const {
    uploadMedia,
    sendMediaMessage,
    pickImageFromGallery,
    takePhoto,
    sendCurrentLocation,
    handleSendVoice,
  } = useChatMediaActions({
    roomId,
    nickname,
    legacyCryptoKey,
    replyTo,
    ephemeralSec,
    setReplyTarget,
    setUploading,
    setShowAttachMenu,
    decryptMsg,
    setMessages,
    filterHiddenForMeKeepingDeleting,
    filterExpired,
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
  });

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isAriaChat && chatRoomHeader?.ariaOnline === false) return;
    if (isAriaChat && sendToAria) {
      await sendAriaChatTextMessage({
        trimmed,
        sendToAria,
        sendInProgressRef,
        setText,
        setReplyTarget,
      });
      return;
    }
    await sendVaultTextMessage();
  }, [isAriaChat, chatRoomHeader?.ariaOnline, sendToAria, text, sendVaultTextMessage, setText, setReplyTarget]);

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
          sendInProgressRef,
        });
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
      setMessages,
    ]
  );

  const onVoiceRecorderOpen = useCallback(() => {
    setActiveVideoId(null);
  }, []);

  /* ── Renderers ── */

  playbackEnvRef.current = {
    activeVoiceUri,
    activePlayerStatus,
    activeVoiceMessageId,
    activeVideoId,
    isRecordingVoice,
  };

  const renderMessageContent = useMemo(
    () =>
      createRenderMessageContent({
        setFullScreenImage,
        setActiveVoiceMessageId,
        handleVoicePlay,
        setActiveVideoId,
        activatedVideoIdsRef: activatedVideoIds,
        rowEnvRef,
        playbackEnvRef,
      }),
    [handleVoicePlay, setFullScreenImage, setActiveVoiceMessageId, setActiveVideoId]
  );

  /** Меняется редко (выбор, мультиселект) — extraData FlatList, MessageRow.memo сравнивает по ссылке. */
  const listExtraDataStable = useMemo(
    () => ({ selectionMode, selectedHash, renderableVideoIds, onUnlockVideo, isAriaChat }),
    [selectionMode, selectedHash, renderableVideoIds, onUnlockVideo, isAriaChat]
  );

  /** Сигнатура прогресса для активной голосовой строки (expo-av status), без setInterval в MessageRow. */
  const voiceProgressSig = useMemo(() => {
    if (!activeVoiceMessageId) return '';
    return `${activePlayerStatus.playing ? 1 : 0}|${Math.round(activePlayerStatus.currentTime * 20) / 20}|${Math.round(activePlayerStatus.duration * 50) / 50}`;
  }, [
    activeVoiceMessageId,
    activePlayerStatus.playing,
    activePlayerStatus.currentTime,
    activePlayerStatus.duration,
  ]);

  messageRowLiveRef.current = {
    activeVoiceMessageId,
    activeVoiceUri,
    activeVideoId,
    isRecordingVoice,
    voiceProgressSig,
  };

  const onMessagePress = useCallback((event, item) => {
    rowEnvRef.current.handleMessagePress(event, item);
  }, []);

  const onMessageLongPress = useCallback((event, item) => {
    rowEnvRef.current.handleMessageLongPress(event, item);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => {
      const live = messageRowLiveRef.current;
      const voicePlaybackSig =
        ((item.message_type === 'voice' ||
          item.message_type === 'audio' ||
          (item.aria_voice_message === true && item.audio_uri)) &&
          item.id === live.activeVoiceMessageId)
          ? live.voiceProgressSig
          : '';
      return (
        <MessageRow
          item={item}
          index={index}
          listExtra={listExtraDataStable}
          activeVoiceMessageId={live.activeVoiceMessageId}
          activeVoiceUri={live.activeVoiceUri}
          activeVideoId={live.activeVideoId}
          isRecordingVoice={live.isRecordingVoice}
          voicePlaybackSig={voicePlaybackSig}
          fmtLenRef={fmtLenRef}
          rowEnvRef={rowEnvRef}
          onMessagePress={onMessagePress}
          onMessageLongPress={onMessageLongPress}
        />
      );
    },
    [listExtraDataStable, onMessagePress, onMessageLongPress]
  );

  /** MessageRow держит стабильные onPress/onLongPress; актуальные хендлеры и данные — через ref без лишних перерисовок списка. */
  fmtLenRef.current = formattedMessages.length;
  rowEnvRef.current = {
    nickname,
    windowWidth,
    selectedIds,
    getReplyMessage,
    ensureMessageAnims,
    renderMessageContent,
    setFullScreenImage,
    handleMessagePress,
    handleMessageLongPress,
    toggleReaction,
    setActiveVideoId,
    replyToMessage,
    isAriaChat,
    ariaPeerName: ARIA_CONTACT.display_name,
  };

  const listFooterPaddingTop =
    chatRoomHeader != null &&
    typeof listPaddingTop === 'number' &&
    listPaddingTop > 0
      ? listPaddingTop + CHAT_HEADER_TO_LIST_GAP_PX
      : listPaddingTop;

  const ariaComposerSurfaceProps = useMemo(
    () => getAriaComposerSurfaceProps(isAriaChat, chatRoomHeader?.ariaOnline),
    [isAriaChat, chatRoomHeader?.ariaOnline]
  );

  const listFooterComponent = useMemo(
    () => (
      <ChatListFooter
        chatRoomHeader={chatRoomHeader}
        listPaddingTop={listFooterPaddingTop}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onExitSelection={exitSelectionMode}
        onBatchDeleteForMe={batchDeleteForMe}
      />
    ),
    [
      chatRoomHeader,
      listFooterPaddingTop,
      selectionMode,
      selectedIds.size,
      exitSelectionMode,
      batchDeleteForMe,
    ],
  );

  return (
    <EphemeralClockContext.Provider value={ephemeralClockTick}>
    <Reanimated.View
      style={[
        tw`flex-1`,
        {
          backgroundColor: V.bgApp,
          overflow: chatRoomHeader ? 'visible' : 'hidden',
        },
      ]}
    >
      <ChatRoomWallpaper />
      {/* Upload overlay */}
      <ChatUploadOverlay visible={uploading} />

      <ChatFullScreenImageModal
        uiReady={uiReady}
        uri={fullScreenImage}
        onClose={() => setFullScreenImage(null)}
      />

      <ChatMessageContextMenuHost
        uiReady={uiReady}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        position={menuPosition}
        selectedMessage={selectedMessage}
        onReplyToMessage={setReplyTarget}
        onRequestDeleteConfirm={() => setDeleteConfirmVisible(true)}
      />

      <ChatDeleteMessageModal
        uiReady={uiReady}
        visible={deleteConfirmVisible}
        onClose={closeDeleteConfirm}
        messageId={selectedMessage?.id ?? null}
        onDeleteForMe={deleteMessageForMe}
        onDeleteForAll={deleteMessageForAll}
      />

      <ChatAttachMenuModal
        uiReady={uiReady}
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        takePhoto={takePhoto}
        pickImageFromGallery={pickImageFromGallery}
        sendCurrentLocation={sendCurrentLocation}
        ephemeralSec={ephemeralSec}
        setEphemeralSec={setEphemeralSec}
      />

      <View style={{ flex: 1, position: 'relative' }}>
        <View style={{ flex: 1 }}>
          <ChatMessagesLoadingOverlay visible={messagesLoading} />
          <Reanimated.View style={[tw`flex-1`, listAnimatedStyle]}>
            <FlatList
              ref={flatListRef}
              data={formattedMessages}
              inverted
              keyExtractor={(item) =>
                item.clientRowKey != null && item.clientRowKey !== ''
                  ? String(item.clientRowKey)
                  : String(item.id)
              }
              renderItem={renderItem}
              extraData={listExtraDataStable}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              onScroll={onListScroll}
              scrollEventThrottle={32}
              decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
              style={[
                tw`flex-1`,
                chatRoomHeader ? { backgroundColor: 'transparent' } : null,
                { zIndex: 1 },
              ]}
              removeClippedSubviews={Platform.OS === 'android'}
              ListHeaderComponent={ListBottomInsetHeader}
              ListFooterComponent={listFooterComponent}
              contentContainerStyle={[
                tw`pt-1`,
                chatRoomHeader && typeof listPaddingTop === 'number' && listPaddingTop > 0 ? null : tw`pb-2`,
              ]}
              onContentSizeChange={() => {
                if (!layoutReadyRef.current) {
                  layoutReadyRef.current = true;
                  initialScrollDoneRef.current = true;
                }
              }}
              ListEmptyComponent={
                messagesLoading ? null : (
                  <Text style={[tw`text-center py-6 text-[13px]`, { color: V.textMuted }]}>
                    Начни общение!
                  </Text>
                )
              }
            />
          </Reanimated.View>
        </View>

        <Reanimated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              zIndex: 2,
              elevation: 2,
            },
            composerWrapperAnimatedStyle,
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', chatListBottomFadeBottom]}
            locations={[0, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 80,
            }}
          />
          <ChatComposer
            inputBarRef={inputBarRef}
            reportInputBar={reportInputBar}
            reportComposerBaseHeight={reportComposerBaseHeight}
            insets={insets}
            visibleReplyTo={visibleReplyTo}
            replyTargetAnimatedStyle={replyTargetAnimatedStyle}
            emojiPanelAnimatedStyle={emojiPanelAnimatedStyle}
            emojiContentAnimatedStyle={emojiContentAnimatedStyle}
            onDismissReply={() => setReplyTarget(null)}
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
            collapseEmojiForKeyboard={collapseEmojiForKeyboard}
            {...ariaComposerSurfaceProps}
          />
        </Reanimated.View>
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
              elevation: 50,
            }}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) {
                setHeaderOverlayH(h);
                headerMeasured.value = 1;
              }
            }}
          >
            <ChatRoomHeader
              title={chatRoomHeader.title}
              contactOnline={chatRoomHeader.contactOnline}
              navigation={chatRoomHeader.navigation}
              ariaOnline={chatRoomHeader.ariaOnline}
              headerRight={chatRoomHeader.headerRight}
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
                elevation: 49,
              }}
            >
              <AriaStateGauges state={ariaState} onHeightChange={setAriaGaugesH} />
            </View>
          ) : null}
        </>
      ) : null}
    </Reanimated.View>
    </EphemeralClockContext.Provider>
  );
}
