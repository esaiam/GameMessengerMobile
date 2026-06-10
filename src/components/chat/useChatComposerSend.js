import { useRef, useCallback } from 'react';
import useChatMediaActions from './useChatMediaActions';
import useChatSendText from './useChatSendText';
import { sendAriaChatTextMessage } from './ariaTextComposerSend';
import { startAriaVoiceComposerSend } from './ariaVoiceComposerSend';
import { parsePicInlineQuery } from '../../lib/parsePicInlineQuery';
import { parseGifInlineQuery } from '../../lib/parseGifInlineQuery';

/**
 * Composer send routing: vault/Aria text, voice, attach media actions.
 * Depends on pipeline optimistic callbacks and edit/save handlers from mutations bundle.
 */
export default function useChatComposerSend({
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
}) {
  const sendInProgressRef = useRef(false);

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
        setReplyTarget,
      });
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
    setEditTarget,
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
    ],
  );

  const onVoiceRecorderOpen = useCallback(() => {
    stopVideo();
  }, [stopVideo]);

  return {
    uploadMedia,
    sendMediaMessage,
    pickImageFromGallery,
    takePhoto,
    sendCurrentLocation,
    handleSendVoice,
    sendMessage,
    handleSendVoiceForComposer,
    onVoiceRecorderOpen,
  };
}
