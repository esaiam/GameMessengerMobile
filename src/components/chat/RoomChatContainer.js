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
  listPaddingTop,
  chatRoomHeader,
  onTopOverlayHeight,
  onEmojiPickerChange,
  onInputBarTopY,
  onInputBarHeight,
}) {
  return (
    <Chat
      roomId={roomId}
      roomCode={roomCode}
      nickname={nickname}
      peerName={peerName}
      isAriaChat={false}
      renderPausedRef={renderPausedRef}
      listPaddingTop={listPaddingTop}
      chatRoomHeader={chatRoomHeader}
      onTopOverlayHeight={onTopOverlayHeight}
      onEmojiPickerChange={onEmojiPickerChange}
      onInputBarTopY={onInputBarTopY}
      onInputBarHeight={onInputBarHeight}
    />
  );
}
