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
  Alert,
  useWindowDimensions,
} from 'react-native';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import {
  ARIA_CONTACT,
  ARIA_MESSAGE_TYPING,
  ARIA_ROOM_ID,
  ARIA_TYPING_ROW_ID,
  createAriaMessageBaseRow,
  transcribeAriaVoice,
} from '../lib/aria';
import { readUriAsBase64 } from './chat/chatMediaIo';
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
import { REPLY_TARGET_PREVIEW_H, EMOJI_PICKER_PANEL_H } from './chat/chatComposerConstants';
import {
  buildFormattedMessagesCached,
  prependFormattedWhenTailAppended,
} from './chat/chatMessageListFormat';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { V } from '../theme';

const MAX_RENDERED_VIDEOS = 5;

/** Расстояние до низа, меньше которого считаем пользователя «внизу» (как в Telegram). */
const CHAT_AT_BOTTOM_THRESHOLD_PX = 40;

/** Зазор между низом парящей шапки и первой строкой ленты (аватар). */
const CHAT_HEADER_TO_LIST_GAP_PX = 8;

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
  /** Отступ сверху у ленты (под «парящую» шапку с blur), px */
  listPaddingTop,
  /** Данные для frosted-шапки (рендер внутри Chat); если null — шапки нет. */
  chatRoomHeader,
  onTopOverlayHeight,
  /** GameScreen: true — не трогать JS-таймеры эфемерки (бросок кубиков) */
  renderPausedRef,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const inputBarRef = useRef(null);
  const [inputBarH, setInputBarH] = useState(0);
  const [bottomOverlayH, setBottomOverlayH] = useState(0);

  const reportInputBar = useCallback((layoutH) => {
    if (typeof layoutH === 'number' && layoutH > 0) {
      setInputBarH(layoutH);
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
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [uiReady, setUiReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => cancelAnimationFrame(id);
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
  const [ephemeralClockTick, setEphemeralClockTick] = useState(0);

  /** 1 c тик только пока в ленте есть неистёкшие сгорающие сообщения (без глобального интервала «всегда»). */
  useEffect(() => {
    const hasUnexpiredEphemeral = () =>
      messagesRef.current.some(
        (m) => m.expires_at && new Date(m.expires_at).getTime() > Date.now()
      );
    if (!hasUnexpiredEphemeral()) return undefined;
    const id = setInterval(() => {
      if (renderPausedRef?.current) return;
      setEphemeralClockTick((n) => n + 1);
      if (!hasUnexpiredEphemeral()) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [messages]);

  const flatListRef = useRef(null);
  /** Пользователь у низа inverted-ленты — при новых сообщениях держим offset 0. */
  const stickToBottomRef = useRef(true);
  /** FlatList уже отрисовал контент (onContentSizeChange). */
  const layoutReadyRef = useRef(false);
  /** Один раз после первого успешного initial scroll. */
  const initialScrollDoneRef = useRef(false);

  const atBottomScrollShared = useSharedValue(1);

  const syncAtBottomFromWorklet = useCallback((atBottom) => {
    stickToBottomRef.current = atBottom;
  }, []);

  const onScrollReanimated = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
        const next = atBottom ? 1 : 0;
        if (next !== atBottomScrollShared.value) {
          atBottomScrollShared.value = next;
          runOnJS(syncAtBottomFromWorklet)(atBottom);
        }
      },
    },
    [syncAtBottomFromWorklet]
  );

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

  const formattedMessagesCacheRef = useRef(new Map());
  /** Для инкрементального append: предыдущий массив messages и зеркало formatted (без лишнего полного rebuild). */
  const messagesStrictPrevRef = useRef(null);
  const formattedMessagesAppendRef = useRef([]);
  const [formattedMessages, setFormattedMessages] = useState([]);
  useEffect(() => {
    const prevMsg = messagesStrictPrevRef.current;
    const cache = formattedMessagesCacheRef.current;
    const prevFmt = formattedMessagesAppendRef.current;

    let nextFormatted;
    if (prevMsg != null) {
      const quick = prependFormattedWhenTailAppended(prevMsg, messages, prevFmt, cache);
      if (quick != null) {
        nextFormatted = quick;
      }
    }
    if (nextFormatted == null) {
      nextFormatted = buildFormattedMessagesCached(messages, cache);
    }

    formattedMessagesAppendRef.current = nextFormatted;
    messagesStrictPrevRef.current = messages;
    setFormattedMessages(nextFormatted);
  }, [messages]);

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
  const fmtLenRef = useRef(0);
  const inputRef = useRef(null);
  const sendInProgressRef = useRef(false);

  const deletingIdsRef = useRef(deletingIds);
  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  const legacyCryptoKey = useMemo(() => (roomCode ? deriveKey(roomCode) : null), [roomCode]);

  const listOpacity = useSharedValue(0);
  const headerMeasured = useSharedValue(0);

  const {
    rootAnimatedStyle,
    inputBarAnimatedStyle,
    replyTargetAnimatedStyle,
    emojiWobbleRotate,
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

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

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

  useEffect(() => {
    if (isAriaChat) {
      setMessagesLoading(false);
      listOpacity.value = 1;
    }
  }, [isAriaChat, listOpacity]);

  useEffect(() => {
    pauseVoice();
    if (!roomId) {
      formattedMessagesCacheRef.current.clear();
      messagesStrictPrevRef.current = null;
      formattedMessagesAppendRef.current = [];
      return;
    }
    atBottomScrollShared.value = 1;
    stickToBottomRef.current = true;
    layoutReadyRef.current = false;
    initialScrollDoneRef.current = false;
    formattedMessagesCacheRef.current.clear();
    messagesStrictPrevRef.current = null;
    formattedMessagesAppendRef.current = [];
    headerMeasured.value = 0;
  }, [roomId, pauseVoice]);

  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    if (!stickToBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

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
      if (sendInProgressRef.current) return;
      sendInProgressRef.current = true;
      try {
        await sendToAria(trimmed);
        setText('');
        setReplyTarget(null);
      } finally {
        sendInProgressRef.current = false;
      }
      return;
    }
    await sendVaultTextMessage();
  }, [isAriaChat, chatRoomHeader?.ariaOnline, sendToAria, text, sendVaultTextMessage, setText, setReplyTarget]);

  const handleSendVoiceForComposer = useCallback(
    async (uri, duration, waveform) => {
      if (isAriaChat && sendToAria) {
        if (chatRoomHeader?.ariaOnline === false) return;
        if (!ariaControlled) return;

        const userMsgId = `aria-user-voice-${Date.now()}`;
        const typingId = ARIA_TYPING_ROW_ID;
        const now = new Date().toISOString();

        const baseRow = createAriaMessageBaseRow();

        const userRow = {
          ...baseRow,
          id: userMsgId,
          player_name: nickname,
          text: '',
          created_at: now,
          read_at: now,
          message_type: 'text',
          aria_voice_message: true,
          audio_uri: uri,
          transcription: null,
        };

        const typingRow = {
          ...baseRow,
          id: typingId,
          player_name: ARIA_CONTACT.display_name,
          text: '',
          created_at: now,
          read_at: null,
          message_type: ARIA_MESSAGE_TYPING,
          isTyping: true,
        };

        setMessages((prev) => [...prev, userRow, typingRow]);

        (async () => {
          try {
            const { data: auth, error: authErr } = await supabase.auth.getUser();
            if (authErr) throw authErr;
            const user_id = auth?.user?.id;
            if (!user_id) throw new Error('no_user');
            const audio_base64 = await readUriAsBase64(uri);
            const text = await transcribeAriaVoice(audio_base64, user_id);
            const trimmed = (text || '').trim();
            if (!trimmed) throw new Error('empty');

            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMsgId ? { ...m, transcription: trimmed } : m
              )
            );

            if (sendInProgressRef.current) return;
            sendInProgressRef.current = true;
            try {
              await sendToAria(trimmed, { skipOptimisticUserTyping: true });
            } finally {
              sendInProgressRef.current = false;
            }
          } catch {
            setMessages((prev) => prev.filter((m) => m.id !== typingId));
            Alert.alert('Голосовые сообщения пока недоступны');
          }
        })();
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

  const onMessagePress = useCallback((event, item) => {
    rowEnvRef.current.handleMessagePress(event, item);
  }, []);

  const onMessageLongPress = useCallback((event, item) => {
    rowEnvRef.current.handleMessageLongPress(event, item);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => (
      <MessageRow
        item={item}
        index={index}
        listExtra={listExtraDataStable}
        activeVoiceMessageId={activeVoiceMessageId}
        activeVoiceUri={activeVoiceUri}
        activeVideoId={activeVideoId}
        isRecordingVoice={isRecordingVoice}
        voicePlaybackSig={
          ((item.message_type === 'voice' ||
            item.message_type === 'audio' ||
            (item.aria_voice_message === true && item.audio_uri)) &&
            item.id === activeVoiceMessageId)
            ? voiceProgressSig
            : ''
        }
        fmtLenRef={fmtLenRef}
        rowEnvRef={rowEnvRef}
        onMessagePress={onMessagePress}
        onMessageLongPress={onMessageLongPress}
      />
    ),
    [
      listExtraDataStable,
      activeVoiceMessageId,
      activeVoiceUri,
      activeVideoId,
      isRecordingVoice,
      voiceProgressSig,
      onMessagePress,
      onMessageLongPress,
    ]
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

  const listBottomInsetH =
    inputBarH > 0
      ? inputBarH +
        (showEmojiPicker ? EMOJI_PICKER_PANEL_H : 0) +
        (replyTo ? REPLY_TARGET_PREVIEW_H : 0)
      : bottomOverlayH;

  return (
    <EphemeralClockContext.Provider value={ephemeralClockTick}>
    <Reanimated.View
      style={[
        tw`flex-1`,
        {
          backgroundColor: V.bgApp,
          overflow: chatRoomHeader ? 'visible' : 'hidden',
        },
        rootAnimatedStyle,
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

      <View style={{ flex: 1 }}>
        <ChatMessagesLoadingOverlay visible={messagesLoading} />
        <Reanimated.FlatList
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
          onScroll={onScrollReanimated}
          scrollEventThrottle={32}
          decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
          style={[
            tw`flex-1`,
            chatRoomHeader ? { backgroundColor: 'transparent' } : null,
            { zIndex: 1 },
            listAnimatedStyle,
          ]}
          removeClippedSubviews={Platform.OS === 'android'}
          ListFooterComponent={listFooterComponent}
          contentContainerStyle={[
            tw`pt-1`,
            chatRoomHeader && typeof listPaddingTop === 'number' && listPaddingTop > 0 ? null : tw`pb-2`,
            listBottomInsetH > 0 ? { paddingTop: listBottomInsetH } : null,
          ]}
          onContentSizeChange={() => {
            if (!layoutReadyRef.current) {
              layoutReadyRef.current = true;
              initialScrollDoneRef.current = true;
            }
            if (stickToBottomRef.current) {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
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
      </View>

      {chatRoomHeader != null ? (
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
              onTopOverlayHeight?.(h);
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
            selectionMode={selectionMode}
            selectedCount={selectedIds.size}
            onExitSelection={exitSelectionMode}
            onCopy={batchCopySelected}
            onForward={batchForwardSelected}
            onDelete={batchDeleteForMe}
          />
        </View>
      ) : null}

      <Reanimated.View
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (typeof h === 'number' && h > 0) setBottomOverlayH(h);
        }}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            elevation: 2,
          },
          inputBarAnimatedStyle,
        ]}
      >
        <ChatComposer
          inputBarRef={inputBarRef}
          reportInputBar={reportInputBar}
          insets={insets}
          visibleReplyTo={visibleReplyTo}
          replyTargetAnimatedStyle={replyTargetAnimatedStyle}
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
          setShowEmojiPicker={setShowEmojiPicker}
          setShowAttachMenu={setShowAttachMenu}
          handleSendVoice={handleSendVoiceForComposer}
          setIsRecordingVoice={setIsRecordingVoice}
          uploadMedia={uploadMedia}
          sendMediaMessage={sendMediaMessage}
          onVoiceRecorderOpen={onVoiceRecorderOpen}
          handleVideoRecorded={handleVideoRecorded}
          handleVideoSendError={handleVideoSendError}
          ariaTextOnly={!!isAriaChat}
          ariaAllowVoice={!!isAriaChat}
          ariaUnavailable={!!isAriaChat && chatRoomHeader?.ariaOnline === false}
        />
      </Reanimated.View>
    </Reanimated.View>
    </EphemeralClockContext.Provider>
  );
}
