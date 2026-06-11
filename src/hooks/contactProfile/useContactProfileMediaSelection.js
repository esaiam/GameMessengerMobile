import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { hideMessagesForMe } from '../../lib/hideRoomMessagesForMe';

/**
 * Режим выделения медиа в профиле контакта + delete for me.
 */
export function useContactProfileMediaSelection({
  nickname,
  roomId,
  setBusy,
  reloadMedia,
  onDismissViewer,
}) {
  const [mediaSelectionMode, setMediaSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState(() => new Set());

  const exitMediaSelection = useCallback(() => {
    setMediaSelectionMode(false);
    setSelectedMediaIds(new Set());
  }, []);

  const toggleMediaSelection = useCallback((id) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setMediaSelectionMode(false);
      return next;
    });
  }, []);

  const handleMediaLongPress = useCallback(
    (item) => {
      if (!item?.id || !item.media_url) return;
      onDismissViewer?.();
      setMediaSelectionMode(true);
      setSelectedMediaIds(new Set([item.id]));
    },
    [onDismissViewer],
  );

  const handleDeleteSelectedMedia = useCallback(() => {
    if (!nickname || selectedMediaIds.size === 0) return;
    const count = selectedMediaIds.size;
    Alert.alert(
      'Удалить у меня',
      `Скрыть ${count} ${count === 1 ? 'медиа' : 'медиа'} у вас?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await hideMessagesForMe({
                messageIds: [...selectedMediaIds],
                nickname,
                roomId,
              });
              exitMediaSelection();
              await reloadMedia();
            } catch (e) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [nickname, roomId, selectedMediaIds, exitMediaSelection, reloadMedia, setBusy]);

  return {
    mediaSelectionMode,
    selectedMediaIds,
    exitMediaSelection,
    toggleMediaSelection,
    handleMediaLongPress,
    handleDeleteSelectedMedia,
  };
}
