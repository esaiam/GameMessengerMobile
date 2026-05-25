import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { deleteChatsFromList } from '../lib/hideRoomMessagesForDelete';

function deleteTitle(count) {
  if (count === 1) return 'Удалить чат?';
  if (count >= 2 && count <= 4) return `Удалить ${count} чата?`;
  return `Удалить ${count} чатов?`;
}

/**
 * Мультивыбор строк списка чатов: long press → режим выбора, tap — toggle, батч удаление с модалкой.
 */
export function useChatsSelection({ nickname, rows, onNavigateToChat, removeRowsByRoomIds }) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState(() => new Set());
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const peerByRoomId = useMemo(() => {
    const map = new Map();
    for (const r of rows || []) {
      if (r.roomId) map.set(r.roomId, r.contactName ?? null);
    }
    return map;
  }, [rows]);

  const selectedHash = useMemo(
    () => Array.from(selectedRoomIds).sort().join(','),
    [selectedRoomIds],
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedRoomIds(new Set());
  }, []);

  const handleChatPress = useCallback(
    (item) => {
      if (selectionMode) {
        if (item.isAria || !item.roomId) return;
        setSelectedRoomIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.roomId)) next.delete(item.roomId);
          else next.add(item.roomId);
          if (next.size === 0) setSelectionMode(false);
          return next;
        });
        return;
      }
      onNavigateToChat(item);
    },
    [selectionMode, onNavigateToChat],
  );

  const handleChatLongPress = useCallback((item) => {
    if (item.isAria || !item.roomId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectionMode(true);
    setSelectedRoomIds(new Set([item.roomId]));
  }, []);

  const openDeleteConfirm = useCallback(() => {
    if (selectedRoomIds.size === 0) return;
    setDeleteConfirmVisible(true);
  }, [selectedRoomIds.size]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleteInProgress) return;
    setDeleteConfirmVisible(false);
  }, [deleteInProgress]);

  const confirmDeleteChats = useCallback(
    async (deleteForEveryone) => {
      if (selectedRoomIds.size === 0 || deleteInProgress) return;
      const ids = [...selectedRoomIds];
      setDeleteInProgress(true);
      try {
        await deleteChatsFromList({
          nickname,
          roomIds: ids,
          peerByRoomId,
          deleteForEveryone,
        });
        removeRowsByRoomIds(ids);
        setDeleteConfirmVisible(false);
        exitSelectionMode();
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось удалить чаты');
      } finally {
        setDeleteInProgress(false);
      }
    },
    [
      selectedRoomIds,
      deleteInProgress,
      nickname,
      peerByRoomId,
      removeRowsByRoomIds,
      exitSelectionMode,
    ],
  );

  const deleteModalTitle = useMemo(
    () => deleteTitle(selectedRoomIds.size),
    [selectedRoomIds.size],
  );

  return {
    selectionMode,
    selectedRoomIds,
    selectedHash,
    exitSelectionMode,
    handleChatPress,
    handleChatLongPress,
    openDeleteConfirm,
    deleteConfirmVisible,
    closeDeleteConfirm,
    confirmDeleteChats,
    deleteModalTitle,
    deleteInProgress,
  };
}
