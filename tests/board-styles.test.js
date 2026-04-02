import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BOARD_STYLE,
  normalizeBoardStyle,
} from '../src/lib/boardStyles.js';

test('normalizeBoardStyle accepts supported board styles', () => {
  assert.equal(normalizeBoardStyle('walnut'), 'walnut');
  assert.equal(normalizeBoardStyle('rosewood'), 'rosewood');
  assert.equal(normalizeBoardStyle('ebony'), 'ebony');
  assert.equal(normalizeBoardStyle('marble-mint'), 'marble-mint');
  assert.equal(normalizeBoardStyle('marble-rose'), 'marble-rose');
  assert.equal(normalizeBoardStyle('walnut-classic'), 'walnut-classic');
  assert.equal(normalizeBoardStyle('rosewood-classic'), 'rosewood-classic');
  assert.equal(normalizeBoardStyle('slate-classic'), 'slate-classic');
});

test('normalizeBoardStyle falls back for unsupported values', () => {
  assert.equal(normalizeBoardStyle('anything-else'), DEFAULT_BOARD_STYLE);
  assert.equal(normalizeBoardStyle(undefined), DEFAULT_BOARD_STYLE);
});
