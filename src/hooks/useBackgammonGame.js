import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  createInitialGameState,
  applyMove,
  applyMoveSequence,
  getMoveOptionsForSelection } from '../utils/gameLogic';

export function useBackgammonGame({
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
  setSwipeEnd }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [highlightedMoves, setHighlightedMoves] = useState([]);
  const [boardMode, setBoardMode] = useState('match');
  const [sandboxState, setSandboxState] = useState(createInitialGameState());
  const [sandboxUiDice, setSandboxUiDice] = useState(null);

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

  useEffect(() => {
    if (!selfPlay) return;
    if (gameState.currentPlayer === 1 || gameState.currentPlayer === 2) {
      setPlayerNumber(gameState.currentPlayer);
    }
  }, [selfPlay, gameState.currentPlayer]);

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
      isFirstMove: { ...(gameState.isFirstMove || { 1: true, 2: true }), [playerNumber]: false } };
    setGameState(newState);
    setSelectedPoint(null);
    setHighlightedMoves([]);
    await syncGameState(newState);
  }, [gameState, playerNumber, syncGameState, boardMode]);

  return {
    selectedPoint,
    highlightedMoves,
    boardMode,
    sandboxState,
    sandboxUiDice,
    setSelectedPoint,
    setHighlightedMoves,
    setSandboxUiDice,
    setMode,
    handlePointPress,
    handleBarPress,
    handleBearOffPress,
    handleEndTurn };
}
