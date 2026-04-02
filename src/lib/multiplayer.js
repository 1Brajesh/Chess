import { STANDARD_START_FEN, normalizeGameState } from './chess.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

export const DEFAULT_ONLINE_STATE = {
  status: 'idle',
  roomId: null,
  roomCode: '',
  playerColor: null,
  remoteVersion: 0,
  inviteUrl: '',
  lastSyncedAt: null,
};

export function createRoomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) =>
    ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length],
  ).join('');
}

export function normalizeRoomCode(candidate) {
  if (typeof candidate !== 'string') {
    return '';
  }

  return candidate.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

export function getPlayerColorForRoom(room, userId) {
  if (!room || !userId) {
    return null;
  }

  if (room.white_player_id === userId) {
    return 'w';
  }

  if (room.black_player_id === userId) {
    return 'b';
  }

  return null;
}

export function normalizeRemoteGame(room) {
  return normalizeGameState({
    startFen:
      typeof room?.start_fen === 'string' ? room.start_fen : STANDARD_START_FEN,
    moves: Array.isArray(room?.moves) ? room.moves : [],
  });
}

export function buildInviteUrl(roomCode) {
  if (typeof window === 'undefined' || !roomCode) {
    return '';
  }

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export function readLinkedRoomCode() {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  return normalizeRoomCode(url.searchParams.get('room') ?? '');
}

export function writeLinkedRoomCode(roomCode) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);

  if (roomCode) {
    url.searchParams.set('room', roomCode);
  } else {
    url.searchParams.delete('room');
  }

  window.history.replaceState({}, '', url);
}

export function formatSeatLabel(playerColor) {
  if (playerColor === 'w') {
    return 'White';
  }

  if (playerColor === 'b') {
    return 'Black';
  }

  return 'Observer';
}

export function formatOnlineStatus(onlineState) {
  if (onlineState.status === 'hosting') {
    return 'Creating room...';
  }

  if (onlineState.status === 'joining') {
    return 'Joining room...';
  }

  if (onlineState.status === 'finished' && onlineState.roomCode) {
    return `Room ${onlineState.roomCode} finished`;
  }

  if (onlineState.roomCode && onlineState.playerColor) {
    return onlineState.status === 'waiting'
      ? `Room ${onlineState.roomCode} is waiting for Black`
      : `Live room ${onlineState.roomCode}`;
  }

  return 'Local-only play';
}
