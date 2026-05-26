import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { rollDice } from '../../utils/gameLogic';
import { playDiceRollSound } from '../../utils/diceSound';

export default function useGameBoardSwipe({
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
}) {
  return useCallback(
    (swipe) => {
      if (diceAnimating || showAnimDice) return;

      const inSandbox = boardMode === 'sandbox';

      if (
        !inSandbox &&
        gameStarted &&
        gameState.turnPhase === 'preroll' &&
        gameState.currentPlayer !== playerNumber
      ) {
        Alert.alert('Подожди', 'Сначала должен бросить игрок 1.');
        return;
      }
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
      const isAntiStress =
        inSandbox || (!isRealRoll && !(isMyTurn && gameState.turnPhase === 'move'));

      if (!isRealRoll && !isAntiStress) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playDiceRollSound();

      const dice = rollDice();
      pauseJsForDiceThrow();
      setAnimDice(dice);
      if (isRealRoll) {
        setUiDice(dice);
      }
      setSwipeStart({ x: swipe.startX, y: swipe.startY });
      setSwipeEnd({ x: swipe.endX, y: swipe.endY });
      setShowAnimDice(true);
      setDiceAnimating(true);

      if (isRealRoll) {
        const at = Date.now();
        lastLocalRealRollRef.current = { dice, at };

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

        setGameState((prev) => ({ ...(prev || {}), lastRollEvent: rollEvent }));

        try {
          syncGameState({ ...gameStateRef.current, lastRollEvent: rollEvent });
        } catch {
          /* ignore */
        }
      }
      pendingRollRef.current = isRealRoll ? dice : null;
    },
    [
      diceAnimating,
      showAnimDice,
      isMyTurn,
      isPreStart,
      gameState,
      roomStatus,
      gameStarted,
      boardMode,
      playerNumber,
      syncGameState,
      pauseJsForDiceThrow,
      pendingRollRef,
      lastLocalRealRollRef,
      lastLocalRollEventIdRef,
      gameStateRef,
      setGameState,
      setAnimDice,
      setUiDice,
      setSwipeStart,
      setSwipeEnd,
      setShowAnimDice,
      setDiceAnimating,
    ],
  );
}
