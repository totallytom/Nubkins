import { CosmeticType } from '../types';
import { COSMETICS } from './cosmetics';
import { KAWAII } from '../lib/theme';

export interface ShopCategory {
  type: CosmeticType;
  title: string;
  blurb: string;
  color: string;   // candy color for the category's card and page accents
  icon: any;       // representative image (null → emoji fallback)
  emoji: string;
}

export const SHOP_CATEGORIES: ShopCategory[] = [
  { type: 'skin',       title: 'Skins',       blurb: 'A whole new Nubkin look',      color: KAWAII.pink,   emoji: '🎨', icon: require('../../assets/nubkins/starry/starry-happy.png') },
  { type: 'accessory',  title: 'Accessories', blurb: 'Hats, glasses, bows & more',   color: KAWAII.mint,   emoji: '🎩', icon: require('../../assets/custom-items/nubkin_witchhat5.png') },
  { type: 'tattoo',     title: 'Tattoos',     blurb: 'Cute cheek marks',             color: KAWAII.yellow, emoji: '🌀', icon: require('../../assets/custom-items/nubkin_odentat.png') },
  { type: 'special',    title: 'Specials',    blurb: 'Rare relics for champions',    color: KAWAII.lilac,  emoji: '🏅', icon: require('../../assets/custom-items/Amu.png') },
  { type: 'background', title: 'Themes',      blurb: 'Recolor your capsule device',  color: KAWAII.sky,    emoji: '🖌️', icon: null },
];

export const getShopCategory = (type: CosmeticType) => SHOP_CATEGORIES.find(c => c.type === type)!;

// Items the Shop lists for a category. Anniversary rewards are gifts, never sold.
export function shopItemsOf(type: CosmeticType) {
  return COSMETICS.filter(c => c.type === type && !c.anniversaryDay);
}
