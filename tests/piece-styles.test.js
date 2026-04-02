import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PIECE_STYLE,
  normalizePieceStyle,
} from '../src/lib/pieceStyles.js';

test('normalizePieceStyle accepts supported piece styles', () => {
  assert.equal(normalizePieceStyle('wood'), 'wood');
  assert.equal(normalizePieceStyle('neo-wood'), 'neo-wood');
  assert.equal(normalizePieceStyle('classic'), 'classic');
  assert.equal(normalizePieceStyle('outline'), 'outline');
  assert.equal(normalizePieceStyle('ornate'), 'ornate');
});

test('normalizePieceStyle falls back for unsupported values', () => {
  assert.equal(normalizePieceStyle('anything-else'), DEFAULT_PIECE_STYLE);
  assert.equal(normalizePieceStyle(undefined), DEFAULT_PIECE_STYLE);
});
