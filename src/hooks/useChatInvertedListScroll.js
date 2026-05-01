import { useCallback, useEffect, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { CHAT_AT_BOTTOM_THRESHOLD_PX } from '../components/chat/chatViewConstants';

/**
 * Inverted FlatList: отслеживание «у низа», сброс при смене комнаты, подскролл при новых сообщениях.
 */
export function useChatInvertedListScroll(roomId, messages, headerMeasured) {
  const flatListRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const layoutReadyRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

  const atBottomScrollShared = useSharedValue(1);

  const syncAtBottomFromWorklet = useCallback((atBottom) => {
    stickToBottomRef.current = atBottom;
  }, []);

  const onScrollReanimated = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
        const next = atBottom ? 1 : 0;
        if (next !== atBottomScrollShared.value) {
          atBottomScrollShared.value = next;
          runOnJS(syncAtBottomFromWorklet)(atBottom);
        }
      },
    },
    [syncAtBottomFromWorklet]
  );

  useEffect(() => {
    if (!roomId) return;
    atBottomScrollShared.value = 1;
    stickToBottomRef.current = true;
    layoutReadyRef.current = false;
    initialScrollDoneRef.current = false;
    headerMeasured.value = 0;
  }, [roomId, headerMeasured]);

  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    if (!stickToBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  return {
    flatListRef,
    stickToBottomRef,
    layoutReadyRef,
    initialScrollDoneRef,
    onScrollReanimated,
  };
}
