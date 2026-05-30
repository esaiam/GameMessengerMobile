import { useCallback, useMemo, useRef } from 'react';
import { ARIA_CONTACT } from '../../lib/aria';
import MessageRow from './MessageRow';
import { createRenderMessageContent } from './createRenderMessageContent';

export default function useChatMessageListRender({
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
}) {
  const rowEnvRef = useRef({});
  const playbackEnvRef = useRef({});
  const messageRowLiveRef = useRef({});
  const fmtLenRef = useRef(0);

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
        playVoiceMessage,
        activateVideo,
        activatedVideoIdsRef: activatedVideoIds,
        rowEnvRef,
        playbackEnvRef,
      }),
    [playVoiceMessage, setFullScreenImage, activateVideo, activatedVideoIds],
  );

  const listExtraDataStable = useMemo(
    () => ({ selectionMode, selectedHash, renderableVideoIds, onUnlockVideo, isAriaChat }),
    [selectionMode, selectedHash, renderableVideoIds, onUnlockVideo, isAriaChat],
  );

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
    [listExtraDataStable, onMessagePress, onMessageLongPress],
  );

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
    replyToMessage,
    isAriaChat,
    ariaPeerName: ARIA_CONTACT.display_name,
    onDateSeparatorPress: openCalendarFromSeparator,
  };

  return { renderItem, listExtraDataStable, fmtLenRef, rowEnvRef };
}
