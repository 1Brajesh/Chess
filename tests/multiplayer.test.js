import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInviteUrl,
  createRoomCode,
  formatSeatLabel,
  getPlayerColorForRoom,
  normalizeRemoteGame,
  normalizeRoomCode,
} from '../src/lib/multiplayer.js';
import { STANDARD_START_FEN } from '../src/lib/chess.js';

test('normalizeRoomCode uppercases and strips invalid characters', () => {
  assert.equal(normalizeRoomCode(' ab-12z '), 'AB12Z');
  assert.equal(normalizeRoomCode('longerthan6chars'), 'LONGER');
});

test('createRoomCode returns a six-character invite code', () => {
  const roomCode = createRoomCode();

  assert.match(roomCode, /^[A-Z0-9]{6}$/);
});

test('getPlayerColorForRoom resolves both sides correctly', () => {
  const room = {
    white_player_id: 'white-user',
    black_player_id: 'black-user',
  };

  assert.equal(getPlayerColorForRoom(room, 'white-user'), 'w');
  assert.equal(getPlayerColorForRoom(room, 'black-user'), 'b');
  assert.equal(getPlayerColorForRoom(room, 'other-user'), null);
});

test('normalizeRemoteGame falls back cleanly', () => {
  assert.deepEqual(normalizeRemoteGame(null), {
    startFen: STANDARD_START_FEN,
    moves: [],
  });
});

test('formatSeatLabel keeps room copy readable', () => {
  assert.equal(formatSeatLabel('w'), 'White');
  assert.equal(formatSeatLabel('b'), 'Black');
  assert.equal(formatSeatLabel(null), 'Observer');
});

test('buildInviteUrl returns an empty string outside the browser', () => {
  assert.equal(buildInviteUrl('ABC123'), '');
});
