export const DEFAULT_BOARD_STYLE = 'walnut';

export const BOARD_STYLE_OPTIONS = [
  {
    value: 'walnut',
    label: 'Walnut',
    description: 'Warm maple and walnut tournament wood',
  },
  {
    value: 'rosewood',
    label: 'Rosewood',
    description: 'Richer red-brown luxury wood finish',
  },
  {
    value: 'ebony',
    label: 'Ebony',
    description: 'High-contrast ebony and ivory wood set',
  },
];

const BOARD_STYLE_SET = new Set(
  BOARD_STYLE_OPTIONS.map((option) => option.value),
);

export function normalizeBoardStyle(candidate) {
  return BOARD_STYLE_SET.has(candidate) ? candidate : DEFAULT_BOARD_STYLE;
}
