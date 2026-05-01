import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CHATS_LIST_POLL_MS } from '../screens/chats/chatsConstants';
import { fetchChatsRows } from '../screens/chats/fetchChatsRows';

export function useChatsRoomsLoader(nickname) {
  const [rows, setRows] = useState([]);
  const rowsCacheRef = useRef({ nickname: null, rows: [] });

  const load = useCallback(async () => {
    const { rows: next, error } = await fetchChatsRows(nickname);
    if (error) {
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить чаты. Проверь подключение.',
        [{ text: 'OK' }]
      );
      return;
    }
    rowsCacheRef.current = { nickname, rows: next };
    setRows(next);
  }, [nickname]);

  useFocusEffect(
    useCallback(() => {
      const cached = rowsCacheRef.current;
      if (cached.rows.length > 0 && cached.nickname === nickname) {
        setRows(cached.rows);
      }
      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });

      let intervalId = null;
      const disarmInterval = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
      const armInterval = () => {
        disarmInterval();
        intervalId = setInterval(() => load(), CHATS_LIST_POLL_MS);
      };

      const onAppState = (next) => {
        if (next === 'active') {
          load();
          armInterval();
        } else {
          disarmInterval();
        }
      };

      const sub = AppState.addEventListener('change', onAppState);
      if (AppState.currentState === 'active') {
        armInterval();
      }

      return () => {
        task.cancel();
        disarmInterval();
        sub.remove();
      };
    }, [load, nickname])
  );

  return { rows };
}
