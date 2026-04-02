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
});

test('normalizeBoardStyle falls back for unsupported values', () => {
  assert.equal(normalizeBoardStyle('anything-else'), DEFAULT_BOARD_STYLE);
  assert.equal(normalizeBoardStyle(undefined), DEFAULT_BOARD_STYLE);
});
