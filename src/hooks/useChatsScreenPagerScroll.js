import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/** Pager lock while FlatList scrolls on Chats tab (avoids fighting horizontal tab swipe). */
export function useChatsScreenPagerScroll({
  acquirePagerLock,
  releasePagerLock,
  resetPagerLock,
  searchDragActiveRef,
}) {
  const listScrollDragRef = useRef(false);

  const onListScrollBeginDrag = useCallback(() => {
    if (searchDragActiveRef.current) return;
    listScrollDragRef.current = true;
    acquirePagerLock?.();
  }, [acquirePagerLock, searchDragActiveRef]);

  const onListScrollEndDrag = useCallback(
    (e) => {
      const vy = e?.nativeEvent?.velocity?.y ?? 0;
      if (Math.abs(vy) < 0.15) {
        listScrollDragRef.current = false;
        releasePagerLock?.();
      }
    },
    [releasePagerLock],
  );

  const onListMomentumScrollEnd = useCallback(() => {
    if (listScrollDragRef.current) {
      listScrollDragRef.current = false;
      releasePagerLock?.();
    }
  }, [releasePagerLock]);

  useFocusEffect(
    useCallback(
      () => () => {
        listScrollDragRef.current = false;
        resetPagerLock?.();
      },
      [resetPagerLock],
    ),
  );

  return { onListScrollBeginDrag, onListScrollEndDrag, onListMomentumScrollEnd };
}
