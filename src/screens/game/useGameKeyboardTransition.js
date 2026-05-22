import { useState, useEffect, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useGameKeyboardTransition(setKbVisible) {
  const [kbTransitioning, setKbTransitioning] = useState(false);
  const kbTransitionTimerRef = useRef(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const mark = (vis) => {
      setKbTransitioning(true);
      setKbVisible(vis);
      if (kbTransitionTimerRef.current) {
        clearTimeout(kbTransitionTimerRef.current);
        kbTransitionTimerRef.current = null;
      }
      kbTransitionTimerRef.current = setTimeout(() => {
        kbTransitionTimerRef.current = null;
        setKbTransitioning(false);
      }, 420);
    };

    const sub1 = Keyboard.addListener(showEvt, () => mark(true));
    const sub2 = Keyboard.addListener(hideEvt, () => mark(false));
    return () => {
      sub1.remove();
      sub2.remove();
      if (kbTransitionTimerRef.current) clearTimeout(kbTransitionTimerRef.current);
    };
  }, [setKbVisible]);

  return { kbTransitioning };
}
