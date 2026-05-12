import { useCallback, useEffect, useRef } from 'react';
import { CHAT_AT_BOTTOM_THRESHOLD_PX } from '../components/chat/chatViewConstants';

function scrollSuppressed(suppressRef) {
  if (suppressRef == null) return false;
  const refs = Array.isArray(suppressRef) ? suppressRef : [suppressRef];
  return refs.some((r) => r?.current);
}

/**
 * Inverted FlatList: отслеживание «у низа», сброс при смене комнаты, подскролл при новых сообщениях.
 * suppressStickToBottomScrollRef — один ref или массив (напр. клавиатура + смена высоты композера).
 */
export function useChatInvertedListScroll(roomId, messages, headerMeasured, suppressStickToBottomScrollRef) {
  const flatListRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const layoutReadyRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

  const onScroll = useCallback((e) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
    if (atBottom !== stickToBottomRef.current) {
      stickToBottomRef.current = atBottom;
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    stickToBottomRef.current = true;
    layoutReadyRef.current = false;
    initialScrollDoneRef.current = false;
    headerMeasured.value = 0;
  }, [roomId, headerMeasured]);

  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    if (!stickToBottomRef.current) return;
    if (scrollSuppressed(suppressStickToBottomScrollRef)) return;
    let innerRaf = null;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (scrollSuppressed(suppressStickToBottomScrollRef)) return;
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf != null) cancelAnimationFrame(innerRaf);
    };
  }, [messages, suppressStickToBottomScrollRef]);

  return {
    flatListRef,
    stickToBottomRef,
    layoutReadyRef,
    initialScrollDoneRef,
    onScroll,
  };
}
