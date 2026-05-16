import React from 'react';
import Chat from '../Chat';

/**
 * Тонкий контейнер для Aria-чата.
 * Инкапсулирует isAriaChat=true и Aria-специфичные пропсы.
 */
export function AriaChatContainer({
  roomId,
  roomCode,
  nickname,
  peerName,
  ariaMessages,
  setAriaMessages,
  sendToAria,
  listPaddingTop,
  chatRoomHeader,
  onTopOverlayHeight,
}) {
  return (
    <Chat
      roomId={roomId}
      roomCode={roomCode}
      nickname={nickname}
      peerName={peerName}
      isAriaChat={true}
      ariaMessages={ariaMessages}
      setAriaMessages={setAriaMessages}
      sendToAria={sendToAria}
      listPaddingTop={listPaddingTop}
      chatRoomHeader={chatRoomHeader}
      onTopOverlayHeight={onTopOverlayHeight}
    />
  );
}
