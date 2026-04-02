export const DEFAULT_PIECE_STYLE = 'classic';

export const PIECE_STYLE_OPTIONS = [
  {
    value: 'classic',
    label: 'Classic',
    description: 'Solid tournament-style icons',
  },
  {
    value: 'outline',
    label: 'Outline',
    description: 'Lighter line-art pieces',
  },
  {
    value: 'ornate',
    label: 'Ornate',
    description: 'Decorative fantasy-style pieces',
  },
];

const PIECE_STYLE_SET = new Set(
  PIECE_STYLE_OPTIONS.map((option) => option.value),
);

export function normalizePieceStyle(candidate) {
  return PIECE_STYLE_SET.has(candidate) ? candidate : DEFAULT_PIECE_STYLE;
}

