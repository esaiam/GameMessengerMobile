import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NICKNAME_KEY, SWIPE_HINT_KEY, LEGACY_SWIPE_HINT_KEY } from './gameScreenConstants';
import { readNicknameFromStorage } from '../../lib/nicknameStorage';

/**
 * Ник из route/AsyncStorage + миграция legacy keys; флаг onboarding swipe hint.
 */
export default function useGameScreenBootstrap(routeNickname, gameStarted) {
  const [nickname, setNickname] = useState(routeNickname || '');
  const [swipeHintLoaded, setSwipeHintLoaded] = useState(false);
  const [swipeHintSeen, setSwipeHintSeen] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(LEGACY_SWIPE_HINT_KEY).then((legacy) => {
      if (legacy) {
        AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
        AsyncStorage.removeItem(LEGACY_SWIPE_HINT_KEY);
      }
    });

    if (routeNickname && routeNickname !== nickname) {
      setNickname(routeNickname);
      return;
    }
    if (!routeNickname && !nickname) {
      readNicknameFromStorage().then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [routeNickname, nickname]);

  useEffect(() => {
    AsyncStorage.getItem(SWIPE_HINT_KEY).then((v) => {
      setSwipeHintSeen(v === '1');
      setSwipeHintLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (gameStarted) {
      setSwipeHintSeen(true);
      AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
    }
  }, [gameStarted]);

  const markSwipeHintSeen = () => {
    setSwipeHintSeen(true);
    AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
  };

  return {
    nickname,
    setNickname,
    swipeHintLoaded,
    swipeHintSeen,
    markSwipeHintSeen,
  };
}
