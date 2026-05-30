import { useCallback, useEffect, useRef } from 'react';
import { shouldStickScrollOnMessagesTailChange } from '../components/chat/chatListScrollStick';
import { CHAT_AT_BOTTOM_THRESHOLD_PX } from '../components/chat/chatViewConstants';

/** Повтор после suppress (клавиатура / emoji settling). */
const SCROLL_SUPPRESS_RETRY_MS = 360;

function scrollSuppressed(suppressRef) {
  if (suppressRef == null) return false;
  const refs = Array.isArray(suppressRef) ? suppressRef : [suppressRef];
  return refs.some((r) => r?.current);
}

/**
 * Inverted FlatList: отслеживание «у низа», сброс при смене комнаты, подскролл при новых сообщениях.
 * suppressStickToBottomScrollRef — один ref или массив (напр. клавиатура + смена высоты композера).
 */
export function useChatInvertedListScroll(roomId, messages, suppressStickToBottomScrollRef) {
  const flatListRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const messagesTailPrevRef = useRef([]);

  const onScroll = useCallback((e) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
    if (atBottom !== stickToBottomRef.current) {
      stickToBottomRef.current = atBottom;
    }
  }, []);

  const scrollToBottomNow = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const scrollToBottomIfStuck = useCallback(() => {
    if (!initialScrollDoneRef.current) return undefined;
    if (!stickToBottomRef.current) return undefined;

    let innerRaf = null;
    let retryTimer = null;

    const tryScroll = () => {
      if (!stickToBottomRef.current) return true;
      if (scrollSuppressed(suppressStickToBottomScrollRef)) return false;
      scrollToBottomNow();
      return true;
    };

    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (tryScroll()) return;
        retryTimer = setTimeout(() => {
          tryScroll();
        }, SCROLL_SUPPRESS_RETRY_MS);
      });
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf != null) cancelAnimationFrame(innerRaf);
      if (retryTimer != null) clearTimeout(retryTimer);
    };
  }, [scrollToBottomNow, suppressStickToBottomScrollRef]);

  const onListLayoutReady = useCallback(() => {
    if (initialScrollDoneRef.current) return;
    initialScrollDoneRef.current = true;
    stickToBottomRef.current = true;
    return scrollToBottomIfStuck();
  }, [scrollToBottomIfStuck]);

  useEffect(() => {
    if (!roomId) return;
    stickToBottomRef.current = true;
    initialScrollDoneRef.current = false;
    messagesTailPrevRef.current = [];
  }, [roomId]);

  useEffect(() => {
    const prev = messagesTailPrevRef.current;
    const tailChanged = shouldStickScrollOnMessagesTailChange(prev, messages);
    messagesTailPrevRef.current = messages;

    if (!tailChanged) return;
    return scrollToBottomIfStuck();
  }, [messages, scrollToBottomIfStuck]);

  return {
    flatListRef,
    initialScrollDoneRef,
    onScroll,
    onListLayoutReady,
    scrollToBottomIfStuck,
  };
}
