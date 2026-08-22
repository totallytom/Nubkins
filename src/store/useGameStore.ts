import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Creature, PlayerProfile, DailyGameRecord, MiniGameId } from '../types';
import { MINI_GAMES } from '../data/minigames';
import { COSMETICS } from '../data/cosmetics';
import { DEFAULT_THEME_ID } from '../data/themes';
import {
  COINS_PER_DIAMOND,
  DAILY_LOGIN_DIAMONDS,
  MILESTONE_LEVEL_INTERVAL,
  MILESTONE_LEVEL_DIAMONDS,
} from '../data/economy';

const STORAGE_KEY_CREATURE = '@nubkins:creature';
const STORAGE_KEY_PROFILE  = '@nubkins:profile';
const STORAGE_KEY_DAILY    = '@nubkins:daily';
const STORAGE_KEY_THEME    = '@nubkins:themeId';
const STORAGE_KEY_AUDIO    = '@nubkins:audio';

const XP_TABLE = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];

function xpToNext(level: number) {
  return XP_TABLE[Math.min(level, XP_TABLE.length - 1)] ?? 9999;
}

function defaultCreature(): Creature {
  const now = new Date().toISOString();
  return {
    name: 'Nubkin',
    hunger: 80,
    happiness: 80,
    energy: 90,
    cleanliness: 90,
    level: 1,
    xp: 0,
    xpToNext: xpToNext(1),
    equippedSkinId: 'skin-default',
    equippedAccessoryId: null,
    equippedTattooId: null,
    equippedSpecialId: null,
    lastFed: null,
    lastPlayed: null,
    lastCleaned: null,
    lastWokeAt: null,
    createdAt: now,
    lastDecayAt: now,
    sleepingSince: null,
    energyDepletedAt: null,
  };
}

function defaultProfile(): PlayerProfile {
  return {
    coins: 100,
    diamonds: 0,
    ownedCosmeticIds: ['skin-default'],
    checkInStreak: 0,
    lastCheckIn: null,
    highScores: {},
    unlockedAchievements: [],
    adsRemoved: false,
    adSessionCount: 0,
  };
}

function dateStr(d: Date) {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayStr() {
  return dateStr(new Date());
}

function defaultDailyRecord(date: string): DailyGameRecord {
  const playsLeft = {} as Record<MiniGameId, number>;
  MINI_GAMES.forEach(g => { playsLeft[g.id] = g.maxPlaysPerDay; });
  return { date, playsLeft };
}

export const SLEEP_WAKE_COST       = 30;  // coins to wake early
export const SLEEP_WAKE_ENERGY     = 80;  // energy level restored on wake / auto-wake
export const AUTO_SLEEP_HOURS      = 5;   // hours of inactivity before Nubkin falls asleep
export const ENERGY_RECHARGE_MINUTES = 15; // minutes until energy auto-refills after hitting 0
const SLEEP_RECOVERY_PER_HR        = 12;  // energy recovered per hour while asleep

// Decay stats based on elapsed hours since last decay checkpoint
function applyDecay(creature: Creature): Creature {
  const now = Date.now();
  const lastDecay = new Date(creature.lastDecayAt ?? creature.createdAt).getTime();
  const hoursSinceLast = (now - lastDecay) / 3_600_000;

  const hungerDecay    = Math.floor(hoursSinceLast * 10);
  const happinessDecay = Math.floor(hoursSinceLast * 5);
  const cleanDecay     = Math.floor(hoursSinceLast * 4);
  const nowIso         = new Date(now).toISOString();

  // While sleeping: energy recovers instead of decaying; auto-wake at SLEEP_WAKE_ENERGY
  if (creature.sleepingSince) {
    const energyGain = Math.floor(hoursSinceLast * SLEEP_RECOVERY_PER_HR);
    const newEnergy  = Math.min(SLEEP_WAKE_ENERGY, creature.energy + energyGain);
    const autoWake   = newEnergy >= SLEEP_WAKE_ENERGY;
    return {
      ...creature,
      hunger:           Math.max(0, creature.hunger - hungerDecay),
      happiness:        Math.max(0, creature.happiness - happinessDecay),
      energy:           newEnergy,
      cleanliness:      Math.max(0, creature.cleanliness - cleanDecay),
      lastDecayAt:      nowIso,
      sleepingSince:    autoWake ? null : creature.sleepingSince,
      lastWokeAt:       autoWake ? nowIso : (creature.lastWokeAt ?? null),
      energyDepletedAt: newEnergy > 0 ? null : (creature.energyDepletedAt ?? null),
    };
  }

  // Normal awake decay — energy and sleep are now independent systems
  const energyDecay = Math.floor(hoursSinceLast * 6);
  const rawEnergy   = Math.max(0, creature.energy - energyDecay);

  // 15-minute energy recharge: track when energy first hits 0, auto-refill after the window
  let energyDepletedAt = creature.energyDepletedAt ?? null;
  let newEnergy = rawEnergy;
  if (rawEnergy === 0 && !energyDepletedAt) {
    energyDepletedAt = nowIso;
  }
  if (energyDepletedAt) {
    const minsDepleted = (now - new Date(energyDepletedAt).getTime()) / 60_000;
    if (minsDepleted >= ENERGY_RECHARGE_MINUTES) {
      newEnergy        = SLEEP_WAKE_ENERGY; // recharge to 80
      energyDepletedAt = null;
    }
  }

  // Sleep is triggered by inactivity only (5 hours), never by energy level
  const lastInteraction = Math.max(
    creature.lastFed     ? new Date(creature.lastFed).getTime()     : 0,
    creature.lastPlayed  ? new Date(creature.lastPlayed).getTime()  : 0,
    creature.lastCleaned ? new Date(creature.lastCleaned).getTime() : 0,
    creature.lastWokeAt  ? new Date(creature.lastWokeAt).getTime()  : 0,
    new Date(creature.createdAt).getTime(),
  );
  const sleepingSince = (now - lastInteraction) / 3_600_000 >= AUTO_SLEEP_HOURS
    ? nowIso
    : null;

  return {
    ...creature,
    hunger:           Math.max(0, creature.hunger - hungerDecay),
    happiness:        Math.max(0, creature.happiness - happinessDecay),
    energy:           newEnergy,
    cleanliness:      Math.max(0, creature.cleanliness - cleanDecay),
    lastDecayAt:      nowIso,
    sleepingSince,
    energyDepletedAt,
  };
}

interface GameState {
  creature: Creature;
  profile: PlayerProfile;
  daily: DailyGameRecord;
  loaded: boolean;
  themeId: string;
  setTheme: (id: string) => Promise<void>;

  isPlayingGame: boolean;
  setIsPlayingGame: (v: boolean) => void;

  bgmEnabled: boolean;
  bgmVolume: number;
  sfxEnabled: boolean;
  setBgmEnabled: (v: boolean) => Promise<void>;
  setBgmVolume: (v: number) => Promise<void>;
  setSfxEnabled: (v: boolean) => Promise<void>;

  load: () => Promise<void>;
  save: () => Promise<void>;
  resetCreature: () => void;

  feedCreature: (hungerRestore: number, happinessBonus: number, coinCost: number, energyRestore?: number) => boolean;
  petCreature: () => void;
  cleanCreature: () => void;
  wakeCreature: () => boolean;

  gainXP: (amount: number) => void;
  gainCoins: (amount: number) => void;
  gainDiamonds: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  spendDiamonds: (amount: number) => boolean;
  convertCoinsToDiamonds: (diamonds?: number) => boolean;

  buyCosmetic: (cosmeticId: string, priceCoin: number, priceDiamond: number) => boolean;
  equipSkin: (skinId: string) => void;
  equipAccessory: (accId: string | null) => void;
  equipTattoo: (tattooId: string | null) => void;
  equipSpecial: (specialId: string | null) => void;

  recordGamePlay: (gameId: MiniGameId, score: number, coinsEarned: number, xpEarned: number) => void;
  playsLeftToday: (gameId: MiniGameId) => number;
  refillPlays: (gameId: MiniGameId) => void;
  addPlays: (gameId: MiniGameId, count: number) => void;
  hasWatchedAdForGame: (gameId: MiniGameId) => boolean;
  markAdWatchedForGame: (gameId: MiniGameId) => void;
  setAdsRemoved: (v: boolean) => void;
  incrementAdSessionCount: () => number;

  levelUpEvent: { level: number; diamonds: number } | null;
  clearLevelUpEvent: () => void;

  checkIn: () => Promise<{ isNew: boolean; streak: number; coinsEarned: number; diamondsEarned: number; streakBonus: number }>;
}

export const useGameStore = create<GameState>()((set, get) => ({
  creature: defaultCreature(),
  profile: defaultProfile(),
  daily: defaultDailyRecord(todayStr()),
  loaded: false,
  themeId: DEFAULT_THEME_ID,
  levelUpEvent: null,
  clearLevelUpEvent: () => set({ levelUpEvent: null }),
  isPlayingGame: false,
  setIsPlayingGame: (v) => set({ isPlayingGame: v }),

  bgmEnabled: true,
  bgmVolume: 0.5,
  sfxEnabled: true,
  setBgmEnabled: async (v) => {
    set({ bgmEnabled: v });
    const { bgmVolume, sfxEnabled } = get();
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify({ bgmEnabled: v, bgmVolume, sfxEnabled }));
  },
  setBgmVolume: async (v) => {
    set({ bgmVolume: v });
    const { bgmEnabled, sfxEnabled } = get();
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify({ bgmEnabled, bgmVolume: v, sfxEnabled }));
  },
  setSfxEnabled: async (v) => {
    set({ sfxEnabled: v });
    const { bgmEnabled, bgmVolume } = get();
    await AsyncStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify({ bgmEnabled, bgmVolume, sfxEnabled: v }));
  },
  setTheme: async (id) => {
    set({ themeId: id });
    await AsyncStorage.setItem(STORAGE_KEY_THEME, id);
  },

  load: async () => {
    try {
      const [rawCreature, rawProfile, rawDaily, rawTheme, rawAudio] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_CREATURE),
        AsyncStorage.getItem(STORAGE_KEY_PROFILE),
        AsyncStorage.getItem(STORAGE_KEY_DAILY),
        AsyncStorage.getItem(STORAGE_KEY_THEME),
        AsyncStorage.getItem(STORAGE_KEY_AUDIO),
      ]);

      let creature = rawCreature ? (JSON.parse(rawCreature) as Creature) : defaultCreature();
      creature = applyDecay(creature);

      const savedProfile = rawProfile ? (JSON.parse(rawProfile) as PlayerProfile) : defaultProfile();
      // Migrate legacy profiles that stored gems instead of diamonds
      const profile: PlayerProfile = {
        ...defaultProfile(),
        ...savedProfile,
        coins:    Math.max(0, savedProfile.coins ?? 100),
        diamonds: Math.max(0, (savedProfile as any).diamonds ?? (savedProfile as any).gems ?? 0),
        unlockedAchievements: savedProfile.unlockedAchievements ?? [],
      };

      const today = todayStr();
      let daily: DailyGameRecord;
      if (rawDaily) {
        const parsed = JSON.parse(rawDaily) as DailyGameRecord;
        daily = parsed.date === today ? parsed : defaultDailyRecord(today);
      } else {
        daily = defaultDailyRecord(today);
      }

      const themeId = rawTheme ?? DEFAULT_THEME_ID;
      const audio = rawAudio ? JSON.parse(rawAudio) : {};
      set({
        creature, profile, daily, themeId, loaded: true,
        bgmEnabled: audio.bgmEnabled ?? true,
        bgmVolume:  audio.bgmVolume  ?? 0.5,
        sfxEnabled: audio.sfxEnabled ?? true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  save: async () => {
    const { creature, profile, daily } = get();
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_CREATURE, JSON.stringify(creature)),
      AsyncStorage.setItem(STORAGE_KEY_PROFILE,  JSON.stringify(profile)),
      AsyncStorage.setItem(STORAGE_KEY_DAILY,    JSON.stringify(daily)),
    ]);
  },

  resetCreature: () => {
    const fresh = defaultCreature();
    set({ creature: fresh });
    get().save();
  },

  feedCreature: (hungerRestore, _happinessBonus, coinCost, energyRestore) => {
    const { profile, creature } = get();
    if (profile.coins < coinCost) return false;
    set({
      creature: {
        ...creature,
        hunger:  Math.min(100, creature.hunger + hungerRestore),
        // Potions unlock energy up to a floor — they never drain energy the Nubkin already has
        energy:  energyRestore ? Math.min(100, Math.max(creature.energy, energyRestore)) : creature.energy,
        lastFed: new Date().toISOString(),
      },
      profile: { ...profile, coins: profile.coins - coinCost },
    });
    get().gainXP(5);
    get().save();
    return true;
  },

  petCreature: () => {
    const { creature } = get();
    set({
      creature: {
        ...creature,
        happiness: Math.min(100, creature.happiness + 3),
        energy:    Math.max(0, creature.energy - 3),
      },
    });
    get().gainXP(2);
    get().save();
  },

  cleanCreature: () => {
    const { creature } = get();
    set({
      creature: {
        ...creature,
        cleanliness: 100,
        happiness: Math.min(100, creature.happiness + 2),
        lastCleaned: new Date().toISOString(),
      },
    });
    get().gainXP(3);
    get().save();
  },

  wakeCreature: () => {
    const { creature, profile } = get();
    if (profile.coins < SLEEP_WAKE_COST) return false;
    set({
      creature: {
        ...creature,
        energy: 60,
        sleepingSince: null,
        lastWokeAt: new Date().toISOString(),
        energyDepletedAt: null,
      },
      profile: { ...profile, coins: profile.coins - SLEEP_WAKE_COST },
    });
    get().save();
    return true;
  },

  gainXP: (amount) => {
    const { creature } = get();
    let { xp, level } = creature;
    const oldLevel = level;
    xp += amount;
    while (xp >= xpToNext(level) && level < 10) {
      xp -= xpToNext(level);
      level += 1;
    }
    set({ creature: { ...get().creature, xp, level, xpToNext: xpToNext(level) } });
    // Award diamonds at every milestone level (every MILESTONE_LEVEL_INTERVAL levels)
    if (level !== oldLevel) {
      for (let lvl = oldLevel + 1; lvl <= level; lvl++) {
        if (lvl % MILESTONE_LEVEL_INTERVAL === 0) {
          get().gainDiamonds(MILESTONE_LEVEL_DIAMONDS);
          set({ levelUpEvent: { level: lvl, diamonds: MILESTONE_LEVEL_DIAMONDS } });
        }
      }
    }
  },

  gainCoins: (amount) => {
    if (amount <= 0) return;
    const { profile } = get();
    set({ profile: { ...profile, coins: profile.coins + amount } });
    get().save();
  },

  gainDiamonds: (amount) => {
    const { profile } = get();
    set({ profile: { ...profile, diamonds: profile.diamonds + amount } });
    get().save();
  },

  spendCoins: (amount) => {
    const { profile } = get();
    if (profile.coins < amount) return false;
    set({ profile: { ...profile, coins: profile.coins - amount } });
    get().save();
    return true;
  },

  spendDiamonds: (amount) => {
    const { profile } = get();
    if (profile.diamonds < amount) return false;
    set({ profile: { ...profile, diamonds: profile.diamonds - amount } });
    get().save();
    return true;
  },

  // Convert coins to diamonds at the locked-in rate (COINS_PER_DIAMOND coins = 1 diamond).
  // Pass `diamonds` to convert a specific amount; omit to convert the max the player can afford.
  convertCoinsToDiamonds: (diamonds) => {
    const { profile } = get();
    const maxDiamonds  = Math.floor(profile.coins / COINS_PER_DIAMOND);
    const diamondsToGain = diamonds === undefined ? maxDiamonds : Math.min(diamonds, maxDiamonds);
    if (diamondsToGain < 1) return false;
    const coinsSpent = diamondsToGain * COINS_PER_DIAMOND;
    set({
      profile: {
        ...profile,
        coins:    profile.coins - coinsSpent,
        diamonds: profile.diamonds + diamondsToGain,
      },
    });
    get().save();
    return true;
  },

  buyCosmetic: (cosmeticId, priceCoin, priceDiamond) => {
    const { profile } = get();
    if (profile.ownedCosmeticIds.includes(cosmeticId)) return false;
    if (priceDiamond > 0) {
      if (!get().spendDiamonds(priceDiamond)) return false;
    } else {
      if (!get().spendCoins(priceCoin)) return false;
    }
    set({ profile: { ...get().profile, ownedCosmeticIds: [...get().profile.ownedCosmeticIds, cosmeticId] } });
    get().save();
    return true;
  },

  equipSkin: (skinId) => {
    const { creature } = get();
    set({ creature: { ...creature, equippedSkinId: skinId } });
    get().save();
  },

  equipAccessory: (accId) => {
    const { creature } = get();
    set({ creature: { ...creature, equippedAccessoryId: accId } });
    get().save();
  },

  equipTattoo: (tattooId) => {
    const { creature } = get();
    set({ creature: { ...creature, equippedTattooId: tattooId } });
    get().save();
  },

  equipSpecial: (specialId) => {
    const { creature } = get();
    set({ creature: { ...creature, equippedSpecialId: specialId } });
    get().save();
  },

  recordGamePlay: (gameId, score, coinsEarned, xpEarned) => {
    const { daily, profile, creature } = get();
    const playsLeft = { ...daily.playsLeft };
    const max = MINI_GAMES.find(g => g.id === gameId)?.maxPlaysPerDay ?? 0;
    const current = playsLeft[gameId] ?? max;
    if (current <= 0) return;
    playsLeft[gameId] = current - 1;

    const highScores = { ...profile.highScores };
    const isNewHighScore = !highScores[gameId] || score > highScores[gameId];
    if (isNewHighScore) highScores[gameId] = score;

    // Auto-grant achievement cosmetics whose score thresholds are all met
    let ownedCosmeticIds = [...profile.ownedCosmeticIds];
    let unlockedAchievements = [...profile.unlockedAchievements];
    if (isNewHighScore) {
      const allHighScores = { ...highScores };
      COSMETICS.forEach(c => {
        if (!c.achievementScores || ownedCosmeticIds.includes(c.id)) return;
        const allMet = c.achievementScores.every(req =>
          (allHighScores[req.gameId] ?? 0) >= req.score
        );
        if (allMet) {
          ownedCosmeticIds = [...ownedCosmeticIds, c.id];
          unlockedAchievements = [...unlockedAchievements, c.id];
        }
      });
    }

    set({
      daily: { ...daily, playsLeft },
      profile: { ...profile, coins: profile.coins + Math.max(0, coinsEarned), highScores, ownedCosmeticIds, unlockedAchievements },
      creature: {
        ...creature,
        happiness: Math.min(100, creature.happiness + 20),
        energy:    Math.max(0, creature.energy - 10),
        lastPlayed: new Date().toISOString(),
      },
    });
    get().gainXP(xpEarned);
    get().save();
  },

  playsLeftToday: (gameId) => {
    const { daily } = get();
    const max = MINI_GAMES.find(g => g.id === gameId)?.maxPlaysPerDay ?? 0;
    if (daily.date !== todayStr()) return max;
    return daily.playsLeft[gameId] ?? max;
  },

  refillPlays: (gameId) => {
    const { daily } = get();
    const max = MINI_GAMES.find(g => g.id === gameId)?.maxPlaysPerDay ?? 0;
    const playsLeft = { ...daily.playsLeft, [gameId]: max };
    set({ daily: { ...daily, playsLeft } });
    get().save();
  },

  addPlays: (gameId, count) => {
    const { daily } = get();
    const current = daily.playsLeft[gameId] ?? 0;
    set({ daily: { ...daily, playsLeft: { ...daily.playsLeft, [gameId]: current + count } } });
    get().save();
  },

  hasWatchedAdForGame: (gameId) => {
    const { daily } = get();
    return daily.adWatchedForGame?.[gameId] ?? false;
  },

  markAdWatchedForGame: (gameId) => {
    const { daily } = get();
    const adWatchedForGame = { ...(daily.adWatchedForGame ?? {}), [gameId]: true };
    set({ daily: { ...daily, adWatchedForGame } });
    get().save();
  },

  setAdsRemoved: (v) => {
    const { profile } = get();
    set({ profile: { ...profile, adsRemoved: v } });
    get().save();
  },

  incrementAdSessionCount: () => {
    const { profile } = get();
    const next = (profile.adSessionCount ?? 0) + 1;
    set({ profile: { ...profile, adSessionCount: next } });
    get().save();
    return next;
  },

  checkIn: async () => {
    const { profile } = get();
    const today = todayStr();
    if (profile.lastCheckIn === today) {
      return { isNew: false, streak: profile.checkInStreak, coinsEarned: 0, diamondsEarned: 0, streakBonus: 0 };
    }

    const yesterday = dateStr(new Date(Date.now() - 86_400_000));
    const streak      = profile.lastCheckIn === yesterday ? profile.checkInStreak + 1 : 1;
    const streakBonus = Math.min(streak * 10, 100);
    const coinsEarned    = 30 + streakBonus;
    const diamondsEarned = DAILY_LOGIN_DIAMONDS;

    set({
      profile: {
        ...profile,
        checkInStreak: streak,
        lastCheckIn:   today,
        coins:    profile.coins + coinsEarned,
        diamonds: profile.diamonds + diamondsEarned,
      },
    });
    await get().save();
    return { isNew: true, streak, coinsEarned, diamondsEarned, streakBonus };
  },
}));
