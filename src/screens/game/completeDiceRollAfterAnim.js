import { Alert } from 'react-native';
import { diceToMoves, getAllValidMoves } from '../../utils/gameLogic';

function finishAnim({ setShowAnimDice, setDiceAnimating, setAnimDice }) {
  setShowAnimDice(false);
  setDiceAnimating(false);
  if (setAnimDice) setAnimDice(null);
}

/**
 * Обработка окончания 3D-броска: preroll, обычный roll, нет ходов.
 */
export async function completeDiceRollAfterAnim({
  pendingDice,
  gameStateRef,
  playerNumber,
  syncGameState,
  setGameState,
  setUiDice,
  setShowAnimDice,
  setDiceAnimating,
  setAnimDice,
}) {
  if (!pendingDice) {
    finishAnim({ setShowAnimDice, setDiceAnimating, setAnimDice });
    return;
  }

  const gs = gameStateRef.current;

  if (gs.turnPhase === 'preroll') {
    const die1 = pendingDice?.[0];
    const die2 = pendingDice?.[1];
    if (!die1 || !die2) {
      finishAnim({ setShowAnimDice, setDiceAnimating });
      return;
    }
    const myRoll = [die1, die2];
    const nextRolls = {
      ...(gs.preStartRolls || { 1: null, 2: null }),
      [gs.currentPlayer]: myRoll,
    };
    const r1 = nextRolls[1];
    const r2 = nextRolls[2];
    const p1 = r1 ? r1[0] + r1[1] : null;
    const p2 = r2 ? r2[0] + r2[1] : null;
    let newState = {
      ...gs,
      preStartRolls: nextRolls,
      dice: [],
      remainingMoves: [],
      headMovesThisTurn: 0,
    };
    setUiDice(myRoll);
    if (p1 == null || p2 == null) {
      newState.currentPlayer = gs.currentPlayer === 1 ? 2 : 1;
      newState.turnPhase = 'preroll';
      setGameState(newState);
      await syncGameState(newState);
      finishAnim({ setShowAnimDice, setDiceAnimating });
      return;
    }
    if (p1 === p2) {
      newState = {
        ...newState,
        preStartRolls: { 1: null, 2: null },
        currentPlayer: 1,
        turnPhase: 'preroll',
      };
      setGameState(newState);
      await syncGameState(newState);
      finishAnim({ setShowAnimDice, setDiceAnimating });
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
    finishAnim({ setShowAnimDice, setDiceAnimating });
    return;
  }

  setUiDice(pendingDice);
  const moves = diceToMoves(pendingDice);
  const newState = {
    ...gs,
    currentPlayer: gs.currentPlayer,
    dice: pendingDice,
    remainingMoves: moves,
    turnPhase: 'move',
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
      isFirstMove: {
        ...(newState.isFirstMove || { 1: true, 2: true }),
        [playerNumber]: false,
      },
    };
    setGameState(autoEndState);
    await syncGameState(autoEndState);
    finishAnim({ setShowAnimDice, setDiceAnimating });
    Alert.alert('Нет ходов', 'У тебя нет доступных ходов. Ход переходит сопернику.');
    return;
  }

  setGameState(newState);
  await syncGameState(newState);
  finishAnim({ setShowAnimDice, setDiceAnimating });
}
