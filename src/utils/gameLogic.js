/**
 * Backgammon Game Logic
 *
 * Board representation: Array(24) of integers
 *   positive = player 1 checkers, negative = player 2 checkers
 *
 * Player 1 moves from high index → low index (home = indices 0-5)
 * Player 2 moves from low index → high index (home = indices 18-23)
 */

export function createInitialBoard() {
  const board = new Array(24).fill(0);
  // Player 1 (positive)
  board[0] = 2;
  board[11] = 5;
  board[16] = 3;
  board[18] = 5;
  // Player 2 (negative)
  board[23] = -2;
  board[12] = -5;
  board[7] = -3;
  board[5] = -5;
  return board;
}

export function createInitialGameState() {
  return {
    board: createInitialBoard(),
    bar: { 1: 0, 2: 0 },
    borneOff: { 1: 0, 2: 0 },
    currentPlayer: 0, // 0 = not started, 1 or 2
    dice: [],
    remainingMoves: [],
    gameOver: false,
    winner: null,
    turnPhase: 'roll', // 'roll' | 'move'
  };
}

export function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

export function diceToMoves(dice) {
  if (dice.length === 2 && dice[0] === dice[1]) {
    return [dice[0], dice[0], dice[0], dice[0]];
  }
  return [...dice];
}

function direction(player) {
  return player === 1 ? -1 : 1;
}

function isOwnChecker(board, index, player) {
  if (player === 1) return board[index] > 0;
  return board[index] < 0;
}

function isOpponentChecker(board, index, player) {
  if (player === 1) return board[index] < 0;
  return board[index] > 0;
}

function checkerCount(board, index) {
  return Math.abs(board[index]);
}

function allCheckersInHome(board, bar, player) {
  if (bar[player] > 0) return false;
  if (player === 1) {
    for (let i = 6; i < 24; i++) {
      if (board[i] > 0) return false;
    }
    return true;
  } else {
    for (let i = 0; i < 18; i++) {
      if (board[i] < 0) return false;
    }
    return true;
  }
}

function highestOccupiedPoint(board, player) {
  if (player === 1) {
    for (let i = 5; i >= 0; i--) {
      if (board[i] > 0) return i;
    }
  } else {
    for (let i = 18; i <= 23; i++) {
      if (board[i] < 0) return i;
    }
  }
  return -1;
}

function canLandOn(board, index, player) {
  if (index < 0 || index > 23) return false;
  const count = checkerCount(board, index);
  if (count <= 1) return true;
  return isOwnChecker(board, index, player) || count === 0;
}

export function getValidMovesForChecker(gameState, fromIndex, dieValue) {
  const { board, bar, borneOff, currentPlayer } = gameState;
  const moves = [];

  if (bar[currentPlayer] > 0 && fromIndex !== 'bar') return moves;

  let targetIndex;
  if (fromIndex === 'bar') {
    if (currentPlayer === 1) {
      targetIndex = 24 - dieValue;
    } else {
      targetIndex = dieValue - 1;
    }

    if (targetIndex >= 0 && targetIndex <= 23 && canLandOn(board, targetIndex, currentPlayer)) {
      moves.push({ from: 'bar', to: targetIndex, die: dieValue });
    }
    return moves;
  }

  if (!isOwnChecker(board, fromIndex, currentPlayer)) return moves;

  const dir = direction(currentPlayer);
  targetIndex = fromIndex + dir * dieValue;

  if (targetIndex >= 0 && targetIndex <= 23) {
    if (canLandOn(board, targetIndex, currentPlayer)) {
      moves.push({ from: fromIndex, to: targetIndex, die: dieValue });
    }
  } else if (allCheckersInHome(board, bar, currentPlayer)) {
    if (currentPlayer === 1) {
      if (fromIndex - dieValue < 0) {
        const highest = highestOccupiedPoint(board, 1);
        if (fromIndex === highest || fromIndex - dieValue === -1) {
          moves.push({ from: fromIndex, to: 'off', die: dieValue });
        }
      }
    } else {
      if (fromIndex + dieValue > 23) {
        const highest = highestOccupiedPoint(board, 2);
        if (fromIndex === highest || fromIndex + dieValue === 24) {
          moves.push({ from: fromIndex, to: 'off', die: dieValue });
        }
      }
    }
  }

  return moves;
}

export function getAllValidMoves(gameState) {
  const { board, bar, currentPlayer, remainingMoves } = gameState;
  const allMoves = [];
  const uniqueDice = [...new Set(remainingMoves)];

  for (const die of uniqueDice) {
    if (bar[currentPlayer] > 0) {
      const barMoves = getValidMovesForChecker(gameState, 'bar', die);
      allMoves.push(...barMoves);
    } else {
      for (let i = 0; i < 24; i++) {
        if (isOwnChecker(board, i, currentPlayer)) {
          const checkerMoves = getValidMovesForChecker(gameState, i, die);
          allMoves.push(...checkerMoves);
        }
      }
    }
  }

  return allMoves;
}

export function applyMove(gameState, move) {
  const newState = JSON.parse(JSON.stringify(gameState));
  const { board, bar, borneOff, currentPlayer } = newState;
  const { from, to, die } = move;

  // Remove from source
  if (from === 'bar') {
    bar[currentPlayer]--;
  } else {
    if (currentPlayer === 1) board[from]--;
    else board[from]++;
  }

  // Place at destination
  if (to === 'off') {
    borneOff[currentPlayer]++;
  } else {
    // Check for hit
    if (isOpponentChecker(board, to, currentPlayer)) {
      const opponent = currentPlayer === 1 ? 2 : 1;
      bar[opponent]++;
      board[to] = 0;
    }
    if (currentPlayer === 1) board[to]++;
    else board[to]--;
  }

  // Remove used die
  const dieIdx = newState.remainingMoves.indexOf(die);
  if (dieIdx !== -1) newState.remainingMoves.splice(dieIdx, 1);

  // Check win
  if (borneOff[currentPlayer] === 15) {
    newState.gameOver = true;
    newState.winner = currentPlayer;
  }

  // Check if turn should end
  if (newState.remainingMoves.length === 0 || (!newState.gameOver && getAllValidMoves(newState).length === 0)) {
    newState.turnPhase = 'roll';
    newState.currentPlayer = currentPlayer === 1 ? 2 : 1;
    newState.dice = [];
    newState.remainingMoves = [];
  }

  return newState;
}

export function getHighlightedPoints(gameState, selectedFrom) {
  if (selectedFrom === null || selectedFrom === undefined) return [];
  const moves = [];
  const uniqueDice = [...new Set(gameState.remainingMoves)];

  for (const die of uniqueDice) {
    const dieMoves = getValidMovesForChecker(gameState, selectedFrom, die);
    moves.push(...dieMoves);
  }

  return moves;
}

export function shouldAutoEndTurn(gameState) {
  return gameState.remainingMoves.length > 0 && getAllValidMoves(gameState).length === 0;
}
