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
  getCapturedPieces,
  getLastMove,
  getMaterialBalance,
  getMoveChoices,
  getPieceColor,
  getPromotionChoices,
  isLightSquare,
  makeEditorStateFromFen,
  normalizeGameState,
  normalizeSetupState,
  parseFen,
  safeValidateFen,
  serializeGameSummary,
} from './lib/chess.js';
import ChessPiece from './components/ChessPiece.jsx';
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

function loadPersistedApp() {
  const fallback = {
    mode: 'game',
    orientation: 'w',
    boardStyle: DEFAULT_BOARD_STYLE,
    pieceStyle: DEFAULT_PIECE_STYLE,
    gameState: createGameState(),
    setupState: makeEditorStateFromFen(STANDARD_START_FEN),
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
      mode: parsed.mode === 'setup' ? 'setup' : 'game',
      orientation: parsed.orientation === 'b' ? 'b' : 'w',
      boardStyle: normalizeBoardStyle(parsed.boardStyle),
      pieceStyle,
      gameState: normalizeGameState(parsed.gameState),
      setupState: normalizeSetupState(parsed.setupState),
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

    return parsed.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.type === 'game' || item.type === 'setup'),
    );
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

function CapturedTray({
  lossColor,
  pieces,
  lead,
  pieceStyle,
  animatedCapture,
}) {
  const label = lossColor === 'w' ? 'White captured' : 'Black captured';

  return (
    <div className="captured-tray" aria-label={`${label} pieces`}>
      <div className="captured-piece-list">
        {pieces.length === 0 ? (
          <span className="captured-empty">No captures</span>
        ) : (
          pieces.map((piece, index) => (
            <span
              key={`${piece}-${index}`}
              className={[
                'captured-piece-item',
                animatedCapture?.color === lossColor &&
                animatedCapture?.piece === piece &&
                animatedCapture?.index === index
                  ? 'capture-pop'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <ChessPiece
                piece={piece}
                pieceStyle={pieceStyle}
                className="captured-piece"
              />
            </span>
          ))
        )}
      </div>
      {lead > 0 ? <span className="captured-score">+{lead}</span> : null}
    </div>
  );
}

function TurnMarker({ active, title, position }) {
  return (
    <div
      className={[
        'turn-marker-slot',
        position,
        active ? 'active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {active ? (
        <div className="turn-marker" title={title} aria-label={title} />
      ) : null}
    </div>
  );
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
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customizeTab, setCustomizeTab] = useState('board');
  const [gameState, setGameState] = useState(persisted.gameState);
  const [setupState, setSetupState] = useState(persisted.setupState);
  const [savedItems, setSavedItems] = useState(loadSavedItems);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [dragSquare, setDragSquare] = useState(null);
  const [selectedPalettePiece, setSelectedPalettePiece] = useState('wP');
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState('Board ready.');
  const [captureAnimation, setCaptureAnimation] = useState(null);
  const previousMoveCountRef = useRef(persisted.gameState.moves.length);
  const roomChannelRef = useRef(null);

  const chess = buildChess(gameState);
  const gameBoard = parseFen(chess.fen());
  const boardState = mode === 'game' ? gameBoard : setupState;
  const boardRows = getBoardRows(orientation);
  const moveList = chess.history();
  const lastMove = getLastMove(gameState);
  const capturedPieces = getCapturedPieces(gameState);
  const materialBalance = getMaterialBalance(capturedPieces);
  const topCaptureColor = orientation === 'w' ? 'b' : 'w';
  const bottomCaptureColor = orientation === 'w' ? 'w' : 'b';
  const activeTurnColor = mode === 'game' ? chess.turn() : setupState.turn;
  const legalTargets =
    mode === 'game' && selectedSquare
      ? getMoveChoices(chess, selectedSquare).map((move) => move.to)
      : [];
  const setupFen = boardMapToFen(setupState.position, setupState.turn);
  const setupValidation = safeValidateFen(setupFen);
  const activeTurnLabel = activeTurnColor === 'w' ? 'White to move' : 'Black to move';
  const activePieceStyleLabel =
    PIECE_STYLE_OPTIONS.find((option) => option.value === pieceStyle)?.label ??
    'Wood + Ivory';
  const activeBoardStyleLabel =
    BOARD_STYLE_OPTIONS.find((option) => option.value === boardStyle)?.label ??
    'Walnut';
  const isOnlineConnected = Boolean(onlineState.roomId);
  const isOnlineBusy =
    onlineState.status === 'hosting' || onlineState.status === 'joining';
  const onlineControlsLocked = isOnlineConnected || isOnlineBusy;
  const isOnlinePlayersTurn =
    !isOnlineConnected || onlineState.playerColor === activeTurnColor;
  const canEditSetup = !onlineControlsLocked;
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
        setupState,
      }),
    );
  }, [boardStyle, gameState, mode, orientation, pieceStyle, setupState]);

  useEffect(() => {
    window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(savedItems));
  }, [savedItems]);

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
    setDragSquare(null);
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
      const { data, error } = await supabase
        .from('games')
        .insert({
          room_code: roomCode,
          host_user_id: authState.userId,
          white_player_id: authState.userId,
          black_player_id: null,
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

      syncRoomState(data, 'w');
      setMessage(`Room ${data.room_code} is live. Share the invite link for Black.`);
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
      if (existingRoom.black_player_id) {
        setOnlineState(DEFAULT_ONLINE_STATE);
        setMessage(`Room ${roomCode} already has two players.`);
        return;
      }

      const { data: joinedRoom, error: joinError } = await supabase
        .from('games')
        .update({
          black_player_id: authState.userId,
          status: existingRoom.status === 'finished' ? 'finished' : 'active',
          version: (existingRoom.version ?? 0) + 1,
        })
        .eq('id', existingRoom.id)
        .is('black_player_id', null)
        .select()
        .single();

      if (joinError || !joinedRoom) {
        setOnlineState(DEFAULT_ONLINE_STATE);
        setMessage(joinError?.message ?? `Room ${roomCode} filled before you joined.`);
        return;
      }

      nextRoom = joinedRoom;
      playerColor = 'b';
    }

    syncRoomState(nextRoom, playerColor);

    if (playerColor === 'b') {
      setOrientation('b');
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

  function handleSetupSquareClick(square) {
    setSetupState((current) => {
      const nextPosition = { ...current.position };

      if (selectedPalettePiece === 'erase') {
        delete nextPosition[square];
      } else {
        nextPosition[square] = selectedPalettePiece;
      }

      return {
        ...current,
        position: nextPosition,
      };
    });

    setMessage(
      selectedPalettePiece === 'erase'
        ? `${square.toUpperCase()} cleared.`
        : `${PIECE_LABELS[selectedPalettePiece]} placed on ${square.toUpperCase()}.`,
    );
  }

  function handleSquareClick(square) {
    if (mode === 'game') {
      handleGameSquareClick(square);
      return;
    }

    handleSetupSquareClick(square);
  }

  function handleDragStart(square) {
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
    if (mode !== 'game' || !dragSquare) {
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

  function copyGameToSetup() {
    if (onlineControlsLocked) {
      setMessage('Setup mode stays local-only. Leave the room first.');
      return;
    }

    setSetupState(makeEditorStateFromFen(chess.fen()));
    setMode('setup');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Current board copied into setup mode.');
  }

  function startGameFromSetup() {
    if (onlineControlsLocked) {
      setMessage('Setup mode stays local-only. Leave the room first.');
      return;
    }

    if (!setupValidation.valid) {
      setMessage(setupValidation.message);
      return;
    }

    setGameState({
      startFen: setupFen,
      moves: [],
    });
    setMode('game');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Game started from the setup position.');
  }

  function resetSetupToStandard() {
    setSetupState(makeEditorStateFromFen(STANDARD_START_FEN));
    setMessage('Setup reset to the standard chess position.');
  }

  function clearSetupBoard() {
    setSetupState({
      position: {},
      turn: 'w',
    });
    setMessage('Setup board cleared.');
  }

  function saveCurrentSnapshot() {
    const name =
      saveName.trim() ||
      `${mode === 'game' ? 'Game' : 'Setup'} ${new Date().toLocaleString()}`;

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
              setupState,
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
      setSetupState(normalizeSetupState(item.payload?.setupState));
      setMode('setup');
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

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Client-Side Chess Board</p>
      </header>

      <main className="layout">
        <section className="board-panel card">
          <div className="board-stage">
            <div className="board-stack">
              {mode === 'game' ? (
                <CapturedTray
                  lossColor={topCaptureColor}
                  pieces={capturedPieces[topCaptureColor]}
                  lead={materialBalance[topCaptureColor]}
                  pieceStyle={pieceStyle}
                  animatedCapture={captureAnimation}
                />
              ) : null}

              <div className="board-core">
                <aside className="turn-marker-column" aria-label={activeTurnLabel}>
                  <TurnMarker
                    active={activeTurnColor === topCaptureColor}
                    title={activeTurnLabel}
                    position="top"
                  />
                  <TurnMarker
                    active={activeTurnColor === bottomCaptureColor}
                    title={activeTurnLabel}
                    position="bottom"
                  />
                </aside>

                <div className={['board-frame', `board-style-${boardStyle}`].join(' ')}>
                  <div className="board-grid" role="grid" aria-label="Chess board">
                    {boardRows.map((row, rowIndex) =>
                      row.map((square, columnIndex) => {
                        const piece = boardState.position[square];
                        const isSelected = selectedSquare === square;
                        const isTarget = legalTargets.includes(square);
                        const isLastMoveSquare =
                          lastMove &&
                          (lastMove.from === square || lastMove.to === square);
                        const rankLabel = columnIndex === 0 ? square[1] : '';
                        const fileLabel =
                          rowIndex === boardRows.length - 1 ? square[0] : '';

                        return (
                          <button
                            key={square}
                            type="button"
                            className={[
                              'board-square',
                              isLightSquare(square) ? 'light' : 'dark',
                              isSelected ? 'selected' : '',
                              isTarget ? 'target' : '',
                              isLastMoveSquare ? 'last-move' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => handleSquareClick(square)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDrop(square)}
                            draggable={mode === 'game' && Boolean(piece)}
                            onDragStart={() => handleDragStart(square)}
                            onDragEnd={() => setDragSquare(null)}
                            aria-label={`${square} ${
                              piece ? PIECE_LABELS[piece] : 'empty square'
                            }`}
                          >
                            {rankLabel ? (
                              <span className="square-rank">{rankLabel}</span>
                            ) : null}
                            {fileLabel ? (
                              <span className="square-file">{fileLabel}</span>
                            ) : null}
                            {piece ? (
                              <ChessPiece piece={piece} pieceStyle={pieceStyle} />
                            ) : null}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>

              {mode === 'game' ? (
                <CapturedTray
                  lossColor={bottomCaptureColor}
                  pieces={capturedPieces[bottomCaptureColor]}
                  lead={materialBalance[bottomCaptureColor]}
                  pieceStyle={pieceStyle}
                  animatedCapture={captureAnimation}
                />
              ) : null}
            </div>
          </div>

          <div className="board-actions">
            <button
              className="primary-button"
              type="button"
              onClick={startNewGame}
              disabled={onlineControlsLocked}
            >
              New Standard Game
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleUndo}
              disabled={onlineControlsLocked}
            >
              Undo Move
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={rewindToStart}
              disabled={onlineControlsLocked}
            >
              Rewind To Start
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={copyGameToSetup}
              disabled={onlineControlsLocked}
            >
              Copy To Setup
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                setOrientation((current) => (current === 'w' ? 'b' : 'w'))
              }
            >
              Flip Board
            </button>
          </div>

          {pendingPromotion ? (
            <div className="promotion-modal">
              <div className="promotion-card">
                <h3>Choose a promotion piece</h3>
                <div className="promotion-options">
                  {pendingPromotion.choices.map((choice) => {
                    const pieceCode = `${chess.turn()}${choice.toUpperCase()}`;
                    return (
                      <button
                        key={choice}
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          attemptMove(
                            pendingPromotion.from,
                            pendingPromotion.to,
                            choice,
                          )
                        }
                      >
                        <ChessPiece
                          piece={pieceCode}
                          pieceStyle={pieceStyle}
                          className="promotion-piece"
                        />
                        {PIECE_LABELS[pieceCode]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setPendingPromotion(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="side-panel">
          <article className="card">
            <div className="section-heading">
              <div>
                <h2>Online Play</h2>
                <p>Host a room or join a friend with Supabase realtime sync.</p>
              </div>
              <span
                className={[
                  'status-badge',
                  isOnlineBusy
                    ? 'pending'
                    : isOnlineConnected
                      ? onlineState.status === 'finished'
                        ? 'local'
                        : onlineState.status === 'waiting'
                        ? 'waiting'
                        : 'live'
                      : 'local',
                ].join(' ')}
              >
                {isOnlineBusy
                  ? 'Connecting'
                  : isOnlineConnected
                    ? onlineState.status === 'finished'
                      ? 'Finished'
                      : onlineState.status === 'waiting'
                      ? 'Waiting'
                      : 'Live'
                    : 'Local'}
              </span>
            </div>

            <div className="customize-summary">
              <span className="board-chip">{onlineStatusLabel}</span>
              {onlineState.playerColor ? (
                <span className="board-chip">
                  {formatSeatLabel(onlineState.playerColor)} seat
                </span>
              ) : null}
            </div>

            <div className="online-panel">
              <button
                type="button"
                className="primary-button"
                onClick={hostOnlineGame}
                disabled={mode !== 'game' || isOnlineBusy}
              >
                Host Online Game
              </button>

              <div className="join-room-row">
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  value={roomCodeInput}
                  onChange={(event) =>
                    setRoomCodeInput(normalizeRoomCode(event.target.value))
                  }
                  placeholder="Room code"
                  disabled={isOnlineBusy}
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => joinOnlineGame()}
                  disabled={isOnlineBusy}
                >
                  Join Room
                </button>
              </div>

              {isOnlineConnected ? (
                <div className="online-room-card">
                  <div>
                    <strong>Room {onlineState.roomCode}</strong>
                    <p>
                      {onlineState.status === 'finished'
                        ? 'Game finished. The room remains available for review.'
                        : onlineState.status === 'waiting'
                        ? 'Waiting for the Black side to join.'
                        : `Synced live as ${formatSeatLabel(onlineState.playerColor)}.`}
                    </p>
                  </div>
                  <div className="save-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={copyInviteLink}
                    >
                      Copy Invite Link
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => leaveOnlineGame()}
                    >
                      Leave Room
                    </button>
                  </div>
                </div>
              ) : null}

              <p className={authState.error ? 'hint warning' : 'hint'}>
                {authState.error || message}
              </p>
            </div>
          </article>

          <article className="card">
            <div className="section-heading">
              <h2>Mode</h2>
              <p>Switch between legal play and free setup editing.</p>
            </div>
            <div className="mode-switch">
              <button
                type="button"
                className={mode === 'game' ? 'primary-button' : 'ghost-button'}
                onClick={() => setMode('game')}
              >
                Game
              </button>
              <button
                type="button"
                className={mode === 'setup' ? 'primary-button' : 'ghost-button'}
                onClick={() => setMode('setup')}
                disabled={!canEditSetup}
              >
                Setup
              </button>
            </div>

            {mode === 'setup' ? (
              <>
                <div className="setup-palette">
                  {PALETTE_PIECES.map((piece) => (
                    <button
                      key={piece}
                      type="button"
                      className={
                        selectedPalettePiece === piece
                          ? 'palette-button active'
                          : 'palette-button'
                      }
                      onClick={() => setSelectedPalettePiece(piece)}
                    >
                      <span className="palette-symbol">
                        {piece === 'erase' ? (
                          <span className="erase-symbol">×</span>
                        ) : (
                          <ChessPiece
                            piece={piece}
                            pieceStyle={pieceStyle}
                            className="palette-piece"
                          />
                        )}
                      </span>
                      <span>{PIECE_LABELS[piece]}</span>
                    </button>
                  ))}
                </div>

                <div className="setup-controls">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setSetupState((current) => ({
                        ...current,
                        turn: current.turn === 'w' ? 'b' : 'w',
                      }))
                    }
                  >
                    Side To Move: {setupState.turn === 'w' ? 'White' : 'Black'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetSetupToStandard}
                  >
                    Reset Setup
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={clearSetupBoard}
                  >
                    Clear Board
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={startGameFromSetup}
                  >
                    Start Game From Setup
                  </button>
                </div>
                <p className={setupValidation.valid ? 'hint ok' : 'hint warning'}>
                  {setupValidation.message}
                </p>
              </>
            ) : (
              <div className="history-panel">
                <h3>Move History</h3>
                {moveList.length === 0 ? (
                  <p className="hint">No moves yet.</p>
                ) : (
                  <ol className="history-list">
                    {moveList.map((move, index) => (
                      <li key={`${move}-${index}`}>{move}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </article>

          <article className="card">
            <div className="section-heading">
              <div>
                <h2>Customize</h2>
                <p>Change board and piece styles only when needed.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsCustomizeOpen((current) => !current)}
                aria-expanded={isCustomizeOpen}
              >
                {isCustomizeOpen ? 'Hide Styles' : 'Show Styles'}
              </button>
            </div>

            <div className="customize-summary">
              <span className="board-chip">{activeBoardStyleLabel} board</span>
              <span className="board-chip">{activePieceStyleLabel} pieces</span>
            </div>

            {isCustomizeOpen ? (
              <div className="customize-panel">
                <div className="customize-tabs" role="tablist" aria-label="Style categories">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={customizeTab === 'board'}
                    className={
                      customizeTab === 'board'
                        ? 'customize-tab active'
                        : 'customize-tab'
                    }
                    onClick={() => setCustomizeTab('board')}
                  >
                    Board
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={customizeTab === 'pieces'}
                    className={
                      customizeTab === 'pieces'
                        ? 'customize-tab active'
                        : 'customize-tab'
                    }
                    onClick={() => setCustomizeTab('pieces')}
                  >
                    Pieces
                  </button>
                </div>

                {customizeTab === 'board' ? (
                  <div className="customize-grid" role="tabpanel">
                    {BOARD_STYLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={
                          boardStyle === option.value
                            ? 'customize-option board-option active'
                            : 'customize-option board-option'
                        }
                        onClick={() => setBoardStyle(option.value)}
                        title={option.description}
                      >
                        <span
                          className={[
                            'board-style-preview compact',
                            `board-style-${option.value}`,
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          <span className="board-style-preview-frame" />
                        </span>
                        <span className="customize-option-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="customize-grid" role="tabpanel">
                    {PIECE_STYLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={
                          pieceStyle === option.value
                            ? 'customize-option piece-option active'
                            : 'customize-option piece-option'
                        }
                        onClick={() => setPieceStyle(option.value)}
                        title={option.description}
                      >
                        <span className="piece-style-preview compact" aria-hidden="true">
                          <ChessPiece piece="wK" pieceStyle={option.value} />
                          <ChessPiece piece="wQ" pieceStyle={option.value} />
                          <ChessPiece piece="bN" pieceStyle={option.value} />
                        </span>
                        <span className="customize-option-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </article>

          <article className="card">
            <div className="section-heading">
              <h2>Save &amp; Load</h2>
              <p>Store game or setup snapshots on this device.</p>
            </div>

            <div className="save-form">
              <input
                type="text"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder={`Name this ${mode}`}
              />
              <button
                type="button"
                className="primary-button"
                onClick={saveCurrentSnapshot}
              >
                Save Current {mode === 'game' ? 'Game' : 'Setup'}
              </button>
            </div>

            {savedItems.length === 0 ? (
              <p className="hint">No local saves yet.</p>
            ) : (
              <div className="save-list">
                {savedItems.map((item) => (
                  <div key={item.id} className="save-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.type === 'game' ? 'Game snapshot' : 'Setup snapshot'}
                        {' · '}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="save-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => loadSave(item)}
                        disabled={onlineControlsLocked}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => deleteSave(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
