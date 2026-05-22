import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Подавление scrollToOffset ленты во время анимации клавиатуры / emoji panel.
 */
export default function useChatInputSettling(showEmojiPicker) {
  const keyboardSettlingRef = useRef(false);
  const keyboardSettleTimerRef = useRef(null);
  const composerInsetSettlingRef = useRef(false);
  const composerInsetSettleTimerRef = useRef(null);

  const armComposerInsetSettling = useCallback(() => {
    composerInsetSettlingRef.current = true;
    if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    composerInsetSettleTimerRef.current = setTimeout(() => {
      composerInsetSettlingRef.current = false;
      composerInsetSettleTimerRef.current = null;
    }, 320);
  }, []);

  useEffect(() => {
    const settlingPadMs = Platform.OS === 'ios' ? 130 : 150;
    const armSettling = (ms) => {
      keyboardSettlingRef.current = true;
      if (keyboardSettleTimerRef.current) clearTimeout(keyboardSettleTimerRef.current);
      keyboardSettleTimerRef.current = setTimeout(() => {
        keyboardSettlingRef.current = false;
        keyboardSettleTimerRef.current = null;
      }, ms);
    };
    const keyboardAnimMs = (e) =>
      typeof e.duration === 'number' && e.duration > 0 ? e.duration : 250;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => {
      armSettling(keyboardAnimMs(e) + settlingPadMs);
    });
    const subHide = Keyboard.addListener(hideEvt, (e) => {
      const base =
        Platform.OS === 'ios' && typeof e?.duration === 'number' && e.duration > 0
          ? e.duration
          : 250;
      armSettling(base + settlingPadMs);
    });
    return () => {
      subShow.remove();
      subHide.remove();
      if (keyboardSettleTimerRef.current) clearTimeout(keyboardSettleTimerRef.current);
      if (composerInsetSettleTimerRef.current) clearTimeout(composerInsetSettleTimerRef.current);
    };
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
  };
}
