import React from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MessageContextMenu from './MessageContextMenu';
import { getMessageCopyText } from './getMessageCopyText';

/**
 * Контекстное меню сообщения: реакции + действия; колбэки чата передаются снаружи.
 */
export default function ChatMessageContextMenuHost({
  uiReady,
  visible,
  onClose,
  position,
  selectedMessage,
  onReplyToMessage,
  onRequestDeleteConfirm,
  onOpenImage }) {
  const canOpenImage =
    selectedMessage?.message_type === 'image' && !!selectedMessage?.media_url;
  if (!uiReady) return null;

  return (
    <MessageContextMenu
      visible={visible}
      onClose={onClose}
      position={position}
      onReply={() => {
        if (selectedMessage) onReplyToMessage(selectedMessage);
      }}
      onOpen={
        canOpenImage
          ? () => {
              onOpenImage?.(selectedMessage.media_url);
            }
          : undefined
      }
      onCopy={async () => {
        if (!selectedMessage) return;
        try {
          await Clipboard.setStringAsync(getMessageCopyText(selectedMessage));
        } catch (e) {
          Alert.alert('Ошибка', e?.message || 'Не удалось скопировать');
        }
      }}
      onForward={() => Alert.alert('Переслать', 'Функция в разработке.')}
      onPin={() => Alert.alert('Закрепить', 'Функция в разработке.')}
      onDelete={onRequestDeleteConfirm}
    />
  );
}
