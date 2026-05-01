import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NICKNAME_STORAGE_KEY } from '../context/AuthGateContext';

/**
 * Никнейм для таб-экранов: приоритет `route.params.nickname`, иначе последнее значение из AsyncStorage.
 */
export function useNicknameFromRoute(route) {
  const [nickname, setNickname] = useState(route.params?.nickname || '');

  useEffect(() => {
    if (route.params?.nickname && route.params.nickname !== nickname) {
      setNickname(route.params.nickname);
      return;
    }
    if (!route.params?.nickname && !nickname) {
      AsyncStorage.getItem(NICKNAME_STORAGE_KEY).then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [route.params?.nickname, nickname]);

  return nickname;
}
