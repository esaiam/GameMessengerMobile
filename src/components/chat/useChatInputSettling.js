import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

/**
 * Подавление scrollToOffset ленты во время анимации клавиатуры / emoji panel.
 */
export default function useChatInputSettling(showEmojiPicker) {
  const keyboardSettlingRef = useRef(false);
  const keyboardSettleTimerRef = useRef(null);
  const composerInsetSettlingRef = useRef(false);
  const composerInsetSettleTimerRef = useRef(null);

  const armKeyboardSettling = useCallback((durationMs = 280) => {
    keyboardSettlingRef.current = true;
    if (keyboardSettleTimerRef.current) clearTimeout(keyboardSettleTimerRef.current);
    const padMs = Platform.OS === 'ios' ? 130 : 80;
    keyboardSettleTimerRef.current = setTimeout(() => {
      keyboardSettlingRef.current = false;
      keyboardSettleTimerRef.current = null;
    }, durationMs + padMs);
  }, []);

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        const dur = typeof e.duration === 'number' && e.duration > 0 ? e.duration : 280;
        runOnJS(armKeyboardSettling)(dur);
      },
      onEnd: (e) => {
        'worklet';
        const dur = typeof e.duration === 'number' && e.duration > 0 ? e.duration : 250;
        runOnJS(armKeyboardSettling)(dur);
      },
    },
    [armKeyboardSettling],
  );

  const armComposerInsetSettling = useCallback(() => {
    composerInsetSettlingRef.current = true;
    if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    composerInsetSettleTimerRef.current = setTimeout(() => {
      composerInsetSettlingRef.current = false;
      composerInsetSettleTimerRef.current = null;
    }, 320);
  }, []);

  useEffect(() => {
    armComposerInsetSettling();
    return () => {
      if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    };
  }, [showEmojiPicker, armComposerInsetSettling]);

  const listScrollSuppressRefs = useMemo(
    () => [keyboardSettlingRef, composerInsetSettlingRef],
    [],
  );

  return {
    armComposerInsetSettling,
    listScrollSuppressRefs,
    keyboardSettlingRef,
  };
}
