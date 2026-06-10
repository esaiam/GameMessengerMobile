import { useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { formatDateKey } from './chatMessageListFormat';

/**
 * Calendar overlay navigation: days with messages, index maps, scroll to date/message in inverted list.
 * Depends on: messages, formattedMessages, flatListRef, isAriaChat, setCalendarOverlay.
 */
export default function useChatCalendarNavigation({
  messages,
  formattedMessages,
  flatListRef,
  isAriaChat,
  setCalendarOverlay,
}) {
  const daysWithMessages = useMemo(() => {
    const set = new Set();
    for (const m of messages) {
      const k = formatDateKey(m.created_at);
      if (k) set.add(k);
    }
    return set;
  }, [messages]);

  const dateKeyToIndexMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < formattedMessages.length; i++) {
      const row = formattedMessages[i];
      if (row._showDate && row._dateKey) map.set(row._dateKey, i);
    }
    return map;
  }, [formattedMessages]);

  const messageIdToIndexMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < formattedMessages.length; i++) {
      const row = formattedMessages[i];
      if (row?.id != null) map.set(row.id, i);
    }
    return map;
  }, [formattedMessages]);

  const openCalendarFromSeparator = useCallback((anchor, dateKey, _dateLabel) => {
    setCalendarOverlay({ anchor, dateKey });
  }, [setCalendarOverlay]);

  const handleCalendarDayPress = useCallback((selectedKey) => {
    if (isAriaChat) {
      // Заглушка для Арии — просто закрываем
      setCalendarOverlay(null);
      return;
    }
    const idx = dateKeyToIndexMap.get(selectedKey);
    setCalendarOverlay(null);
    if (idx == null) return;
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5 });
    }, 180);
  }, [isAriaChat, dateKeyToIndexMap, flatListRef, setCalendarOverlay]);

  const scrollToMessageById = useCallback((messageId) => {
    const idx = messageIdToIndexMap.get(messageId);
    if (idx == null) {
      Alert.alert('Сообщение', 'Не удалось найти сообщение в ленте.');
      return;
    }
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
    }, 120);
  }, [messageIdToIndexMap, flatListRef]);

  return {
    daysWithMessages,
    dateKeyToIndexMap,
    messageIdToIndexMap,
    openCalendarFromSeparator,
    handleCalendarDayPress,
    scrollToMessageById,
  };
}
