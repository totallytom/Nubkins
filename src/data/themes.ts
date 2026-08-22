export interface CapsuleTheme {
  id: string;
  name: string;
  emoji: string;

  pageBg: string;

  // Capsule shell
  shell: string;
  shellLight: string;
  shellMid: string;
  shellDark: string;
  shellDeep: string;
  keychain: string;
  speaker: string;

  // Screen area
  bezel: string;
  screen: string;
  statsPanelBg: string;
  statsPanelBorder: string;
  statTrack: string;
  xpBar: string;
  screenFloor: string;

  // LED
  led: string;

  // Seam
  seam: string;
  seamHighlight: string;

  // Button panel
  panel: string;
  panelLight: string;
  panelMid: string;
  panelDark: string;
  panelDeep: string;

  // Buttons
  btn: string;
  btnLight: string;
  btnMid: string;
  btnDark: string;
  btnDeep: string;
  btnLabel: string;
}

export const THEMES: CapsuleTheme[] = [
  {
    id: 'lemon-pop',
    name: 'Lemon Pop',
    emoji: '',
    pageBg: '#FEF3C7',
    shell: '#FACC15', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#B45309', speaker: '#A16207',
    bezel: '#FEF9C3', screen: '#78a77a',
    statsPanelBg: '#FEF9C3', statsPanelBorder: '#EAB308', statTrack: '#2D2060', xpBar: '#FACC15', screenFloor: '#2D2060',
    led: '#F43F5E',
    seam: '#B45309', seamHighlight: '#FDE047',
    panel: '#EC4899', panelLight: '#F9A8D4', panelMid: '#F472B6', panelDark: '#BE185D', panelDeep: '#9D174D',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#BE185D',
  },
  {
    id: 'candy-shell',
    name: 'Candy Shell',
    emoji: '',
    pageBg: '#FAE8FF',
    shell: '#F472B6', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#9D174D', speaker: '#BE185D',
    bezel: '#FDE7F3', screen: '#78a77a',
    statsPanelBg: '#FDE7F3', statsPanelBorder: '#F472B6', statTrack: '#2D1060', xpBar: '#A855F7', screenFloor: '#2D1060',
    led: '#A78BFA',
    seam: '#9D174D', seamHighlight: '#FBCFE8',
    panel: '#A855F7', panelLight: '#D8B4FE', panelMid: '#C084FC', panelDark: '#7E22CE', panelDeep: '#581C87',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#7E22CE',
  },
  {
    id: 'ocean-toy',
    name: 'Ocean Toy',
    emoji: '',
    pageBg: '#CFFAFE',
    shell: '#22D3EE', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#0E7490', speaker: '#0E7490',
    bezel: '#E0FBFF', screen: '#78a77a',
    statsPanelBg: '#E0FBFF', statsPanelBorder: '#22D3EE', statTrack: '#1E3A5F', xpBar: '#22D3EE', screenFloor: '#1E3A5F',
    led: '#F59E0B',
    seam: '#0E7490', seamHighlight: '#A5F3FC',
    panel: '#0EA5E9', panelLight: '#7DD3FC', panelMid: '#38BDF8', panelDark: '#0369A1', panelDeep: '#075985',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#0369A1',
  },
  {
    id: 'berry-punch',
    name: 'Berry Punch',
    emoji: '',
    pageBg: '#EDE9FE',
    shell: '#C026D3', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#701A75', speaker: '#701A75',
    bezel: '#FAF5FF', screen: '#78a77a',
    statsPanelBg: '#FAF5FF', statsPanelBorder: '#C026D3', statTrack: '#2D1060', xpBar: '#C026D3', screenFloor: '#2D1060',
    led: '#4ADE80',
    seam: '#701A75', seamHighlight: '#E879F9',
    panel: '#7E22CE', panelLight: '#C084FC', panelMid: '#9333EA', panelDark: '#581C87', panelDeep: '#3B0764',
    btn: '#FEF9C3', btnLight: '#FEF08A', btnMid: '#FACC15', btnDark: '#EAB308', btnDeep: '#CA8A04', btnLabel: '#581C87',
  },
  {
    id: 'mint-dream',
    name: 'Mint Dream',
    emoji: '',
    pageBg: '#DCFCE7',
    shell: '#4ADE80', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#15803D', speaker: '#15803D',
    bezel: '#F0FFF4', screen: '#78a77a',
    statsPanelBg: '#F0FFF4', statsPanelBorder: '#4ADE80', statTrack: '#14532D', xpBar: '#4ADE80', screenFloor: '#14532D',
    led: '#F43F5E',
    seam: '#15803D', seamHighlight: '#BBF7D0',
    panel: '#059669', panelLight: '#6EE7B7', panelMid: '#10B981', panelDark: '#047857', panelDeep: '#064E3B',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#047857',
  },
  {
    id: 'sunset-blaze',
    name: 'Sunset Blaze',
    emoji: '',
    pageBg: '#FFEDD5',
    shell: '#F97316', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#C2410C', speaker: '#C2410C',
    bezel: '#FFF7ED', screen: '#78a77a',
    statsPanelBg: '#FFF7ED', statsPanelBorder: '#F97316', statTrack: '#3D1C00', xpBar: '#F97316', screenFloor: '#3D1C00',
    led: '#FACC15',
    seam: '#C2410C', seamHighlight: '#FDBA74',
    panel: '#DC2626', panelLight: '#FCA5A5', panelMid: '#EF4444', panelDark: '#B91C1C', panelDeep: '#991B1B',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#B91C1C',
  },
  {
    id: 'galaxy-night',
    name: 'Galaxy Night',
    emoji: '',
    pageBg: '#E0E7FF',
    shell: '#1E1B4B', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#312E81', speaker: '#312E81',
    bezel: '#EEF2FF', screen: '#78a77a',
    statsPanelBg: '#EEF2FF', statsPanelBorder: '#4338CA', statTrack: '#1E1B4B', xpBar: '#818CF8', screenFloor: '#1E1B4B',
    led: '#818CF8',
    seam: '#312E81', seamHighlight: '#4338CA',
    panel: '#4338CA', panelLight: '#818CF8', panelMid: '#6366F1', panelDark: '#3730A3', panelDeep: '#312E81',
    btn: '#C7D2FE', btnLight: '#E0E7FF', btnMid: '#A5B4FC', btnDark: '#6366F1', btnDeep: '#4338CA', btnLabel: '#1E1B4B',
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    emoji: '',
    pageBg: '#FFE4E6',
    shell: '#FDA4AF', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
    keychain: '#E11D48', speaker: '#E11D48',
    bezel: '#FFF1F2', screen: '#78a77a',
    statsPanelBg: '#FFF1F2', statsPanelBorder: '#FDA4AF', statTrack: '#3D0A1F', xpBar: '#FB7185', screenFloor: '#3D0A1F',
    led: '#F43F5E',
    seam: '#121212', seamHighlight: '#FECDD3',
    panel: '#E11D48', panelLight: '#FDA4AF', panelMid: '#F43F5E', panelDark: '#BE123C', panelDeep: '#9F1239',
    btn: '#FFFFFF', btnLight: '#F3F4F6', btnMid: '#E5E7EB', btnDark: '#9CA3AF', btnDeep: '#6B7280', btnLabel: '#BE123C',
  },

  {
  id: 'midnight-rose',
  name: 'Midnight Rose',
  pageBg: '#1a0a0fad',
  shell: '#8B0032', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
  keychain: '#4A0019', speaker: '#4A0019',
  bezel: '#2D0016', screen: '#78a77a',
  statsPanelBg: '#1b051050', statsPanelBorder: '#C0004A', statTrack: '#e6dbde', xpBar: '#FF1A6E', screenFloor: '#1A0A0F',
  led: '#FF1A6E',
  seam: '#4A0019', seamHighlight: '#FF6699',
  panel: '#C0004A', panelLight: '#FF6699', panelMid: '#E0005A', panelDark: '#7A002F', panelDeep: '#4A0019',
  btn: '#FFD6E7', btnLight: '#FFE8F0', btnMid: '#FFB3CF', btnDark: '#E0005A', btnDeep: '#C0004A', btnLabel: '#4A0019',
},

{
  id: 'angel-sky',
  name: 'Angel Sky',
  pageBg: '#c3ebdab2',
  shell: '#d3f0d3', shellLight: '#121212', shellMid: '#121212', shellDark: '#121212', shellDeep: '#121212',
  keychain: '#f3de6a', speaker: '#4A0019',
  bezel: '#2D0016', screen: '#78a77a',
  statsPanelBg: '#1b051050', statsPanelBorder: '#C0004A', statTrack: '#e6dbde', xpBar: '#FF1A6E', screenFloor: '#1A0A0F',
  led: '#FF1A6E',
  seam: '#4A0019', seamHighlight: '#FF6699',
  panel: '#ffffff', panelLight: '#252425', panelMid: '#2c2b2c', panelDark: '#2b292a', panelDeep: '#292828',
  btn: '#FFD6E7', btnLight: '#222122', btnMid: '#242424', btnDark: '#2b292a', btnDeep: '#222122', btnLabel: '#1d1d1d',
},

];

export const DEFAULT_THEME_ID = 'lemon-pop';

export function getThemeById(id: string): CapsuleTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}
