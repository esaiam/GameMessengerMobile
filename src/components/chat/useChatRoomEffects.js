import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { fetchPublicKeys } from '../../utils/VaultKeyServer';
import roomMessagesCache from '../../utils/roomMessagesCache';

/**
 * Загрузка истории, realtime postgres_changes, очистка эфемерки в БД, read receipts.
 * Состояние messages / messagesLoading остаётся в родителе (нужно для useMessageRowAnimations и рендера).
 */
export default function useChatRoomEffects({
  roomId,
  nickname,
  isAriaChat,
  renderPausedRef,
  listOpacity,
  decryptMsg,
  decryptBatch,
  filterExpired,
  filterHiddenForMeKeepingDeleting,
  fadeAnims,
  scaleAnims,
  optimisticVideoTempIdRef,
  pendingVideoActiveIdMigrationRef,
  activatedVideoIds,
  setActiveVideoId,
  deletingIdsRef,
  messages,
  setMessages,
  setMessagesLoading,
  messagesRef,
  /** ref для отправки broadcast после «удалить у всех» / очистки (когда postgres UPDATE не доходит из‑за RLS) */
  chatSyncRef }) {
  const readSentRef = useRef(new Set());

  /** Realtime INSERT: накапливаем расшифрованные сообщения и сливаем в один setMessages за microtask (меньше ререндеров при пачке событий). */
  const realtimeInsertQueueRef = useRef([]);
  const realtimeFlushScheduledRef = useRef(false);

  /** Иначе при смене комнаты без размонтирования Chat старые id остаются в Set и read_at не шлётся. */
  useEffect(() => {
    readSentRef.current.clear();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setMessagesLoading(false);
      return;
    }
    if (isAriaChat) {
      setMessagesLoading(false);
      listOpacity.value = 1;
      return undefined;
    }
    let cancelled = false;
    const loadMessages = async () => {
      const cached = roomMessagesCache.get(roomId);
      if (!cached || cached.length === 0) {
        listOpacity.value = 0;
      }
      if (cached && cached.length > 0) {
        setMessages(cached);
        setMessagesLoading(false);
        listOpacity.value = 1;
      } else {
        setMessagesLoading(true);
      }

      const { data } = await supabase
        .from('messages')
        .select(
          'id, room_id, player_name, text, created_at, read_at, reply_to, reactions, hidden_for, message_type, media_url, latitude, longitude, expires_at, waveform',
        )
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (cancelled || !data) {
        setMessagesLoading(false);
        return;
      }

      const chronological = data.length ? [...data].reverse() : [];

      const uniquePlayers = [...new Set(chronological.map((m) => m.player_name))];
      try {
        await fetchPublicKeys(uniquePlayers);
      } catch {}

      const decrypted = await decryptBatch(chronological);

      if (cancelled) return;

      const filtered = filterHiddenForMeKeepingDeleting(filterExpired(decrypted));

      const prev = messagesRef.current;
      const hasChanged =
        prev.length !== filtered.length ||
        filtered.some((msg, i) => {
          const prior = prev[i];
          return (
            !prior ||
            prior.id !== msg.id ||
            prior.text !== msg.text ||
            prior.message_type !== msg.message_type
          );
        });
      if (hasChanged) {
        setMessages(filtered);
      }
      roomMessagesCache.set(roomId, filtered);
      setMessagesLoading(false);

      if (!cached || cached.length === 0) {
        listOpacity.value = withTiming(1, { duration: 80 });
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
      setMessagesLoading(false);
    };
  }, [roomId, isAriaChat, filterHiddenForMeKeepingDeleting, decryptBatch, filterExpired]);

  useEffect(() => {
    if (!roomId || isAriaChat) return;

    const sortRealtimeInsertBatch = (msgs) =>
      [...msgs].sort((a, b) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
      });

    /** Применить уже расшифрованные INSERT из одной микропачки (один setMessages). */
    const applyRealtimeInsertBatch = (batch) => {
      if (batch.length === 0) return;
      const sorted = sortRealtimeInsertBatch(batch);
      pendingVideoActiveIdMigrationRef.current = null;

      for (const msg of sorted) {
        const replaceVideoTempId =
          msg.message_type === 'video' && msg.player_name === nickname
            ? optimisticVideoTempIdRef.current
            : null;
        if (
          replaceVideoTempId &&
          fadeAnims[replaceVideoTempId] != null &&
          scaleAnims[replaceVideoTempId] != null
        ) {
          fadeAnims[msg.id] = fadeAnims[replaceVideoTempId];
          scaleAnims[msg.id] = scaleAnims[replaceVideoTempId];
          delete fadeAnims[replaceVideoTempId];
          delete scaleAnims[replaceVideoTempId];
        } else {
          fadeAnims[msg.id] = new Animated.Value(0);
          scaleAnims[msg.id] = new Animated.Value(0.85);
          Animated.parallel([
            Animated.timing(fadeAnims[msg.id], { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.spring(scaleAnims[msg.id], {
              toValue: 1,
              friction: 8,
              tension: 120,
              useNativeDriver: true })]).start();
        }
      }

      const migrations = [];

      setMessages((prev) => {
        let next = prev;
        for (const msg of sorted) {
          if (next.some((m) => m.id === msg.id)) {
            next = filterHiddenForMeKeepingDeleting(filterExpired(next));
            continue;
          }
          if (msg.message_type === 'video' && msg.player_name === nickname) {
            const tempId = optimisticVideoTempIdRef.current;
            if (tempId) {
              optimisticVideoTempIdRef.current = null;
              migrations.push({ from: tempId, to: msg.id });
              next = filterHiddenForMeKeepingDeleting(
                filterExpired([
                  ...next.filter((m) => m.id !== tempId),
                  { ...msg, clientRowKey: tempId }])
              );
              continue;
            }
          }
          next = filterHiddenForMeKeepingDeleting(filterExpired([...next, msg]));
        }
        return next;
      });

      const seenMigrationTo = new Set();
      for (const videoIdMig of migrations) {
        if (seenMigrationTo.has(videoIdMig.to)) continue;
        seenMigrationTo.add(videoIdMig.to);
        setActiveVideoId((cur) => (cur === videoIdMig.from ? videoIdMig.to : cur));
        if (activatedVideoIds.current.has(videoIdMig.from)) {
          activatedVideoIds.current.delete(videoIdMig.from);
          activatedVideoIds.current.add(videoIdMig.to);
        }
      }

    };

    const flushRealtimeInsertQueue = () => {
      realtimeFlushScheduledRef.current = false;
      const raw = realtimeInsertQueueRef.current;
      realtimeInsertQueueRef.current = [];
      applyRealtimeInsertBatch(raw);
    };

    const scheduleRealtimeInsertFlush = () => {
      if (realtimeFlushScheduledRef.current) return;
      realtimeFlushScheduledRef.current = true;
      queueMicrotask(flushRealtimeInsertQueue);
    };

    const syncRef = chatSyncRef;
    if (syncRef) syncRef.current = null;

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('broadcast', { event: 'vault_msg_hide' }, ({ payload }) => {
        const id = payload?.id;
        if (id == null) return;
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== id);
          const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
          roomMessagesCache.set(roomId, filtered);
          return filtered;
        });
      })
      .on('broadcast', { event: 'vault_thread_clear' }, () => {
        setMessages(() => {
          roomMessagesCache.set(roomId, []);
          return [];
        });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = await decryptMsg(payload.new);
            if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return;
            if ((msg.hidden_for || []).includes(nickname)) return;
            realtimeInsertQueueRef.current.push(msg);
            scheduleRealtimeInsertFlush();
          } else if (payload.eventType === 'UPDATE') {
            const id = payload.new?.id ?? payload.old?.id;
            if (id == null) return;
            const base = messagesRef.current.find((m) => m.id === id) || {};
            const merged = { ...base, ...payload.new, id };
            const updatedMsg = await decryptMsg(merged);
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === id ? updatedMsg : m));
              const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
              roomMessagesCache.set(roomId, filtered);
              return filtered;
            });
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            if (deletingIdsRef.current?.has?.(id)) return;
            setMessages((prev) => {
              const next = prev.filter((m) => m.id !== id);
              const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
              roomMessagesCache.set(roomId, filtered);
              return filtered;
            });
          }
        },
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' || !syncRef) return;
        syncRef.current = {
          hideMessage: (messageId) =>
            channel.send({
              type: 'broadcast',
              event: 'vault_msg_hide',
              payload: { id: messageId } }),
          clearThread: () =>
            channel.send({
              type: 'broadcast',
              event: 'vault_thread_clear',
              payload: {} }) };
      });

    return () => {
      if (syncRef) syncRef.current = null;
      realtimeFlushScheduledRef.current = false;
      const pending = realtimeInsertQueueRef.current;
      realtimeInsertQueueRef.current = [];
      supabase.removeChannel(channel);
      if (pending.length > 0) {
        applyRealtimeInsertBatch(pending);
      }
    };
  }, [roomId, isAriaChat, decryptMsg, nickname, filterHiddenForMeKeepingDeleting, filterExpired, chatSyncRef]);

  useEffect(() => {
    if (isAriaChat) return;
    const hasEphemeral = messages.some((m) => m.expires_at);
    if (!hasEphemeral) return;
    const timer = setInterval(() => {
      if (renderPausedRef?.current) return;
      setMessages((prev) => {
        const filtered = filterExpired(prev);
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [messages.length, isAriaChat]);

  useEffect(() => {
    if (!roomId || !nickname || isAriaChat) return;
    const unread = messages.filter(
      (m) => m.player_name !== nickname && !m.read_at && !readSentRef.current.has(m.id),
    );
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    ids.forEach((id) => readSentRef.current.add(id));
    supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, nickname, roomId, isAriaChat]);
}
