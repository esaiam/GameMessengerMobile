import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { supabase } from '../../lib/supabase';
import { fetchPublicKeys } from '../../utils/VaultKeyServer';
import roomMessagesCache from '../../utils/roomMessagesCache';
import {
  mergeMessagesKeepingOptimisticText,
  isOwnTextMessage,
  transferRowAnims,
} from './useChatOptimisticText';
import { isOwnImageMessage, isOwnVoiceMessage } from './useChatOptimisticMedia';
import { invalidateDecryptCache } from './messageDecrypt';
import { invalidatePreviewCache } from '../../screens/chats/chatsPreviewCache';
import {
  markRoomReadThrough,
  clearRoomReadCursor,
} from '../../lib/chatReadCursor';
import {
  mergeMessagesById,
  MESSAGES_PAGE_SIZE,
  MESSAGE_LIST_SELECT,
  serverHiddenForMeIdSet,
} from './chatMessageMerge';

/**
 * Загрузка истории, realtime postgres_changes, очистка эфемерки в БД, read receipts.
 * Состояние messages / messagesLoading остаётся в родителе (нужно для useMessageRowAnimations и рендера).
 */
export default function useChatRoomEffects({
  roomId,
  nickname,
  isAriaChat,
  renderPausedRef,
  diceBusyRef,
  chatFlushDeferredRef,
  diceAnimating,
  showAnimDice,
  listOpacity,
  decryptMsg,
  decryptBatch,
  filterExpired,
  filterHiddenForMeKeepingDeleting,
  fadeAnims,
  scaleAnims,
  optimisticVideoTempIdRef,
  optimisticImageTempIdRef,
  optimisticVoiceTempIdRef,
  optimisticTextTempIdsRef,
  pendingVideoActiveIdMigrationRef,
  activatedVideoIds,
  setActiveVideoId,
  deletingIdsRef,
  messages,
  setMessages,
  setMessagesLoading,
  messagesRef,
  onInitialPageLoaded,
  /** Комната на экране (не просто смонтирована в stack) — иначе read cursor сбрасывается в фоне. */
  roomFocused = false,
  /** ref для отправки broadcast после «удалить у всех» / очистки (когда postgres UPDATE не доходит из‑за RLS) */
  chatSyncRef,
  /** Комната удалена на сервере — уйти с экрана чата */
  onRoomDeleted }) {
  const readSentRef = useRef(new Set());

  /** Realtime INSERT: накапливаем расшифрованные сообщения и сливаем в один setMessages за microtask (меньше ререндеров при пачке событий). */
  const realtimeInsertQueueRef = useRef([]);
  const realtimeFlushScheduledRef = useRef(false);
  const deferredInsertBatchRef = useRef([]);
  const deferredUpdatesRef = useRef(new Map());
  const applyInsertBatchRef = useRef(null);

  const shouldDeferChatUi = () =>
    Boolean(renderPausedRef?.current || diceBusyRef?.current);

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
      listOpacity.value = 0;

      const { data: roomRow } = await supabase
        .from('rooms')
        .select('thread_cleared_at, last_message_id')
        .eq('id', roomId)
        .maybeSingle();

      if (!cancelled && roomRow?.thread_cleared_at && !roomRow?.last_message_id) {
        setMessages([]);
        roomMessagesCache.clear(roomId);
        setMessagesLoading(false);
        listOpacity.value = 1;
        onInitialPageLoaded?.(0);
        return;
      }

      let cached = roomMessagesCache.get(roomId);
      if (!cached || cached.length === 0) {
        cached = await roomMessagesCache.hydrateFromDisk(roomId);
      }
      if (cached && cached.length > 0) {
        setMessages(cached);
        setMessagesLoading(false);
      } else {
        setMessagesLoading(true);
      }

      const { data } = await supabase
        .from('messages')
        .select(MESSAGE_LIST_SELECT)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (cancelled || !data) {
        setMessagesLoading(false);
        listOpacity.value = 1;
        onInitialPageLoaded?.(0);
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

      const serverHiddenForMeIds = serverHiddenForMeIdSet(nickname, chronological);

      const prev = messagesRef.current;
      const mergedWithPrev = mergeMessagesById(prev, filtered).filter(
        (m) => !serverHiddenForMeIds.has(m.id),
      );
      const merged = mergeMessagesKeepingOptimisticText(
        mergedWithPrev,
        prev,
        optimisticTextTempIdsRef?.current ?? [],
      );
      const hasChanged =
        prev.length !== merged.length ||
        merged.some((msg, i) => {
          const prior = prev[i];
          return (
            !prior ||
            prior.id !== msg.id ||
            prior.text !== msg.text ||
            prior.message_type !== msg.message_type ||
            prior.edited_at !== msg.edited_at ||
            prior.read_at !== msg.read_at
          );
        });
      if (hasChanged) {
        setMessages(merged);
      }
      roomMessagesCache.set(roomId, merged);
      setMessagesLoading(false);
      onInitialPageLoaded?.(data.length);

      if (merged.length === 0) {
        listOpacity.value = 1;
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
      setMessagesLoading(false);
    };
  }, [roomId, isAriaChat, filterHiddenForMeKeepingDeleting, decryptBatch, filterExpired, onInitialPageLoaded]);

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
        const replaceImageTempId = isOwnImageMessage(msg, nickname)
          ? optimisticImageTempIdRef?.current
          : null;
        const replaceVoiceTempId = isOwnVoiceMessage(msg, nickname)
          ? optimisticVoiceTempIdRef?.current
          : null;
        const replaceTextTempId =
          isOwnTextMessage(msg, nickname) && optimisticTextTempIdsRef?.current?.[0]
            ? optimisticTextTempIdsRef.current[0]
            : null;
        const replaceTempId =
          replaceVideoTempId || replaceImageTempId || replaceVoiceTempId || replaceTextTempId;
        if (
          replaceTempId &&
          fadeAnims[replaceTempId] != null &&
          scaleAnims[replaceTempId] != null
        ) {
          fadeAnims[msg.id] = fadeAnims[replaceTempId];
          scaleAnims[msg.id] = scaleAnims[replaceTempId];
          delete fadeAnims[replaceTempId];
          delete scaleAnims[replaceTempId];
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
          if (isOwnImageMessage(msg, nickname)) {
            const tempId = optimisticImageTempIdRef?.current;
            if (tempId) {
              optimisticImageTempIdRef.current = null;
              transferRowAnims(tempId, msg.id, fadeAnims, scaleAnims);
              next = filterHiddenForMeKeepingDeleting(
                filterExpired([
                  ...next.filter((m) => m.id !== tempId),
                  { ...msg, clientRowKey: tempId }])
              );
              continue;
            }
          }
          if (isOwnVoiceMessage(msg, nickname)) {
            const tempId = optimisticVoiceTempIdRef?.current;
            if (tempId) {
              optimisticVoiceTempIdRef.current = null;
              transferRowAnims(tempId, msg.id, fadeAnims, scaleAnims);
              next = filterHiddenForMeKeepingDeleting(
                filterExpired([
                  ...next.filter((m) => m.id !== tempId),
                  { ...msg, clientRowKey: tempId }])
              );
              continue;
            }
          }
          if (isOwnTextMessage(msg, nickname) && optimisticTextTempIdsRef?.current?.length) {
            const tempId = optimisticTextTempIdsRef.current.shift();
            if (tempId && next.some((m) => m.id === tempId)) {
              transferRowAnims(tempId, msg.id, fadeAnims, scaleAnims);
              next = filterHiddenForMeKeepingDeleting(
                filterExpired([
                  ...next.filter((m) => m.id !== tempId),
                  { ...msg, clientRowKey: tempId, _isOptimistic: false }])
              );
              continue;
            }
            if (tempId && !next.some((m) => m.id === tempId)) {
              optimisticTextTempIdsRef.current.unshift(tempId);
            }
          }
          next = filterHiddenForMeKeepingDeleting(filterExpired([...next, msg]));
        }
        roomMessagesCache.set(roomId, next);
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

    applyInsertBatchRef.current = applyRealtimeInsertBatch;

    const flushDeferredChat = () => {
      if (deferredInsertBatchRef.current.length > 0) {
        const batch = deferredInsertBatchRef.current.splice(0);
        applyRealtimeInsertBatch(batch);
      }
      if (deferredUpdatesRef.current.size > 0) {
        const updates = new Map(deferredUpdatesRef.current);
        deferredUpdatesRef.current.clear();
        setMessages((prev) => {
          let next = prev;
          for (const [id, updatedMsg] of updates) {
            next = next.map((m) => (m.id === id ? updatedMsg : m));
          }
          const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
          roomMessagesCache.set(roomId, filtered);
          return filtered;
        });
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
          roomMessagesCache.clear(roomId);
          return [];
        });
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const room = payload.new;
          if (room?.thread_cleared_at && !room?.last_message_id) {
            setMessages([]);
            roomMessagesCache.clear(roomId);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => {
          setMessages([]);
          roomMessagesCache.clear(roomId);
          void clearRoomReadCursor(nickname, roomId);
          onRoomDeleted?.();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = await decryptMsg(payload.new);
            if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return;
            // INSERT — всегда новое сообщение; hidden_for только для истории (UPDATE/load)
            if (shouldDeferChatUi()) {
              deferredInsertBatchRef.current.push(msg);
              return;
            }
            realtimeInsertQueueRef.current.push(msg);
            scheduleRealtimeInsertFlush();
          } else if (payload.eventType === 'UPDATE') {
            const id = payload.new?.id ?? payload.old?.id;
            if (id == null) return;
            if (payload.old?.text !== payload.new?.text) {
              invalidateDecryptCache(id);
              invalidatePreviewCache(id);
            }
            const base = messagesRef.current.find((m) => m.id === id) || {};
            const merged = { ...base, ...payload.new, id };
            const updatedMsg = await decryptMsg(merged);
            if (shouldDeferChatUi()) {
              deferredUpdatesRef.current.set(id, updatedMsg);
              return;
            }
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === id ? updatedMsg : m));
              const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
              roomMessagesCache.set(roomId, filtered);
              return filtered;
            });
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            invalidateDecryptCache(id);
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
      applyInsertBatchRef.current = null;
      realtimeFlushScheduledRef.current = false;
      const pending = realtimeInsertQueueRef.current;
      realtimeInsertQueueRef.current = [];
      supabase.removeChannel(channel);
      if (pending.length > 0) {
        applyRealtimeInsertBatch(pending);
      }
      if (deferredInsertBatchRef.current.length > 0 || deferredUpdatesRef.current.size > 0) {
        flushDeferredChat();
      }
    };
  }, [roomId, isAriaChat, decryptMsg, nickname, filterHiddenForMeKeepingDeleting, filterExpired, chatSyncRef, diceBusyRef, renderPausedRef, onRoomDeleted]);

  useEffect(() => {
    if (!chatFlushDeferredRef) return undefined;
    const flush = () => {
      if (deferredInsertBatchRef.current.length > 0 && applyInsertBatchRef.current) {
        const batch = deferredInsertBatchRef.current.splice(0);
        applyInsertBatchRef.current(batch);
      }
      if (deferredUpdatesRef.current.size > 0) {
        const updates = new Map(deferredUpdatesRef.current);
        deferredUpdatesRef.current.clear();
        setMessages((prev) => {
          let next = prev;
          for (const [id, updatedMsg] of updates) {
            next = next.map((m) => (m.id === id ? updatedMsg : m));
          }
          const filtered = filterHiddenForMeKeepingDeleting(filterExpired(next));
          roomMessagesCache.set(roomId, filtered);
          return filtered;
        });
      }
    };
    chatFlushDeferredRef.current = flush;
    return () => {
      chatFlushDeferredRef.current = null;
    };
  }, [chatFlushDeferredRef, roomId, filterHiddenForMeKeepingDeleting, filterExpired, setMessages]);

  useEffect(() => {
    if (isAriaChat) return;
    if (diceAnimating || showAnimDice) return;
    chatFlushDeferredRef?.current?.();
  }, [diceAnimating, showAnimDice, isAriaChat, chatFlushDeferredRef]);

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
    if (!roomFocused || !roomId || !nickname || isAriaChat) return;
    const unread = messages.filter(
      (m) => m.player_name !== nickname && !m.read_at && !readSentRef.current.has(m.id),
    );
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    ids.forEach((id) => readSentRef.current.add(id));
    supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFocused, messages.length, nickname, roomId, isAriaChat]);

  /** Локальный cursor — только пока комната на экране. */
  useEffect(() => {
    if (!roomFocused || !roomId || !nickname || isAriaChat || messages.length === 0) return;
    const latest = messages.reduce((best, m) => {
      if (!best) return m;
      const t = Date.parse(m.created_at || 0);
      const bt = Date.parse(best.created_at || 0);
      return t > bt ? m : best;
    }, null);
    if (!latest?.id) return;
    void markRoomReadThrough(nickname, roomId, latest.id, latest.created_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFocused, messages.length, nickname, roomId, isAriaChat]);
}
