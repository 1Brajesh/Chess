import { Chess } from 'chess.js';

export const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const DISPLAY_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const PIECE_SYMBOLS = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

export const PIECE_LABELS = {
  wK: 'White king',
  wQ: 'White queen',
  wR: 'White rook',
  wB: 'White bishop',
  wN: 'White knight',
  wP: 'White pawn',
  bK: 'Black king',
  bQ: 'Black queen',
  bR: 'Black rook',
  bB: 'Black bishop',
  bN: 'Black knight',
  bP: 'Black pawn',
  erase: 'Clear square',
};

const FEN_TO_PIECE = {
  k: 'bK',
  q: 'bQ',
  r: 'bR',
  b: 'bB',
  n: 'bN',
  p: 'bP',
  K: 'wK',
  Q: 'wQ',
  R: 'wR',
  B: 'wB',
  N: 'wN',
  P: 'wP',
};

const PIECE_TO_FEN = {
  bK: 'k',
  bQ: 'q',
  bR: 'r',
  bB: 'b',
  bN: 'n',
  bP: 'p',
  wK: 'K',
  wQ: 'Q',
  wR: 'R',
  wB: 'B',
  wN: 'N',
  wP: 'P',
};

const CAPTURE_DISPLAY_ORDER = {
  P: 0,
  N: 1,
  B: 2,
  R: 3,
  Q: 4,
  K: 5,
};

const PIECE_MATERIAL = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
};

export function createGameState(startFen = STANDARD_START_FEN) {
  return {
    startFen,
    moves: [],
  };
}

export function parseFen(fen = STANDARD_START_FEN) {
  const [placement = '', turn = 'w'] = fen.split(' ');
  const position = {};
  const rows = placement.split('/');

  rows.forEach((row, rowIndex) => {
    let fileIndex = 0;
    for (const token of row) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
        continue;
      }

      const square = `${FILES[fileIndex]}${8 - rowIndex}`;
      position[square] = FEN_TO_PIECE[token];
      fileIndex += 1;
    }
  });

  return {
    position,
    turn,
  };
}

export function boardMapToFen(position, turn = 'w') {
  const rows = DISPLAY_RANKS.map((rank) => {
    let emptyCount = 0;
    let row = '';

    for (const file of FILES) {
      const square = `${file}${rank}`;
      const piece = position[square];

      if (!piece) {
        emptyCount += 1;
        continue;
      }

      if (emptyCount > 0) {
        row += String(emptyCount);
        emptyCount = 0;
      }

      row += PIECE_TO_FEN[piece];
    }

    if (emptyCount > 0) {
      row += String(emptyCount);
    }

    return row;
  });

  return `${rows.join('/')} ${turn} - - 0 1`;
}

export function buildChess(gameState) {
  const chess = new Chess(gameState.startFen);

  for (const move of gameState.moves) {
    chess.move(move);
  }

  return chess;
}

export function getBoardRows(orientation = 'w') {
  const files = orientation === 'w' ? FILES : [...FILES].reverse();
  const ranks =
    orientation === 'w' ? DISPLAY_RANKS : [...DISPLAY_RANKS].reverse();

  return ranks.map((rank) => files.map((file) => `${file}${rank}`));
}

export function getPieceColor(piece) {
  if (!piece) {
    return null;
  }

  return piece.startsWith('w') ? 'w' : 'b';
}

export function isLightSquare(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (fileIndex + rank) % 2 === 1;
}

export function getMoveChoices(chess, square) {
  return chess.moves({ square, verbose: true });
}

export function getPromotionChoices(chess, from, to) {
  const choices = getMoveChoices(chess, from)
    .filter((move) => move.to === to && move.promotion)
    .map((move) => move.promotion);

  return [...new Set(choices)];
}

export function getLastMove(gameState) {
  const chess = buildChess(gameState);
  const history = chess.history({ verbose: true });
  return history.at(-1) ?? null;
}

export function getCapturedPieces(gameState) {
  const history = buildChess(gameState).history({ verbose: true });
  const capturedPieces = {
    w: [],
    b: [],
  };

  for (const move of history) {
    if (!move.captured) {
      continue;
    }

    const lostColor = move.color === 'w' ? 'b' : 'w';
    capturedPieces[lostColor].push(
      `${lostColor}${move.captured.toUpperCase()}`,
    );
  }

  const sortPieces = (pieces) =>
    [...pieces].sort((left, right) => {
      const rankDifference =
        CAPTURE_DISPLAY_ORDER[left[1]] - CAPTURE_DISPLAY_ORDER[right[1]];

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.localeCompare(right);
    });

  return {
    w: sortPieces(capturedPieces.w),
    b: sortPieces(capturedPieces.b),
  };
}

export function getMaterialBalance(capturedPieces) {
  const countMaterial = (pieces) =>
    pieces.reduce(
      (total, piece) => total + (PIECE_MATERIAL[piece[1]] ?? 0),
      0,
    );

  const whiteWins = countMaterial(capturedPieces.b);
  const blackWins = countMaterial(capturedPieces.w);
  const difference = whiteWins - blackWins;

  return {
    w: difference < 0 ? Math.abs(difference) : 0,
    b: difference > 0 ? difference : 0,
  };
}

export function safeValidateFen(fen) {
  try {
    new Chess(fen);
    return {
      valid: true,
      message: 'Position is ready for game mode.',
    };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Invalid position.',
    };
  }
}

export function makeEditorStateFromFen(fen) {
  const { position, turn } = parseFen(fen);
  return {
    position,
    turn,
  };
}

export function normalizeSetupState(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return makeEditorStateFromFen(STANDARD_START_FEN);
  }

  const nextPosition = {};

  if (candidate.position && typeof candidate.position === 'object') {
    for (const [square, piece] of Object.entries(candidate.position)) {
      if (/^[a-h][1-8]$/.test(square) && PIECE_SYMBOLS[piece]) {
        nextPosition[square] = piece;
      }
    }
  }

  return {
    position: nextPosition,
    turn: candidate.turn === 'b' ? 'b' : 'w',
  };
}

export function normalizeGameState(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return createGameState();
  }

  const nextGame = {
    startFen:
      typeof candidate.startFen === 'string'
        ? candidate.startFen
        : STANDARD_START_FEN,
    moves: Array.isArray(candidate.moves) ? candidate.moves : [],
  };

  try {
    buildChess(nextGame);
    return nextGame;
  } catch {
    return createGameState();
  }
}

export function serializeGameSummary(chess) {
  if (chess.isCheckmate()) {
    return `Checkmate. ${chess.turn() === 'w' ? 'Black' : 'White'} wins.`;
  }

  if (chess.isStalemate()) {
    return 'Draw by stalemate.';
  }

  if (chess.isThreefoldRepetition()) {
    return 'Draw by repetition.';
  }

  if (chess.isInsufficientMaterial()) {
    return 'Draw by insufficient material.';
  }

  if (chess.isDraw()) {
    return 'Draw.';
  }

  const turnLabel = chess.turn() === 'w' ? 'White' : 'Black';
  return chess.inCheck()
    ? `${turnLabel} to move. Check.`
    : `${turnLabel} to move.`;
}
