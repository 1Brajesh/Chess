import { useEffect, useState } from 'react';
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

const ASSET_MODULES = import.meta.glob('../assets/pieces/*/*.{png,svg}', {
  eager: true,
  import: 'default',
});

const PIECE_CODE_BY_FILENAME = {
  wK: 'wK',
  wQ: 'wQ',
  wR: 'wR',
  wB: 'wB',
  wN: 'wN',
  wP: 'wP',
  bK: 'bK',
  bQ: 'bQ',
  bR: 'bR',
  bB: 'bB',
  bN: 'bN',
  bP: 'bP',
  WhiteKing: 'wK',
  WhiteQueen: 'wQ',
  WhiteRook: 'wR',
  WhiteBishop: 'wB',
  WhiteKnight: 'wN',
  WhitePawn: 'wP',
  BlackKing: 'bK',
  BlackQueen: 'bQ',
  BlackRook: 'bR',
  BlackBishop: 'bB',
  BlackKnight: 'bN',
  BlackPawn: 'bP',
};

function buildAssetPieceMap() {
  return Object.entries(ASSET_MODULES).reduce((styles, [path, source]) => {
    const match = path.match(/\/pieces\/([^/]+)\/([A-Za-z0-9_-]+)\.(png|svg)$/);

    if (!match) {
      return styles;
    }

    const [, style, fileStem] = match;
    const pieceCode = PIECE_CODE_BY_FILENAME[fileStem];

    if (!pieceCode) {
      return styles;
    }

    if (!styles[style]) {
      styles[style] = {};
    }

    styles[style][pieceCode] = source;
    return styles;
  }, {});
}

const IMAGE_BY_STYLE = buildAssetPieceMap();

export default function ChessPiece({
  piece,
  pieceStyle = DEFAULT_PIECE_STYLE,
  className = '',
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const resolvedStyle = normalizePieceStyle(pieceStyle);
  const usesImageAssets = IMAGE_BY_STYLE[resolvedStyle] != null;
  const colorClass = piece?.startsWith('w') ? 'white' : 'black';
  const imageSource = piece ? IMAGE_BY_STYLE[resolvedStyle]?.[piece] : null;
  const Icon =
    piece
      ? (ICONS_BY_STYLE[resolvedStyle] ?? ICONS_BY_STYLE.classic)[piece[1]]
      : null;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource, resolvedStyle]);

  if (!piece || piece === 'erase') {
    return null;
  }

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
      {usesImageAssets && imageSource && !imageFailed ? (
        <img
          src={imageSource}
          className="piece-image"
          alt=""
          aria-hidden="true"
          draggable="false"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon className="piece-icon" aria-hidden="true" focusable="false" />
      )}
    </span>
  );
}
