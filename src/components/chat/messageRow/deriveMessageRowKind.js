import { ARIA_MESSAGE_TYPING } from '../../../lib/aria';

/**
 * Pure classification flags for a chat list row (no side effects).
 *
 * Kind resolution order (see resolveMessageRowKind):
 * ariaPlainTyping → ariaPlainText → typing → video → image → ariaVoice → text → other
 *
 * @param {object} item — FlatList message item
 * @param {object} listExtra — stable listExtra from useChatMessageListRender
 * @param {{ nickname: string }} env — rowEnvRef.current subset; full contract: messageRowEnvContract.js
 */
export function deriveMessageRowFlags(item, listExtra, env) {
  const isMine = item.player_name === env.nickname;
  const isVideoMessage = item.message_type === 'video';
  const isImageMessage = item.message_type === 'image';
  const isAriaTyping =
    item.message_type === ARIA_MESSAGE_TYPING || item.isTyping === true;
  /** Голос Aria с локальным файлом — плеер + опционально транскрипт (иначе старый Mic+текст). */
  const isAriaVoiceBubble =
    item.aria_voice_message === true && !!item.audio_uri;
  const isTextMessage =
    !isAriaTyping &&
    !isAriaVoiceBubble &&
    (item.aria_voice_message === true ||
      !item.message_type ||
      item.message_type === 'text');
  const ariaPlainIncoming = listExtra.ariaPlainPanel && !isMine;

  return {
    isMine,
    isVideoMessage,
    isImageMessage,
    isAriaTyping,
    isAriaVoiceBubble,
    isTextMessage,
    ariaPlainIncoming,
  };
}

/**
 * Row render disposition — order matches MessageRow branch priority.
 * @returns {'ariaPlainTyping'|'ariaPlainText'|'typing'|'video'|'image'|'ariaVoice'|'text'|'other'}
 */
export function resolveMessageRowKind(flags) {
  const {
    isVideoMessage,
    isImageMessage,
    isAriaTyping,
    isAriaVoiceBubble,
    isTextMessage,
    ariaPlainIncoming,
  } = flags;

  if (ariaPlainIncoming && isAriaTyping) return 'ariaPlainTyping';
  if (ariaPlainIncoming && isTextMessage && !isAriaVoiceBubble) return 'ariaPlainText';
  if (isAriaTyping) return 'typing';
  if (isVideoMessage) return 'video';
  if (isImageMessage) return 'image';
  if (isAriaVoiceBubble) return 'ariaVoice';
  if (isTextMessage) return 'text';
  return 'other';
}

/** @see resolveMessageRowKind */
export function deriveMessageRowKind(item, listExtra, env) {
  return resolveMessageRowKind(deriveMessageRowFlags(item, listExtra, env));
}
