import { PIECE_LABELS } from '../lib/chess.js';
import ChessPiece from './ChessPiece.jsx';

export default function ModeCard({
  mode,
  canUseFreePlay,
  setMode,
  moveList,
  pieceStyle,
  palettePieces,
  selectedPalettePiece,
  isFreePlayPaletteArmed,
  handlePaletteSelect,
  freePlayState,
  resetFreePlayToStandard,
  clearFreePlayBoard,
  toggleFreePlayTurn,
  startGameFromFreePlay,
  freePlayValidation,
  freePlayUndoLimit,
  onArmMovePieces,
}) {
  const isFreePlayMode = mode === 'freeplay';

  return (
    <article className="card">
      <div className="section-heading">
        <h2>Mode</h2>
        <p>Switch between legal play and unrestricted free play.</p>
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
          className={mode === 'freeplay' ? 'primary-button' : 'ghost-button'}
          onClick={() => setMode('freeplay')}
          disabled={!canUseFreePlay}
        >
          Free Play
        </button>
      </div>

      {isFreePlayMode ? (
        <>
          <div className="editor-palette">
            {palettePieces.map((piece) => (
              <button
                key={piece}
                type="button"
                className={
                  selectedPalettePiece === piece && isFreePlayPaletteArmed
                    ? 'palette-button active'
                    : 'palette-button'
                }
                onClick={() => handlePaletteSelect(piece)}
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

          <div className="editor-controls">
            <button
              type="button"
              className={isFreePlayPaletteArmed ? 'ghost-button' : 'primary-button'}
              onClick={onArmMovePieces}
            >
              Move Pieces
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={toggleFreePlayTurn}
            >
              Side To Move: {freePlayState.turn === 'w' ? 'White' : 'Black'}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={resetFreePlayToStandard}
            >
              Reset Free Play
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={clearFreePlayBoard}
            >
              Clear Board
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={startGameFromFreePlay}
            >
              Start Game From Free Play
            </button>
          </div>
          <p className="hint">
            {isFreePlayPaletteArmed
              ? selectedPalettePiece === 'erase'
                ? 'Click any square to clear it, or switch back to Move Pieces.'
                : `Click any square to place ${PIECE_LABELS[
                    selectedPalettePiece
                  ].toLowerCase()}, or switch back to Move Pieces.`
              : `Drag any piece anywhere, or click one piece and then another square. Dropping on an occupied square removes the piece already there. The last ${freePlayUndoLimit} free-play actions can be undone.`}
          </p>
          <p className={freePlayValidation.valid ? 'hint ok' : 'hint warning'}>
            {freePlayValidation.valid
              ? `Position is ready for game mode with ${
                  freePlayState.turn === 'w' ? 'White' : 'Black'
                } to move.`
              : freePlayValidation.message}
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
  );
}
