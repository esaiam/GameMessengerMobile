import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
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
import { useBoardAnimation } from '../hooks/useBoardAnimation';
import { useGameSession } from '../hooks/useGameSession';
import { useBackgammonGame } from '../hooks/useBackgammonGame';
const NICKNAME_KEY = '@backgammon_nickname';
const SWIPE_HINT_KEY = '@backgammon_swipe_hint_seen';
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
  const routePeerName = route.params?.peerName || route.params?.title || null;
  const [nickname, setNickname] = useState(route.params?.nickname || '');

  const [gameState, setGameState] = useState(createInitialGameState());
  const [playerNumber, setPlayerNumber] = useState(initialPlayerNumber);

  const [diceAnimating, setDiceAnimating] = useState(false);
  const diceAnimatingRef = useRef(false);
  useEffect(() => {
    diceAnimatingRef.current = diceAnimating;
  }, [diceAnimating]);
  const [showAnimDice, setShowAnimDice] = useState(false);
  const showAnimDiceRef = useRef(false);
  useEffect(() => {
    showAnimDiceRef.current = showAnimDice;
  }, [showAnimDice]);
  const [animDice, setAnimDice] = useState(null);
  const [uiDice, setUiDice] = useState(null);

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

  const [kbVisible, setKbVisible] = useState(false);

  const opponentNameRef = useRef(routePeerName);
  const backgammonSettersRef = useRef(null);
  const isMyTurn = gameState.currentPlayer === playerNumber;
  const {
    room,
    playerNumber: sessionPlayerNumber,
    activeSessionId,
    useLegacyRoomState,
    opponentOnline,
    syncGameState,
    newGame,
    leaveRoom,
    channelRef,
  } = useGameSession({
    roomId,
    nickname,
    selfPlay,
    opponentName: opponentNameRef.current,
    playerNumber,
    setPlayerNumber,
    gameStateRef,
    setGameState,
    setSelectedPoint: (v) => backgammonSettersRef.current?.setSelectedPoint?.(v),
    setHighlightedMoves: (v) => backgammonSettersRef.current?.setHighlightedMoves?.(v),
    setDiceAnimating,
    setShowAnimDice,
    setAnimDice,
    setUiDice,
    setSandboxUiDice: (v) => backgammonSettersRef.current?.setSandboxUiDice?.(v),
    setSwipeStart,
    setSwipeEnd,
    pendingRollRef,
    navigation,
    setKbVisible,
  });

  const backgammonGame = useBackgammonGame({
    selfPlay,
    gameState,
    setGameState,
    playerNumber,
    setPlayerNumber,
    syncGameState,
    opponentOnline,
    isMyTurn,
    pendingRollRef,
    setDiceAnimating,
    setShowAnimDice,
    setAnimDice,
    setSwipeStart,
    setSwipeEnd,
  });
  backgammonSettersRef.current = {
    setSelectedPoint: backgammonGame.setSelectedPoint,
    setHighlightedMoves: backgammonGame.setHighlightedMoves,
    setSandboxUiDice: backgammonGame.setSandboxUiDice,
  };
  const {
    selectedPoint,
    highlightedMoves,
    boardMode,
    sandboxState,
    sandboxUiDice,
    setSandboxUiDice,
    setMode,
    handlePointPress,
    handleBarPress,
    handleBearOffPress,
    handleEndTurn,
  } = backgammonGame;

  useEffect(() => {
    if (sessionPlayerNumber !== undefined && sessionPlayerNumber !== null) {
      setPlayerNumber(sessionPlayerNumber);
    }
  }, [sessionPlayerNumber]);

  const opponentName = useMemo(() => {
    if (selfPlay) return nickname;
    if (!room || !nickname) return routePeerName;
    const u1 = room?.user1_id || room?.player1_name || null;
    const u2 = room?.user2_id || room?.player2_name || null;
    if (!u1 && !u2) return routePeerName;
    if (u1 === nickname) return u2;
    if (u2 === nickname) return u1;
    // fallback: if nickname isn't on the room record yet, pick "other" heuristically
    return routePeerName || u2 || u1;
  }, [room, nickname, selfPlay, routePeerName]);
  opponentNameRef.current = opponentName;

  const roomStatus = room?.status || 'playing';

  const gameStarted = gameState.gameStarted === true;
  // Pre-start roll: each player rolls ONE die in turn to decide who starts
  const isPreStart = gameStarted && gameState.turnPhase === 'preroll';
  const effectiveGameState = boardMode === 'sandbox' ? sandboxState : gameState;

  /** Вызов из setTimeout удалённого броска — ref обновляется после объявления pauseJsForDiceThrow */
  const pauseJsForDiceThrowRef = useRef(() => {});

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
      pauseJsForDiceThrowRef.current();
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
    pauseJsForDiceThrowRef.current();
    setAnimDice(nextDice);
    setSwipeStart({ x: 42, y: pointH * 1.25 });
    setSwipeEnd({ x: (windowW || Dimensions.get('window').width) - 42, y: pointH * 0.75 });
    setShowAnimDice(true);
    setDiceAnimating(true);
    setThrowKey((k) => k + 1);
  }, [boardMode, gameStarted, gameState.dice, diceAnimating, showAnimDice, diceEqual, pointH, windowW]);

  const BOARD_TOP_GAP = 4;
  const BOARD_SIDE_GAP = 8;
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
  /** Не совмещать с renderPausedRef: pauseRendering() ставит ref в true и иначе остановит RAF в DiceThrow3D */
  const diceGlPausedRef = useRef(false);
  const boardRef = useRef(null);
  const boardMountedRef = useRef(false);
  const [boardMounted, setBoardMounted] = useState(false);
  /** Пока false — Backgammon не в дереве (после сворачивания доски), игра в state родителя продолжается */
  const [boardContentActive, setBoardContentActive] = useState(false);

  const [kbTransitioning, setKbTransitioning] = useState(false);
  const kbTransitionTimerRef = useRef(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const mark = (vis) => {
      setKbTransitioning(true);
      setKbVisible(vis);
      if (kbTransitionTimerRef.current) {
        clearTimeout(kbTransitionTimerRef.current);
        kbTransitionTimerRef.current = null;
      }
      kbTransitionTimerRef.current = setTimeout(() => {
        kbTransitionTimerRef.current = null;
        setKbTransitioning(false);
      }, 420);
    };
    const sub1 = Keyboard.addListener(showEvt, () => mark(true));
    const sub2 = Keyboard.addListener(hideEvt, () => mark(false));
    return () => {
      sub1.remove();
      sub2.remove();
      if (kbTransitionTimerRef.current) clearTimeout(kbTransitionTimerRef.current);
    };
  }, []);

  const DRAG_MAX_EXTRA_H = 28;
  const HANDLE_NARROW_RATIO = 0.6;

  const {
    handleStretchAnim,
    handleWidthAnim,
    boardDropAnim,
    middlePulseAnim,
    slidePan,
    suppressAvailableHRef,
    boardColTopYRef,
    chatInputTopYRef,
    pauseJsForDiceThrow,
    computeMaxSlide,
  } = useBoardAnimation({
    showAnimDice,
    showAnimDiceRef,
    diceAnimatingRef,
    renderPausedRef,
    boardRef,
    boardColRef,
    boardMountedRef,
    setAvailableH,
    setBoardMounted,
    setBoardContentActive,
    kbVisible,
    frostedHeaderH,
  });
  pauseJsForDiceThrowRef.current = pauseJsForDiceThrow;

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

  useFocusEffect(
    useCallback(() => {
      return () => {
        suppressAvailableHRef.current = false;
        Keyboard.dismiss();
        setKbVisible(false);
      };
    }, [])
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
      setShowAnimDice(false);
      setAnimDice(null);
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
      pauseJsForDiceThrow();
      setAnimDice(dice);
      if (isRealRoll) {
        setUiDice(dice);
      }
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
    [diceAnimating, showAnimDice, isMyTurn, isPreStart, gameState, roomStatus, gameStarted, boardMode, playerNumber, syncGameState, pauseJsForDiceThrow]
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

  const handleSwipeHintComplete = useCallback(() => {
    setSwipeHintSeen(true);
    AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
  }, []);

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
      28,
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
    const fallbackW = windowW || Dimensions.get('window').width;
    const raw = w || fallbackW;
    const insetW = Math.max(0, raw - BOARD_SIDE_GAP * 2);
    if (typeof BOARD_MAX_W === 'number' && BOARD_MAX_W > 0) return Math.floor(Math.min(insetW, BOARD_MAX_W));
    return Math.floor(insetW);
  }, [boardColW, fullStripW, windowW, BOARD_MAX_W, BOARD_SIDE_GAP]);

  const listPaddingTop = frostedHeaderH > 0 ? frostedHeaderH : insets.top + 75;
  const boardTopOffset = listPaddingTop + BOARD_TOP_GAP;

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: V.bgApp }]}
    >
      {/* Body: доска → ручка → чат */}
      <View
        style={[
          tw`flex-1`,
          isWideTablet ? tw`flex-row` : null,
          !isWideTablet ? { position: 'relative' } : null,
        ]}
      >
        {/* Board column */}
        {!kbVisible && !emojiPickerVisible && (
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
              isWideTablet ? { paddingTop: insets.top } : null,
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
              {boardMounted && boardContentActive && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: BOARD_SIDE_GAP }}>
                  <BackgammonBoard
                    ref={boardRef}
                    renderPausedRef={renderPausedRef}
                    gameState={effectiveGameState}
                    isMyTurn={isMyTurn}
                    turnPhase={gameState.turnPhase}
                    selfPlay={selfPlay}
                    opponentOnline={opponentOnline}
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
                          pausedRef={diceGlPausedRef}
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
                  borderTopLeftRadius: bottomR,
                  borderTopRightRadius: bottomR,
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
            peerName={opponentName}
            renderPausedRef={renderPausedRef}
            listPaddingTop={listPaddingTop}
            onTopOverlayHeight={setFrostedHeaderH}
            chatRoomHeader={{
              title: opponentName || 'Чат',
              contactOnline: selfPlay ? true : opponentOnline,
              navigation,
              onHeaderPress: opponentName
                ? () =>
                    navigation.navigate('ContactProfile', {
                      peerName: opponentName,
                      contactOnline: selfPlay ? true : opponentOnline,
                      roomId,
                      nickname,
                    })
                : undefined,
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
                  <Phone size={20} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
              ),
            }}
            onEmojiPickerChange={(visible) => setEmojiPickerVisible(visible)}
            onInputBarTopY={(y) => {
              if (isWideTablet) return;
              if (kbVisible) return;
              if (kbTransitioning) return;
              if (emojiPickerVisible) return;
              if (typeof y !== 'number') return;
              chatInputTopYRef.current = y;
              computeMaxSlide();
            }}
          />
        </View>
      </View>

    </View>
  );
}
