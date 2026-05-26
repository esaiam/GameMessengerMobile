import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playDiceRollSound } from '../../utils/diceSound';

/**
 * Анимация броска соперника: lastRollEvent и legacy sync по gameState.dice.
 */
export default function useGameDiceRemoteSync({
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
}) {
  useEffect(() => {
    if (boardMode !== 'match') return;
    if (!gameStarted) return;
    if (diceAnimating || showAnimDice) return;

    const evt = gameState?.lastRollEvent || null;
    const evtId = typeof evt?.id === 'string' ? evt.id : null;
    if (!evtId) return;
    if (prevNetRollEventIdRef.current === evtId) return;
    prevNetRollEventIdRef.current = evtId;

    if (evt?.by === playerNumber) return;
    if (lastLocalRollEventIdRef.current && lastLocalRollEventIdRef.current === evtId) return;

    const evtDice = Array.isArray(evt?.dice) ? evt.dice : [];
    if (evtDice.length !== 2) return;

    const now = Date.now();
    const at = typeof evt?.at === 'number' ? evt.at : now;
    const target = at + 50;
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
      if (boardMode !== 'match') return;
      if (diceAnimating || showAnimDice) return;

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
      playDiceRollSound();

      pendingRollRef.current = null;
      pauseJsForDiceThrowRef.current();
      setAnimDice(evtDice);
      setSwipeStart(startPos);
      setSwipeEnd(endPos);
      setShowAnimDice(true);
      setDiceAnimating(true);
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
    windowW,
    pauseJsForDiceThrowRef,
    pendingRollRef,
    prevNetRollEventIdRef,
    lastLocalRollEventIdRef,
    setAnimDice,
    setSwipeStart,
    setSwipeEnd,
    setShowAnimDice,
    setDiceAnimating,
  ]);

  useEffect(() => {
    if (boardMode !== 'match') return;
    if (!gameStarted) return;
    if (diceAnimating || showAnimDice) return;

    const nextDice = Array.isArray(gameState.dice) ? gameState.dice : [];
    const prevDice = Array.isArray(prevNetDiceRef.current) ? prevNetDiceRef.current : [];

    prevNetDiceRef.current = nextDice;

    if (nextDice.length !== 2) return;
    if (diceEqual(prevDice, nextDice)) return;

    const evt = gameState?.lastRollEvent || null;
    const evtDice = Array.isArray(evt?.dice) ? evt.dice : [];
    if (evtDice.length === 2 && diceEqual(evtDice, nextDice)) return;

    const lastLocal = lastLocalRealRollRef.current;
    if (lastLocal?.dice && diceEqual(lastLocal.dice, nextDice) && Date.now() - (lastLocal.at || 0) < 4000) {
      return;
    }

    pendingRollRef.current = null;
    pauseJsForDiceThrowRef.current();
    setAnimDice(nextDice);
    setSwipeStart({ x: 42, y: pointH * 1.25 });
    setSwipeEnd({ x: (windowW || Dimensions.get('window').width) - 42, y: pointH * 0.75 });
    setShowAnimDice(true);
    setDiceAnimating(true);
  }, [
    boardMode,
    gameStarted,
    gameState.dice,
    gameState?.lastRollEvent,
    diceAnimating,
    showAnimDice,
    diceEqual,
    pointH,
    windowW,
    pauseJsForDiceThrowRef,
    pendingRollRef,
    prevNetDiceRef,
    lastLocalRealRollRef,
    setAnimDice,
    setSwipeStart,
    setSwipeEnd,
    setShowAnimDice,
    setDiceAnimating,
  ]);
}

/** @returns {(a: number[] | null, b: number[] | null) => boolean} */
export function createDiceEqual() {
  return (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
}
