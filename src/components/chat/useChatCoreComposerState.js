import { useState, useEffect, useRef, useCallback } from 'react';
import { configureReplyTargetLayoutAnimation } from './replyTargetLayoutAnimation';
import { canEditMessage } from './chatEditMessageUtils';

/**
 * Core chat composer state: messages (vault vs Aria), text/reply/edit, ephemeral, deletingIds, emoji panel.
 * Depends on Chat props: roomId, isAriaChat, ariaMessages, setAriaMessages, nickname, onEmojiPickerChange.
 */
export default function useChatCoreComposerState({
  roomId,
  isAriaChat,
  ariaMessages,
  setAriaMessages,
  nickname,
  onEmojiPickerChange,
}) {
  const [internalMessages, setInternalMessages] = useState([]);
  const ariaControlled =
    isAriaChat === true && typeof setAriaMessages === 'function' && Array.isArray(ariaMessages);
  const messages = ariaControlled ? ariaMessages : internalMessages;
  const setMessages = ariaControlled ? setAriaMessages : setInternalMessages;

  const [messagesLoading, setMessagesLoading] = useState(true);
  const [initialHistoryReady, setInitialHistoryReady] = useState(isAriaChat);
  const [historyDataReady, setHistoryDataReady] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [visibleReplyTo, setVisibleReplyTo] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [visibleEditTarget, setVisibleEditTarget] = useState(null);
  const [ephemeralSec, setEphemeralSec] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPanelGifQuery, setEmojiPanelGifQuery] = useState('');
  const [emojiPanelGifSearchFocused, setEmojiPanelGifSearchFocused] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);

  const deletingIdsRef = useRef(deletingIds);
  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  useEffect(() => {
    onEmojiPickerChange?.(showEmojiPicker);
  }, [showEmojiPicker, onEmojiPickerChange]);

  useEffect(() => {
    if (!showEmojiPicker) {
      setEmojiPanelGifQuery('');
      setEmojiPanelGifSearchFocused(false);
    }
  }, [showEmojiPicker]);

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
  }, [nickname, isAriaChat, setReplyTarget]);

  useEffect(() => {
    setEditTarget(null);
  }, [roomId]);

  useEffect(() => {
    setInitialHistoryReady(isAriaChat);
    setHistoryDataReady(isAriaChat);
  }, [roomId, isAriaChat]);

  return {
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
    deletingIds,
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
  };
}
