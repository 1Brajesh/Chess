export const DEFAULT_BOARD_STYLE = 'walnut';

export const BOARD_STYLE_OPTIONS = [
  {
    value: 'walnut',
    label: 'Walnut',
    description: 'Warm maple and walnut tournament board',
  },
  {
    value: 'rosewood',
    label: 'Rosewood',
    description: 'Richer red-brown luxury wood finish',
  },
  {
    value: 'slate',
    label: 'Slate',
    description: 'Dark stone board with pale ivory squares',
  },
];

const BOARD_STYLE_SET = new Set(
  BOARD_STYLE_OPTIONS.map((option) => option.value),
);

export function normalizeBoardStyle(candidate) {
  return BOARD_STYLE_SET.has(candidate) ? candidate : DEFAULT_BOARD_STYLE;
}

