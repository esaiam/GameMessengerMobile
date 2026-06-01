import React from 'react';
import ChatMessageContextMenuHost from './ChatMessageContextMenuHost';
import ChatFullScreenImageModal from './ChatFullScreenImageModal';
import ChatDeleteMessageModal from './ChatDeleteMessageModal';
import ChatHeaderOverflowMenuModal from './ChatHeaderOverflowMenuModal';
import ChatClearHistoryConfirmModal from './ChatClearHistoryConfirmModal';
import ChatAttachMenuModal from './ChatAttachMenuModal';
import ChatUploadOverlay from './ChatUploadOverlay';
import ChatCalendarOverlay from './ChatCalendarOverlay';

export default function ChatOverlays({
  uiReady,
  uploading,
  fullScreenImage,
  onCloseFullScreenImage,
  calendarOverlay,
  daysWithMessages,
  onCalendarDayPress,
  onCloseCalendar,
  menuVisible,
  menuPosition,
  selectedMessage,
  onCloseMenu,
  onReplyToMessage,
  onEditMessage,
  canEditSelectedMessage,
  onRequestDeleteConfirm,
  onOpenImage,
  onPinMessage,
  pinLabel,
  pinDisabled,
  deleteConfirmVisible,
  onCloseDeleteConfirm,
  onDeleteForMe,
  onDeleteForAll,
  overflowMenuVisible,
  onCloseOverflowMenu,
  onClearHistory,
  onDeleteChatFromList,
  clearHistoryConfirmVisible,
  onCloseClearHistoryConfirm,
  onConfirmClearHistory,
  deleteChatConfirmVisible,
  onCloseDeleteChatConfirm,
  onConfirmDeleteChat,
  deleteChatConfirmDisabled,
  showAttachMenu,
  onCloseAttachMenu,
  takePhoto,
  pickImageFromGallery,
  sendCurrentLocation,
  ephemeralSec,
  setEphemeralSec,
}) {
  return (
    <>
      <ChatUploadOverlay visible={uploading} />
      <ChatFullScreenImageModal
        uiReady={uiReady}
        uri={fullScreenImage}
        onClose={onCloseFullScreenImage}
      />
      <ChatCalendarOverlay
        visible={!!calendarOverlay}
        anchor={calendarOverlay?.anchor ?? null}
        initialDateKey={calendarOverlay?.dateKey ?? null}
        daysWithMessages={daysWithMessages}
        onDayPress={onCalendarDayPress}
        onClose={onCloseCalendar}
      />
      <ChatMessageContextMenuHost
        uiReady={uiReady}
        visible={menuVisible}
        onClose={onCloseMenu}
        position={menuPosition}
        selectedMessage={selectedMessage}
        onReplyToMessage={onReplyToMessage}
        onEditMessage={onEditMessage}
        canEditSelectedMessage={canEditSelectedMessage}
        onRequestDeleteConfirm={onRequestDeleteConfirm}
        onOpenImage={onOpenImage}
        onPinMessage={onPinMessage}
        pinLabel={pinLabel}
        pinDisabled={pinDisabled}
      />
      <ChatDeleteMessageModal
        uiReady={uiReady}
        visible={deleteConfirmVisible}
        onClose={onCloseDeleteConfirm}
        messageId={selectedMessage?.id ?? null}
        onDeleteForMe={onDeleteForMe}
        onDeleteForAll={onDeleteForAll}
      />
      <ChatHeaderOverflowMenuModal
        uiReady={uiReady}
        visible={overflowMenuVisible}
        onClose={onCloseOverflowMenu}
        onClearHistory={onClearHistory}
        onDeleteChat={onDeleteChatFromList}
      />
      <ChatClearHistoryConfirmModal
        uiReady={uiReady}
        visible={clearHistoryConfirmVisible}
        onClose={onCloseClearHistoryConfirm}
        onConfirm={onConfirmClearHistory}
      />
      <ChatClearHistoryConfirmModal
        uiReady={uiReady}
        visible={deleteChatConfirmVisible}
        confirmDisabled={deleteChatConfirmDisabled}
        onClose={onCloseDeleteChatConfirm}
        onConfirm={onConfirmDeleteChat}
        title="Удалить чат?"
        description="Чат исчезнет из списка. Сообщения скроются согласно выбранному варианту."
        confirmLabel="Удалить"
      />
      <ChatAttachMenuModal
        uiReady={uiReady}
        visible={showAttachMenu}
        onClose={onCloseAttachMenu}
        takePhoto={takePhoto}
        pickImageFromGallery={pickImageFromGallery}
        sendCurrentLocation={sendCurrentLocation}
        ephemeralSec={ephemeralSec}
        setEphemeralSec={setEphemeralSec}
      />
    </>
  );
}
