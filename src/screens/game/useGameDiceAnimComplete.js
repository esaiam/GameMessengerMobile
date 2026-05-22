import { useCallback } from 'react';
import { completeDiceRollAfterAnim } from './completeDiceRollAfterAnim';

export default function useGameDiceAnimComplete({
  pendingRollRef,
  gameStateRef,
  playerNumber,
  syncGameState,
  setGameState,
  setUiDice,
  setShowAnimDice,
  setDiceAnimating,
  setAnimDice,
}) {
  return useCallback(async () => {
    const pendingDice = pendingRollRef.current;
    pendingRollRef.current = null;
    await completeDiceRollAfterAnim({
      pendingDice,
      gameStateRef,
      playerNumber,
      syncGameState,
      setGameState,
      setUiDice,
      setShowAnimDice,
      setDiceAnimating,
      setAnimDice,
    });
  }, [
    pendingRollRef,
    gameStateRef,
    playerNumber,
    syncGameState,
    setGameState,
    setUiDice,
    setShowAnimDice,
    setDiceAnimating,
    setAnimDice,
  ]);
}
