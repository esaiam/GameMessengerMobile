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
  flushDeferredWhileDice,
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
    flushDeferredWhileDice?.();
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
    flushDeferredWhileDice,
  ]);
}
