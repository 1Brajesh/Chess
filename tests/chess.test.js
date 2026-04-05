import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STANDARD_START_FEN,
  boardMapToFen,
  buildChess,
  getCapturedPieces,
  getCapturedPiecesFromHistory,
  getMaterialBalance,
  makeFreePlayStateFromFen,
  normalizeFreePlayState,
  safeValidateFen,
} from '../src/lib/chess.js';

test('game history replays into the expected position', () => {
  const chess = buildChess({
    startFen: STANDARD_START_FEN,
    moves: [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'g1', to: 'f3' },
    ],
  });

  assert.equal(chess.fen(), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
});

test('free play state can round-trip a standard board through FEN conversion', () => {
  const freePlayState = makeFreePlayStateFromFen(STANDARD_START_FEN);
  const fen = boardMapToFen(freePlayState.position, freePlayState.turn);

  assert.equal(
    fen,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
  );
});

test('free play normalization keeps current fields and upgrades legacy history', () => {
  const freePlayState = normalizeFreePlayState({
    position: {
      e4: 'wK',
      e5: 'bK',
    },
    turn: 'b',
    history: [
      {
        e2: 'wK',
        e7: 'bK',
      },
    ],
  });

  assert.deepEqual(freePlayState, {
    position: {
      e4: 'wK',
      e5: 'bK',
    },
    turn: 'b',
    history: [
      {
        position: {
          e2: 'wK',
          e7: 'bK',
        },
        turn: 'w',
      },
    ],
  });
});

test('game-mode validation rejects positions without kings', () => {
  const validation = safeValidateFen('8/8/8/8/8/8/8/8 w - - 0 1');

  assert.equal(validation.valid, false);
});

test('captured pieces and material balance follow the move history', () => {
  const gameState = {
    startFen: STANDARD_START_FEN,
    moves: [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
      { from: 'd8', to: 'd5' },
    ],
  };

  const capturedPieces = getCapturedPieces(gameState);

  assert.deepEqual(capturedPieces.b, ['bP']);
  assert.deepEqual(capturedPieces.w, ['wP']);
  assert.deepEqual(getMaterialBalance(capturedPieces), { w: 0, b: 0 });
});

test('captured pieces can be derived from one verbose history replay', () => {
  const chess = buildChess({
    startFen: STANDARD_START_FEN,
    moves: [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
      { from: 'd8', to: 'd5' },
    ],
  });

  const capturedPieces = getCapturedPiecesFromHistory(
    chess.history({ verbose: true }),
  );

  assert.deepEqual(capturedPieces, {
    w: ['wP'],
    b: ['bP'],
  });
});
