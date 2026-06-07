import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  isChatLastMessageUnread,
  loadReadCursors,
  subscribeReadCursors,
} from '../lib/chatReadCursor';

export function useChatReadCursors(nickname) {
  const [cursors, setCursors] = useState({});

  const refresh = useCallback(async () => {
    if (!nickname) {
      setCursors({});
      return;
    }
    setCursors(await loadReadCursors(nickname));
  }, [nickname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!nickname) return undefined;
    return subscribeReadCursors((owner, map) => {
      if (owner === nickname) setCursors(map);
    });
  }, [nickname]);

  const isRowUnread = useCallback(
    (item) => {
      if (item?.isAria) return false;
      return isChatLastMessageUnread(item?.last, nickname, item?.roomId, cursors);
    },
    [nickname, cursors],
  );

  return { cursors, isRowUnread, refresh };
}
