import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Keyboard,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeBlurView from '../components/SafeBlurView';
import { Phone } from '../icons/lucideIcons';
import { supabase } from '../lib/supabase';
import BackgammonBoard from '../components/BackgammonBoard';
import { DieFace } from '../components/Dice';
import DiceThrow3D from '../components/DiceThrow3D';
import SwipeBoardHint from '../components/SwipeBoardHint';
import Chat from '../components/Chat';
import { ICON_SELECTION_ACTION } from '../components/ChatRoomHeader';
import { V, boardPalette } from '../theme';
import {
  createInitialGameState,
  migrateGameState,
  stripTerminalMetaForDb,
  rollDice,
  diceToMoves,
  getAllValidMoves,
  applyMove,
  applyMoveSequence,
  shouldAutoEndTurn,
  getMoveOptionsForSelection,
} from '../utils/gameLogic';
import { playDiceRollSound, preloadDiceSound, unloadDiceSound } from '../utils/diceSound';
const NICKNAME_KEY = '@backgammon_nickname';
const SWIPE_HINT_KEY = '@backgammon_swipe_hint_seen';
/** Полоса игрового статуса между frosted-шапкой чата и доской (телефон) */
const GAME_STATUS_STRIP_H = 24;
/** Как у ChatRoomHeader.js — frosted шапка чата */
const HANDLE_BLUR_INTENSITY_IOS = 78;
const HANDLE_BLUR_INTENSITY_ANDROID = 56;
const HANDLE_FROST_TINT_OPACITY = 0.28;

export default function GameScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const isTablet = windowW >= 768;
  const isWideTablet = isTablet && windowW > windowH;

  const roomId = route.params?.roomId;
  const initialPlayerNumber = route.params?.playerNumber;
  const selfPlay = route.params?.selfPlay === true;
  const [nickname, setNickname] = useState(route.params?.nickname || '');

  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(createInitialGameState());
  const [playerNumber, setPlayerNumber] = useState(initialPlayerNumber);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [highlightedMoves, setHighlightedMoves] = useState([]);
  const channelRef = useRef(null);
  const sessionChannelRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [useLegacyRoomState, setUseLegacyRoomState] = useState(false);

  const [diceAnimating, setDiceAnimating] = useState(false);
  const [showAnimDice, setShowAnimDice] = useState(false);
  const [animDice, setAnimDice] = useState(null);
  const [uiDice, setUiDice] = useState(null);

  const [boardMode, setBoardMode] = useState('match'); // 'match' | 'sandbox' (auto-driven)
  const [sandboxState, setSandboxState] = useState(createInitialGameState());
  const [sandboxUiDice, setSandboxUiDice] = useState(null);
  const [opponentOnline, setOpponentOnline] = useState(selfPlay ? true : false);

  const opponentName = useMemo(() => {
    if (selfPlay) return nickname;
    if (!room || !nickname) return null;
    const u1 = room?.user1_id || room?.player1_name || null;
    const u2 = room?.user2_id || room?.player2_name || null;
    if (!u1 && !u2) return null;
    if (u1 === nickname) return u2;
    if (u2 === nickname) return u1;
    // fallback: if nickname isn't on the room record yet, pick "other" heuristically
    return u2 || u1;
  }, [room, nickname, selfPlay]);
  const [swipeStart, setSwipeStart] = useState(null);
  const [swipeEnd, setSwipeEnd] = useState(null);
  const [throwKey, setThrowKey] = useState(0);
  const pendingRollRef = useRef(null);
  const lastLocalRealRollRef = useRef(null); // { dice: number[], at: number }
  const prevNetDiceRef = useRef(null); // number[] | null
  const prevNetRollEventIdRef = useRef(null); // string | null
  const lastLocalRollEventIdRef = useRef(null); // string | null
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const isMyTurn = gameState.currentPlayer === playerNumber;
  const gameStarted = gameState.gameStarted === true;
  const roomStatus = room?.status || 'playing';
  // Pre-start roll: each player rolls ONE die in turn to decide who starts
  const isPreStart = gameStarted && gameState.turnPhase === 'preroll';
  const effectiveGameState = boardMode === 'sandbox' ? sandboxState : gameState;

  const diceEqual = useCallback((a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }, []);

  // Remote roll animation: prefer explicit roll event from synced state
  useEffect(() => {
    if (boardMode !== 'match') return;
    if (!gameStarted) return;
    if (diceAnimating || showAnimDice) return;

    const evt = gameState?.lastRollEvent || null;
    const evtId = typeof evt?.id === 'string' ? evt.id : null;
    if (!evtId) return;
    if (prevNetRollEventIdRef.current === evtId) return;
    prevNetRollEventIdRef.current = evtId;

    // Don't replay our own event (or the echo of it)
    if (evt?.by === playerNumber) return;
    if (lastLocalRollEventIdRef.current && lastLocalRollEventIdRef.current === evtId) return;

    const evtDice = Array.isArray(evt?.dice) ? evt.dice : [];
    if (evtDice.length !== 2) return;

    const now = Date.now();
    const at = typeof evt?.at === 'number' ? evt.at : now;
    const target = at + 50; // smaller cushion: feel more "instant"
    const delay = Math.max(0, Math.min(110, target - now));

    const startPos =
      evt?.startPos && typeof evt.startPos.x === 'number' && typeof evt.startPos.y === 'number'
        ? evt.startPos
        : { x: 42, y: pointH * 1.25 };
    const endPos =
      evt?.endPos && typeof evt.endPos.x === 'number' && typeof evt.endPos.y === 'number'
        ? evt.endPos
        : { x: (windowW || Dimensions.get('window').width) - 42, y: pointH * 0.75 };

    const t = setTimeout(() => {
      // Re-check state at fire time (avoid racing with local animations)
      if (boardMode !== 'match') return;
      if (diceAnimating || showAnimDice) return;

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      playDiceRollSound();

      pendingRollRef.current = null;
      setAnimDice(evtDice);
      setSwipeStart(startPos);
      setSwipeEnd(endPos);
      setShowAnimDice(true);
      setDiceAnimating(true);
      setThrowKey((k) => k + 1);
    }, delay);

    return () => clearTimeout(t);
  }, [
    boardMode,
    gameStarted,
    gameState?.lastRollEvent,
    diceAnimating,
    showAnimDice,
    playerNumber,
    pointH,
  ]);

  // Fallback: when synced state receives new dice (legacy), replay 3D throw locally
  useEffect(() => {
    if (boardMode !== 'match') return;
    if (!gameStarted) return;
    if (diceAnimating || showAnimDice) return;

    const nextDice = Array.isArray(gameState.dice) ? gameState.dice : [];
    const prevDice = Array.isArray(prevNetDiceRef.current) ? prevNetDiceRef.current : [];

    prevNetDiceRef.current = nextDice;

    // Only animate real rolls (two dice) that appeared/changed
    if (!(nextDice.length === 2)) return;
    if (diceEqual(prevDice, nextDice)) return;

    // If we have an explicit roll event in state that matches these dice,
    // do NOT double-animate via the legacy dice watcher.
    const evt = gameState?.lastRollEvent || null;
    const evtDice = Array.isArray(evt?.dice) ? evt.dice : [];
    if (evtDice.length === 2 && diceEqual(evtDice, nextDice)) return;

    // If this is our own roll just synced back, don't double-animate
    const lastLocal = lastLocalRealRollRef.current;
    if (lastLocal?.dice && diceEqual(lastLocal.dice, nextDice) && Date.now() - (lastLocal.at || 0) < 4000) {
      return;
    }

    // Opponent roll animation (fixed throw vector so it looks like a throw)
    pendingRollRef.current = null;
    setAnimDice(nextDice);
    setSwipeStart({ x: 42, y: pointH * 1.25 });
    setSwipeEnd({ x: (windowW || Dimensions.get('window').width) - 42, y: pointH * 0.75 });
    setShowAnimDice(true);
    setDiceAnimating(true);
    setThrowKey((k) => k + 1);
  }, [boardMode, gameStarted, gameState.dice, diceAnimating, showAnimDice, diceEqual, pointH, windowW]);

  // Presence: auto-enter sandbox when opponent is offline
  useEffect(() => {
    if (selfPlay) {
      setOpponentOnline(true);
      return;
    }
    if (!roomId || !nickname) return;

    const ch = supabase.channel(`presence-room-${roomId}`, {
      config: { presence: { key: nickname } },
    });

    const recompute = () => {
      const st = ch.presenceState?.() || {};
      const online = new Set();
      Object.values(st).forEach((arr) => {
        (arr || []).forEach((p) => {
          if (p?.nickname) online.add(p.nickname);
        });
      });
      if (!opponentName) {
        setOpponentOnline(false);
        return;
      }
      setOpponentOnline(online.has(opponentName));
    };

    ch.on('presence', { event: 'sync' }, recompute);
    ch.on('presence', { event: 'join' }, recompute);
    ch.on('presence', { event: 'leave' }, recompute);

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ nickname, at: Date.now() });
        } catch {}
        recompute();
      }
    });

    presenceChannelRef.current = ch;
    return () => {
      try {
        if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
      } finally {
        presenceChannelRef.current = null;
      }
    };
  }, [roomId, nickname, selfPlay, opponentName]);

  useEffect(() => {
    if (!selfPlay) return;
    if (gameState.currentPlayer === 1 || gameState.currentPlayer === 2) {
      setPlayerNumber(gameState.currentPlayer);
    }
  }, [selfPlay, gameState.currentPlayer]);

  const HANDLE_H = 28;
  const DEFAULT_PH = 130;
  const MIN_PH = 50;
  const BOARD_CHROME = 32;
  /** Высота frosted ChatRoomHeader внутри Chat (как ChatRoomScreen) */
  const [frostedHeaderH, setFrostedHeaderH] = useState(0);
  const boardColRef = useRef(null);
  const [availableH, setAvailableH] = useState(0);
  const pointH = availableH > 0
    ? Math.max(MIN_PH, Math.floor((availableH - BOARD_CHROME) / 2))
    : DEFAULT_PH;

  const [swipeHintLoaded, setSwipeHintLoaded] = useState(false);
  const [swipeHintSeen, setSwipeHintSeen] = useState(true);

  const renderPausedRef = useRef(false);
  const boardRef = useRef(null);
  const boardMountedRef = useRef(false);
  const [boardMounted, setBoardMounted] = useState(false);
  const maxSlideRef = useRef(600);
  const boardColTopYRef = useRef(null);
  const chatInputTopYRef = useRef(null);
  const boardOpenRef = useRef(false);

  const handleStretchAnim = useRef(new Animated.Value(0)).current;
  const handleWidthAnim = useRef(new Animated.Value(0)).current;
  const boardDropAnim = useRef(new Animated.Value(0)).current;
  const middlePulseAnim = useRef(new Animated.Value(0)).current;
  const boardDropStartRef = useRef(0);

  const DRAG_MAX_EXTRA_H = HANDLE_H;
  const MIN_DRAG_THRESHOLD = 20;
  const HANDLE_NARROW_RATIO = 0.6;

  const computeMaxSlide = useCallback(() => {
    const bY = boardColTopYRef.current;
    const iY = chatInputTopYRef.current;
    if (typeof bY === 'number' && typeof iY === 'number') {
      const avail = Math.max(200, iY - bY - HANDLE_H - 8);
      maxSlideRef.current = avail;
      setAvailableH(avail);
    } else {
      maxSlideRef.current = 600;
    }
  }, []);

  const runOpenSequence = useCallback(() => {
    if (!boardMountedRef.current) {
      boardMountedRef.current = true;
      setBoardMounted(true);
    }
    boardOpenRef.current = true;
    middlePulseAnim.setValue(0);

    Animated.timing(handleStretchAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.timing(handleWidthAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      const maxH = maxSlideRef.current;
      Animated.timing(boardDropAnim, {
        toValue: maxH,
        duration: 380,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        Animated.sequence([
          Animated.timing(boardDropAnim, {
            toValue: maxH - 18,
            duration: 100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(boardDropAnim, {
            toValue: maxH,
            duration: 100,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(boardDropAnim, {
            toValue: maxH - 5,
            duration: 60,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(boardDropAnim, {
            toValue: maxH,
            duration: 60,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }),
        ]).start();
      });
    });
  }, [handleStretchAnim, handleWidthAnim, boardDropAnim, middlePulseAnim]);

  const runCloseSequence = useCallback(() => {
    boardOpenRef.current = false;
    handleStretchAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    boardDropAnim.stopAnimation();
    middlePulseAnim.stopAnimation();
    handleStretchAnim.setValue(0);
    middlePulseAnim.setValue(0);

    const afterBoardCollapsed = () => {
      Animated.timing(handleWidthAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        renderPausedRef.current = false;
      });
    };

    const collapseBoardHeightOnly = () => {
      Animated.timing(boardDropAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }).start(afterBoardCollapsed);
    };

    handleWidthAnim.stopAnimation((w) => {
      const curW = typeof w === 'number' ? w : 0;
      if (curW >= 0.99) {
        collapseBoardHeightOnly();
      } else {
        Animated.timing(handleWidthAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(collapseBoardHeightOnly);
      }
    });
  }, [handleStretchAnim, handleWidthAnim, boardDropAnim, middlePulseAnim]);

  const openRef = useRef(runOpenSequence);
  const closeRef = useRef(runCloseSequence);
  useEffect(() => { openRef.current = runOpenSequence; }, [runOpenSequence]);
  useEffect(() => { closeRef.current = runCloseSequence; }, [runCloseSequence]);

  const slidePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        handleStretchAnim.stopAnimation();
        handleWidthAnim.stopAnimation();
        middlePulseAnim.stopAnimation();
        if (boardOpenRef.current) {
          boardDropAnim.stopAnimation((v) => { boardDropStartRef.current = v; });
        }
      },
      onPanResponderMove: (_, gs) => {
        if (boardOpenRef.current) {
          const maxH = maxSlideRef.current;
          const next = Math.max(0, Math.min(maxH, boardDropStartRef.current + gs.dy));
          boardDropAnim.setValue(next);
          return;
        }
        const dy = Math.max(0, gs.dy);
        const t = Math.min(1, dy / 120);
        handleStretchAnim.setValue(t);
      },
      onPanResponderRelease: (_, gs) => {
        if (boardOpenRef.current) {
          const maxH = maxSlideRef.current;
          const cur = Math.max(0, Math.min(maxH, boardDropStartRef.current + gs.dy));
          const vy = gs.vy;
          if (vy < -0.5 || cur < maxH * 0.4) {
            closeRef.current();
          } else {
            Animated.timing(boardDropAnim, {
              toValue: maxH,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start();
          }
          return;
        }
        const dy = Math.max(0, gs.dy);
        if (dy > MIN_DRAG_THRESHOLD) {
          openRef.current();
        } else {
          Animated.timing(handleStretchAnim, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!boardOpenRef.current) {
          Animated.timing(handleStretchAnim, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const [kbVisible, setKbVisible] = useState(false);
  const [kbTransitioning, setKbTransitioning] = useState(false);

  useEffect(() => {
    if (route.params?.nickname && route.params.nickname !== nickname) {
      setNickname(route.params.nickname);
      return;
    }
    if (!route.params?.nickname && !nickname) {
      AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [route.params?.nickname, nickname]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const mark = (vis) => {
      setKbTransitioning(true);
      setKbVisible(vis);
      setTimeout(() => setKbTransitioning(false), 420);
    };
    const sub1 = Keyboard.addListener(showEvt, () => mark(true));
    const sub2 = Keyboard.addListener(hideEvt, () => mark(false));
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  useEffect(() => {
    if (kbVisible) return;
    chatInputTopYRef.current = null;
    setTimeout(() => computeMaxSlide(), 0);
  }, [kbVisible, computeMaxSlide]);

  /** После измерения шапки чата пересчитать зону свайпа доски */
  useEffect(() => {
    const t = setTimeout(() => computeMaxSlide(), 0);
    return () => clearTimeout(t);
  }, [frostedHeaderH, computeMaxSlide]);

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions?.({ tabBarStyle: { display: 'none' } });
      return () => {
        Keyboard.dismiss();
        setKbVisible(false);
        parent?.setOptions?.({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  useEffect(() => {
    preloadDiceSound();
    return () => { unloadDiceSound(); };
  }, []);

  useEffect(() => {
    if (!diceAnimating) return;
    const t = setTimeout(() => {
      setDiceAnimating(false);
      setShowAnimDice(false);
      setAnimDice(null);
    }, 8000);
    return () => clearTimeout(t);
  }, [diceAnimating]);

  const leaveRoom = useCallback(() => {
    Keyboard.dismiss();
    setKbVisible(false);
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    AsyncStorage.getItem(SWIPE_HINT_KEY).then((v) => {
      setSwipeHintSeen(v === '1');
      setSwipeHintLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (gameStarted) {
      setSwipeHintSeen(true);
      AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
    }
  }, [gameStarted]);

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
        navigation.goBack();
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

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new;
          setRoom(updated);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Subscribe to sessions only when modern mode is active
    let sessChannel = null;
    if (!useLegacyRoomState) {
      sessChannel = supabase
        .channel(`game-sessions-${roomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setActiveSessionId(payload.new.id);
              if (payload.new.board_state) {
                setGameState(migrateGameState(payload.new.board_state));
                setSelectedPoint(null);
                setHighlightedMoves([]);
              }
              return;
            }
            if (payload.new?.id && payload.new.id !== activeSessionId) return;
            if (payload.eventType === 'UPDATE' && payload.new?.board_state) {
              setGameState(migrateGameState(payload.new.board_state));
              setSelectedPoint(null);
              setHighlightedMoves([]);
            }
          }
        )
        .subscribe();
      sessionChannelRef.current = sessChannel;
    }

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (sessionChannelRef.current) supabase.removeChannel(sessionChannelRef.current);
    };
  }, [roomId, activeSessionId, useLegacyRoomState]);

  const syncGameState = useCallback(
    async (newState) => {
      const toPersist = stripTerminalMetaForDb(newState);
      const { error } = useLegacyRoomState
        ? await supabase.from('rooms').update({ game_state: toPersist }).eq('id', roomId)
        : await supabase.from('game_sessions').update({ board_state: toPersist }).eq('id', activeSessionId);
      if (error) console.warn('Sync error:', error.message);
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
        preStartRolls: { 1: null, 2: null },
      };
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

  const setMode = useCallback((nextMode) => {
    setBoardMode(nextMode);
    // Drop any in-flight dice anim when switching modes
    pendingRollRef.current = null;
    setDiceAnimating(false);
    setShowAnimDice(false);
    setAnimDice(null);
    setSwipeStart(null);
    setSwipeEnd(null);
    if (nextMode === 'sandbox') {
      setSandboxState(createInitialGameState());
      setSandboxUiDice(null);
    }
  }, []);

  useEffect(() => {
    if (selfPlay) return;
    if (opponentOnline) setMode('match');
    else setMode('sandbox');
  }, [opponentOnline, setMode, selfPlay]);

  const handleDiceAnimComplete = useCallback(async () => {
    const pendingDice = pendingRollRef.current;
    if (pendingDice) {
      pendingRollRef.current = null;
      const gs = gameStateRef.current;
      if (gs.turnPhase === 'preroll') {
        const die = pendingDice?.[0];
        if (!die) {
          setShowAnimDice(false);
          setDiceAnimating(false);
          return;
        }

        const nextRolls = { ...(gs.preStartRolls || { 1: null, 2: null }), [gs.currentPlayer]: die };
        const p1 = nextRolls[1];
        const p2 = nextRolls[2];

        let newState = {
          ...gs,
          preStartRolls: nextRolls,
          dice: [],
          remainingMoves: [],
          headMovesThisTurn: 0,
        };

        // Show pre-start dice in UI (both dice values when available)
        setUiDice([p1, p2]);

        if (p1 == null || p2 == null) {
          // other player rolls next
          newState.currentPlayer = gs.currentPlayer === 1 ? 2 : 1;
          newState.turnPhase = 'preroll';
          setGameState(newState);
          await syncGameState(newState);
          setShowAnimDice(false);
          setDiceAnimating(false);
          return;
        }

        if (p1 === p2) {
          // tie -> reroll
          newState = {
            ...newState,
            preStartRolls: { 1: null, 2: null },
            currentPlayer: 1,
            turnPhase: 'preroll',
          };
          setGameState(newState);
          await syncGameState(newState);
          setShowAnimDice(false);
          setDiceAnimating(false);
          return;
        }

        const starter = p1 > p2 ? 1 : 2;
        newState = {
          ...newState,
          currentPlayer: starter,
          turnPhase: 'roll',
        };
        setGameState(newState);
        await syncGameState(newState);
        setShowAnimDice(false);
        setDiceAnimating(false);
        return;
      }

      // Normal roll (two dice) -> enters move phase
      setUiDice(pendingDice);
      const moves = diceToMoves(pendingDice);
      const newState = {
        ...gs,
        currentPlayer: gs.currentPlayer,
        dice: pendingDice,
        remainingMoves: moves,
        turnPhase: 'move',
        // gameStarted is controlled only by "New game" button
        headMovesThisTurn: 0,
      };

      if (getAllValidMoves(newState).length === 0) {
        const opponent = playerNumber === 1 ? 2 : 1;
        const autoEndState = {
          ...newState,
          currentPlayer: opponent,
          dice: [],
          remainingMoves: [],
          turnPhase: 'roll',
          headMovesThisTurn: 0,
          isFirstMove: { ...(newState.isFirstMove || { 1: true, 2: true }), [playerNumber]: false },
        };
        setGameState(autoEndState);
        await syncGameState(autoEndState);
        setShowAnimDice(false);
        setDiceAnimating(false);
        Alert.alert('Нет ходов', 'У тебя нет доступных ходов. Ход переходит сопернику.');
        return;
      }

      setGameState(newState);
      await syncGameState(newState);
      setShowAnimDice(false);
      setDiceAnimating(false);
    } else {
      setDiceAnimating(false);
      setTimeout(() => {
        setShowAnimDice(false);
        setAnimDice(null);
      }, 1200);
    }
  }, [playerNumber, syncGameState]);

  const handleBoardSwipe = useCallback(
    (swipe) => {
      if (diceAnimating || showAnimDice) return;

      const inSandbox = boardMode === 'sandbox';

      // Anti-stress rolls before starting the game: allow only one player to avoid state racing
      if (!inSandbox && !gameStarted && playerNumber !== 1) {
        Alert.alert('Недоступно', 'До начала игры «просто так» может кидать только игрок 1.');
        return;
      }

      const isRealRoll =
        !inSandbox &&
        gameStarted &&
        (isMyTurn || isPreStart) &&
        (gameState.turnPhase === 'roll' || gameState.turnPhase === 'preroll') &&
        roomStatus === 'playing';
      const isAntiStress = inSandbox || (!isRealRoll && !(isMyTurn && gameState.turnPhase === 'move'));

      if (!isRealRoll && !isAntiStress) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playDiceRollSound();

      const dice = gameState.turnPhase === 'preroll' ? [rollDice()[0], rollDice()[0]] : rollDice();
      setAnimDice(dice);
      if (inSandbox) setSandboxUiDice(dice);
      else setUiDice(dice);
      setSwipeStart({ x: swipe.startX, y: swipe.startY });
      setSwipeEnd({ x: swipe.endX, y: swipe.endY });
      setShowAnimDice(true);
      setDiceAnimating(true);
      setThrowKey((k) => k + 1);

      if (isRealRoll) {
        const at = Date.now();
        lastLocalRealRollRef.current = { dice, at };

        // Broadcast a roll event so both clients can start the throw animation from the same "event"
        const rollEvent = {
          id: `${at}-${playerNumber}-${Math.random().toString(16).slice(2)}`,
          by: playerNumber,
          at,
          dice,
          startPos: { x: swipe.startX, y: swipe.startY },
          endPos: { x: swipe.endX, y: swipe.endY },
          phase: gameState.turnPhase,
        };
        lastLocalRollEventIdRef.current = rollEvent.id;

        // Update local state immediately (so subsequent syncs keep the field)
        setGameState((prev) => ({ ...(prev || {}), lastRollEvent: rollEvent }));

        // Sync immediately (fire-and-forget): only adds metadata, doesn't change game rules
        try {
          syncGameState({ ...gameStateRef.current, lastRollEvent: rollEvent });
        } catch {}
      }
      pendingRollRef.current = isRealRoll ? dice : null;
    },
    [diceAnimating, showAnimDice, isMyTurn, isPreStart, gameState, roomStatus, gameStarted, boardMode, playerNumber, syncGameState]
  );

  const handleRollDice = useCallback(() => {
    if (diceAnimating) return;
    // Before the game starts: allow only player 1 (anti-stress roll), sandbox stays local
    if (!gameStarted && !(boardMode === 'match' && playerNumber === 1)) return;
    if (!(isMyTurn || isPreStart)) return;
    if (!(gameState.turnPhase === 'roll' || gameState.turnPhase === 'preroll')) return;
    const bw = windowW || Dimensions.get('window').width;
    const bh = pointH * 2;
    handleBoardSwipe({
      startX: bw * 0.3,
      startY: bh * 0.5,
      endX: bw * 0.6,
      endY: bh * 0.5,
    });
  }, [diceAnimating, isMyTurn, isPreStart, gameState, pointH, handleBoardSwipe, gameStarted, boardMode, playerNumber]);

  const handlePointPress = useCallback(
    (index) => {
      if (boardMode !== 'match') return;
      if (!isMyTurn || gameState.turnPhase !== 'move') return;

      if (selectedPoint !== null) {
        const matching = highlightedMoves.filter((m) => m.to === index);
        if (matching.length >= 1) {
          const matchingMove =
            matching.find((m) => m?.kind === 'combo' && Array.isArray(m.sequence)) || matching[0];

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newState =
            matchingMove?.kind === 'combo' && Array.isArray(matchingMove.sequence)
              ? applyMoveSequence(gameState, matchingMove.sequence)
              : applyMove(gameState, matchingMove);
          setGameState(newState);
          syncGameState(newState);
          setSelectedPoint(null);
          setHighlightedMoves([]);

          if (newState.gameOver) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const marsText = newState.mars ? '\nМарс! Счёт ×2' : '';
            Alert.alert('Победа!', `${newState.winner === playerNumber ? 'Ты' : 'Соперник'} победил!${marsText}`);
          }
          return;
        }
      }

      const val = gameState.board[index];
      const isOwn = (playerNumber === 1 && val > 0) || (playerNumber === 2 && val < 0);

      if (isOwn && (!gameState.bar || gameState.bar[playerNumber] === 0)) {
        setSelectedPoint(index);
        const opts = getMoveOptionsForSelection(gameState, index);
        setHighlightedMoves(opts);
      } else {
        setSelectedPoint(null);
        setHighlightedMoves([]);
      }
    },
    [isMyTurn, gameState, selectedPoint, highlightedMoves, playerNumber, syncGameState]
  );

  const handleBarPress = useCallback(
    (barPlayer) => {
      if (boardMode !== 'match') return;
      if (!isMyTurn || gameState.turnPhase !== 'move') return;
      if (barPlayer !== playerNumber || gameState.bar[playerNumber] <= 0) return;
      setSelectedPoint('bar');
      setHighlightedMoves(getMoveOptionsForSelection(gameState, 'bar'));
    },
    [isMyTurn, gameState, playerNumber, boardMode]
  );

  const handleBearOffPress = useCallback(
    () => {
      if (boardMode !== 'match') return;
      if (!isMyTurn || gameState.turnPhase !== 'move' || selectedPoint === null) return;
      const matching = highlightedMoves.filter((m) => m.to === 'off');
      if (matching.length >= 1) {
        const matchingMove =
          matching.find((m) => m?.kind === 'combo' && Array.isArray(m.sequence)) || matching[0];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newState =
          matchingMove?.kind === 'combo' && Array.isArray(matchingMove.sequence)
            ? applyMoveSequence(gameState, matchingMove.sequence)
            : applyMove(gameState, matchingMove);
        setGameState(newState);
        syncGameState(newState);
        setSelectedPoint(null);
        setHighlightedMoves([]);
        if (newState.gameOver) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const marsText = newState.mars ? '\nМарс! Счёт ×2' : '';
          Alert.alert('Победа!', `${newState.winner === playerNumber ? 'Ты' : 'Соперник'} победил!${marsText}`);
        }
      }
    },
    [isMyTurn, gameState, selectedPoint, highlightedMoves, playerNumber, syncGameState]
  );

  const handleSwipeHintComplete = useCallback(() => {
    setSwipeHintSeen(true);
    AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
  }, []);

  const handleEndTurn = useCallback(async () => {
    if (boardMode !== 'match') return;
    const opponent = playerNumber === 1 ? 2 : 1;
    const newState = {
      ...gameState,
      currentPlayer: opponent,
      dice: [],
      remainingMoves: [],
      turnPhase: 'roll',
      headMovesThisTurn: 0,
      isFirstMove: { ...(gameState.isFirstMove || { 1: true, 2: true }), [playerNumber]: false },
    };
    setGameState(newState);
    setSelectedPoint(null);
    setHighlightedMoves([]);
    await syncGameState(newState);
  }, [gameState, playerNumber, syncGameState, boardMode]);

  const statusText = () => {
    if (!room) return 'Загрузка...';
    if (roomStatus === 'waiting') return 'Ожидание соперника...';
    const u1 = selfPlay ? nickname : (room?.user1_id || room?.player1_name);
    const u2 = selfPlay ? nickname : (room?.user2_id || room?.player2_name);
    if (gameState.gameOver) return `Победитель: ${gameState.winner === 1 ? u1 : u2}`;
    if (boardMode === 'sandbox') return '';
    if (!gameStarted) return '';
    if (gameState.turnPhase === 'preroll') return 'Бросьте по одному кубику, чтобы определить первый ход';
    return isMyTurn ? 'Твой ход' : 'Ход соперника';
  };

  const canEndTurn =
    isMyTurn &&
    gameState.turnPhase === 'move' &&
    gameState.dice.length > 0 &&
    (gameState.remainingMoves.length === 0 || shouldAutoEndTurn(gameState));

  const showFingerHint =
    swipeHintLoaded &&
    !swipeHintSeen &&
    !gameStarted &&
    roomStatus === 'playing' &&
    boardMounted &&
    !showAnimDice;

  const BOARD_MAX_W = isTablet ? 720 : undefined;
  const [boardColW, setBoardColW] = useState(0);
  const fullStripW = useMemo(() => {
    if (boardColW > 0) return boardColW;
    if (isWideTablet) return Math.max(360, Math.floor((windowW || 0) * 0.58));
    return windowW || Dimensions.get('window').width;
  }, [boardColW, isWideTablet, windowW]);
  const narrowStripW = useMemo(() => Math.max(48, Math.floor(fullStripW / 5)), [fullStripW]);

  const animatedHandleH = useMemo(
    () => Animated.add(
      HANDLE_H,
      Animated.add(
        Animated.multiply(handleStretchAnim, DRAG_MAX_EXTRA_H),
        Animated.multiply(middlePulseAnim, DRAG_MAX_EXTRA_H * 0.5)
      )
    ),
    [handleStretchAnim, middlePulseAnim]
  );

  const animatedHandleW = useMemo(
    () =>
      handleWidthAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [narrowStripW, fullStripW],
        extrapolate: 'clamp',
      }),
    [handleWidthAnim, narrowStripW, fullStripW]
  );

  const dragHandleW = useMemo(
    () =>
      handleStretchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [narrowStripW, Math.max(36, Math.floor(narrowStripW * HANDLE_NARROW_RATIO))],
        extrapolate: 'clamp',
      }),
    [handleStretchAnim, narrowStripW]
  );

  /**
   * Радиусы только снизу:
   * - верх всегда плоский (0)
   * - низ всегда скруглён (никогда не 0)
   *
   * При drag (handleWidthAnim=0) хотим «овал» снизу: bottomR ≈ width/2.
   * При expand до полной ширины сохраняем заметное скругление снизу (не прямой угол).
   */
  const oneMinusHandleWidth = useMemo(
    () => handleWidthAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
    [handleWidthAnim]
  );

  const oneMinusStretch = useMemo(
    () => handleStretchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
    [handleStretchAnim]
  );

  /** В покое — меньший радиус; при pull — “полуовал” (приближаемся к width/2) */
  const BOTTOM_R_COLLAPSED = 10;
  const bottomRDrag = useMemo(
    () =>
      Animated.add(
        Animated.multiply(oneMinusStretch, BOTTOM_R_COLLAPSED),
        Animated.multiply(handleStretchAnim, Animated.multiply(dragHandleW, 0.5))
      ),
    [oneMinusStretch, handleStretchAnim, dragHandleW]
  );

  /** На полной ширине тоже сохраняем скругление снизу */
  const BOTTOM_R_FULL = 18;
  const bottomR = useMemo(
    () =>
      Animated.add(
        Animated.multiply(oneMinusHandleWidth, bottomRDrag),
        Animated.multiply(handleWidthAnim, BOTTOM_R_FULL)
      ),
    [oneMinusHandleWidth, bottomRDrag, handleWidthAnim]
  );

  const THUMB_W_MAX = 48;
  const THUMB_W_MIN = 4;
  const THUMB_H_LINE = 4;
  const thumbGripW = useMemo(
    () =>
      handleStretchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [THUMB_W_MAX, THUMB_W_MIN],
        extrapolate: 'clamp',
      }),
    [handleStretchAnim]
  );
  const thumbGripH = useMemo(
    () =>
      handleStretchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [THUMB_H_LINE, THUMB_W_MIN],
        extrapolate: 'clamp',
      }),
    [handleStretchAnim]
  );
  const thumbGripRadius = useMemo(
    () =>
      handleStretchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [9999, THUMB_W_MIN / 2],
        extrapolate: 'clamp',
      }),
    [handleStretchAnim]
  );

  const stripWidthAnim = useMemo(
    () => Animated.add(
      Animated.multiply(
        handleWidthAnim.interpolate({ inputRange: [0, 0.01], outputRange: [1, 0], extrapolate: 'clamp' }),
        dragHandleW
      ),
      Animated.multiply(
        handleWidthAnim.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }),
        animatedHandleW
      )
    ),
    [handleWidthAnim, dragHandleW, animatedHandleW]
  );

  const boardRenderW = useMemo(() => {
    const w = boardColW > 0 ? boardColW : fullStripW;
    if (!w) return windowW || Dimensions.get('window').width;
    if (typeof BOARD_MAX_W === 'number' && BOARD_MAX_W > 0) return Math.floor(Math.min(w, BOARD_MAX_W));
    return Math.floor(w);
  }, [boardColW, fullStripW, windowW, BOARD_MAX_W]);

  const listPaddingTop = frostedHeaderH > 0 ? frostedHeaderH : insets.top + 75;
  const gameStatusLabel = statusText();
  const showGameStatus = !kbVisible && !!gameStatusLabel;
  const showWideTabletStatusStrip = isWideTablet && showGameStatus;
  const phoneStatusStripH = !isWideTablet && showGameStatus ? GAME_STATUS_STRIP_H : 0;
  const boardTopOffset = listPaddingTop + phoneStatusStripH;
  const chatHeaderTopPaddingOverride = showWideTabletStatusStrip ? 10 : undefined;

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: V.bgApp }]}
    >
      {/* Планшет: тонкая полоса статуса игры на всю ширину (доска слева без отдельной шапки) */}
      {showWideTabletStatusStrip ? (
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 6,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: V.border,
          }}
        >
          <Text
            style={[
              tw`text-center text-[10px]`,
              {
                color: isMyTurn ? V.accentGold : V.textMuted,
                fontWeight: isMyTurn ? '500' : '400',
              },
            ]}
          >
            {gameStatusLabel}
          </Text>
        </View>
      ) : null}

      {/* Body: доска → ручка → чат; на телефоне полоса статуса между шапкой чата и доской — absolute */}
      <View
        style={[
          tw`flex-1`,
          isWideTablet ? tw`flex-row` : null,
          !isWideTablet ? { position: 'relative' } : null,
        ]}
      >
        {/* Board column */}
        {!kbVisible && (
          <View
            ref={boardColRef}
            onLayout={(e) => {
              const w = e?.nativeEvent?.layout?.width;
              if (typeof w === 'number' && w > 0) setBoardColW(w);
              boardColRef.current?.measureInWindow((_x, y) => {
                if (typeof y === 'number') {
                  boardColTopYRef.current = y;
                  computeMaxSlide();
                }
              });
            }}
            pointerEvents="box-none"
            style={[
              isWideTablet ? { width: Math.max(360, Math.floor(windowW * 0.58)) } : null,
              isWideTablet && !showWideTabletStatusStrip ? { paddingTop: insets.top } : null,
              !isWideTablet
                ? {
                    position: 'absolute',
                    top: boardTopOffset,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    elevation: 10,
                  }
                : null,
            ]}
          >
            <Animated.View
              pointerEvents="box-none"
              style={{
                width: stripWidthAnim,
                alignSelf: 'center',
              }}
            >
            <Animated.View
              style={{ height: boardDropAnim, overflow: 'hidden' }}
              pointerEvents="box-none"
            >
              {boardMounted && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                  <BackgammonBoard
                    ref={boardRef}
                    renderPausedRef={renderPausedRef}
                    gameState={effectiveGameState}
                    playerNumber={playerNumber}
                    selectedPoint={selectedPoint}
                    highlightedMoves={highlightedMoves}
                    onPointPress={handlePointPress}
                    onBarPress={handleBarPress}
                    onBearOffPress={handleBearOffPress}
                    onSwipe={handleBoardSwipe}
                    topBarMiddle={
                      <TouchableOpacity
                        onPress={newGame}
                        disabled={!selfPlay && !opponentOnline}
                        style={[
                          tw`px-3 py-1.5 rounded-[10px]`,
                          { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border },
                          (!selfPlay && !opponentOnline) && { opacity: 0.45 },
                        ]}
                      >
                        <Text style={[tw`text-[10px] font-medium`, { color: V.textSecondary }]}>Новая игра</Text>
                      </TouchableOpacity>
                    }
                    enableLayoutAnimations={!kbTransitioning && !isWideTablet}
                    maxBoardWidth={BOARD_MAX_W}
                    diceOverlay={
                      showAnimDice && (
                        <DiceThrow3D
                          key={throwKey}
                          dice={animDice}
                          startPos={swipeStart}
                          endPos={swipeEnd}
                          boardWidth={boardRenderW}
                          boardHeight={pointH * 2}
                          onComplete={handleDiceAnimComplete}
                          pausedRef={renderPausedRef}
                        />
                      )
                    }
                    centerOverlay={
                      (boardMode === 'sandbox'
                        ? (Array.isArray(sandboxUiDice) && sandboxUiDice.length === 2)
                        : (gameStarted
                            ? (gameState.turnPhase === 'preroll' || (Array.isArray(gameState.dice) && gameState.dice.length === 2))
                            : (Array.isArray(uiDice) && uiDice.length === 2)
                          )
                      ) &&
                      !showAnimDice && (
                        <View style={tw`flex-1 items-center justify-center`}>
                          {boardMode === 'sandbox' && (
                            <View
                              style={[
                                tw`mb-2 px-3 py-1 rounded-[10px]`,
                                { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                              ]}
                            >
                              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>
                                Песочница
                              </Text>
                            </View>
                          )}
                          <View style={tw`items-center justify-center`}>
                            {boardMode === 'match' && gameState.turnPhase === 'preroll' ? (
                              <View style={tw`flex-row items-center`}>
                                <View style={tw`items-center mr-4`}>
                                  <Text style={[tw`text-[10px] mb-1`, { color: V.textMuted, fontWeight: '400' }]}>Ты</Text>
                                  <DieFace value={Math.max(1, Math.min(6, (gameState.preStartRolls?.[playerNumber] ?? 1)))} isUsed={false} size={42} />
                                </View>
                                <View style={tw`items-center`}>
                                  <Text style={[tw`text-[10px] mb-1`, { color: V.textMuted, fontWeight: '400' }]}>Соперник</Text>
                                  <DieFace value={Math.max(1, Math.min(6, (gameState.preStartRolls?.[playerNumber === 1 ? 2 : 1] ?? 1)))} isUsed={false} size={42} />
                                </View>
                              </View>
                            ) : (
                              <>
                                <View style={{ marginBottom: 10 }}>
                                  <DieFace
                                    value={
                                      boardMode === 'sandbox'
                                        ? sandboxUiDice[0]
                                        : (gameStarted ? gameState.dice?.[0] : uiDice?.[0])
                                    }
                                    isUsed={false}
                                    size={42}
                                  />
                                </View>
                                <DieFace
                                  value={
                                    boardMode === 'sandbox'
                                      ? sandboxUiDice[1]
                                      : (gameStarted ? gameState.dice?.[1] : uiDice?.[1])
                                  }
                                  isUsed={false}
                                  size={42}
                                />
                              </>
                            )}
                          </View>
                        </View>
                      )
                    }
                    swipeHintOverlay={
                      <SwipeBoardHint
                        visible={showFingerHint}
                        boardWidth={boardRenderW}
                        boardHeight={pointH * 2}
                        onComplete={handleSwipeHintComplete}
                      />
                    }
                    pointHeight={pointH}
                    pointHeightMin={MIN_PH}
                    pointHeightMax={pointH}
                  >
                    {canEndTurn && (
                      <View style={tw`flex-row items-center justify-center`}>
                        <TouchableOpacity
                          style={[
                            tw`rounded-[10px] px-4 py-2`,
                            { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border },
                          ]}
                          onPress={handleEndTurn}
                        >
                          <Text style={[tw`text-[10px] font-medium`, { color: V.textSecondary }]}>Завершить ход</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </BackgammonBoard>
                </View>
              )}
            </Animated.View>

            {/* Handle — капсула с 4-фазной анимацией */}
            <Animated.View
              {...slidePan.panHandlers}
              style={[
                tw`items-center justify-center`,
                {
                  height: animatedHandleH,
                  overflow: 'hidden',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.border,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: bottomR,
                  borderBottomRightRadius: bottomR,
                },
              ]}
              accessibilityLabel="Потяни вниз, чтобы открыть доску"
            >
              <SafeBlurView
                intensity={Platform.OS === 'ios' ? HANDLE_BLUR_INTENSITY_IOS : HANDLE_BLUR_INTENSITY_ANDROID}
                tint="dark"
                blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
                pointerEvents="none"
                style={StyleSheet.absoluteFillObject}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: V.bgElevated, opacity: HANDLE_FROST_TINT_OPACITY },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={{
                  width: thumbGripW,
                  height: thumbGripH,
                  borderRadius: thumbGripRadius,
                  overflow: 'hidden',
                }}
              >
                <SafeBlurView
                  intensity={Platform.OS === 'ios' ? 18 : 14}
                  tint="dark"
                  blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFillObject}
                />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { backgroundColor: V.textPrimary, opacity: 0.22 },
                  ]}
                />
              </Animated.View>
            </Animated.View>
            </Animated.View>
          </View>
        )}

        {!isWideTablet && showGameStatus ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: listPaddingTop,
              left: 0,
              right: 0,
              height: GAME_STATUS_STRIP_H,
              zIndex: 15,
              elevation: 15,
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                tw`text-center text-[10px]`,
                {
                  color: isMyTurn ? V.accentGold : V.textMuted,
                  fontWeight: isMyTurn ? '500' : '400',
                },
              ]}
            >
              {gameStatusLabel}
            </Text>
          </View>
        ) : null}

        {/* Chat column */}
        <View
          style={[
            tw`flex-1`,
            { zIndex: isWideTablet ? 20 : 0, elevation: isWideTablet ? 20 : 0, backgroundColor: V.bgApp },
            isWideTablet ? { minWidth: 320 } : null,
          ]}
        >
          <Chat
            roomId={roomId}
            roomCode={room?.code}
            nickname={nickname}
            compact
            listPaddingTop={listPaddingTop}
            onTopOverlayHeight={setFrostedHeaderH}
            chatRoomHeader={{
              title: opponentName || 'Чат',
              contactOnline: selfPlay ? true : opponentOnline,
              navigation,
              topPaddingOverride: chatHeaderTopPaddingOverride,
              headerRight: (
                <TouchableOpacity
                  onPress={() => Alert.alert('Звонок', 'Голосовые звонки скоро!')}
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Phone size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
              ),
            }}
            onInputBarTopY={(y) => {
              if (isWideTablet) return;
              if (kbVisible) return;
              if (typeof y !== 'number') return;
              if (typeof chatInputTopYRef.current === 'number') {
                chatInputTopYRef.current = Math.min(chatInputTopYRef.current, y);
              } else {
                chatInputTopYRef.current = y;
              }
              computeMaxSlide();
            }}
          />
        </View>
      </View>

    </View>
  );
}
