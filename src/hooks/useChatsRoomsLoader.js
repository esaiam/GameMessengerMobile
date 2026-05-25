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
import { registerChatsListReload } from '../lib/chatsListSync';

const MESSAGE_PREVIEW_SELECT =
  'id, room_id, text, message_type, created_at, player_name';
const BLOCKED_CACHE_MS = 30_000;
const LOAD_DEBOUNCE_MS = 400;

export function useChatsRoomsLoader(nickname) {
  const [rows, setRows] = useState([]);
  // in-memory кэш для быстрого восстановления при re-mount без kill
  const rowsCacheRef = useRef({ nickname: null, rows: [] });
  // чтобы realtime-обновление не затёрло последний массив
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Флаг, что диск-кэш уже применён для текущего nickname
  const diskCacheLoadedRef = useRef(false);
  const blockedCacheRef = useRef({ at: 0, set: new Set() });
  const loadDebounceRef = useRef(null);

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

  /** Realtime: только UPDATE своих rooms (last_message_id), не все INSERT в messages */
  useEffect(() => {
    if (!nickname) return;

    const getBlockedCached = async () => {
      const now = Date.now();
      if (now - blockedCacheRef.current.at < BLOCKED_CACHE_MS) {
        return blockedCacheRef.current.set;
      }
      const set = await getBlockedPeers(nickname);
      blockedCacheRef.current = { at: now, set };
      return set;
    };

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

      const blocked = await getBlockedCached();
      const idx = rowsRef.current.findIndex((r) => r.roomId === roomId);
      if (idx === -1) {
        await unhideChatRoom(nickname, roomId);
        scheduleLoad();
        return;
      }
      const row = rowsRef.current[idx];
      if (blocked.has(row.contactName)) return;

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

    const onRoomUpdate = (payload) => {
      const room = payload.new;
      if (!room?.id || !room?.last_message_id) return;
      if (payload.old?.last_message_id === room.last_message_id) return;
      applyLastMessage(room);
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
