import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { sendPushNotification } from '../../lib/sendPushNotification';
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
}) {
  const readSentRef = useRef(new Set());

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

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = await decryptMsg(payload.new);
            if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return;
            if ((msg.hidden_for || []).includes(nickname)) return;
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
                  useNativeDriver: true,
                }),
              ]).start();
            }
            pendingVideoActiveIdMigrationRef.current = null;
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) {
                return filterHiddenForMeKeepingDeleting(filterExpired(prev));
              }
              if (msg.message_type === 'video' && msg.player_name === nickname) {
                const tempId = optimisticVideoTempIdRef.current;
                if (tempId) {
                  optimisticVideoTempIdRef.current = null;
                  pendingVideoActiveIdMigrationRef.current = { from: tempId, to: msg.id };
                  return filterHiddenForMeKeepingDeleting(filterExpired([
                    ...prev.filter((m) => m.id !== tempId),
                    { ...msg, clientRowKey: tempId },
                  ]));
                }
              }
              return filterHiddenForMeKeepingDeleting(filterExpired([...prev, msg]));
            });
            const videoIdMig = pendingVideoActiveIdMigrationRef.current;
            if (videoIdMig) {
              pendingVideoActiveIdMigrationRef.current = null;
              setActiveVideoId((cur) => (cur === videoIdMig.from ? videoIdMig.to : cur));
              if (activatedVideoIds.current.has(videoIdMig.from)) {
                activatedVideoIds.current.delete(videoIdMig.from);
                activatedVideoIds.current.add(videoIdMig.to);
              }
            }

            if (msg.player_name !== nickname) {
              void (async () => {
                const { data: authData } = await supabase.auth.getUser();
                const myId = authData?.user?.id;
                if (!myId) return;

                const { data: room } = await supabase
                  .from('rooms')
                  .select('user1_id, user2_id, player1_name, player2_name')
                  .eq('id', roomId)
                  .maybeSingle();
                if (!room) return;

                const u1 = String(room.user1_id || room.player1_name || '').trim();
                const u2 = String(room.user2_id || room.player2_name || '').trim();
                const me = String(nickname ?? '').trim();
                const peerHandle =
                  u1 === me ? u2 || null : u2 === me ? u1 || null : null;
                if (!peerHandle) return;

                const { data: peerProfile } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('handle', peerHandle)
                  .maybeSingle();
                const peerId = peerProfile?.id;
                if (!peerId || peerId === myId) return;

                const { data: recipientProfile } = await supabase
                  .from('profiles')
                  .select('push_token')
                  .eq('id', peerId)
                  .maybeSingle();
                const pushToken = recipientProfile?.push_token;
                if (!pushToken) return;

                const senderName = String(msg.player_name ?? '').trim();
                const bodyText = String(msg.text ?? '').slice(0, 100);
                await sendPushNotification({
                  to: pushToken,
                  title: senderName || peerHandle,
                  body: bodyText,
                  data: { roomId },
                });
              })();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = await decryptMsg(payload.new);
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === payload.new.id ? updatedMsg : m));
              return filterHiddenForMeKeepingDeleting(filterExpired(next));
            });
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            if (deletingIdsRef.current?.has?.(id)) return;
            setMessages((prev) => prev.filter((m) => m.id !== id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isAriaChat, decryptMsg, nickname, filterHiddenForMeKeepingDeleting, filterExpired]);

  useEffect(() => {
    if (isAriaChat) return;
    const hasEphemeral = messages.some((m) => m.expires_at);
    if (!hasEphemeral) return;
    const timer = setInterval(() => {
      if (renderPausedRef?.current) return;
      setMessages((prev) => {
        const filtered = filterExpired(prev);
        if (filtered.length !== prev.length) {
          const expiredIds = prev
            .filter((m) => m.expires_at && new Date(m.expires_at).getTime() <= Date.now())
            .map((m) => m.id);
          if (expiredIds.length > 0) supabase.from('messages').delete().in('id', expiredIds).then();
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
