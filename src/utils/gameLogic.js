/**
 * Длинные нарды (Long Backgammon) — Game Logic
 *
 * Board: Array(24), index 0–23 = points 1–24
 *   positive values = Player 1 checkers
 *   negative values = Player 2 checkers
 *
 * Player 1: Head at index 23 (point 24), moves 23→22→…→0, home = indices 0–5
 * Player 2: Head at index 11 (point 12), moves 11→10→…→0→23→22→…→12, home = indices 12–17
 * Both players move counter-clockwise (same direction).
 * No hitting — a point occupied by the opponent is completely blocked.
 */

const HEAD_INDEX = { 1: 23, 2: 11 };

// ---------------------------------------------------------------------------
// Path-position helpers.
// pathPos 0 = head, pathPos 23 = last point before bearing off.
// ---------------------------------------------------------------------------

function indexToPathPos(player, index) {
  if (player === 1) return 23 - index;
  return index <= 11 ? 11 - index : 35 - index;
}

function pathPosToIndex(player, pathPos) {
  if (player === 1) return 23 - pathPos;
  return pathPos <= 11 ? 11 - pathPos : 35 - pathPos;
}

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

function isOwnChecker(board, index, player) {
  return player === 1 ? board[index] > 0 : board[index] < 0;
}

function isOpponentChecker(board, index, player) {
  return player === 1 ? board[index] < 0 : board[index] > 0;
}

function canLandOn(board, index, player) {
  if (index < 0 || index > 23) return false;
  if (board[index] === 0) return true;
  return isOwnChecker(board, index, player);
}

function allCheckersInHome(board, player) {
  for (let i = 0; i < 24; i++) {
    if (player === 1 && board[i] > 0 && i > 5) return false;
    if (player === 2 && board[i] < 0 && (i < 12 || i > 17)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Block rule: нельзя строить блок из 6+ подряд закрытых пунктов,
// если перед ним нет ни одной шашки противника.
// «Перед» = дальше по пути противника (больший pathPos противника).
// ---------------------------------------------------------------------------

function wouldCreateIllegalBlock(board, player) {
  const opponent = player === 1 ? 2 : 1;
  let runLength = 0;

  for (let pp = 0; pp < 24; pp++) {
    const idx = pathPosToIndex(opponent, pp);
    if (isOwnChecker(board, idx, player)) {
      runLength++;
      if (runLength >= 6) {
        let opponentPast = false;
        for (let cpp = pp + 1; cpp < 24; cpp++) {
          const cidx = pathPosToIndex(opponent, cpp);
          if (isOwnChecker(board, cidx, opponent)) {
            opponentPast = true;
            break;
          }
        }
        if (!opponentPast) return true;
      }
    } else {
      runLength = 0;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Head rule: с головы можно снять только 1 шашку за ход.
// Исключение первого хода: дубль 3-3 / 4-4 / 6-6 → 2 шашки с головы,
// если одной шашкой невозможно сыграть все 4 хода.
// ---------------------------------------------------------------------------

function canSingleCheckerPlayAll(board, player, dieValue, numMoves) {
  let pathPos = 0;
  for (let i = 0; i < numMoves; i++) {
    pathPos += dieValue;
    if (pathPos > 23) return false;
    const idx = pathPosToIndex(player, pathPos);
    if (isOpponentChecker(board, idx, player)) return false;
  }
  return true;
}

function getMaxHeadMoves(gameState) {
  const player = gameState.currentPlayer;
  if (!gameState.isFirstMove || !gameState.isFirstMove[player]) return 1;
  const d = gameState.dice;
  if (!d || d.length !== 2 || d[0] !== d[1]) return 1;
  if (![3, 4, 6].includes(d[0])) return 1;
  if (canSingleCheckerPlayAll(gameState.board, player, d[0], 4)) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export function createInitialBoard() {
  const board = new Array(24).fill(0);
  board[23] = 15;  // Player 1 head (point 24)
  board[11] = -15; // Player 2 head (point 12)
  return board;
}

export function createInitialGameState() {
  return {
    board: createInitialBoard(),
    bar: { 1: 0, 2: 0 },
    borneOff: { 1: 0, 2: 0 },
    currentPlayer: 0,
    dice: [],
    remainingMoves: [],
    gameOver: false,
    winner: null,
    mars: false,
    turnPhase: 'roll', // 'preroll' | 'roll' | 'move'
    gameStarted: false,
    preStartRolls: { 1: null, 2: null }, // each player rolls 1 die to decide who starts
    headMovesThisTurn: 0,
    isFirstMove: { 1: true, 2: true },
  };
}

/** Восстанавливает gameOver/winner/mars из позиции (в БД эти поля не храним). */
function hydrateTerminalOutcome(gs) {
  if (!gs || typeof gs.borneOff !== 'object') return gs;
  if (gs.borneOff[1] === 15) {
    gs.gameOver = true;
    gs.winner = 1;
    gs.mars = gs.borneOff[2] === 0;
  } else if (gs.borneOff[2] === 15) {
    gs.gameOver = true;
    gs.winner = 2;
    gs.mars = gs.borneOff[1] === 0;
  }
  return gs;
}

/**
 * Миграция: если стейт из БД в старом формате (короткие нарды),
 * сбрасываем доску на начальную расстановку длинных нард.
 * Сохраняем мета-поля (currentPlayer, turnPhase и т.д.).
 */
export function migrateGameState(gs) {
  if (!gs) return createInitialGameState();
  let out;
  if (gs.isFirstMove) {
    if (!gs.preStartRolls) gs.preStartRolls = { 1: null, 2: null };
    out = gs;
  } else {
    const fresh = createInitialGameState();
    fresh.currentPlayer = gs.currentPlayer || 0;
    fresh.turnPhase = gs.turnPhase || 'roll';
    fresh.gameStarted = false;
    out = fresh;
  }
  return hydrateTerminalOutcome(out);
}

/** Убирает исход партии перед записью в Supabase (остаётся только позиция). */
export function stripTerminalMetaForDb(state) {
  if (!state || !state.gameOver) return state;
  return {
    ...state,
    gameOver: false,
    winner: null,
    mars: false,
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

// ---------------------------------------------------------------------------
// Move generation (raw — one die, no forced-play filtering yet)
// ---------------------------------------------------------------------------

function getMovesForDie(board, player, dieValue, headMoves, maxHead) {
  const moves = [];
  const inHome = allCheckersInHome(board, player);

  for (let i = 0; i < 24; i++) {
    if (player === 1 ? board[i] <= 0 : board[i] >= 0) continue;
    if (i === HEAD_INDEX[player] && headMoves >= maxHead) continue;

    const fromPP = indexToPathPos(player, i);
    const targetPP = fromPP + dieValue;

    if (targetPP <= 23) {
      const targetIdx = pathPosToIndex(player, targetPP);
      if (canLandOn(board, targetIdx, player)) {
        const tb = [...board];
        if (player === 1) { tb[i]--; tb[targetIdx]++; } else { tb[i]++; tb[targetIdx]--; }
        if (!wouldCreateIllegalBlock(tb, player)) {
          moves.push({ from: i, to: targetIdx, die: dieValue });
        }
      }
    } else if (inHome) {
      // Bearing off
      if (targetPP === 24) {
        moves.push({ from: i, to: 'off', die: dieValue });
      } else {
        // Oversized die: допустимо, только если нет своих шашек дальше от выброса
        let canBearOff = true;
        for (let pp = 18; pp < fromPP; pp++) {
          const idx = pathPosToIndex(player, pp);
          if (player === 1 ? board[idx] > 0 : board[idx] < 0) {
            canBearOff = false;
            break;
          }
        }
        if (canBearOff) {
          moves.push({ from: i, to: 'off', die: dieValue });
        }
      }
    }
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Forced-play search: определяем максимальное количество ходов,
// которые можно сделать из данной позиции (для правила обязательного хода).
// ---------------------------------------------------------------------------

function maxMovesReachable(board, player, remainingDice, headMoves, maxHead) {
  if (remainingDice.length === 0) return 0;

  const uniqueDice = [...new Set(remainingDice)];
  let best = 0;

  for (const die of uniqueDice) {
    const moves = getMovesForDie(board, player, die, headMoves, maxHead);
    for (const move of moves) {
      const nb = [...board];
      if (player === 1) { nb[move.from]--; } else { nb[move.from]++; }
      if (move.to !== 'off') {
        if (player === 1) { nb[move.to]++; } else { nb[move.to]--; }
      }
      const nh = (move.from === HEAD_INDEX[player]) ? headMoves + 1 : headMoves;
      const nr = [...remainingDice];
      nr.splice(nr.indexOf(die), 1);
      const sub = 1 + maxMovesReachable(nb, player, nr, nh, maxHead);
      if (sub > best) best = sub;
      if (best === remainingDice.length) return best;
    }
    if (best === remainingDice.length) return best;
  }
  return best;
}

// ---------------------------------------------------------------------------
// getAllValidMoves — учитывает правило обязательного полного хода:
// 1. Использовать оба кубика если возможно
// 2. Если можно только один — использовать бо́льший
// 3. При дубле — максимум из 4 ходов
// ---------------------------------------------------------------------------

export function getAllValidMoves(gameState) {
  const { remainingMoves, currentPlayer, board } = gameState;
  if (!remainingMoves || remainingMoves.length === 0) return [];

  const maxHead = getMaxHeadMoves(gameState);
  const headMoves = gameState.headMovesThisTurn || 0;
  const uniqueDice = [...new Set(remainingMoves)];

  const allFirstMoves = [];
  for (const die of uniqueDice) {
    allFirstMoves.push(...getMovesForDie(board, currentPlayer, die, headMoves, maxHead));
  }
  if (allFirstMoves.length === 0) return [];
  if (remainingMoves.length <= 1) return allFirstMoves;

  const maxReachable = maxMovesReachable(board, currentPlayer, remainingMoves, headMoves, maxHead);
  if (maxReachable === 0) return [];

  // Если можно только 1 ход и кубики разные — обязан сыграть бо́льший
  if (maxReachable === 1 && uniqueDice.length > 1) {
    const maxDie = Math.max(...uniqueDice);
    const maxDieMoves = allFirstMoves.filter((m) => m.die === maxDie);
    if (maxDieMoves.length > 0) return maxDieMoves;
    return allFirstMoves;
  }

  // Оставляем только ходы, ведущие к максимальному использованию кубиков
  const validFirstMoves = allFirstMoves.filter((move) => {
    const nb = [...board];
    if (currentPlayer === 1) { nb[move.from]--; } else { nb[move.from]++; }
    if (move.to !== 'off') {
      if (currentPlayer === 1) { nb[move.to]++; } else { nb[move.to]--; }
    }
    const nh = (move.from === HEAD_INDEX[currentPlayer]) ? headMoves + 1 : headMoves;
    const nr = [...remainingMoves];
    nr.splice(nr.indexOf(move.die), 1);
    return 1 + maxMovesReachable(nb, currentPlayer, nr, nh, maxHead) === maxReachable;
  });

  return validFirstMoves.length > 0 ? validFirstMoves : allFirstMoves;
}

// ---------------------------------------------------------------------------
// Вспомогательные экспорты для UI
// ---------------------------------------------------------------------------

export function getValidMovesForChecker(gameState, fromIndex, dieValue) {
  return getAllValidMoves(gameState).filter((m) => m.from === fromIndex && m.die === dieValue);
}

export function getHighlightedPoints(gameState, selectedFrom) {
  if (selectedFrom === null || selectedFrom === undefined) return [];
  return getAllValidMoves(gameState).filter((m) => m.from === selectedFrom);
}

// ---------------------------------------------------------------------------
// Варианты хода для UI: одиночные (по одному кубику) + “дальние” (по двум кубикам подряд одной шашкой).
// Это позволяет показать пользователю опции вроде 3, 2, и 3+2 (или 2+3) из одной выбранной шашки.
// ---------------------------------------------------------------------------

function pickTwoDiceOrders(remainingMoves) {
  if (!Array.isArray(remainingMoves) || remainingMoves.length < 2) return [];
  // Берём все упорядоченные пары значений с учётом мультисета (на дубле получится одна пара (d,d)).
  const orders = [];
  for (let i = 0; i < remainingMoves.length; i++) {
    for (let j = 0; j < remainingMoves.length; j++) {
      if (i === j) continue;
      orders.push([remainingMoves[i], remainingMoves[j]]);
    }
  }
  const uniq = new Set();
  const out = [];
  for (const [a, b] of orders) {
    const k = `${a},${b}`;
    if (uniq.has(k)) continue;
    uniq.add(k);
    out.push([a, b]);
  }
  return out;
}

export function getMoveOptionsForSelection(gameState, selectedFrom) {
  if (selectedFrom === null || selectedFrom === undefined) return [];

  const firstMoves = getAllValidMoves(gameState).filter((m) => m.from === selectedFrom);
  const options = firstMoves.map((m) => ({ ...m, kind: 'single', sequence: [m] }));

  // Если выбираем не точку (например бар) или нет 2+ кубиков — “дальние” не строим.
  if (typeof selectedFrom !== 'number') return options;
  if (!Array.isArray(gameState.remainingMoves) || gameState.remainingMoves.length < 2) return options;

  const orders = pickTwoDiceOrders(gameState.remainingMoves);
  const dedupe = new Set(options.map((o) => `${o.from}->${o.to}|${o.kind}|${o.die}`));

  for (const [d1, d2] of orders) {
    // ВАЖНО: для “дальних” ходов не используем getAllValidMoves (там есть forced-play фильтрация),
    // иначе UI часто показывает только первый обязательный кубик и не рисует конечную точку суммы.
    const maxHead1 = getMaxHeadMoves(gameState);
    const headMoves1 = gameState.headMovesThisTurn || 0;
    const step1 = getMovesForDie(gameState.board, gameState.currentPlayer, d1, headMoves1, maxHead1).filter(
      (m) => m.from === selectedFrom && m.to !== 'off'
    );
    for (const m1 of step1) {
      const s1 = simulateMove(gameState, m1);
      const maxHead2 = getMaxHeadMoves(s1);
      const headMoves2 = s1.headMovesThisTurn || 0;
      const step2 = getMovesForDie(s1.board, s1.currentPlayer, d2, headMoves2, maxHead2).filter(
        (m) => m.from === m1.to
      );
      for (const m2 of step2) {
        const opt = {
          from: selectedFrom,
          to: m2.to,
          kind: 'combo',
          dice: [d1, d2],
          via: m1.to,
          sequence: [m1, m2],
        };
        const key = `${opt.from}->${opt.to}|combo|${d1},${d2}|via:${opt.via}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        options.push(opt);
      }
    }
  }

  return options;
}

export function shouldAutoEndTurn(gameState) {
  return (
    gameState.remainingMoves &&
    gameState.remainingMoves.length > 0 &&
    getAllValidMoves(gameState).length === 0
  );
}

// ---------------------------------------------------------------------------
// simulateMove — механическое применение хода (без проверки конца хода).
// Используется внутри applyMove и для симуляции.
// ---------------------------------------------------------------------------

function simulateMove(gameState, move) {
  const newState = JSON.parse(JSON.stringify(gameState));
  const { board, borneOff, currentPlayer } = newState;
  const { from, to, die } = move;

  if (currentPlayer === 1) board[from]--;
  else board[from]++;

  if (to === 'off') {
    borneOff[currentPlayer]++;
  } else {
    if (currentPlayer === 1) board[to]++;
    else board[to]--;
  }

  if (from === HEAD_INDEX[currentPlayer]) {
    newState.headMovesThisTurn = (newState.headMovesThisTurn || 0) + 1;
  }

  const dieIdx = newState.remainingMoves.indexOf(die);
  if (dieIdx !== -1) newState.remainingMoves.splice(dieIdx, 1);

  return newState;
}

// ---------------------------------------------------------------------------
// applyMove — основная функция для применения хода игроком.
// Проверяет победу, марс, конец хода.
// ---------------------------------------------------------------------------

export function applyMove(gameState, move) {
  const newState = simulateMove(gameState, move);
  const { borneOff, currentPlayer } = newState;

  if (borneOff[currentPlayer] === 15) {
    newState.gameOver = true;
    newState.winner = currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;
    newState.mars = borneOff[opponent] === 0;
  }

  if (!newState.gameOver) {
    if (newState.remainingMoves.length === 0 || getAllValidMoves(newState).length === 0) {
      if (!newState.isFirstMove) newState.isFirstMove = { 1: true, 2: true };
      newState.isFirstMove = { ...newState.isFirstMove, [currentPlayer]: false };
      newState.turnPhase = 'roll';
      newState.currentPlayer = currentPlayer === 1 ? 2 : 1;
      newState.dice = [];
      newState.remainingMoves = [];
      newState.headMovesThisTurn = 0;
    }
  }

  return newState;
}

export function applyMoveSequence(gameState, moves) {
  if (!Array.isArray(moves) || moves.length === 0) return gameState;
  let st = gameState;
  for (const m of moves) st = simulateMove(st, m);

  const { borneOff, currentPlayer } = st;

  if (borneOff[currentPlayer] === 15) {
    st.gameOver = true;
    st.winner = currentPlayer;
    const opponent = currentPlayer === 1 ? 2 : 1;
    st.mars = borneOff[opponent] === 0;
  }

  if (!st.gameOver) {
    if (st.remainingMoves.length === 0 || getAllValidMoves(st).length === 0) {
      if (!st.isFirstMove) st.isFirstMove = { 1: true, 2: true };
      st.isFirstMove = { ...st.isFirstMove, [currentPlayer]: false };
      st.turnPhase = 'roll';
      st.currentPlayer = currentPlayer === 1 ? 2 : 1;
      st.dice = [];
      st.remainingMoves = [];
      st.headMovesThisTurn = 0;
    }
  }

  return st;
}
