import { CreatureMood, MiniGameId } from '../types';

export type TraitId = 'sleepy' | 'playful' | 'greedy' | 'shy' | 'bouncy';

export interface Trait {
  id: TraitId;
  label: string;
  emoji: string;
  description: string;
  favoriteGames: MiniGameId[];                   // +TRAIT_GAME_HAPPINESS when played
  moodLines: Record<CreatureMood, string[]>;     // speech bubble lines on Home
}

// Extra happiness when a Nubkin plays a game that suits its personality.
export const TRAIT_GAME_HAPPINESS = 10;
// Greedy Nubkins get this much extra happiness from every meal.
export const GREEDY_FEED_HAPPINESS = 5;
// Sleepy Nubkins doze off after this many idle hours (others: AUTO_SLEEP_HOURS).
export const SLEEPY_AUTO_SLEEP_HOURS = 4;

export const TRAITS: Record<TraitId, Trait> = {
  sleepy: {
    id: 'sleepy', label: 'Sleepy', emoji: '😴',
    description: 'Loves naps and warm baths. Dozes off a little sooner than most.',
    favoriteGames: ['bath-time'],
    moodLines: {
      happy:    ['cozy and happy~', 'this is nice… *yawn*'],
      excited:  ['wide awake for this!!', 'okay that was fun!'],
      neutral:  ['five more minutes…', 'is it nap time yet?'],
      sad:      ['too tired to be happy…', 'need a cuddle and a nap…'],
      sleeping: ['Zzz…', 'Zzz… mmm… berries…'],
    },
  },
  playful: {
    id: 'playful', label: 'Playful', emoji: '🎈',
    description: 'Always ready for a game, especially puzzles.',
    favoriteGames: ['twist-catch', 'slide-catch'],
    moodLines: {
      happy:    ['play with me!!', "let's do something fun!"],
      excited:  ['AGAIN! AGAIN!', 'best. game. ever!!'],
      neutral:  ['so bored… game?', 'tag, you\'re it!'],
      sad:      ['nobody plays with me…', 'can we play later…?'],
      sleeping: ['Zzz…', 'Zzz… *dream-wiggling*'],
    },
  },
  greedy: {
    id: 'greedy', label: 'Greedy', emoji: '🍓',
    description: 'Lives for snacks. Every meal makes them extra happy.',
    favoriteGames: [],
    moodLines: {
      happy:    ['full tummy, full heart!', 'that snack was perfect~'],
      excited:  ['MORE SNACKS!!', 'is that… dessert?!'],
      neutral:  ['is that… a snack?', 'thinking about berries…'],
      sad:      ['my tummy is so empty…', 'not even one berry…?'],
      sleeping: ['Zzz…', 'Zzz… nom nom…'],
    },
  },
  shy: {
    id: 'shy', label: 'Shy', emoji: '🙈',
    description: 'Quiet and sweet. Opens up with gentle head pats.',
    favoriteGames: ['bath-time'],
    moodLines: {
      happy:    ['h-hi… I\'m happy you\'re here', '*blushes softly*'],
      excited:  ['th-that was fun!', '*happy little squeak*'],
      neutral:  ['um… hello…', '*peeks at you*'],
      sad:      ['…did I do something wrong?', '*hides a little*'],
      sleeping: ['Zzz…', 'Zzz… *tiny snore*'],
    },
  },
  bouncy: {
    id: 'bouncy', label: 'Bouncy', emoji: '🐰',
    description: "Can't sit still! Hops around and loves jumping games.",
    favoriteGames: ['nubkin-jump'],
    moodLines: {
      happy:    ['boing boing boing!', 'can\'t stop hopping~'],
      excited:  ['JUMP JUMP JUMP!!', 'woooo higher!!'],
      neutral:  ['*bounces in place*', 'hop… hop… hop…'],
      sad:      ['no bounce left…', '*sad little hop*'],
      sleeping: ['Zzz…', 'Zzz… *twitchy feet*'],
    },
  },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export function rollTrait(): TraitId {
  return TRAIT_IDS[Math.floor(Math.random() * TRAIT_IDS.length)];
}

export function getTrait(id: TraitId | undefined): Trait | null {
  return id ? TRAITS[id] : null;
}
