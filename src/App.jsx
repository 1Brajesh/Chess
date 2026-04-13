import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  PIECE_LABELS,
  STANDARD_START_FEN,
  boardMapToFen,
  buildChess,
  createGameState,
  getBoardRows,
  getCapturedPiecesFromHistory,
  getMaterialBalance,
  getMoveChoices,
  getPieceColor,
  getPromotionChoices,
  makeFreePlayStateFromFen,
  normalizeGameState,
  normalizeFreePlayState,
  parseFen,
  safeValidateFen,
  serializeGameSummary,
} from './lib/chess.js';
import BoardPanel from './components/BoardPanel.jsx';
import CustomizeCard from './components/CustomizeCard.jsx';
import ModeCard from './components/ModeCard.jsx';
import OnlinePlayCard from './components/OnlinePlayCard.jsx';
import SaveLoadCard from './components/SaveLoadCard.jsx';
import {
  BOARD_STYLE_OPTIONS,
  DEFAULT_BOARD_STYLE,
  normalizeBoardStyle,
} from './lib/boardStyles.js';
import {
  DEFAULT_PIECE_STYLE,
  PIECE_STYLE_OPTIONS,
  normalizePieceStyle,
} from './lib/pieceStyles.js';
import {
  DEFAULT_ONLINE_STATE,
  buildInviteUrl,
  createRoomCode,
  formatOnlineStatus,
  formatSeatLabel,
  getPlayerColorForRoom,
  normalizeRemoteGame,
  normalizeRoomCode,
  readLinkedRoomCode,
  writeLinkedRoomCode,
} from './lib/multiplayer.js';
import { HAS_SUPABASE_CONFIG, supabase } from './lib/supabase.js';

const APP_STORAGE_KEY = 'chess-board-session-v1';
const SAVES_STORAGE_KEY = 'chess-board-saves-v1';
const DISPLAY_PREFS_VERSION = 3;
const FREE_PLAY_UNDO_LIMIT = 200;

function createDefaultAuthState() {
  return {
    ready: !HAS_SUPABASE_CONFIG,
    userId: null,
    error: '',
  };
}

const PALETTE_PIECES = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
  'erase',
];

const MODE_LABELS = {
  game: 'Game',
  freeplay: 'Free Play',
};

function areBoardPositionsEqual(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function areFreePlaySnapshotsEqual(left, right) {
  return left?.turn === right?.turn &&
    areBoardPositionsEqual(left?.position, right?.position);
}

function loadPersistedApp() {
  const fallback = {
    mode: 'game',
    orientation: 'w',
    boardStyle: DEFAULT_BOARD_STYLE,
    pieceStyle: DEFAULT_PIECE_STYLE,
    gameState: createGameState(),
    freePlayState: makeFreePlayStateFromFen(STANDARD_START_FEN),
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(APP_STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    const pieceStyle =
      parsed.displayPrefsVersion === DISPLAY_PREFS_VERSION
        ? normalizePieceStyle(parsed.pieceStyle)
        : parsed.pieceStyle == null || parsed.pieceStyle === 'staunton'
          ? DEFAULT_PIECE_STYLE
          : normalizePieceStyle(parsed.pieceStyle);

    return {
      mode:
        parsed.mode === 'setup' || parsed.mode === 'freeplay'
          ? 'freeplay'
          : 'game',
      orientation: parsed.orientation === 'b' ? 'b' : 'w',
      boardStyle: normalizeBoardStyle(parsed.boardStyle),
      pieceStyle,
      gameState: normalizeGameState(parsed.gameState),
      freePlayState: normalizeFreePlayState(
        parsed.freePlayState ?? parsed.setupState,
      ),
    };
  } catch {
    return fallback;
  }
}

function loadSavedItems() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string'
      ) {
        return [];
      }

      if (item.type === 'game' || item.type === 'freeplay') {
        return [item];
      }

      if (item.type === 'setup') {
        return [
          {
            ...item,
            type: 'freeplay',
            payload: {
              freePlayState: normalizeFreePlayState(item.payload?.setupState),
              orientation: item.payload?.orientation,
            },
          },
        ];
      }

      return [];
    });
  } catch {
    return [];
  }
}

function createSaveId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [persisted] = useState(loadPersistedApp);
  const [mode, setMode] = useState(persisted.mode);
  const [orientation, setOrientation] = useState(persisted.orientation);
  const [boardStyle, setBoardStyle] = useState(persisted.boardStyle);
  const [pieceStyle, setPieceStyle] = useState(persisted.pieceStyle);
  const [authState, setAuthState] = useState(createDefaultAuthState);
  const [onlineState, setOnlineState] = useState(DEFAULT_ONLINE_STATE);
  const [roomCodeInput, setRoomCodeInput] = useState(readLinkedRoomCode);
  const [manualHostColor, setManualHostColor] = useState(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customizeTab, setCustomizeTab] = useState('board');
  const [gameState, setGameState] = useState(persisted.gameState);
  const [freePlayState, setFreePlayState] = useState(persisted.freePlayState);
  const [savedItems, setSavedItems] = useState(loadSavedItems);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [dragSquare, setDragSquare] = useState(null);
  const [selectedPalettePiece, setSelectedPalettePiece] = useState('wP');
  const [isFreePlayPaletteArmed, setIsFreePlayPaletteArmed] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState('Board ready.');
  const [captureAnimation, setCaptureAnimation] = useState(null);
  const previousMoveCountRef = useRef(persisted.gameState.moves.length);
  const roomChannelRef = useRef(null);

  const chess = buildChess(gameState);
  const gameBoard = parseFen(chess.fen());
  const verboseMoveHistory = chess.history({ verbose: true });
  const isFreePlayMode = mode === 'freeplay';
  const boardState = mode === 'game' ? gameBoard : freePlayState;
  const boardRows = getBoardRows(orientation);
  const moveList = verboseMoveHistory.map((move) => move.san);
  const lastMove = verboseMoveHistory.at(-1) ?? null;
  const capturedPieces = getCapturedPiecesFromHistory(verboseMoveHistory);
  const materialBalance = getMaterialBalance(capturedPieces);
  const topCaptureColor = orientation === 'w' ? 'b' : 'w';
  const bottomCaptureColor = orientation === 'w' ? 'w' : 'b';
  const activeTurnColor = mode === 'game' ? chess.turn() : freePlayState.turn;
  const legalTargets =
    mode === 'game' && selectedSquare
      ? getMoveChoices(chess, selectedSquare).map((move) => move.to)
      : [];
  const freePlayFen = boardMapToFen(freePlayState.position, freePlayState.turn);
  const freePlayValidation = safeValidateFen(freePlayFen);
  const activeTurnLabel =
    activeTurnColor === 'w'
      ? isFreePlayMode
        ? 'White to move if started as a game'
        : 'White to move'
      : isFreePlayMode
        ? 'Black to move if started as a game'
        : 'Black to move';
  const activePieceStyleLabel =
    PIECE_STYLE_OPTIONS.find((option) => option.value === pieceStyle)?.label ??
    'Wood + Ivory';
  const activeBoardStyleLabel =
    BOARD_STYLE_OPTIONS.find((option) => option.value === boardStyle)?.label ??
    'Walnut';
  const activeModeLabel = MODE_LABELS[mode] ?? 'Game';
  const preferredHostColor = manualHostColor ?? orientation;
  const isOnlineConnected = Boolean(onlineState.roomId);
  const isOnlineBusy =
    onlineState.status === 'hosting' || onlineState.status === 'joining';
  const onlineControlsLocked = isOnlineConnected || isOnlineBusy;
  const isOnlinePlayersTurn =
    !isOnlineConnected || onlineState.playerColor === activeTurnColor;
  const canUseFreePlay = !onlineControlsLocked;
  const onlineStatusLabel = formatOnlineStatus(onlineState);

  useEffect(() => {
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        mode,
        orientation,
        boardStyle,
        pieceStyle,
        displayPrefsVersion: DISPLAY_PREFS_VERSION,
        gameState,
        freePlayState,
      }),
    );
  }, [
    boardStyle,
    freePlayState,
    gameState,
    mode,
    orientation,
    pieceStyle,
  ]);

  useEffect(() => {
    window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(savedItems));
  }, [savedItems]);

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
    setDragSquare(null);
    setIsFreePlayPaletteArmed(false);
  }, [mode]);

  async function clearRoomSubscription() {
    if (!supabase || !roomChannelRef.current) {
      return;
    }

    const channel = roomChannelRef.current;
    roomChannelRef.current = null;
    await supabase.removeChannel(channel);
  }

  function getOnlineConnectionStatus(room) {
    if (room?.status === 'finished') {
      return 'finished';
    }

    return room?.black_player_id ? 'connected' : 'waiting';
  }

  function syncRoomState(room, playerColor) {
    const nextGameState = normalizeRemoteGame(room);
    const resolvedPlayerColor =
      playerColor ?? getPlayerColorForRoom(room, authState.userId);

    setGameState(nextGameState);
    setMode('game');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setDragSquare(null);
    setOnlineState({
      status: getOnlineConnectionStatus(room),
      roomId: room.id,
      roomCode: room.room_code,
      playerColor: resolvedPlayerColor,
      remoteVersion: Number.isFinite(room.version)
        ? room.version
        : nextGameState.moves.length,
      inviteUrl: buildInviteUrl(room.room_code),
      lastSyncedAt: room.updated_at ?? null,
    });
    writeLinkedRoomCode(room.room_code);
    setRoomCodeInput(room.room_code);
  }

  const handleRoomPayload = useEffectEvent((payload) => {
    const room = payload.new;

    if (!room || room.id !== onlineState.roomId) {
      return;
    }

    if (Number.isFinite(room.version) && room.version <= onlineState.remoteVersion) {
      return;
    }

    const nextGameState = normalizeRemoteGame(room);
    const previousMoveCount = gameState.moves.length;
    const nextMoveCount = nextGameState.moves.length;

    startTransition(() => {
      syncRoomState(room, getPlayerColorForRoom(room, authState.userId));
    });

    if (
      onlineState.status === 'waiting' &&
      room.black_player_id &&
      room.status !== 'finished'
    ) {
      setMessage('Black joined the room.');
      return;
    }

    if (nextMoveCount > previousMoveCount && room.last_move_san) {
      setMessage(`${room.last_move_san} synced.`);
      return;
    }

    if (room.status === 'finished') {
      setMessage(serializeGameSummary(buildChess(nextGameState)));
    }
  });

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let cancelled = false;

    async function ensureAnonymousSession() {
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (error) {
        setAuthState({
          ready: true,
          userId: null,
          error: error.message,
        });
        setMessage('Supabase auth could not start.');
        return;
      }

      let user = data.session?.user ?? null;

      if (!user) {
        const { data: anonymousData, error: anonymousError } =
          await supabase.auth.signInAnonymously();

        if (cancelled) {
          return;
        }

        if (anonymousError) {
          setAuthState({
            ready: true,
            userId: null,
            error: anonymousError.message,
          });
          setMessage('Enable anonymous sign-ins in Supabase Auth first.');
          return;
        }

        user = anonymousData.user ?? null;
      }

      setAuthState({
        ready: true,
        userId: user?.id ?? null,
        error: '',
      });
    }

    ensureAnonymousSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) {
        return;
      }

      setAuthState({
        ready: true,
        userId: session?.user?.id ?? null,
        error: '',
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !onlineState.roomId) {
      return undefined;
    }

    const channel = supabase
      .channel(`game-room-${onlineState.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${onlineState.roomId}`,
        },
        handleRoomPayload,
      )
      .subscribe();

    roomChannelRef.current = channel;

    return () => {
      if (roomChannelRef.current === channel) {
        roomChannelRef.current = null;
      }

      supabase.removeChannel(channel);
    };
  }, [handleRoomPayload, onlineState.roomId]);

  useEffect(() => {
    const previousMoveCount = previousMoveCountRef.current;
    const currentMoveCount = gameState.moves.length;

    if (mode !== 'game') {
      setCaptureAnimation(null);
      previousMoveCountRef.current = currentMoveCount;
      return;
    }

    if (currentMoveCount < previousMoveCount) {
      setCaptureAnimation(null);
    }

    if (currentMoveCount > previousMoveCount && lastMove?.captured) {
      const lossColor = lastMove.color === 'w' ? 'b' : 'w';
      const capturedPiece = `${lossColor}${lastMove.captured.toUpperCase()}`;
      const trayPieces = capturedPieces[lossColor];
      const index = trayPieces.findLastIndex((piece) => piece === capturedPiece);
      const nextAnimation = {
        color: lossColor,
        piece: capturedPiece,
        index,
        moveCount: currentMoveCount,
      };

      setCaptureAnimation(nextAnimation);
      previousMoveCountRef.current = currentMoveCount;

      const timeoutId = window.setTimeout(() => {
        setCaptureAnimation((current) =>
          current?.moveCount === currentMoveCount ? null : current,
        );
      }, 900);

      return () => window.clearTimeout(timeoutId);
    }

    previousMoveCountRef.current = currentMoveCount;
  }, [capturedPieces, gameState.moves.length, lastMove, mode]);

  async function leaveOnlineGame(nextMessage = 'Left the online room.') {
    await clearRoomSubscription();
    setOnlineState(DEFAULT_ONLINE_STATE);
    writeLinkedRoomCode('');
    setRoomCodeInput(readLinkedRoomCode());
    setMessage(nextMessage);
  }

  async function hostOnlineGame() {
    if (!supabase || !HAS_SUPABASE_CONFIG) {
      setMessage('Supabase is not configured yet.');
      return;
    }

    if (!authState.ready || !authState.userId) {
      setMessage('Online identity is still connecting.');
      return;
    }

    if (mode !== 'game') {
      setMessage('Switch back to game mode before hosting online.');
      return;
    }

    if (isOnlineConnected) {
      await leaveOnlineGame('Left the previous room.');
    }

    setOnlineState({
      ...DEFAULT_ONLINE_STATE,
      status: 'hosting',
    });
    setMessage('Creating online room...');

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const roomCode = createRoomCode();
      const hostsWhite = preferredHostColor === 'w';
      const { data, error } = await supabase
        .from('games')
        .insert({
          room_code: roomCode,
          host_user_id: authState.userId,
          white_player_id: hostsWhite ? authState.userId : null,
          black_player_id: hostsWhite ? null : authState.userId,
          start_fen: gameState.startFen,
          current_fen: chess.fen(),
          moves: gameState.moves,
          status: 'waiting',
          last_move_san: lastMove?.san ?? null,
          version: gameState.moves.length,
        })
        .select()
        .single();

      if (error?.code === '23505') {
        continue;
      }

      if (error || !data) {
        setOnlineState(DEFAULT_ONLINE_STATE);
        setMessage(error?.message ?? 'Could not create the online room.');
        return;
      }

      syncRoomState(data, preferredHostColor);
      setMessage(
        `Room ${data.room_code} is live. Share the invite link for ${
          preferredHostColor === 'w' ? 'Black' : 'White'
        }.`,
      );
      return;
    }

    setOnlineState(DEFAULT_ONLINE_STATE);
    setMessage('Could not reserve a unique room code. Try again.');
  }

  async function joinOnlineGame(roomCodeCandidate = roomCodeInput) {
    if (!supabase || !HAS_SUPABASE_CONFIG) {
      setMessage('Supabase is not configured yet.');
      return;
    }

    if (!authState.ready || !authState.userId) {
      setMessage('Online identity is still connecting.');
      return;
    }

    const roomCode = normalizeRoomCode(roomCodeCandidate);

    if (!roomCode) {
      setMessage('Enter a room code first.');
      return;
    }

    if (isOnlineConnected && roomCode === onlineState.roomCode) {
      setMessage(`Already connected to room ${roomCode}.`);
      return;
    }

    if (isOnlineConnected) {
      await leaveOnlineGame('Switching rooms...');
    }

    setOnlineState({
      ...DEFAULT_ONLINE_STATE,
      status: 'joining',
      roomCode,
    });
    setRoomCodeInput(roomCode);
    setMessage(`Joining room ${roomCode}...`);

    const { data: existingRoom, error: selectError } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (selectError) {
      setOnlineState(DEFAULT_ONLINE_STATE);
      setMessage(selectError.message);
      return;
    }

    if (!existingRoom) {
      setOnlineState(DEFAULT_ONLINE_STATE);
      setMessage(`Room ${roomCode} was not found.`);
      return;
    }

    let nextRoom = existingRoom;
    let playerColor = getPlayerColorForRoom(existingRoom, authState.userId);

    if (!playerColor) {
      const openSeatColor = existingRoom.white_player_id
        ? existingRoom.black_player_id
          ? null
          : 'b'
        : 'w';

      if (!openSeatColor) {
        setOnlineState(DEFAULT_ONLINE_STATE);
        setMessage(`Room ${roomCode} already has two players.`);
        return;
      }

      const { data: joinedRoom, error: joinError } = await supabase
        .from('games')
        .update({
          white_player_id:
            openSeatColor === 'w' ? authState.userId : existingRoom.white_player_id,
          black_player_id:
            openSeatColor === 'b' ? authState.userId : existingRoom.black_player_id,
          status: existingRoom.status === 'finished' ? 'finished' : 'active',
          version: (existingRoom.version ?? 0) + 1,
        })
        .eq('id', existingRoom.id)
        .is(openSeatColor === 'w' ? 'white_player_id' : 'black_player_id', null)
        .select()
        .single();

      if (joinError || !joinedRoom) {
        setOnlineState(DEFAULT_ONLINE_STATE);
        setMessage(joinError?.message ?? `Room ${roomCode} filled before you joined.`);
        return;
      }

      nextRoom = joinedRoom;
      playerColor = openSeatColor;
    }

    syncRoomState(nextRoom, playerColor);

    if (playerColor) {
      setOrientation(playerColor);
    }

    setMessage(`Joined room ${nextRoom.room_code} as ${formatSeatLabel(playerColor)}.`);
  }

  async function copyInviteLink() {
    if (!onlineState.inviteUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      setMessage('Copy the room code manually.');
      return;
    }

    try {
      await navigator.clipboard.writeText(onlineState.inviteUrl);
      setMessage('Invite link copied.');
    } catch {
      setMessage('Could not copy the invite link.');
    }
  }

  async function attemptMove(from, to, promotion) {
    const promotionChoices = getPromotionChoices(chess, from, to);

    if (promotionChoices.length > 0 && !promotion) {
      setPendingPromotion({
        from,
        to,
        choices: promotionChoices,
      });
      return false;
    }

    if (isOnlineConnected && !isOnlinePlayersTurn) {
      setMessage('Wait for the other side to move.');
      return false;
    }

    const move = promotion ? { from, to, promotion } : { from, to };
    const replay = buildChess(gameState);
    const result = replay.move(move);

    if (!result) {
      setMessage('Illegal move.');
      return false;
    }

    if (isOnlineConnected) {
      const nextMoves = [...gameState.moves, move];
      const nextStatus = replay.isGameOver()
        ? 'finished'
        : onlineState.status === 'waiting'
          ? 'waiting'
          : 'active';
      const { data, error } = await supabase
        .from('games')
        .update({
          moves: nextMoves,
          current_fen: replay.fen(),
          last_move_san: result.san,
          status: nextStatus,
          version: onlineState.remoteVersion + 1,
        })
        .eq('id', onlineState.roomId)
        .eq('version', onlineState.remoteVersion)
        .select()
        .single();

      if (error || !data) {
        setMessage(error?.message ?? 'The room changed before your move synced.');
        return false;
      }

      syncRoomState(data, onlineState.playerColor);
    } else {
      setGameState((current) => ({
        ...current,
        moves: [...current.moves, move],
      }));
    }

    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage(`${result.san} played.`);
    return true;
  }

  function handleGameSquareClick(square) {
    if (isOnlineConnected && !isOnlinePlayersTurn) {
      setSelectedSquare(null);
      setMessage('Wait for the other side to move.');
      return;
    }

    if (chess.isGameOver()) {
      setSelectedSquare(null);
      setMessage('The game is over. Start a new game or rewind.');
      return;
    }

    const piece = gameBoard.position[square];
    const pieceColor = getPieceColor(piece);

    if (!selectedSquare) {
      if (piece && pieceColor === chess.turn()) {
        setSelectedSquare(square);
        setMessage(`${square.toUpperCase()} selected.`);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setMessage('Selection cleared.');
      return;
    }

    if (piece && pieceColor === chess.turn()) {
      setSelectedSquare(square);
      setMessage(`${square.toUpperCase()} selected.`);
      return;
    }

    attemptMove(selectedSquare, square);
  }

  function handlePaletteSelect(piece) {
    const nextArmed =
      piece !== selectedPalettePiece || !isFreePlayPaletteArmed;

    setSelectedPalettePiece(piece);
    setSelectedSquare(null);
    setIsFreePlayPaletteArmed(nextArmed);
    setMessage(
      nextArmed
        ? piece === 'erase'
          ? 'Free play placement tool armed. Click a square to clear it.'
          : `Free play placement tool armed for ${PIECE_LABELS[
              piece
            ].toLowerCase()}.`
        : 'Free play move mode armed.',
    );
  }

  function updateFreePlayState(nextPosition, nextTurn = freePlayState.turn) {
    setFreePlayState((current) => {
      const nextSnapshot = {
        position: nextPosition,
        turn: nextTurn,
      };
      const currentSnapshot = {
        position: current.position,
        turn: current.turn,
      };

      if (areFreePlaySnapshotsEqual(currentSnapshot, nextSnapshot)) {
        return current;
      }

      return {
        position: nextPosition,
        turn: nextTurn,
        history: [
          ...current.history.slice(-(FREE_PLAY_UNDO_LIMIT - 1)),
          {
            position: current.position,
            turn: current.turn,
          },
        ],
      };
    });
  }

  function placeFreePlayPiece(square) {
    const nextPosition = { ...freePlayState.position };

    if (selectedPalettePiece === 'erase') {
      delete nextPosition[square];
    } else {
      nextPosition[square] = selectedPalettePiece;
    }

    updateFreePlayState(nextPosition);

    setSelectedSquare(null);
    setMessage(
      selectedPalettePiece === 'erase'
        ? `${square.toUpperCase()} cleared.`
        : `${PIECE_LABELS[selectedPalettePiece]} placed on ${square.toUpperCase()}.`,
    );
  }

  function moveFreePlayPiece(from, to) {
    const movingPiece = freePlayState.position[from];
    const replacedPiece = freePlayState.position[to];

    setDragSquare(null);
    setSelectedSquare(null);
    setIsFreePlayPaletteArmed(false);

    if (!movingPiece) {
      return;
    }

    if (from === to) {
      setMessage('Selection cleared.');
      return;
    }

    const nextPosition = { ...freePlayState.position };
    delete nextPosition[from];
    nextPosition[to] = movingPiece;
    updateFreePlayState(nextPosition);

    setMessage(
      replacedPiece
        ? `${PIECE_LABELS[movingPiece]} moved to ${to.toUpperCase()}. ${PIECE_LABELS[
            replacedPiece
          ]} removed.`
        : `${PIECE_LABELS[movingPiece]} moved to ${to.toUpperCase()}.`,
    );
  }

  function handleFreePlaySquareClick(square) {
    if (isFreePlayPaletteArmed) {
      placeFreePlayPiece(square);
      return;
    }

    const piece = freePlayState.position[square];

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setMessage('Selection cleared.');
        return;
      }

      moveFreePlayPiece(selectedSquare, square);
      return;
    }

    if (!piece) {
      return;
    }

    setSelectedSquare(square);
    setMessage(`${PIECE_LABELS[piece]} selected from ${square.toUpperCase()}.`);
  }

  function handleSquareClick(square) {
    if (mode === 'game') {
      handleGameSquareClick(square);
      return;
    }

    handleFreePlaySquareClick(square);
  }

  function handleDragStart(square) {
    if (mode === 'freeplay') {
      const piece = freePlayState.position[square];

      if (!piece) {
        return;
      }

      setIsFreePlayPaletteArmed(false);
      setDragSquare(square);
      setSelectedSquare(square);
      return;
    }

    if (mode !== 'game') {
      return;
    }

    if (isOnlineConnected && !isOnlinePlayersTurn) {
      setMessage('Wait for the other side to move.');
      return;
    }

    const piece = gameBoard.position[square];

    if (!piece || getPieceColor(piece) !== chess.turn() || chess.isGameOver()) {
      return;
    }

    setDragSquare(square);
    setSelectedSquare(square);
  }

  function handleDrop(square) {
    if (!dragSquare) {
      return;
    }

    if (mode === 'freeplay') {
      moveFreePlayPiece(dragSquare, square);
      return;
    }

    if (mode !== 'game') {
      return;
    }

    attemptMove(dragSquare, square);
    setDragSquare(null);
  }

  function handleUndo() {
    if (onlineControlsLocked) {
      setMessage('Undo stays local-only. Leave the room first.');
      return;
    }

    if (isFreePlayMode) {
      if (freePlayState.history.length === 0) {
        setMessage('No free play actions to undo.');
        return;
      }

      setFreePlayState((current) => {
        const previousSnapshot = current.history.at(-1);

        if (!previousSnapshot) {
          return current;
        }

        return {
          position: previousSnapshot.position,
          turn: previousSnapshot.turn,
          history: current.history.slice(0, -1),
        };
      });
      setSelectedSquare(null);
      setDragSquare(null);
      setIsFreePlayPaletteArmed(false);
      setMessage('Free play action reverted.');
      return;
    }

    if (gameState.moves.length === 0) {
      setMessage('No moves to undo.');
      return;
    }

    setGameState((current) => ({
      ...current,
      moves: current.moves.slice(0, -1),
    }));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Last move reverted.');
  }

  function rewindToStart() {
    if (onlineControlsLocked) {
      setMessage('Rewind stays local-only. Leave the room first.');
      return;
    }

    if (gameState.moves.length === 0) {
      setMessage('Already at the start of the game.');
      return;
    }

    setGameState((current) => ({
      ...current,
      moves: [],
    }));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Returned to the starting position.');
  }

  function startNewGame() {
    if (onlineControlsLocked) {
      setMessage('Start a fresh local game after leaving the room.');
      return;
    }

    setGameState(createGameState());
    setMode('game');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Standard game ready.');
  }

  function copyCurrentBoardToFreePlay() {
    if (onlineControlsLocked) {
      setMessage('Free play stays local-only. Leave the room first.');
      return;
    }

    if (isFreePlayMode) {
      return;
    }

    setFreePlayState({
      ...makeFreePlayStateFromFen(chess.fen()),
      history: [],
    });
    setMode('freeplay');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setDragSquare(null);
    setIsFreePlayPaletteArmed(false);
    setMessage('Current game copied into free play.');
  }

  function resetFreePlayToStandard() {
    const resetState = makeFreePlayStateFromFen(STANDARD_START_FEN);
    updateFreePlayState(resetState.position, resetState.turn);
    setSelectedSquare(null);
    setDragSquare(null);
    setIsFreePlayPaletteArmed(false);
    setMessage('Free play reset to the standard chess position.');
  }

  function clearFreePlayBoard() {
    updateFreePlayState({}, 'w');
    setSelectedSquare(null);
    setDragSquare(null);
    setIsFreePlayPaletteArmed(false);
    setMessage('Free play board cleared.');
  }

  function toggleFreePlayTurn() {
    const nextTurn = freePlayState.turn === 'w' ? 'b' : 'w';
    updateFreePlayState(freePlayState.position, nextTurn);
    setMessage(
      `Game from free play will start with ${
        nextTurn === 'w' ? 'White' : 'Black'
      } to move.`,
    );
  }

  function armFreePlayMoveMode() {
    setIsFreePlayPaletteArmed(false);
    setMessage(
      'Free play move mode armed. Drag a piece anywhere or click one and choose a square.',
    );
  }

  function startGameFromFreePlay() {
    if (onlineControlsLocked) {
      setMessage('Free play stays local-only. Leave the room first.');
      return;
    }

    if (!freePlayValidation.valid) {
      setMessage(freePlayValidation.message);
      return;
    }

    setGameState({
      startFen: freePlayFen,
      moves: [],
    });
    setMode('game');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setDragSquare(null);
    setIsFreePlayPaletteArmed(false);
    setMessage('Game started from the free play position.');
  }

  function saveCurrentSnapshot() {
    const name =
      saveName.trim() || `${activeModeLabel} ${new Date().toLocaleString()}`;

    const nextSave = {
      id: createSaveId(),
      name,
      type: mode,
      createdAt: new Date().toISOString(),
      payload:
        mode === 'game'
          ? {
              gameState,
              orientation,
            }
          : {
              freePlayState,
              orientation,
            },
    };

    setSavedItems((current) => [nextSave, ...current]);
    setSaveName('');
    setMessage(`${name} saved on this device.`);
  }

  function loadSave(item) {
    if (onlineControlsLocked) {
      setMessage('Leave the online room before loading a local snapshot.');
      return;
    }

    if (item.type === 'game') {
      setGameState(normalizeGameState(item.payload?.gameState));
      setMode('game');
    } else {
      setFreePlayState(
        normalizeFreePlayState(item.payload?.freePlayState ?? item.payload?.setupState),
      );
      setMode('freeplay');
    }

    setOrientation(item.payload?.orientation === 'b' ? 'b' : 'w');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage(`${item.name} loaded.`);
  }

  function deleteSave(id) {
    setSavedItems((current) => current.filter((item) => item.id !== id));
    setMessage('Saved snapshot removed.');
  }

  function handleRoomCodeInputChange(value) {
    setRoomCodeInput(normalizeRoomCode(value));
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Client-Side Chess Board</p>
      </header>

      <main className="layout">
        <BoardPanel
          mode={mode}
          boardStyle={boardStyle}
          boardRows={boardRows}
          boardState={boardState}
          selectedSquare={selectedSquare}
          dragSquare={dragSquare}
          legalTargets={legalTargets}
          lastMove={lastMove}
          pieceStyle={pieceStyle}
          topCaptureColor={topCaptureColor}
          bottomCaptureColor={bottomCaptureColor}
          capturedPieces={capturedPieces}
          materialBalance={materialBalance}
          captureAnimation={captureAnimation}
          activeTurnColor={activeTurnColor}
          activeTurnLabel={activeTurnLabel}
          onSquareClick={handleSquareClick}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onDragEnd={() => setDragSquare(null)}
          startNewGame={startNewGame}
          handleUndo={handleUndo}
          rewindToStart={rewindToStart}
          copyCurrentBoardToFreePlay={copyCurrentBoardToFreePlay}
          onFlipBoard={() =>
            setOrientation((current) => (current === 'w' ? 'b' : 'w'))
          }
          isOnlineControlsLocked={onlineControlsLocked}
          isFreePlayMode={isFreePlayMode}
          pendingPromotion={pendingPromotion}
          promotionTurnColor={chess.turn()}
          onPromotionChoice={(from, to, choice) =>
            attemptMove(from, to, choice)
          }
          onCancelPromotion={() => setPendingPromotion(null)}
        />

        <section className="side-panel">
          <OnlinePlayCard
            isOnlineBusy={isOnlineBusy}
            isOnlineConnected={isOnlineConnected}
            onlineState={onlineState}
            onlineStatusLabel={onlineStatusLabel}
            preferredHostColor={preferredHostColor}
            orientation={orientation}
            onChooseHostColor={setManualHostColor}
            hostOnlineGame={hostOnlineGame}
            mode={mode}
            roomCodeInput={roomCodeInput}
            onRoomCodeInputChange={handleRoomCodeInputChange}
            joinOnlineGame={() => joinOnlineGame()}
            copyInviteLink={copyInviteLink}
            leaveOnlineGame={() => leaveOnlineGame()}
            message={message}
            authError={authState.error}
          />

          <ModeCard
            mode={mode}
            canUseFreePlay={canUseFreePlay}
            setMode={setMode}
            moveList={moveList}
            pieceStyle={pieceStyle}
            palettePieces={PALETTE_PIECES}
            selectedPalettePiece={selectedPalettePiece}
            isFreePlayPaletteArmed={isFreePlayPaletteArmed}
            handlePaletteSelect={handlePaletteSelect}
            freePlayState={freePlayState}
            resetFreePlayToStandard={resetFreePlayToStandard}
            clearFreePlayBoard={clearFreePlayBoard}
            toggleFreePlayTurn={toggleFreePlayTurn}
            startGameFromFreePlay={startGameFromFreePlay}
            freePlayValidation={freePlayValidation}
            freePlayUndoLimit={FREE_PLAY_UNDO_LIMIT}
            onArmMovePieces={armFreePlayMoveMode}
          />

          <CustomizeCard
            isCustomizeOpen={isCustomizeOpen}
            toggleCustomizeOpen={() =>
              setIsCustomizeOpen((current) => !current)
            }
            customizeTab={customizeTab}
            setCustomizeTab={setCustomizeTab}
            activeBoardStyleLabel={activeBoardStyleLabel}
            activePieceStyleLabel={activePieceStyleLabel}
            boardStyle={boardStyle}
            setBoardStyle={setBoardStyle}
            pieceStyle={pieceStyle}
            setPieceStyle={setPieceStyle}
          />

          <SaveLoadCard
            activeModeLabel={activeModeLabel}
            saveName={saveName}
            onSaveNameChange={setSaveName}
            saveCurrentSnapshot={saveCurrentSnapshot}
            savedItems={savedItems}
            modeLabels={MODE_LABELS}
            loadSave={loadSave}
            onlineControlsLocked={onlineControlsLocked}
            deleteSave={deleteSave}
          />
        </section>
      </main>
    </div>
  );
}
