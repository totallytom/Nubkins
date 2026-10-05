import type { TraitId } from '../data/personality';

export type CreatureMood ='happy' | 'neutral' | 'sad' | 'sleeping' | 'excited';

export interface Creature {
  name: string;
  named?: boolean;     // false/absent until the player picks a name (drives the first-launch naming prompt)
  hunger: number;      // 0–100, decays over time
  happiness: number;   // 0–100
  energy: number;      // 0–100
  cleanliness: number; // 0–100
  level: number;
  xp: number;
  xpToNext: number;
  equippedSkinId: string;
  equippedAccessoryId: string | null;
  equippedTattooId: string | null;
  equippedSpecialId: string | null;
  lastFed: string | null;          // ISO timestamp
  lastPlayed: string | null;
  lastCleaned: string | null;
  lastWokeAt: string | null;       // ISO timestamp — resets the 5-hour inactivity sleep timer
  createdAt: string;
  lastDecayAt: string;
  sleepingSince: string | null;    // ISO timestamp — set after 5 hours of inactivity
  energyDepletedAt: string | null; // ISO timestamp — set when energy hits 0; clears after 15-min recharge

  // Berry preferences — rolled once per Nubkin, revealed to the player by feeding.
  favoriteBerryId?: string;
  dislikedBerryId?: string;
  berryFeeds?: Record<string, number>;  // times each berry has been fed
  favoriteRevealed?: boolean;
  dislikeRevealed?: boolean;

  // Anniversaries already celebrated, as days-together counts (7, 30, 100, 365, …)
  celebratedAnniversaries?: number[];

  trait?: TraitId;        // personality, rolled at hatch
}

export type MemoryKind =
  | 'hatch'
  | 'first-level-up'
  | 'first-outfit'
  | 'first-high-score'
  | 'favorite-food'
  | 'anniversary';

// A saved "photo" — the Nubkin's look at the moment, redrawn in the memory book.
export interface Memory {
  id: string;
  kind: MemoryKind;
  title: string;
  caption: string;
  date: string;          // ISO timestamp
  daysTogether: number;  // 1 on hatch day
  level: number;
  mood: CreatureMood;
  skinId: string;
  accessoryId: string | null;
  tattooId: string | null;
  specialId: string | null;
  themeId: string;
}

export interface PlayerProfile {
  coins: number;
  diamonds: number;      // premium currency — earned via daily login, level milestones, and coin conversion
  ownedCosmeticIds: string[];
  checkInStreak: number;
  lastCheckIn: string | null;
  highScores: Record<string, number>; // gameId -> score
  unlockedAchievements: string[];     // cosmetic ids unlocked via achievement
  adsRemoved?: boolean;               // true after $3.99 "Remove Ads" IAP
  adSessionCount?: number;            // total game sessions played, for the forced-interstitial cadence
}

export type CosmeticType = 'skin' | 'accessory' | 'tattoo' | 'special' | 'background';
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  priceCoin: number;
  priceDiamond: number;
  emoji: string;
  image?: any;          // PNG asset — when present, used instead of emoji everywhere
  imageStyle?: { width?: number; height?: number; top?: number; left?: number };
  description: string;
  unlockLevel?: number;
  achievementScores?: { gameId: string; score: number }[];
  anniversaryDay?: number;  // granted (never sold) on this days-together anniversary
}

export interface FoodItem {
  id: string;
  name: string;
  emoji: string;
  image?: ReturnType<typeof require>;
  hungerRestore: number;
  happinessBonus: number;
  coinCost: number;
  energyRestore?: number;
}

export type MiniGameId = 'twist-catch' | 'slide-catch' | 'bath-time' | 'bubble-pop' | 'nub-catch' | 'obstacle-dash' | 'nubkin-jump' | 'nubkin-launch';

export interface MiniGameDef {
  id: MiniGameId;
  name: string;
  description: string;
  emoji: string;
  baseCoinsPerPlay: number;
  baseXpPerPlay: number;
  maxPlaysPerDay: number;
}

export interface DailyGameRecord {
  date: string;  // YYYY-MM-DD
  playsLeft: Record<MiniGameId, number>;
  adWatchedForGame?: Partial<Record<MiniGameId, boolean>>; // one rewarded ad per game per day
}
