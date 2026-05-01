import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { ARIA_MESSAGE_TYPING } from '../../lib/aria';
import { getBatchCopyLineFromDecrypted } from './getMessageCopyText';

/**
 * Мультивыбор строк, контекстное меню по тапу (вне режима выбора), батч скрыть/копировать/переслать.
 */
export default function useChatSelection({
  messages,
  setMessages,
  nickname,
  isAriaChat = false,
  filterHiddenForMe,
  filterExpired,
  formattedMessages,
  decryptMsg,
  onOpenMessageMenu,
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const selectedHash = useMemo(
    () => Array.from(selectedIds).sort().join(','),
    [selectedIds],
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleMessagePress = useCallback(
    (event, item) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          if (next.size === 0) setSelectionMode(false);
          return next;
        });
        return;
      }
      if (isAriaChat || item?.message_type === ARIA_MESSAGE_TYPING) return;
      onOpenMessageMenu(event, item);
    },
    [selectionMode, isAriaChat, onOpenMessageMenu],
  );

  const handleMessageLongPress = useCallback(
    (event, item) => {
      if (isAriaChat || item?.message_type === ARIA_MESSAGE_TYPING) return;
      setSelectionMode(true);
      setSelectedIds(new Set([item.id]));
    },
    [isAriaChat],
  );

  const batchDeleteForMe = useCallback(async () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Удалить у меня',
      `Скрыть ${selectedIds.size} сообщ. у вас?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const ids = [...selectedIds];
            const updates = new Map();
            let lastError = null;
            for (const id of ids) {
              const msg = messages.find((m) => m.id === id);
              if (!msg) continue;
              const hidden = [...(msg.hidden_for || []), nickname];
              const { error } = await supabase
                .from('messages')
                .update({ hidden_for: hidden })
                .eq('id', id);
              if (error) lastError = error;
              else updates.set(id, hidden);
            }
            if (updates.size > 0) {
              setMessages((prev) =>
                filterHiddenForMe(
                  filterExpired(
                    prev.map((m) => (updates.has(m.id) ? { ...m, hidden_for: updates.get(m.id) } : m)),
                  ),
                ),
              );
            }
            if (lastError) {
              Alert.alert('Ошибка', lastError.message);
            }
            exitSelectionMode();
          },
        },
      ],
    );
  }, [selectedIds, messages, nickname, exitSelectionMode, filterHiddenForMe, filterExpired, setMessages]);

  const messageLineForCopy = useCallback(
    async (msg) => getBatchCopyLineFromDecrypted(await decryptMsg(msg)),
    [decryptMsg],
  );

  const batchCopySelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const lines = [];
    for (let i = formattedMessages.length - 1; i >= 0; i--) {
      const item = formattedMessages[i];
      if (!selectedIds.has(item.id)) continue;
      lines.push(await messageLineForCopy(item));
    }
    const text = lines.join('\n\n');
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Скопировано', `${selectedIds.size} сообщ.`);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось скопировать');
    }
  }, [selectedIds, formattedMessages, messageLineForCopy]);

  const batchForwardSelected = useCallback(() => {
    Alert.alert('Переслать', 'Функция в разработке.');
  }, []);

  return {
    selectionMode,
    selectedIds,
    selectedHash,
    exitSelectionMode,
    handleMessagePress,
    handleMessageLongPress,
    batchDeleteForMe,
    batchCopySelected,
    batchForwardSelected,
  };
}
