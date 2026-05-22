import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CHATS_LIST_POLL_MS } from '../screens/chats/chatsConstants';
import { fetchChatsRows } from '../screens/chats/fetchChatsRows';
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';
import { filterVisibleChatRows } from '../lib/filterVisibleChats';
import { getBlockedPeers } from '../lib/blockedContacts';
import { unhideChatRoom } from '../lib/hiddenChats';

export function useChatsRoomsLoader(nickname) {
  const [rows, setRows] = useState([]);
  // in-memory кэш для быстрого восстановления при re-mount без kill
  const rowsCacheRef = useRef({ nickname: null, rows: [] });
  // чтобы realtime-обновление не затёрло последний массив
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Флаг, что диск-кэш уже применён для текущего nickname
  const diskCacheLoadedRef = useRef(false);

  /** Полная загрузка с сервера */
  const load = useCallback(async () => {
    const { rows: next, error } = await fetchChatsRows(nickname);
    if (error) {
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить чаты. Проверь подключение.',
        [{ text: 'OK' }]
      );
      return;
    }
    const visible = await filterVisibleChatRows(nickname, next);
    rowsCacheRef.current = { nickname, rows: visible };
    setRows(visible);
    saveDialogsCache(nickname, visible);
  }, [nickname]);

  /** При монтировании — показать диск-кэш мгновенно, потом догнать сервер */
  useEffect(() => {
    if (!nickname) return;
    diskCacheLoadedRef.current = false;

    let cancelled = false;
    loadDialogsCache(nickname).then((cached) => {
      if (cancelled) return;
      if (cached && cached.length > 0) {
        rowsCacheRef.current = { nickname, rows: cached };
        setRows(cached);
      }
      diskCacheLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [nickname]);

  useFocusEffect(
    useCallback(() => {
      // Если есть in-memory кэш — показать сразу
      const cached = rowsCacheRef.current;
      if (cached.rows.length > 0 && cached.nickname === nickname) {
        setRows(cached.rows);
      }

      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });

      let intervalId = null;
      const disarmInterval = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
      const armInterval = () => {
        disarmInterval();
        intervalId = setInterval(() => load(), CHATS_LIST_POLL_MS);
      };

      const onAppState = (next) => {
        if (next === 'active') {
          load();
          armInterval();
        } else {
          disarmInterval();
        }
      };

      const sub = AppState.addEventListener('change', onAppState);
      if (AppState.currentState === 'active') {
        armInterval();
      }

      return () => {
        task.cancel();
        disarmInterval();
        sub.remove();
      };
    }, [load, nickname])
  );

  /** Realtime: подписка на новые сообщения — мгновенное обновление списка */
  useEffect(() => {
    if (!nickname) return;

    const channel = supabase
      .channel(`chat-list-${nickname}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg?.room_id) return;

          (async () => {
            const blocked = await getBlockedPeers(nickname);
            const idx = rowsRef.current.findIndex((r) => r.roomId === newMsg.room_id);
            if (idx === -1) {
              load();
              return;
            }
            const row = rowsRef.current[idx];
            if (blocked.has(row.contactName)) return;

            await unhideChatRoom(nickname, newMsg.room_id);

            setRows((prev) => {
              const i = prev.findIndex((r) => r.roomId === newMsg.room_id);
              if (i === -1) {
                load();
                return prev;
              }
              const updatedRow = { ...prev[i], last: newMsg };
              const next = [updatedRow, ...prev.filter((_, j) => j !== i)];
              rowsCacheRef.current = { nickname, rows: next };
              saveDialogsCache(nickname, next);
              return next;
            });
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nickname, load]);

  return { rows };
}
