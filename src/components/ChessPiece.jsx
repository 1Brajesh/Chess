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
import stauntonBlackBishop from '../assets/pieces/staunton/bB.svg';
import stauntonBlackKing from '../assets/pieces/staunton/bK.svg';
import stauntonBlackKnight from '../assets/pieces/staunton/bN.svg';
import stauntonBlackPawn from '../assets/pieces/staunton/bP.svg';
import stauntonBlackQueen from '../assets/pieces/staunton/bQ.svg';
import stauntonBlackRook from '../assets/pieces/staunton/bR.svg';
import stauntonWhiteBishop from '../assets/pieces/staunton/wB.svg';
import stauntonWhiteKing from '../assets/pieces/staunton/wK.svg';
import stauntonWhiteKnight from '../assets/pieces/staunton/wN.svg';
import stauntonWhitePawn from '../assets/pieces/staunton/wP.svg';
import stauntonWhiteQueen from '../assets/pieces/staunton/wQ.svg';
import stauntonWhiteRook from '../assets/pieces/staunton/wR.svg';
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

const IMAGE_BY_PIECE = {
  wK: stauntonWhiteKing,
  wQ: stauntonWhiteQueen,
  wR: stauntonWhiteRook,
  wB: stauntonWhiteBishop,
  wN: stauntonWhiteKnight,
  wP: stauntonWhitePawn,
  bK: stauntonBlackKing,
  bQ: stauntonBlackQueen,
  bR: stauntonBlackRook,
  bB: stauntonBlackBishop,
  bN: stauntonBlackKnight,
  bP: stauntonBlackPawn,
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
  const colorClass = piece.startsWith('w') ? 'white' : 'black';
  const Icon = ICONS_BY_STYLE[resolvedStyle]?.[piece[1]];
  const imageSource = IMAGE_BY_PIECE[piece];

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
      {resolvedStyle === 'staunton' ? (
        <img
          src={imageSource}
          className="piece-image"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ) : (
        <Icon className="piece-icon" aria-hidden="true" focusable="false" />
      )}
    </span>
  );
}
