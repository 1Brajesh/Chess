import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STANDARD_START_FEN,
  boardMapToFen,
  buildChess,
  getCapturedPieces,
  getMaterialBalance,
  makeEditorStateFromFen,
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

test('editor state can round-trip a standard board through FEN conversion', () => {
  const editor = makeEditorStateFromFen(STANDARD_START_FEN);
  const fen = boardMapToFen(editor.position, editor.turn);

  assert.equal(
    fen,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
  );
});

test('setup validation rejects positions without kings', () => {
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
