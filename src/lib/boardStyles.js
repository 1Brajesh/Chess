export const DEFAULT_BOARD_STYLE = 'walnut';

export const BOARD_STYLE_OPTIONS = [
  {
    value: 'walnut',
    label: 'Walnut Photo',
    description: 'Photoreal maple and walnut wood board',
  },
  {
    value: 'rosewood',
    label: 'Rosewood Photo',
    description: 'Photoreal red-brown luxury wood finish',
  },
  {
    value: 'ebony',
    label: 'Ebony Photo',
    description: 'Photoreal ebony and ivory wood set',
  },
  {
    value: 'marble-mint',
    label: 'White + Green Marble',
    description: 'Photoreal white marble and pale green marble',
  },
  {
    value: 'marble-rose',
    label: 'White + Pink Marble',
    description: 'Photoreal white marble and soft pink marble',
  },
  {
    value: 'walnut-classic',
    label: 'Walnut Classic',
    description: 'Original non-image walnut texture theme',
  },
  {
    value: 'rosewood-classic',
    label: 'Rosewood Classic',
    description: 'Original non-image rosewood texture theme',
  },
  {
    value: 'slate-classic',
    label: 'Slate Classic',
    description: 'Original non-image slate and ivory theme',
  },
];

const BOARD_STYLE_SET = new Set(
  BOARD_STYLE_OPTIONS.map((option) => option.value),
);

export function normalizeBoardStyle(candidate) {
  return BOARD_STYLE_SET.has(candidate) ? candidate : DEFAULT_BOARD_STYLE;
}
