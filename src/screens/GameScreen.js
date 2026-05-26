import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  TouchableOpacity,
  Alert,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone } from '../icons/lucideIcons';
import { RoomChatContainer } from '../components/chat/RoomChatContainer';
import { V } from '../theme';
import { createInitialGameState, shouldAutoEndTurn } from '../utils/gameLogic';
import { preloadDiceSound, unloadDiceSound } from '../utils/diceSound';
import { useBoardAnimation } from '../hooks/useBoardAnimation';
import { useGameSession } from '../hooks/useGameSession';
import { useBackgammonGame } from '../hooks/useBackgammonGame';
import useGameScreenBootstrap from './game/useGameScreenBootstrap';
import useGameKeyboardTransition from './game/useGameKeyboardTransition';
import useGameDiceRemoteSync, { createDiceEqual } from './game/useGameDiceRemoteSync';
import { resolveGameOpponentName } from './game/resolveGameOpponentName';
import {
  BOARD_TOP_GAP,
  DEFAULT_PH,
  MIN_PH,
  BOARD_CHROME,
} from './game/gameScreenConstants';
import useGameDiceAnimComplete from './game/useGameDiceAnimComplete';
import useGameBoardSwipe from './game/useGameBoardSwipe';
import useGameBoardHandleStyles from './game/useGameBoardHandleStyles';
import GameBoardColumn from './game/GameBoardColumn';
import { useMessengerScreenBackHandler } from '../lib/safeGoBack';

export default function GameScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  useMessengerScreenBackHandler(navigation);
  const { width: windowW, height: windowH } = useWindowDimensions();
  const shortestSide = Math.min(windowW, windowH);
  const isTabletLayout = shortestSide >= 540;
  const isLandscape = windowW > windowH;
  /** На планшете нарды только в портрете; в альбоме — только чат */
  const showBackgammonBoard = !isTabletLayout || !isLandscape;

  const roomId = route.params?.roomId;
  const selfPlay = route.params?.selfPlay === true;
  const routePeerName = route.params?.peerName || route.params?.title || null;

  const [gameState, setGameState] = useState(createInitialGameState());
  const gameStarted = gameState.gameStarted === true;
  const {
    nickname,
    swipeHintLoaded,
    swipeHintSeen,
    markSwipeHintSeen,
  } = useGameScreenBootstrap(route.params?.nickname, gameStarted);
  const [playerNumber, setPlayerNumber] = useState(route.params?.playerNumber);

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
  const pendingRollRef = useRef(null);
  const lastLocalRealRollRef = useRef(null); // { dice: number[], at: number }
  const prevNetDiceRef = useRef(null); // number[] | null
  const prevNetRollEventIdRef = useRef(null); // string | null
  const lastLocalRollEventIdRef = useRef(null); // string | null
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const diceBusyRef = useRef(false);
  useEffect(() => {
    diceBusyRef.current = diceAnimating || showAnimDice;
  }, [diceAnimating, showAnimDice]);
  const pendingSessionStateRef = useRef(null);
  const chatFlushDeferredRef = useRef(null);

  const [kbVisible, setKbVisible] = useState(false);

  const opponentNameRef = useRef(routePeerName);
  const backgammonSettersRef = useRef(null);
  const isMyTurn = gameState.currentPlayer === playerNumber;
  const {
    room,
    playerNumber: sessionPlayerNumber,
    opponentOnline,
    syncGameState,
    newGame } = useGameSession({
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
    diceBusyRef,
    pendingSessionStateRef,
    navigation,
    setKbVisible });

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
    setSwipeEnd });
  backgammonSettersRef.current = {
    setSelectedPoint: backgammonGame.setSelectedPoint,
    setHighlightedMoves: backgammonGame.setHighlightedMoves,
    setSandboxUiDice: backgammonGame.setSandboxUiDice };
  const {
    selectedPoint,
    highlightedMoves,
    boardMode,
    sandboxState,
    sandboxUiDice,
    handlePointPress,
    handleBarPress,
    handleBearOffPress,
    handleEndTurn } = backgammonGame;

  useEffect(() => {
    if (sessionPlayerNumber !== undefined && sessionPlayerNumber !== null) {
      setPlayerNumber(sessionPlayerNumber);
    }
  }, [sessionPlayerNumber]);

  const opponentName = useMemo(
    () => resolveGameOpponentName(room, nickname, selfPlay, routePeerName),
    [room, nickname, selfPlay, routePeerName],
  );
  opponentNameRef.current = opponentName;

  const roomStatus = room?.status || 'playing';

  // Pre-start roll: each player rolls two dice, higher sum goes first
  const isPreStart = gameStarted && gameState.turnPhase === 'preroll';
  const effectiveGameState = boardMode === 'sandbox' ? sandboxState : gameState;

  /** Вызов из setTimeout удалённого броска — ref обновляется после объявления pauseJsForDiceThrow */
  const pauseJsForDiceThrowRef = useRef(() => {});

  const diceEqual = useMemo(() => createDiceEqual(), []);

  /** Высота frosted ChatRoomHeader внутри Chat (как ChatRoomScreen) */
  const [frostedHeaderH, setFrostedHeaderH] = useState(0);
  const boardColRef = useRef(null);
  const [availableH, setAvailableH] = useState(0);
  const pointH = availableH > 0
    ? Math.max(MIN_PH, Math.floor((availableH - BOARD_CHROME) / 2))
    : DEFAULT_PH;

  const renderPausedRef = useRef(false);
  /** Не совмещать с renderPausedRef: pauseRendering() ставит ref в true и иначе остановит RAF в DiceThrow3D */
  const diceGlPausedRef = useRef(false);
  const boardRef = useRef(null);
  const boardMountedRef = useRef(false);
  const [boardMounted, setBoardMounted] = useState(false);
  /** Пока false — Backgammon не в дереве (после сворачивания доски), игра в state родителя продолжается */
  const [boardContentActive, setBoardContentActive] = useState(false);

  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const { kbTransitioning } = useGameKeyboardTransition(setKbVisible);

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
    runCloseSequence } = useBoardAnimation({
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
    frostedHeaderH });
  pauseJsForDiceThrowRef.current = pauseJsForDiceThrow;

  useGameDiceRemoteSync({
    boardMode,
    gameStarted,
    gameState,
    diceAnimating,
    showAnimDice,
    playerNumber,
    pointH,
    windowW,
    diceEqual,
    pauseJsForDiceThrowRef,
    pendingRollRef,
    prevNetDiceRef,
    prevNetRollEventIdRef,
    lastLocalRollEventIdRef,
    lastLocalRealRollRef,
    setAnimDice,
    setSwipeStart,
    setSwipeEnd,
    setShowAnimDice,
    setDiceAnimating,
  });

  useEffect(() => {
    const t = setTimeout(() => computeMaxSlide(), 80);
    return () => clearTimeout(t);
  }, [windowW, windowH, computeMaxSlide]);

  useEffect(() => {
    if (!showBackgammonBoard && boardContentActive) {
      runCloseSequence();
    }
  }, [showBackgammonBoard, boardContentActive, runCloseSequence]);

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

  const flushDeferredWhileDice = useCallback(() => {
    diceBusyRef.current = false;
    chatFlushDeferredRef.current?.();
    const pending = pendingSessionStateRef.current;
    pendingSessionStateRef.current = null;
    if (pending) {
      setGameState(pending);
      backgammonSettersRef.current?.setSelectedPoint?.(null);
      backgammonSettersRef.current?.setHighlightedMoves?.([]);
    }
  }, []);
  const flushDeferredWhileDiceRef = useRef(flushDeferredWhileDice);
  flushDeferredWhileDiceRef.current = flushDeferredWhileDice;

  useEffect(() => {
    if (!diceAnimating) return;
    const t = setTimeout(() => {
      flushDeferredWhileDiceRef.current?.();
      setDiceAnimating(false);
      setShowAnimDice(false);
      setAnimDice(null);
    }, 8000);
    return () => clearTimeout(t);
  }, [diceAnimating]);

  const handleDiceAnimComplete = useGameDiceAnimComplete({
    pendingRollRef,
    gameStateRef,
    playerNumber,
    syncGameState,
    setGameState,
    setUiDice,
    setShowAnimDice,
    setDiceAnimating,
    setAnimDice,
    flushDeferredWhileDice,
  });

  const handleBoardSwipe = useGameBoardSwipe({
    diceAnimating,
    showAnimDice,
    boardMode,
    gameStarted,
    gameState,
    playerNumber,
    isMyTurn,
    isPreStart,
    roomStatus,
    pauseJsForDiceThrow,
    pendingRollRef,
    lastLocalRealRollRef,
    lastLocalRollEventIdRef,
    gameStateRef,
    setGameState,
    syncGameState,
    setAnimDice,
    setUiDice,
    setSwipeStart,
    setSwipeEnd,
    setShowAnimDice,
    setDiceAnimating,
  });

  const canEndTurn =
    isMyTurn &&
    gameState.turnPhase === 'move' &&
    gameState.dice.length > 0 &&
    (gameState.remainingMoves.length === 0 || shouldAutoEndTurn(gameState));

  const showFingerHint =
    showBackgammonBoard &&
    swipeHintLoaded &&
    !swipeHintSeen &&
    !gameStarted &&
    roomStatus === 'playing' &&
    boardMounted &&
    !showAnimDice;

  const boardMaxW = isTabletLayout ? 720 : undefined;
  const [boardColW, setBoardColW] = useState(0);
  const { animatedHandleH, bottomR, stripWidthAnim, boardRenderW } = useGameBoardHandleStyles({
    handleStretchAnim,
    handleWidthAnim,
    middlePulseAnim,
    boardColW,
    windowW,
    boardMaxW,
  });

  const listPaddingTop = frostedHeaderH > 0 ? frostedHeaderH : insets.top + 75;
  const boardTopOffset = listPaddingTop + BOARD_TOP_GAP;

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: V.bgApp }]}
    >
      {/* Body: доска → ручка → чат */}
      <View style={[tw`flex-1`, { position: 'relative' }]}>
        {/* Board column */}
        {showBackgammonBoard && !kbVisible && !emojiPickerVisible && (
          <GameBoardColumn
            boardColRef={boardColRef}
            boardTopOffset={boardTopOffset}
            boardColTopYRef={boardColTopYRef}
            computeMaxSlide={computeMaxSlide}
            onBoardColLayoutWidth={setBoardColW}
            stripWidthAnim={stripWidthAnim}
            boardDropAnim={boardDropAnim}
            slidePan={slidePan}
            boardMounted={boardMounted}
            boardContentActive={boardContentActive}
            boardRef={boardRef}
            renderPausedRef={renderPausedRef}
            effectiveGameState={effectiveGameState}
            gameState={gameState}
            isMyTurn={isMyTurn}
            selfPlay={selfPlay}
            opponentOnline={opponentOnline}
            playerNumber={playerNumber}
            selectedPoint={selectedPoint}
            highlightedMoves={highlightedMoves}
            onPointPress={handlePointPress}
            onBarPress={handleBarPress}
            onBearOffPress={handleBearOffPress}
            onSwipe={handleBoardSwipe}
            onNewGame={newGame}
            kbTransitioning={kbTransitioning}
            isTabletLayout={isTabletLayout}
            boardMaxW={boardMaxW}
            showAnimDice={showAnimDice}
            animDice={animDice}
            swipeStart={swipeStart}
            swipeEnd={swipeEnd}
            boardRenderW={boardRenderW}
            pointH={pointH}
            onDiceAnimComplete={handleDiceAnimComplete}
            diceGlPausedRef={diceGlPausedRef}
            boardMode={boardMode}
            gameStarted={gameStarted}
            sandboxUiDice={sandboxUiDice}
            uiDice={uiDice}
            showFingerHint={showFingerHint}
            onSwipeHintComplete={markSwipeHintSeen}
            canEndTurn={canEndTurn}
            onEndTurn={handleEndTurn}
            animatedHandleH={animatedHandleH}
            bottomR={bottomR}
            handleStretchAnim={handleStretchAnim}
          />
        )}

        {/* Chat column */}
        <View
          style={[
            tw`flex-1`,
            { backgroundColor: V.bgApp }]}
        >
          <RoomChatContainer
            roomId={roomId}
            roomCode={room?.code}
            nickname={nickname}
            peerName={opponentName}
            renderPausedRef={renderPausedRef}
            diceBusyRef={diceBusyRef}
            chatFlushDeferredRef={chatFlushDeferredRef}
            diceAnimating={diceAnimating}
            showAnimDice={showAnimDice}
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
                      nickname })
                : undefined,
              headerRight: (
                <TouchableOpacity
                  onPress={() => Alert.alert('Звонок', 'Голосовые звонки скоро!')}
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center' }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Phone size={20} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
              ) }}
            onEmojiPickerChange={(visible) => setEmojiPickerVisible(visible)}
            onInputBarTopY={(y) => {
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
