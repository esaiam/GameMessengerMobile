import { useCallback, useEffect, useRef } from 'react';
import { shouldStickScrollOnMessagesTailChange } from '../components/chat/chatListScrollStick';
import { CHAT_AT_BOTTOM_THRESHOLD_PX } from '../components/chat/chatViewConstants';

/** Повтор tail-scroll если suppress (emoji panel layout). */
const SCROLL_SUPPRESS_RETRY_MS = 360;

function scrollSuppressed(suppressRef) {
  if (suppressRef == null) return false;
  const refs = Array.isArray(suppressRef) ? suppressRef : [suppressRef];
  return refs.some((r) => r?.current);
}

/**
 * Inverted FlatList: «у низа», сброс при смене комнаты, подскролл при новых сообщениях.
 * listOpacity — лента скрыта до первого scrollToOffset(0), без видимого прыжка при входе.
 */
export function useChatInvertedListScroll(
  roomId,
  messages,
  suppressStickToBottomScrollRef,
  listOpacity,
) {
  const flatListRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const messagesTailPrevRef = useRef([]);

  const onScroll = useCallback(
    (e) => {
      // Inset KB/emoji меняет contentOffset без действия пользователя — не сбрасываем «у низа».
      if (scrollSuppressed(suppressStickToBottomScrollRef)) return;
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
      if (atBottom !== stickToBottomRef.current) {
        stickToBottomRef.current = atBottom;
      }
    },
    [suppressStickToBottomScrollRef],
  );

  const scrollToBottomNow = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const revealList = useCallback(() => {
    if (listOpacity != null) {
      listOpacity.value = 1;
    }
  }, [listOpacity]);

  /** Однократный nudge после onEnd клавиатуры, если остались у низа (drift после resize viewport). */
  const nudgeListToBottomIfStuck = useCallback(() => {
    if (!initialScrollDoneRef.current) return;
    if (!stickToBottomRef.current) return;
    scrollToBottomNow();
  }, [scrollToBottomNow]);

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

  /** Первый показ: scroll + reveal за один кадр, пока opacity=0. */
  const completeInitialScroll = useCallback(() => {
    if (initialScrollDoneRef.current) return;
    initialScrollDoneRef.current = true;
    stickToBottomRef.current = true;

    let retryTimer = null;
    const finish = () => {
      scrollToBottomNow();
      revealList();
    };

    const raf = requestAnimationFrame(() => {
      if (!scrollSuppressed(suppressStickToBottomScrollRef)) {
        finish();
        return;
      }
      retryTimer = setTimeout(finish, SCROLL_SUPPRESS_RETRY_MS);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (retryTimer != null) clearTimeout(retryTimer);
    };
  }, [scrollToBottomNow, revealList, suppressStickToBottomScrollRef]);

  const onListLayoutReady = useCallback(() => {
    return completeInitialScroll();
  }, [completeInitialScroll]);

  useEffect(() => {
    if (!roomId) return;
    stickToBottomRef.current = true;
    initialScrollDoneRef.current = false;
    messagesTailPrevRef.current = [];
    if (listOpacity != null) {
      listOpacity.value = 0;
    }
  }, [roomId, listOpacity]);

  useEffect(() => {
    const prev = messagesTailPrevRef.current;
    const tailChanged = shouldStickScrollOnMessagesTailChange(prev, messages);
    messagesTailPrevRef.current = messages;

    if (!tailChanged) return;

    if (!initialScrollDoneRef.current) {
      if (messages.length > 0) {
        return completeInitialScroll();
      }
      return undefined;
    }

    return scrollToBottomIfStuck();
  }, [messages, scrollToBottomIfStuck, completeInitialScroll]);

  /** Страховка: если onContentSizeChange не пришёл (viewport remount). */
  useEffect(() => {
    if (listOpacity == null || initialScrollDoneRef.current) return undefined;
    if (messages.length === 0) return undefined;

    const timer = setTimeout(() => {
      if (!initialScrollDoneRef.current) {
        completeInitialScroll();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [roomId, messages.length, listOpacity, completeInitialScroll]);

  return {
    flatListRef,
    onScroll,
    onListLayoutReady,
    nudgeListToBottomIfStuck,
    scrollToBottomIfStuck,
  };
}
