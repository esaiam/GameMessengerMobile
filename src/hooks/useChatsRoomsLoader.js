import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CHATS_LIST_POLL_MS } from '../screens/chats/chatsConstants';
import { fetchChatsRows } from '../screens/chats/fetchChatsRows';
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';
import { filterVisibleChatRows } from '../lib/filterVisibleChats';
import { getBlockedPeers, normalizePeerHandle } from '../lib/blockedContacts';
import { unhideChatRoom } from '../lib/hiddenChats';
import { registerChatsListReload } from '../lib/chatsListSync';
import { clearRoomReadCursor } from '../lib/chatReadCursor';

const MESSAGE_PREVIEW_SELECT =
  'id, room_id, text, message_type, created_at, player_name, read_at, hidden_for';
const LOAD_DEBOUNCE_MS = 400;

function peerHandleFromRoom(room, nickname) {
  if (!room?.id || !nickname) return null;
  return room.user1_id === nickname ? room.user2_id : room.user1_id;
}

export function useChatsRoomsLoader(nickname) {
  const [rows, setRows] = useState([]);
  // in-memory кэш для быстрого восстановления при re-mount без kill
  const rowsCacheRef = useRef({ nickname: null, rows: [] });
  // чтобы realtime-обновление не затёрло последний массив
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const loadDebounceRef = useRef(null);

  /** Полная загрузка с сервера */
  const load = useCallback(async () => {
    const { rows: next, error } = await fetchChatsRows(nickname);
    if (error) {
      const hasCachedRows =
        (rowsCacheRef.current.rows.length > 0 && rowsCacheRef.current.nickname === nickname) ||
        rowsRef.current.length > 0;
      if (!hasCachedRows) {
        Alert.alert(
          'Ошибка загрузки',
          'Не удалось загрузить чаты. Проверь подключение.',
          [{ text: 'OK' }],
        );
      }
      return;
    }
    const visible = await filterVisibleChatRows(nickname, next, { forceRefreshHidden: true });
    rowsCacheRef.current = { nickname, rows: visible };
    setRows(visible);
    saveDialogsCache(nickname, visible);
  }, [nickname]);

  /** При монтировании — показать диск-кэш мгновенно, потом догнать сервер */
  useEffect(() => {
    if (!nickname) return;

    let cancelled = false;
    loadDialogsCache(nickname).then(async (cached) => {
      if (cancelled || !cached?.length) return;
      const visible = await filterVisibleChatRows(nickname, cached, { forceRefreshHidden: true });
      if (cancelled) return;
      rowsCacheRef.current = { nickname, rows: visible };
      setRows(visible);
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

  /** Realtime: только UPDATE своих rooms (last_message_id), не все INSERT в messages */
  useEffect(() => {
    if (!nickname) return;

    const scheduleLoad = () => {
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
      loadDebounceRef.current = setTimeout(() => {
        loadDebounceRef.current = null;
        load();
      }, LOAD_DEBOUNCE_MS);
    };

    const applyLastMessage = async (room) => {
      const roomId = room.id;
      const lastMessageId = room.last_message_id;
      if (!roomId || !lastMessageId) return;

      const { data: newMsg, error } = await supabase
        .from('messages')
        .select(MESSAGE_PREVIEW_SELECT)
        .eq('id', lastMessageId)
        .maybeSingle();

      if (error || !newMsg) {
        scheduleLoad();
        return;
      }

      if ((newMsg.hidden_for || []).includes(nickname)) {
        setRows((prev) => {
          if (!prev.some((r) => r.roomId === roomId)) return prev;
          const next = prev.filter((r) => r.roomId !== roomId);
          rowsCacheRef.current = { nickname, rows: next };
          saveDialogsCache(nickname, next);
          return next;
        });
        return;
      }

      const blocked = await getBlockedPeers(nickname);
      const idx = rowsRef.current.findIndex((r) => r.roomId === roomId);
      const contactName = peerHandleFromRoom(room, nickname);

      if (idx === -1) {
        if (!contactName) {
          scheduleLoad();
          return;
        }
        if (blocked.has(normalizePeerHandle(contactName))) return;
        await unhideChatRoom(nickname, roomId);
        setRows((prev) => {
          if (prev.some((r) => r.roomId === roomId)) {
            scheduleLoad();
            return prev;
          }
          const newRow = {
            roomId,
            roomCode: room.code ?? null,
            contactName,
            last: newMsg,
          };
          const next = [newRow, ...prev];
          rowsCacheRef.current = { nickname, rows: next };
          saveDialogsCache(nickname, next);
          return next;
        });
        return;
      }
      const row = rowsRef.current[idx];
      if (blocked.has(normalizePeerHandle(row.contactName))) return;

      await unhideChatRoom(nickname, roomId);

      setRows((prev) => {
        const i = prev.findIndex((r) => r.roomId === roomId);
        if (i === -1) {
          scheduleLoad();
          return prev;
        }
        const updatedRow = { ...prev[i], last: newMsg };
        const next = [updatedRow, ...prev.filter((_, j) => j !== i)];
        rowsCacheRef.current = { nickname, rows: next };
        saveDialogsCache(nickname, next);
        return next;
      });
    };

    const onRoomDelete = (payload) => {
      const deletedRoomId = payload.old?.id;
      if (!deletedRoomId) return;

      void clearRoomReadCursor(nickname, deletedRoomId);
      setRows((prev) => {
        if (!prev.some((r) => r.roomId === deletedRoomId)) return prev;
        const next = prev.filter((r) => r.roomId !== deletedRoomId);
        rowsCacheRef.current = { nickname, rows: next };
        saveDialogsCache(nickname, next);
        return next;
      });
    };

    const onRoomUpdate = (payload) => {
      const room = payload.new;
      if (!room?.id) return;

      const lastId = room.last_message_id;
      const oldLastId = payload.old?.last_message_id;

      // Новое сообщение (в т.ч. после «удалить у всех») — показать/обновить строку
      if (lastId && lastId !== oldLastId) {
        applyLastMessage(room);
        return;
      }

      // Комната ожила: thread_cleared сброшен, last_message уже был
      if (lastId && payload.old?.thread_cleared_at && !room.thread_cleared_at) {
        applyLastMessage(room);
        return;
      }

      // Пустая очищенная комната — убрать из списка
      if ((room.thread_cleared_at && !lastId) || (!lastId && oldLastId)) {
        void clearRoomReadCursor(nickname, room.id);
        setRows((prev) => {
          const next = prev.filter((r) => r.roomId !== room.id);
          rowsCacheRef.current = { nickname, rows: next };
          saveDialogsCache(nickname, next);
          return next;
        });
      }
    };

    const channel = supabase
      .channel(`chat-list-${nickname}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `user1_id=eq.${nickname}`,
        },
        onRoomUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `user2_id=eq.${nickname}`,
        },
        onRoomUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rooms',
          filter: `user1_id=eq.${nickname}`,
        },
        onRoomDelete
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'rooms',
          filter: `user2_id=eq.${nickname}`,
        },
        onRoomDelete
      )
      .subscribe();

    return () => {
      if (loadDebounceRef.current) {
        clearTimeout(loadDebounceRef.current);
        loadDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [nickname, load]);

  useEffect(() => {
    registerChatsListReload(load);
    return () => registerChatsListReload(null);
  }, [load]);

  const removeRowsByRoomIds = useCallback(
    (roomIds) => {
      if (!roomIds?.length) return;
      const idSet = new Set(roomIds);
      setRows((prev) => {
        const next = prev.filter((r) => !idSet.has(r.roomId));
        rowsCacheRef.current = { nickname, rows: next };
        saveDialogsCache(nickname, next);
        return next;
      });
    },
    [nickname],
  );

  return { rows, removeRowsByRoomIds };
}
