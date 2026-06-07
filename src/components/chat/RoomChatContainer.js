import React from 'react';
import Chat from '../Chat';

/**
 * Тонкий контейнер для обычного чата комнаты.
 * Инкапсулирует game/room-специфичные пропсы.
 */
export function RoomChatContainer({
  roomId,
  roomCode,
  nickname,
  peerName,
  renderPausedRef,
  diceBusyRef,
  chatFlushDeferredRef,
  diceAnimating,
  showAnimDice,
  listPaddingTop,
  chatRoomHeader,
  onTopOverlayHeight,
  onEmojiPickerChange,
  onInputBarTopY,
  onInputBarHeight,
  roomFocused = false }) {
  return (
    <Chat
      roomId={roomId}
      roomCode={roomCode}
      nickname={nickname}
      peerName={peerName}
      isAriaChat={false}
      renderPausedRef={renderPausedRef}
      diceBusyRef={diceBusyRef}
      chatFlushDeferredRef={chatFlushDeferredRef}
      diceAnimating={diceAnimating}
      showAnimDice={showAnimDice}
      listPaddingTop={listPaddingTop}
      chatRoomHeader={chatRoomHeader}
      onTopOverlayHeight={onTopOverlayHeight}
      onEmojiPickerChange={onEmojiPickerChange}
      onInputBarTopY={onInputBarTopY}
      onInputBarHeight={onInputBarHeight}
      overscrollEnabled={false}
      roomFocused={roomFocused}
    />
  );
}
