import {
  FaChessBishop,
  FaChessKing,
  FaChessKnight,
  FaChessPawn,
  FaChessQueen,
  FaChessRook,
} from 'react-icons/fa6';
import {
  FaRegChessBishop,
  FaRegChessKing,
  FaRegChessKnight,
  FaRegChessPawn,
  FaRegChessQueen,
  FaRegChessRook,
} from 'react-icons/fa6';
import {
  GiChessBishop,
  GiChessKing,
  GiChessKnight,
  GiChessPawn,
  GiChessQueen,
  GiChessRook,
} from 'react-icons/gi';
import { DEFAULT_PIECE_STYLE, normalizePieceStyle } from '../lib/pieceStyles.js';

const ICONS_BY_STYLE = {
  classic: {
    K: FaChessKing,
    Q: FaChessQueen,
    R: FaChessRook,
    B: FaChessBishop,
    N: FaChessKnight,
    P: FaChessPawn,
  },
  outline: {
    K: FaRegChessKing,
    Q: FaRegChessQueen,
    R: FaRegChessRook,
    B: FaRegChessBishop,
    N: FaRegChessKnight,
    P: FaRegChessPawn,
  },
  ornate: {
    K: GiChessKing,
    Q: GiChessQueen,
    R: GiChessRook,
    B: GiChessBishop,
    N: GiChessKnight,
    P: GiChessPawn,
  },
};

export default function ChessPiece({
  piece,
  pieceStyle = DEFAULT_PIECE_STYLE,
  className = '',
}) {
  if (!piece || piece === 'erase') {
    return null;
  }

  const resolvedStyle = normalizePieceStyle(pieceStyle);
  const Icon = ICONS_BY_STYLE[resolvedStyle][piece[1]];
  const colorClass = piece.startsWith('w') ? 'white' : 'black';

  return (
    <span
      className={[
        'piece-render',
        colorClass,
        `style-${resolvedStyle}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="piece-icon" aria-hidden="true" focusable="false" />
    </span>
  );
}
