import {
  BOARD_STYLE_OPTIONS,
} from '../lib/boardStyles.js';
import {
  PIECE_STYLE_OPTIONS,
} from '../lib/pieceStyles.js';
import ChessPiece from './ChessPiece.jsx';

export default function CustomizeCard({
  isCustomizeOpen,
  toggleCustomizeOpen,
  customizeTab,
  setCustomizeTab,
  activeBoardStyleLabel,
  activePieceStyleLabel,
  boardStyle,
  setBoardStyle,
  pieceStyle,
  setPieceStyle,
}) {
  return (
    <article className="card">
      <div className="section-heading">
        <div>
          <h2>Customize</h2>
          <p>Change board and piece styles only when needed.</p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={toggleCustomizeOpen}
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
  );
}
