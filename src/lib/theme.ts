export const BG         = '#8686e9';
export const TEXT_WHITE = '#EFEFFF';
export const TEXT_BLACK = '#0F0F23';
export const FONT       = 'MaruMinyaHangul';
export const FONT_MARU  = 'MaruMinyaHangul';

// Bright pastel palette for modals/overlays — pink wash instead of a black
// scrim, cream cards, candy buttons with dark "sticker" outlines and dark text.
export const KAWAII = {
  backdrop:   'rgba(255,190,222,0.78)',
  card:       '#FFF6FB',
  cardBorder: '#FF8CC6',
  ink:        '#2B1630',   // primary text + button outlines
  inkSoft:    '#7A5A80',   // secondary text
  pink:       '#FF8CC6',
  mint:       '#7EE2B8',
  yellow:     '#FFD95A',
  sky:        '#8FD3FF',
  lilac:      '#CDB4FF',
  orange:     '#C2540A',   // readable accent text on light backgrounds
};

// Chunky candy-button look shared by modal buttons.
export const KAWAII_BTN = {
  borderWidth: 2.5,
  borderBottomWidth: 5,
  borderColor: KAWAII.ink,
  borderRadius: 22,
} as const;
