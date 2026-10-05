import { FoodItem } from '../types';

export const FOOD_ITEMS: FoodItem[] = [
  { id: 'snack-blob',    name: 'Nub Snack',    emoji: '', image: require('../../assets/custom-items/Feed.png'),              hungerRestore: 20, happinessBonus: 5,  coinCost: 10 },
  { id: 'snack-shroom',  name: 'Cherry Berry',   emoji: '', image: require('../../assets/minigame_items/CherrieBerry.png'),    hungerRestore: 30, happinessBonus: 10, coinCost: 20 },
  { id: 'snack-star',    name: 'Hundred Berry',    emoji: '', image: require('../../assets/minigame_items/100berry.png'),        hungerRestore: 15, happinessBonus: 20, coinCost: 25 },
  { id: 'snack-cake',    name: 'Peach Berry',      emoji: '', image: require('../../assets/minigame_items/Peachberry.png'),      hungerRestore: 50, happinessBonus: 30, coinCost: 60 },
  { id: 'snack-berry',   name: 'Weird Berry',   emoji: '', image: require('../../assets/minigame_items/Sunberry.png'),        hungerRestore: 25, happinessBonus: 8,  coinCost: 15 },
  { id: 'snack-potion',  name: 'Happy Potion',  emoji: '', image: require('../../assets/minigame_items/Happypotion.png'), hungerRestore: 10, happinessBonus: 40, coinCost: 250, energyRestore: 50 },
];

// The berries a Nubkin can love or dislike (Cherry, Hundred, Peach, Weird).
export const BERRY_IDS = ['snack-shroom', 'snack-star', 'snack-cake', 'snack-berry'];

export const FAVORITE_REVEAL_FEEDS = 3;  // feeds of the favorite before it's revealed
export const DISLIKE_REVEAL_FEEDS  = 2;  // feeds of the disliked berry before it's revealed
export const FAVORITE_HAPPINESS    = 10; // extra happiness when fed their favorite
export const DISLIKE_HAPPINESS     = -5; // happiness change when fed the berry they dislike

export const getFoodById = (id: string) => FOOD_ITEMS.find(f => f.id === id);

// Pick a random favorite and a different disliked berry for a new Nubkin.
export function rollBerryPreferences(): { favoriteBerryId: string; dislikedBerryId: string } {
  const fav = BERRY_IDS[Math.floor(Math.random() * BERRY_IDS.length)];
  const rest = BERRY_IDS.filter(id => id !== fav);
  return { favoriteBerryId: fav, dislikedBerryId: rest[Math.floor(Math.random() * rest.length)] };
}
