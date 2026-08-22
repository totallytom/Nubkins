import { FoodItem } from '../types';

export const FOOD_ITEMS: FoodItem[] = [
  { id: 'snack-blob',    name: 'Nub Snack',    emoji: '', image: require('../../assets/custom-items/Feed.png'),              hungerRestore: 20, happinessBonus: 5,  coinCost: 10 },
  { id: 'snack-shroom',  name: 'Cherry Berry',   emoji: '', image: require('../../assets/minigame_items/CherrieBerry.png'),    hungerRestore: 30, happinessBonus: 10, coinCost: 20 },
  { id: 'snack-star',    name: 'Hundred Berry',    emoji: '', image: require('../../assets/minigame_items/100berry.png'),        hungerRestore: 15, happinessBonus: 20, coinCost: 25 },
  { id: 'snack-cake',    name: 'Peach Berry',      emoji: '', image: require('../../assets/minigame_items/Peachberry.png'),      hungerRestore: 50, happinessBonus: 30, coinCost: 60 },
  { id: 'snack-berry',   name: 'Weird Berry',   emoji: '', image: require('../../assets/minigame_items/Sunberry.png'),        hungerRestore: 25, happinessBonus: 8,  coinCost: 15 },
  { id: 'snack-potion',  name: 'Happy Potion',  emoji: '', image: require('../../assets/minigame_items/Happypotion.png'), hungerRestore: 10, happinessBonus: 40, coinCost: 250, energyRestore: 50 },
];
