import React from 'react';
import ChatView from './chat/ChatView';
import useChatController from './chat/useChatController';

/**
 * Room chat: hook orchestration in `useChatController`, UI in `ChatView`.
 * Public props unchanged for ChatRoomScreen, GameScreen / RoomChatContainer, AriaChatContainer.
 */
export default function Chat({
  roomId,
  roomCode: _roomCode,
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
  /** GameScreen tablet: доска раскрыта — позже placeholder вместо image/video в ленте */
  suppressHeavyMedia = false,
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
  roomFocused = false,
  /** Aria: typewriter завершён */
  onAriaRevealComplete,
}) {
  const viewProps = useChatController({
    roomId,
    nickname,
    peerName,
    isAriaChat,
    ariaMessages,
    setAriaMessages,
    sendToAria,
    onInputBarHeight,
    onInputBarTopY,
    onEmojiPickerChange,
    listPaddingTop,
    chatRoomHeader,
    onTopOverlayHeight,
    suppressHeavyMedia,
    renderPausedRef,
    diceBusyRef,
    chatFlushDeferredRef,
    diceAnimating,
    showAnimDice,
    overscrollEnabled,
    roomFocused,
    onAriaRevealComplete,
  });

  return <ChatView {...viewProps} />;
}
