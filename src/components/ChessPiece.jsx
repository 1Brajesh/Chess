import {
  FaChessBishop,
  FaChessKing,
  FaChessKnight,
  FaChessPawn,
  FaChessQueen,
  FaChessRook,
} from 'react-icons/fa';

const ICON_BY_PIECE = {
  K: FaChessKing,
  Q: FaChessQueen,
  R: FaChessRook,
  B: FaChessBishop,
  N: FaChessKnight,
  P: FaChessPawn,
};

export default function ChessPiece({ piece, className = '' }) {
  if (!piece || piece === 'erase') {
    return null;
  }

  const Icon = ICON_BY_PIECE[piece[1]];
  const colorClass = piece.startsWith('w') ? 'white' : 'black';

  return (
    <span className={['piece-render', colorClass, className].filter(Boolean).join(' ')}>
      <Icon className="piece-icon" aria-hidden="true" focusable="false" />
    </span>
  );
}

