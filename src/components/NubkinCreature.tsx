import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from 'react-native';
import { CreatureMood } from '../types';
import { FONT } from '../lib/theme';
import { TraitId } from '../data/personality';

const CHARACTER_IMAGES: Record<string, Record<string, any>> = {
  default: {
    happy:    require('../../assets/nubkins/Nubkin1-Happy.png'),
    excited:  require('../../assets/nubkins/Nubkin1-Excitement.png'),
    neutral:  require('../../assets/nubkins/Nubkin1-Neutral.png'),
    sad:      require('../../assets/nubkins/Nubkin1-sad.png'),
    sleeping: require('../../assets/nubkins/Nubkin1-sleep.png'),
  },
  'skin-jerry': {
    happy:    require('../../assets/nubkins/jerry/jerry-happy.png'),
    excited:  require('../../assets/nubkins/jerry/jerry-excited.png'),
    neutral:  require('../../assets/nubkins/jerry/jerry-neutral.png'),
    sad:      require('../../assets/nubkins/jerry/jerry-sad.png'),
    sleeping: require('../../assets/nubkins/jerry/jerry-sleep.png'),
  },
  'skin-starry': {
    happy:    require('../../assets/nubkins/starry/starry-happy.png'),
    excited:  require('../../assets/nubkins/starry/starry-excited.png'),
    neutral:  require('../../assets/nubkins/starry/starry-neutral.png'),
    sad:      require('../../assets/nubkins/starry/starry-sad.png'),
    sleeping: require('../../assets/nubkins/starry/starry-neutral.png'),
  },
  'skin-nubkin2': {
    happy:    require('../../assets/nubkins/Nubkin2.png'),
    excited:  require('../../assets/nubkins/Nubkin2-Excitement.png'),
    neutral:  require('../../assets/nubkins/Nubkin2-Neutral.png'),
    sad:      require('../../assets/nubkins/Nubkin2-sad.png'),
    sleeping: require('../../assets/nubkins/Nubkin2-Sleep.png'),
  },
  'skin-pinubs': {
    happy:    require('../../assets/nubkins/pinubs/Pinub-happy.png'),
    excited:  require('../../assets/nubkins/pinubs/pinub-excited.png'),
    neutral:  require('../../assets/nubkins/pinubs/pinub-neutral.png'),
    sad:      require('../../assets/nubkins/pinubs/pinub-sad.png'),
    sleeping: require('../../assets/nubkins/pinubs/pinub-sleep.png'),
  },
  'skin-babynubs': {
    happy:    require('../../assets/nubkins/nubs/babynubs-happy.png'),
    excited:  require('../../assets/nubkins/nubs/babynubs-happy.png'),
    neutral:  require('../../assets/nubkins/nubs/babynubs-neutral.png'),
    sad:      require('../../assets/nubkins/nubs/babynubs-sad.png'),
    sleeping: require('../../assets/nubkins/nubs/babynubs-neutral.png'),
  },
  'skin-golden': {
    happy:    require('../../assets/nubkins/golden/Golden-Happy.png'),
    excited:  require('../../assets/nubkins/golden/Golden-Excitement.png'),
    neutral:  require('../../assets/nubkins/golden/Golden-Neutral.png'),
    sad:      require('../../assets/nubkins/golden/Golden-sad.png'),
    sleeping: require('../../assets/nubkins/golden/Golden-Sleep.png'),
  },
  'skin-ember': {
    happy:    require('../../assets/nubkins/ember/Ember-Happy.png'),
    excited:  require('../../assets/nubkins/ember/Ember-Excitement.png'),
    neutral:  require('../../assets/nubkins/ember/Ember-Neutral.png'),
    sad:      require('../../assets/nubkins/ember/Ember-sad.png'),
    sleeping: require('../../assets/nubkins/ember/Ember-Sleep.png'),
  },
  'skin-phantom': {
    happy:    require('../../assets/nubkins/phantom/Phantom-Happy.png'),
    excited:  require('../../assets/nubkins/phantom/Phantom-Excitement.png'),
    neutral:  require('../../assets/nubkins/phantom/Phantom-Neutral.png'),
    sad:      require('../../assets/nubkins/phantom/Phantom-sad.png'),
    sleeping: require('../../assets/nubkins/phantom/Phantom-Sleep.png'),
  },
  'skin-watermelon': {
    happy:    require('../../assets/nubkins/watermelon/Watermelon-happy.png'),
    excited:  require('../../assets/nubkins/watermelon/Watermelon-Excitement.png'),
    neutral:  require('../../assets/nubkins/watermelon/Watermelon-Neutral.png'),
    sad:      require('../../assets/nubkins/watermelon/Watermelon-sad.png'),
    sleeping: require('../../assets/nubkins/watermelon/watermelon-Sleep.png'),
  },
  'skin-spacenub': {
    happy:    require('../../assets/nubkins/spacenub/SpaceNub-Happy.png'),
    excited:  require('../../assets/nubkins/spacenub/SpaceNub-Excitement.png'),
    neutral:  require('../../assets/nubkins/spacenub/SpaceNub-Neutral.png'),
    sad:      require('../../assets/nubkins/spacenub/SpaceNub-Sad.png'),
    sleeping: require('../../assets/nubkins/spacenub/SpaceNub-Sleep.png'),
  },
  'skin-spacenub2': {
    happy:    require('../../assets/nubkins/spacenub2/SpaceNub2-Happy.png'),
    excited:  require('../../assets/nubkins/spacenub2/SpaceNub2-Excitement.png'),
    neutral:  require('../../assets/nubkins/spacenub2/SpaceNub2-Neutral.png'),
    sad:      require('../../assets/nubkins/spacenub2/SpaceNub2-Sad.png'),
    sleeping: require('../../assets/nubkins/spacenub2/SpaceNub2-Sleep.png'),
  },
};

const SKIN_GLOW: Record<string, string> = {
  'skin-default': '#D2A8FF',
  'skin-slime':   '#55EFC4',
  'skin-lava':    '#FF7675',
  'skin-galaxy':  '#74B9FF',
  'skin-crystal': '#DFE6E9',
  'skin-ghost':   '#FFFFFF',
  'skin-jerry':   '#FF9F7F',
  'skin-starry':  '#74B9FF',
  'skin-nubkin2':   '#F4A7C3',
  'skin-pinubs':    '#A29BFE',
  'skin-babynubs':  '#FFEAA7',
  'skin-golden':    '#FFD700',
  'skin-ember':     '#FF6B35',
  'skin-phantom':   '#B983FF',
  'skin-watermelon':'#FF5C77',
  'skin-spacenub':  '#4834D4',
  'skin-spacenub2': '#00CEC9',
};

const PARTICLE_N = 8;

// ── Petting tuning ─────────────────────────────────────
const HEART_EMOJIS     = ['💖', '💕', '💗', '❤️', '💞'];
const MAX_HEARTS       = 24;   // cap on simultaneously floating hearts
const COMBO_WINDOW_MS  = 700;  // taps closer than this build a combo
const STROKE_SLOP      = 12;   // px of movement before a touch counts as a stroke
const STROKE_HEART_GAP = 26;   // px of finger travel between stroke hearts
const STROKE_MIN_PATH  = 60;   // px of travel for a stroke to count as a pet

export type PetKind = 'tap' | 'stroke';

interface Heart {
  id: number; x: number; y: number; emoji: string; big: boolean; drift: number;
  rise: Animated.Value; opacity: Animated.Value; scale: Animated.Value;
}

export interface NubkinCreatureRef {
  celebrate: () => void;
  feedJump:  () => void;
  pet:       () => void;   // play the tap-pet reaction as if the center was tapped
}

interface Props {
  mood: CreatureMood;
  skinId: string;
  accessoryEmoji: string | null;
  accessoryImage?: any;
  accessoryImageStyle?: { width?: number; height?: number; top?: number; left?: number };
  tattooImage?: any;
  tattooImageStyle?: { width?: number; height?: number; top?: number; left?: number };
  specialImage?: any;
  specialImageStyle?: { width?: number; height?: number; top?: number; left?: number };
  hideGlow?: boolean;
  onTap: () => void;
  // When true, taps and strokes pet the Nubkin (hearts + happy wiggle) and
  // report through onPet instead of onTap.
  pettable?: boolean;
  onPet?: (kind: PetKind, combo: number) => void;
  // Personality, which tunes idle motion (sleepy drifts slower, bouncy hops more).
  trait?: TraitId;
}

const NubkinCreature = forwardRef<NubkinCreatureRef, Props>(function NubkinCreature({ mood, skinId, accessoryEmoji, accessoryImage, accessoryImageStyle, tattooImage, tattooImageStyle, specialImage, specialImageStyle, hideGlow, onTap, pettable, onPet, trait }: Props, ref) {
  const traitRef = useRef(trait);
  traitRef.current = trait;
  const bobAnim    = useRef(new Animated.Value(0)).current;
  const squishAnim = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0.4)).current;
  const tapScale   = useRef(new Animated.Value(1)).current;
  const tapRotate  = useRef(new Animated.Value(0)).current;
  const tapY       = useRef(new Animated.Value(0)).current;
  const swayAnim      = useRef(new Animated.Value(0)).current;
  const idleHopY      = useRef(new Animated.Value(0)).current;
  const droopRotate   = useRef(new Animated.Value(0)).current;
  const lastTapRef    = useRef(0);
  const bobLoopRef    = useRef<Animated.CompositeAnimation | null>(null);
  const zzzYAnim      = useRef(new Animated.Value(0)).current;
  const zzzOpacity    = useRef(new Animated.Value(0)).current;
  const zzzScale      = useRef(new Animated.Value(0.6)).current;
  const zzzLoopRef    = useRef<Animated.CompositeAnimation | null>(null);
  const particles     = useRef(
    Array.from({ length: PARTICLE_N }, () => {
      const x         = new Animated.Value(0);
      const y         = new Animated.Value(0);
      const opacity   = new Animated.Value(0);
      const rotate    = new Animated.Value(0);
      const rotateDeg = rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
      return { x, y, opacity, rotate, rotateDeg };
    })
  ).current;
  const [particleEmojis, setParticleEmojis] = useState<string[]>([]);

  const tapRotateDeg  = useRef(tapRotate.interpolate({
    inputRange: [-360, 0, 360],
    outputRange: ['-360deg', '0deg', '360deg'],
    extrapolate: 'clamp',
  })).current;
  const swayDeg = useRef(swayAnim.interpolate({
    inputRange: [-5, 0, 5],
    outputRange: ['-5deg', '0deg', '5deg'],
    extrapolate: 'clamp',
  })).current;
  const droopDeg = useRef(droopRotate.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  })).current;
  const translateY    = useRef(Animated.add(Animated.add(bobAnim, tapY), idleHopY)).current;
  const combinedScale = useRef(Animated.multiply(squishAnim, tapScale)).current;

  function startBob(sleeping: boolean) {
    // Sleepy Nubkins drift a little slower.
    const sleepySlow = trait === 'sleepy' ? 1.3 : 1;
    bobLoopRef.current?.stop();
    const amplitude = sleeping ? 5    : 10;
    const period    = sleeping ? 2000 : 1000 * sleepySlow;
    bobLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -amplitude, duration: period, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0,          duration: period, useNativeDriver: true }),
      ])
    );
    bobLoopRef.current.start();
  }

  function startZzz() {
    zzzYAnim.setValue(0);
    zzzOpacity.setValue(0);
    zzzScale.setValue(0.6);
    zzzLoopRef.current?.stop();
    zzzLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(zzzOpacity, { toValue: 1,   duration: 300,  useNativeDriver: true }),
          Animated.spring(zzzScale,   { toValue: 1.1, useNativeDriver: true, speed: 14 }),
        ]),
        Animated.timing(zzzYAnim,   { toValue: -50, duration: 1000, useNativeDriver: true }),
        Animated.timing(zzzOpacity, { toValue: 0,   duration: 250,  useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(zzzYAnim,   { toValue: 0,   duration: 0, useNativeDriver: true }),
          Animated.timing(zzzScale,   { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    );
    zzzLoopRef.current.start();
  }

  function stopZzz() {
    zzzLoopRef.current?.stop();
    zzzLoopRef.current = null;
    Animated.timing(zzzOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }

  function burstParticles(emojis: string[]) {
    setParticleEmojis(emojis);
    const anims = particles.map((p, i) => {
      const angle  = (i / PARTICLE_N) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const radius = 40 + Math.random() * 25;
      const tx     = Math.cos(angle) * radius;
      const ty     = Math.sin(angle) * radius - 20;
      p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(1); p.rotate.setValue(0);
      return Animated.parallel([
        Animated.timing(p.x,      { toValue: tx,  duration: 520, useNativeDriver: true }),
        Animated.timing(p.y,      { toValue: ty,  duration: 520, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 360, duration: 520, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(p.opacity, { toValue: 0, duration: 340, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(anims).start(() => setParticleEmojis([]));
  }

  function celebrate() {
    Animated.sequence([
      Animated.spring(squishAnim, { toValue: 1.3, useNativeDriver: true, speed: 25, bounciness: 4 }),
      Animated.spring(squishAnim, { toValue: 1,   useNativeDriver: true, speed: 14 }),
    ]).start();
    burstParticles(['⭐', '✨', '🌟', '💫', '⭐', '✨', '🌟', '💫']);
  }

  function feedJump() {
    Animated.sequence([
      Animated.timing(tapY, { toValue: -55, duration: 150, useNativeDriver: true }),
      Animated.spring(tapY, { toValue: 0,   useNativeDriver: true, speed: 10, bounciness: 18 }),
    ]).start();
    Animated.sequence([
      Animated.spring(tapScale, { toValue: 1.22, useNativeDriver: true, speed: 28 }),
      Animated.spring(tapScale, { toValue: 1,    useNativeDriver: true, speed: 14 }),
    ]).start();
    burstParticles(['❤️', '✨', '❤️', '💛', '❤️', '✨', '💛', '❤️']);
  }

  useEffect(() => {
    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    ).start();

    // Idle sway — different period to bob so motion feels organic
    Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, { toValue:  4, duration: 2200, useNativeDriver: true }),
        Animated.timing(swayAnim, { toValue: -4, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Periodic idle hop — small bounce every 5-9 s when not recently tapped
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function scheduleHop() {
      timeout = setTimeout(() => {
        if (Date.now() - lastTapRef.current > 3000) {
          Animated.sequence([
            Animated.timing(idleHopY, { toValue: traitRef.current === 'bouncy' ? -26 : -18, duration: 110, useNativeDriver: true }),
            Animated.spring(idleHopY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 12 }),
          ]).start(() => scheduleHop());
        } else {
          scheduleHop();
        }
      }, traitRef.current === 'bouncy'
        ? 2200 + Math.random() * 1800   // bouncy Nubkins can't sit still
        : 5000 + Math.random() * 4000);
    }
    scheduleHop();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const sleeping = mood === 'sleeping';
    startBob(sleeping);

    if (sleeping) {
      Animated.spring(squishAnim,    { toValue: 0.95, useNativeDriver: true }).start();
      Animated.spring(droopRotate,   { toValue: 0,   useNativeDriver: true, speed: 8 }).start();
      startZzz();
    } else if (mood === 'happy' || mood === 'excited') {
      Animated.sequence([
        Animated.spring(squishAnim, { toValue: 1.15, useNativeDriver: true, speed: 20 }),
        Animated.spring(squishAnim, { toValue: 1,    useNativeDriver: true, speed: 20 }),
      ]).start();
      Animated.spring(droopRotate,   { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 4 }).start();
      stopZzz();
    } else if (mood === 'sad') {
      Animated.spring(squishAnim,  { toValue: 0.9, useNativeDriver: true }).start();
      Animated.spring(droopRotate, { toValue: -7,  useNativeDriver: true, speed: 5, bounciness: 2 }).start();
      stopZzz();
    } else {
      Animated.spring(squishAnim,    { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(droopRotate,   { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 4 }).start();
      stopZzz();
    }
  }, [mood]);

  const handleTap = () => {
    lastTapRef.current = Date.now();
    const pick = Math.floor(Math.random() * 3);

    if (pick === 0) {
      // Wiggle — rapid left-right shake
      Animated.sequence([
        Animated.timing(tapRotate, { toValue: -18, duration: 60,  useNativeDriver: true }),
        Animated.timing(tapRotate, { toValue:  18, duration: 60,  useNativeDriver: true }),
        Animated.timing(tapRotate, { toValue: -12, duration: 55,  useNativeDriver: true }),
        Animated.timing(tapRotate, { toValue:  12, duration: 55,  useNativeDriver: true }),
        Animated.timing(tapRotate, { toValue:   0, duration: 55,  useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(tapScale, { toValue: 1.1, useNativeDriver: true, speed: 30 }),
        Animated.spring(tapScale, { toValue: 1,   useNativeDriver: true, speed: 18 }),
      ]).start();

    } else if (pick === 1) {
      // Bounce — jump up and land with squish
      Animated.sequence([
        Animated.timing(tapY,     { toValue: -42,  duration: 140, useNativeDriver: true }),
        Animated.spring(tapY,     { toValue: 0,    useNativeDriver: true, speed: 12, bounciness: 16 }),
      ]).start();
      Animated.sequence([
        Animated.spring(tapScale, { toValue: 1.18, useNativeDriver: true, speed: 28 }),
        Animated.spring(tapScale, { toValue: 1,    useNativeDriver: true, speed: 14 }),
      ]).start();

    } else {
      // Spin — full 360° rotation
      tapRotate.setValue(0);
      Animated.sequence([
        Animated.timing(tapRotate, { toValue: 360, duration: 420, useNativeDriver: true }),
        Animated.timing(tapRotate, { toValue: 0,   duration: 0,   useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(tapScale, { toValue: 1.12, useNativeDriver: true, speed: 22 }),
        Animated.spring(tapScale, { toValue: 1,    useNativeDriver: true, speed: 14 }),
      ]).start();
    }

    onTap();
  };

  // ── Petting ────────────────────────────────────────────

  const [hearts, setHearts] = useState<Heart[]>([]);
  const heartIdRef   = useRef(0);
  const comboRef     = useRef(0);
  const lastPetRef   = useRef(0);
  const strokeRef    = useRef({ x0: 0, y0: 0, lastX: 0, lastY: 0, path: 0, lastSpawn: 0, hearts: 0, stroking: false });

  function spawnHeart(x: number, y: number, big = false) {
    const h: Heart = {
      id: heartIdRef.current++,
      x: Math.max(0, Math.min(SIZE, x)),
      y: Math.max(0, Math.min(SIZE, y)),
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
      big,
      drift: (Math.random() - 0.5) * 36,
      rise: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0.3),
    };
    Animated.parallel([
      Animated.timing(h.rise, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(h.scale, { toValue: 1, speed: 24, bounciness: 14, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(h.opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start(() => setHearts(prev => prev.filter(p => p.id !== h.id)));
    setHearts(prev => [...prev.slice(-(MAX_HEARTS - 1)), h]);
  }

  // Happy wiggle — a side-to-side shimmy that grows with the tap combo.
  function happyWiggle(intensity: number) {
    const a = Math.min(20, 11 * intensity);
    tapRotate.stopAnimation();
    Animated.sequence([
      Animated.timing(tapRotate, { toValue: -a,        duration: 60, useNativeDriver: true }),
      Animated.timing(tapRotate, { toValue:  a,        duration: 60, useNativeDriver: true }),
      Animated.timing(tapRotate, { toValue: -a * 0.6,  duration: 55, useNativeDriver: true }),
      Animated.timing(tapRotate, { toValue:  a * 0.6,  duration: 55, useNativeDriver: true }),
      Animated.timing(tapRotate, { toValue:  0,        duration: 55, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.spring(tapScale, { toValue: 1 + 0.06 * intensity, useNativeDriver: true, speed: 30 }),
      Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, speed: 18 }),
    ]).start();
  }

  function petTap(x: number, y: number) {
    const now = Date.now();
    lastTapRef.current = now;
    comboRef.current = now - lastPetRef.current < COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
    lastPetRef.current = now;
    const combo = comboRef.current;

    happyWiggle(1 + Math.min(combo, 5) * 0.15);
    const count = Math.min(1 + combo, 6);
    for (let i = 0; i < count; i++) {
      spawnHeart(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30, i === 0 && combo >= 3);
    }

    // Every 5th tap in a row: a happy bounce and a ring of hearts.
    if (combo % 5 === 0) {
      Animated.sequence([
        Animated.timing(tapY, { toValue: -36, duration: 130, useNativeDriver: true }),
        Animated.spring(tapY, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 16 }),
      ]).start();
      burstParticles(['💖', '💕', '💗', '❤️', '💖', '💕', '💗', '❤️']);
    }

    onPet?.('tap', combo);
  }

  // Latest-render handlers for the once-created PanResponder.
  const petHandlers = useRef({ petTap, spawnHeart, happyWiggle });
  petHandlers.current = { petTap, spawnHeart, happyWiggle };
  const onPetRef = useRef(onPet);
  onPetRef.current = onPet;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      strokeRef.current = { x0: x, y0: y, lastX: x, lastY: y, path: 0, lastSpawn: 0, hearts: 0, stroking: false };
      lastTapRef.current = Date.now();
    },
    onPanResponderMove: (_, g) => {
      const s = strokeRef.current;
      if (!s.stroking) {
        if (Math.hypot(g.dx, g.dy) < STROKE_SLOP) return;
        s.stroking = true;
        tapScale.stopAnimation();
        Animated.spring(tapScale, { toValue: 1.06, useNativeDriver: true, speed: 20 }).start();
      }
      const x = s.x0 + g.dx;
      const y = s.y0 + g.dy;
      s.path += Math.hypot(x - s.lastX, y - s.lastY);
      s.lastX = x;
      s.lastY = y;
      if (s.path - s.lastSpawn >= STROKE_HEART_GAP) {
        s.lastSpawn = s.path;
        s.hearts++;
        petHandlers.current.spawnHeart(x, y);
      }
      // Lean into the stroke, like leaning into a hand.
      tapRotate.stopAnimation();
      tapRotate.setValue(Math.max(-10, Math.min(10, g.dx / 6)));
      lastTapRef.current = Date.now();
    },
    onPanResponderRelease: () => {
      const s = strokeRef.current;
      if (!s.stroking) {
        petHandlers.current.petTap(s.x0, s.y0);
        return;
      }
      Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, speed: 18 }).start();
      petHandlers.current.happyWiggle(1);
      if (s.path >= STROKE_MIN_PATH) onPetRef.current?.('stroke', s.hearts);
    },
    onPanResponderTerminate: () => {
      Animated.spring(tapRotate, { toValue: 0, useNativeDriver: true }).start();
      Animated.spring(tapScale,  { toValue: 1, useNativeDriver: true }).start();
    },
  })).current;

  useImperativeHandle(ref, () => ({ celebrate, feedJump, pet: () => petTap(SIZE / 2, SIZE / 2) }));

  const glow = SKIN_GLOW[skinId] ?? SKIN_GLOW['skin-default'];

  const body = (
      <Animated.View
        pointerEvents={pettable ? 'none' : 'auto'}
        style={[
          styles.wrapper,
          { transform: [{ translateY }, { scale: combinedScale }, { rotate: tapRotateDeg }, { rotate: swayDeg }, { rotate: droopDeg }] }
        ]}
      >
        {!hideGlow && <View style={styles.glowRing} />}
        {!hideGlow && <Animated.View style={[styles.glow, { backgroundColor: glow, opacity: glowAnim }]} />}

        {/* Character image */}
        <Image
          source={(CHARACTER_IMAGES[skinId] ?? CHARACTER_IMAGES.default)[mood]}
          style={styles.creature}
          resizeMode="contain"
        />

        {/* Blush / tattoo — tattoo replaces default blush when equipped */}
        <Image
          source={tattooImage ?? require('../../assets/custom-items/nubkins_defaultrosy.png')}
          style={[styles.blush, tattooImageStyle]}
          resizeMode="contain"
        />

        {/* Special item overlay (own slot, independent of tattoo) */}
        {specialImage && (
          <Image
            source={specialImage}
            style={[styles.blush, specialImageStyle]}
            resizeMode="contain"
          />
        )}

        {/* Accessory */}
        {accessoryImage ? (
          <Image source={accessoryImage} style={[styles.accessoryImg, accessoryImageStyle]} resizeMode="contain" />
        ) : accessoryEmoji ? (
          <View style={styles.accessoryContainer}>
            <Text style={styles.accessoryText}>{accessoryEmoji}</Text>
          </View>
        ) : null}

        {/* Floating Zzz for sleep */}
        <Animated.Text style={[styles.zzz, { opacity: zzzOpacity, transform: [{ translateY: zzzYAnim }, { scale: zzzScale }] }]}>
          z
        </Animated.Text>

        {/* Particle burst */}
        {particleEmojis.length > 0 && particles.map((p, i) => (
          <Animated.Text key={i} style={[styles.particle, {
            opacity:   p.opacity,
            transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: p.rotateDeg }],
          }]}>
            {particleEmojis[i % particleEmojis.length]}
          </Animated.Text>
        ))}
      </Animated.View>
  );

  if (!pettable) {
    return <TouchableWithoutFeedback onPress={handleTap}>{body}</TouchableWithoutFeedback>;
  }

  // Pettable: an untransformed touch area owns the gesture (so touch coordinates
  // stay stable while the body wiggles), and hearts float above the body.
  return (
    <View style={styles.petArea} {...panResponder.panHandlers}>
      {body}
      {hearts.map(h => (
        <Animated.Text
          key={h.id}
          pointerEvents="none"
          style={[
            styles.heart,
            h.big && styles.heartBig,
            {
              left: h.x - 10,
              top:  h.y - 12,
              opacity: h.opacity,
              transform: [
                { translateX: h.rise.interpolate({ inputRange: [0, 1], outputRange: [0, h.drift] }) },
                { translateY: h.rise.interpolate({ inputRange: [0, 1], outputRange: [0, -72] }) },
                { scale: h.scale },
              ],
            },
          ]}
        >
          {h.emoji}
        </Animated.Text>
      ))}
    </View>
  );
});

export default NubkinCreature;

const SIZE = 140;

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: SIZE + 52,
    height: SIZE + 52,
    borderRadius: (SIZE + 52) / 2,
    bottom: -16,
    borderWidth: 5,
    borderColor: '#0D0D0D',
    backgroundColor: 'transparent',
  },
  glow: {
    position: 'absolute',
    width: SIZE + 40,
    height: SIZE + 40,
    borderRadius: (SIZE + 40) / 2,
    bottom: -10,
  },
  creature: {
    width: SIZE,
    height: SIZE,
  },
  blush: {
    position: 'absolute',
    top: 20,
    width: SIZE,
    height: SIZE,
  },
  accessoryImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
  },
  accessoryContainer: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
  },
  accessoryText: {
    fontFamily: FONT,
    fontSize: 32,
  },
  zzz: {
    fontFamily: FONT,
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 22,
    color: '#8888CC',
  },
  particle: {
    position: 'absolute',
    fontSize: 16,
  },
  petArea: {
    width: SIZE,
    height: SIZE,
  },
  heart: {
    position: 'absolute',
    fontSize: 18,
  },
  heartBig: {
    fontSize: 26,
  },
});
