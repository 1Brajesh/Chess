import { PIECE_LABELS, isLightSquare } from '../lib/chess.js';
import ChessPiece from './ChessPiece.jsx';

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

export default function BoardPanel({
  mode,
  boardStyle,
  boardRows,
  boardState,
  selectedSquare,
  dragSquare,
  legalTargets,
  lastMove,
  pieceStyle,
  topCaptureColor,
  bottomCaptureColor,
  capturedPieces,
  materialBalance,
  captureAnimation,
  activeTurnColor,
  activeTurnLabel,
  onSquareClick,
  onDrop,
  onDragStart,
  onDragEnd,
  startNewGame,
  handleUndo,
  rewindToStart,
  copyCurrentBoardToFreePlay,
  onFlipBoard,
  isOnlineControlsLocked,
  isFreePlayMode,
  pendingPromotion,
  promotionTurnColor,
  onPromotionChoice,
  onCancelPromotion,
}) {
  return (
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
                    const visiblePiece =
                      mode === 'freeplay' && dragSquare === square ? null : piece;
                    const isSelected = selectedSquare === square;
                    const isTarget = legalTargets.includes(square);
                    const isLastMoveSquare =
                      mode === 'game' &&
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
                        onClick={() => onSquareClick(square)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => onDrop(square)}
                        draggable={
                          (mode === 'game' || mode === 'freeplay') && Boolean(piece)
                        }
                        onDragStart={() => onDragStart(square)}
                        onDragEnd={onDragEnd}
                        aria-label={`${square} ${
                          visiblePiece ? PIECE_LABELS[visiblePiece] : 'empty square'
                        }`}
                      >
                        {rankLabel ? (
                          <span className="square-rank">{rankLabel}</span>
                        ) : null}
                        {fileLabel ? (
                          <span className="square-file">{fileLabel}</span>
                        ) : null}
                        {visiblePiece ? (
                          <ChessPiece
                            piece={visiblePiece}
                            pieceStyle={pieceStyle}
                          />
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
          disabled={isOnlineControlsLocked}
        >
          New Standard Game
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={handleUndo}
          disabled={isOnlineControlsLocked}
        >
          Undo
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={rewindToStart}
          disabled={isOnlineControlsLocked || mode !== 'game'}
        >
          Rewind To Start
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={copyCurrentBoardToFreePlay}
          disabled={isOnlineControlsLocked || isFreePlayMode}
        >
          Copy Board To Free Play
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onFlipBoard}
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
                const pieceCode = `${promotionTurnColor}${choice.toUpperCase()}`;
                return (
                  <button
                    key={choice}
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      onPromotionChoice(
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
              onClick={onCancelPromotion}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
