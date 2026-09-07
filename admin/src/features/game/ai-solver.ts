import { Direction } from './types';

export interface AiEvaluation {
  bestMove: Direction | null;
  confidence: number;
  scores: Record<Direction, number>;
  reason: string;
}

type Board = number[][];

/** Create a clone of a 4x4 board */
function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** Simulate moving in a direction and return the new board, or null if invalid */
function simulateMove(board: Board, direction: Direction): { nextBoard: Board; scoreGain: number } | null {
  const nextBoard = cloneBoard(board);
  let scoreGain = 0;
  let moved = false;

  const rotate = (b: Board) => {
    const N = 4;
    const res: Board = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        res[c][N - 1 - r] = b[r][c];
      }
    }
    return res;
  };

  // Convert all directions to LEFT move by rotating
  let workingBoard = nextBoard;
  let rotations = 0;
  if (direction === 'UP') rotations = 3;
  else if (direction === 'RIGHT') rotations = 2;
  else if (direction === 'DOWN') rotations = 1;

  for (let i = 0; i < rotations; i++) {
    workingBoard = rotate(workingBoard);
  }

  // Slide left
  for (let r = 0; r < 4; r++) {
    const row = workingBoard[r].filter((v) => v !== 0);
    const newRow: number[] = [];
    let skip = false;

    for (let c = 0; c < row.length; c++) {
      if (skip) {
        skip = false;
        continue;
      }
      if (c + 1 < row.length && row[c] === row[c + 1]) {
        const mergedVal = row[c] * 2;
        newRow.push(mergedVal);
        scoreGain += mergedVal;
        skip = true;
        moved = true;
      } else {
        newRow.push(row[c]);
      }
    }

    while (newRow.length < 4) {
      newRow.push(0);
    }

    for (let c = 0; c < 4; c++) {
      if (workingBoard[r][c] !== newRow[c]) {
        moved = true;
      }
      workingBoard[r][c] = newRow[c];
    }
  }

  // Rotate back
  const backRotations = (4 - rotations) % 4;
  for (let i = 0; i < backRotations; i++) {
    workingBoard = rotate(workingBoard);
  }

  if (!moved) return null;
  return { nextBoard: workingBoard, scoreGain };
}

/** Evaluate board heuristic score */
function evaluateBoard(board: Board): number {
  let emptyCells = 0;
  let smoothness = 0;
  let maxTile = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c];
      if (val === 0) {
        emptyCells++;
      } else {
        if (val > maxTile) maxTile = val;

        // Smoothness: adjacent differences (log scale)
        if (c + 1 < 4 && board[r][c + 1] !== 0) {
          smoothness -= Math.abs(Math.log2(val) - Math.log2(board[r][c + 1]));
        }
        if (r + 1 < 4 && board[r + 1][c] !== 0) {
          smoothness -= Math.abs(Math.log2(val) - Math.log2(board[r + 1][c]));
        }
      }
    }
  }

  // Monotonicity along rows and cols
  let monotonicity = 0;
  // Left/Right
  for (let r = 0; r < 4; r++) {
    let inc = 0;
    let dec = 0;
    for (let c = 0; c < 3; c++) {
      const curr = board[r][c] ? Math.log2(board[r][c]) : 0;
      const next = board[r][c + 1] ? Math.log2(board[r][c + 1]) : 0;
      if (curr > next) dec += next - curr;
      else if (next > curr) inc += curr - next;
    }
    monotonicity += Math.max(inc, dec);
  }
  // Up/Down
  for (let c = 0; c < 4; c++) {
    let inc = 0;
    let dec = 0;
    for (let r = 0; r < 3; r++) {
      const curr = board[r][c] ? Math.log2(board[r][c]) : 0;
      const next = board[r + 1][c] ? Math.log2(board[r + 1][c]) : 0;
      if (curr > next) dec += next - curr;
      else if (next > curr) inc += curr - next;
    }
    monotonicity += Math.max(inc, dec);
  }

  // Corner heuristic: bonus if max tile is at a corner
  const isCorner =
    board[0][0] === maxTile ||
    board[0][3] === maxTile ||
    board[3][0] === maxTile ||
    board[3][3] === maxTile;
  const cornerBonus = isCorner ? Math.log2(maxTile) * 8 : 0;

  return (
    emptyCells * 12 +
    smoothness * 2.5 +
    monotonicity * 3.5 +
    cornerBonus
  );
}

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

/**
 * AI Expectimax search to depth 2
 */
export function getAiRecommendation(board: Board): AiEvaluation {
  const scores: Record<Direction, number> = {
    UP: -Infinity,
    DOWN: -Infinity,
    LEFT: -Infinity,
    RIGHT: -Infinity,
  };

  let bestMove: Direction | null = null;
  let bestScore = -Infinity;

  for (const dir of DIRECTIONS) {
    const sim1 = simulateMove(board, dir);
    if (!sim1) continue;

    // Direct score evaluation
    const score1 = evaluateBoard(sim1.nextBoard) + sim1.scoreGain * 0.1;

    // Lookahead depth 2: evaluate subsequent best reply
    let lookaheadBest = -Infinity;
    for (const nextDir of DIRECTIONS) {
      const sim2 = simulateMove(sim1.nextBoard, nextDir);
      if (sim2) {
        const score2 = evaluateBoard(sim2.nextBoard) + sim2.scoreGain * 0.1;
        if (score2 > lookaheadBest) lookaheadBest = score2;
      }
    }

    const totalScore = score1 + (lookaheadBest > -Infinity ? lookaheadBest * 0.8 : 0);
    scores[dir] = totalScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMove = dir;
    }
  }

  if (!bestMove) {
    return {
      bestMove: null,
      confidence: 0,
      scores,
      reason: "Harakat imkoni qolmadi",
    };
  }

  // Calculate confidence relative to other possible moves
  const validScores = Object.values(scores).filter((s) => s > -Infinity);
  let confidence = 85;
  if (validScores.length > 1) {
    const sorted = [...validScores].sort((a, b) => b - a);
    const diff = sorted[0] - sorted[1];
    confidence = Math.min(99, Math.max(60, Math.round(75 + diff * 2.5)));
  }

  const reasonMap: Record<Direction, string> = {
    UP: "Yuqoriga surish bo'sh joylarni saqlab, yirik xonadonlarni burchakka jamlaydi.",
    DOWN: "Pastga surish xavfsiz va yirik binolarni pastki burchakka mustahkamlaydi.",
    LEFT: "Chapga surish optimal: chap tomonda kuchli birlashuv hosil bo'ladi.",
    RIGHT: "O'ngga surish yangi maydon ochadi va birlashish zanjirini yaratadi.",
  };

  return {
    bestMove,
    confidence,
    scores,
    reason: reasonMap[bestMove],
  };
}
