import { useEffect, useRef, useState } from 'react';
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

const APP_STORAGE_KEY = 'chess-board-session-v1';
const SAVES_STORAGE_KEY = 'chess-board-saves-v1';
const DISPLAY_PREFS_VERSION = 3;

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

  function attemptMove(from, to, promotion) {
    const promotionChoices = getPromotionChoices(chess, from, to);

    if (promotionChoices.length > 0 && !promotion) {
      setPendingPromotion({
        from,
        to,
        choices: promotionChoices,
      });
      return false;
    }

    const move = promotion ? { from, to, promotion } : { from, to };
    const replay = buildChess(gameState);
    const result = replay.move(move);

    if (!result) {
      setMessage('Illegal move.');
      return false;
    }

    setGameState((current) => ({
      ...current,
      moves: [...current.moves, move],
    }));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage(`${result.san} played.`);
    return true;
  }

  function handleGameSquareClick(square) {
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
    setGameState(createGameState());
    setMode('game');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Standard game ready.');
  }

  function copyGameToSetup() {
    setSetupState(makeEditorStateFromFen(chess.fen()));
    setMode('setup');
    setSelectedSquare(null);
    setPendingPromotion(null);
    setMessage('Current board copied into setup mode.');
  }

  function startGameFromSetup() {
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
            <button className="primary-button" type="button" onClick={startNewGame}>
              New Standard Game
            </button>
            <button className="ghost-button" type="button" onClick={handleUndo}>
              Undo Move
            </button>
            <button className="ghost-button" type="button" onClick={rewindToStart}>
              Rewind To Start
            </button>
            <button className="ghost-button" type="button" onClick={copyGameToSetup}>
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
