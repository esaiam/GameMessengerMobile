import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  createInitialGameState,
  migrateGameState,
  stripTerminalMetaForDb } from '../utils/gameLogic';
import { safeGoBackToMessengerList } from '../lib/safeGoBack';

export function useGameSession({
  roomId,
  nickname,
  selfPlay,
  opponentName,
  playerNumber,
  setPlayerNumber,
  gameStateRef,
  setGameState,
  setSelectedPoint,
  setHighlightedMoves,
  setDiceAnimating,
  setShowAnimDice,
  setAnimDice,
  setUiDice,
  setSandboxUiDice,
  setSwipeStart,
  setSwipeEnd,
  pendingRollRef,
  navigation,
  setKbVisible }) {
  const [room, setRoom] = useState(null);
  const channelRef = useRef(null);
  const sessionChannelRef = useRef(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const activeSessionIdRef = useRef(activeSessionId);
  const [useLegacyRoomState, setUseLegacyRoomState] = useState(false);
  const [opponentOnline, setOpponentOnline] = useState(() => selfPlay === true);
  const opponentNamePresenceRef = useRef(opponentName);
  const nicknamePresenceRef = useRef(nickname);
  opponentNamePresenceRef.current = opponentName;
  nicknamePresenceRef.current = nickname;

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) return;
      // Room should already exist (created from contact tap), but keep a safety net:
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        Alert.alert('Ошибка', 'Комната не найдена');
        Keyboard.dismiss();
        setKbVisible(false);
        safeGoBackToMessengerList(navigation);
        return;
      }

      setRoom(data);
      const u1 = selfPlay ? nickname : (data.user1_id || data.player1_name);
      const u2 = selfPlay ? nickname : (data.user2_id || data.player2_name);
      if (u1 === nickname) setPlayerNumber(1);
      else if (u2 === nickname) setPlayerNumber(2);

      // Prefer modern sessions; fallback to legacy rooms.game_state if sessions table isn't available yet
      try {
        const { data: sessions, error: sessErr } = await supabase
          .from('game_sessions')
          .select('id, board_state, status, created_at')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (sessErr) throw sessErr;

        let session = sessions?.[0] || null;
        if (!session) {
          const { data: created, error: createErr } = await supabase
            .from('game_sessions')
            .insert({ room_id: roomId, status: 'active', board_state: createInitialGameState() })
            .select('id, board_state')
            .single();
          if (createErr) throw createErr;
          session = created;
        }

        setUseLegacyRoomState(false);
        setActiveSessionId(session.id);
        if (session.board_state) {
          const migrated = migrateGameState(session.board_state);
          setGameState(migrated);
          if (migrated !== session.board_state) {
            supabase.from('game_sessions').update({ board_state: migrated }).eq('id', session.id);
          }
        }
      } catch (e) {
        setUseLegacyRoomState(true);
        setActiveSessionId(null);
        if (data.game_state) {
          const migrated = migrateGameState(data.game_state);
          setGameState(migrated);
          if (migrated !== data.game_state) {
            supabase.from('rooms').update({ game_state: migrated }).eq('id', roomId);
          }
        } else {
          const fresh = createInitialGameState();
          setGameState(fresh);
          supabase.from('rooms').update({ game_state: fresh }).eq('id', roomId);
        }
      }
    };

    loadRoom();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const onRoomPostgresPayload = (payload) => {
      const updated = payload.new;
      setRoom((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });
    };

    const recomputeOpponentPresence = (ch) => {
      const st = typeof ch.presenceState === 'function' ? ch.presenceState() : {};
      const online = new Set();
      Object.entries(st || {}).forEach(([presenceKey, arr]) => {
        if (presenceKey) online.add(presenceKey);
        (arr || []).forEach((p) => {
          if (p?.nickname) online.add(p.nickname);
        });
      });
      const want = String(opponentNamePresenceRef.current || '').trim().toLowerCase();
      if (!want) {
        setOpponentOnline(false);
        return;
      }
      setOpponentOnline([...online].some((n) => String(n).trim().toLowerCase() === want));
    };

    const postgresOn = (ch) =>
      ch.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}` },
        onRoomPostgresPayload
      );

    if (selfPlay) {
      setOpponentOnline(true);
      const channel = postgresOn(supabase.channel(`room-${roomId}`)).subscribe();
      channelRef.current = channel;
      return () => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
    }

    if (!nickname || !opponentName) {
      setOpponentOnline(false);
      const channel = postgresOn(supabase.channel(`room-${roomId}`)).subscribe();
      channelRef.current = channel;
      return () => {
        if (channelRef.current) supabase.removeChannel(channelRef.current);
      };
    }

    const channel = postgresOn(
      supabase.channel(`room-${roomId}`, {
        config: { presence: { key: nickname } } })
    )
      .on('presence', { event: 'sync' }, () => recomputeOpponentPresence(channel))
      .on('presence', { event: 'join' }, () => recomputeOpponentPresence(channel))
      .on('presence', { event: 'leave' }, () => recomputeOpponentPresence(channel))
      .subscribe(async (status, err) => {
        if (__DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          const errDetail =
            err instanceof Error
              ? err.message
              : err && typeof err === 'object'
                ? JSON.stringify(err)
                : String(err || '');
          console.warn('[Vault][room+presence]', `room-${roomId}`, status, errDetail);
        }
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({ nickname: nicknamePresenceRef.current, at: Date.now() });
          } catch (e) {
            if (__DEV__) console.warn('[Vault][presence] track failed:', e?.message || e);
          }
          recomputeOpponentPresence(channel);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, selfPlay, nickname, opponentName]);

  useEffect(() => {
    if (!roomId || useLegacyRoomState) {
      if (sessionChannelRef.current) {
        supabase.removeChannel(sessionChannelRef.current);
        sessionChannelRef.current = null;
      }
      return;
    }

    const sessChannel = supabase
      .channel(`game-sessions-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setActiveSessionId(payload.new.id);
            setDiceAnimating(false);
            setShowAnimDice(false);
            setAnimDice(null);
            pendingRollRef.current = null;
            if (payload.new.board_state) {
              const current = gameStateRef.current;
              const incoming = migrateGameState(payload.new.board_state);
              if (JSON.stringify(incoming) !== JSON.stringify(current)) {
                setGameState(incoming);
                setSelectedPoint(null);
                setHighlightedMoves([]);
              }
            }
            return;
          }
          if (payload.new?.id && payload.new.id !== activeSessionIdRef.current) return;
          if (payload.eventType === 'UPDATE' && payload.new?.board_state) {
            const current = gameStateRef.current;
            const incoming = migrateGameState(payload.new.board_state);
            if (JSON.stringify(incoming) !== JSON.stringify(current)) {
              setGameState(incoming);
              setSelectedPoint(null);
              setHighlightedMoves([]);
            }
          }
        }
      )
      .subscribe();
    sessionChannelRef.current = sessChannel;

    return () => {
      if (sessionChannelRef.current) supabase.removeChannel(sessionChannelRef.current);
    };
  }, [roomId, useLegacyRoomState]);

  const syncGameState = useCallback(
    async (newState) => {
      const toPersist = stripTerminalMetaForDb(newState);
      const { error } = useLegacyRoomState
        ? await supabase.from('rooms').update({ game_state: toPersist }).eq('id', roomId)
        : await supabase.from('game_sessions').update({ board_state: toPersist }).eq('id', activeSessionId);
      if (error && __DEV__) console.warn('Sync error:', error.message);
    },
    [roomId, activeSessionId, useLegacyRoomState]
  );

  const newGame = useCallback(async () => {
    if (!roomId) return;
    try {
      // Reset local dice UI immediately (so old dice don't linger)
      pendingRollRef.current = null;
      setDiceAnimating(false);
      setShowAnimDice(false);
      setAnimDice(null);
      setUiDice(null);
      setSandboxUiDice(null);
      setSwipeStart(null);
      setSwipeEnd(null);
      const fresh = {
        ...createInitialGameState(),
        gameStarted: true,
        turnPhase: 'preroll',
        currentPlayer: 1,
        preStartRolls: { 1: null, 2: null } };
      if (useLegacyRoomState) {
        const { error } = await supabase.from('rooms').update({ game_state: fresh }).eq('id', roomId);
        if (error) {
          Alert.alert('Ошибка', error.message);
          return;
        }
        setGameState(migrateGameState(fresh));
      } else {
        if (activeSessionId) {
          await supabase
            .from('game_sessions')
            .update({ status: 'finished', board_state: null })
            .eq('id', activeSessionId);
        }
        const { data: created, error } = await supabase
          .from('game_sessions')
          .insert({ room_id: roomId, status: 'active', board_state: fresh })
          .select('id, board_state')
          .single();
        if (error) {
          Alert.alert('Ошибка', error.message);
          return;
        }
        setActiveSessionId(created.id);
        setGameState(migrateGameState(created.board_state));
      }
      setSelectedPoint(null);
      setHighlightedMoves([]);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось начать новую игру');
    }
  }, [roomId, activeSessionId, useLegacyRoomState]);

  const leaveRoom = useCallback(() => {
    Keyboard.dismiss();
    setKbVisible(false);
    safeGoBackToMessengerList(navigation);
  }, [navigation]);

  return {
    room,
    playerNumber,
    activeSessionId,
    useLegacyRoomState,
    opponentOnline,
    syncGameState,
    newGame,
    leaveRoom,
    channelRef };
}
