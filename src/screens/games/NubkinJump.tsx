import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT } from '../../lib/theme';
import { getSkinImages } from '../../lib/skinImages';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';
import { playSfx } from '../../lib/sfx';

const { width: SW, height: SH } = Dimensions.get('window');

const CONTROLLER_H = 210;
const HUD_H        = 56;
const GROUND_H     = 143;
const NUBKIN_SIZE  = 64;
const OBS_SIZE     = 70;
const STAR_SIZE    = 28;
const JUMP_HEIGHT  = 150;
const JUMP_UP_MS   = 200;
const JUMP_DN_MS   = 260;
const TICK_MS      = 16;
const NUBKIN_X     = 80;
const MAX_SPEED    = 11;
const SPEED_ACCEL  = 0.0025; // added every tick — smooth continuous ramp instead of stepped jumps

const GAP_PX     = 620;  // average ground distance between obstacles
const GAP_JITTER = 0.45; // +/- randomness applied to that distance

// Both the stump and Nubkin PNGs have transparent padding baked in below the
// visible art (measured: stump ~15.2% of its height, Nubkin skins ~11.4% —
// consistent across every skin checked). Without compensating, the sprites'
// bounding boxes touch the ground line but the visible art floats above it.
const OBS_BOTTOM_PAD    = OBS_SIZE    * (91 / 600);
const NUBKIN_BOTTOM_PAD = NUBKIN_SIZE * (16 / 140);

// Ground dashes: DASH_UNIT is chosen so it divides SW exactly, so the two
// scrolled tiles line up seamlessly when bgX wraps at -SW (see startGame()).
const DASH_W          = 18;
const DASHES_PER_TILE = Math.max(1, Math.round(SW / 40));
const DASH_UNIT       = SW / DASHES_PER_TILE;

interface Obs  { id: number; x: number }
interface Star { id: number; x: number }
interface Props { level: number; onFinish: (score: number) => void }

let _uid = 0;

export default function NubkinJump({ level, onFinish }: Props) {
  const equippedSkinId = useGameStore(s => s.creature.equippedSkinId);
  const skin           = getSkinImages(equippedSkinId);
  const nubkinImgs     = { run: skin.happy, jump: skin.excited, hit: skin.sad };
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const insets        = useSafeAreaInsets();
  const gameH         = SH - insets.top - insets.bottom - CONTROLLER_H - HUD_H;
  const nubkinBaseTop = gameH - GROUND_H - NUBKIN_SIZE + NUBKIN_BOTTOM_PAD;
  const obsTop        = gameH - GROUND_H - OBS_SIZE + OBS_BOTTOM_PAD;
  const starTop       = nubkinBaseTop - Math.round(JUMP_HEIGHT * 0.55);

  const [running,   setRunning]   = useState(false);
  const [crashed,   setCrashed]   = useState(false);
  const [paused,    setPaused]    = useState(false);
  const [score,     setScore]     = useState(0);
  const [obstacles, setObstacles] = useState<Obs[]>([]);
  const [stars,     setStars]     = useState<Star[]>([]);
  const [mood,      setMood]      = useState<'run' | 'jump' | 'hit'>('run');
  const [showSaveMe, setShowSaveMe] = useState(false);

  const translateY    = useRef(new Animated.Value(0)).current;
  const translateYRef = useRef(0);
  const isJumping     = useRef(false);
  const pausedRef     = useRef(false);
  const obsRef        = useRef<Obs[]>([]);
  const starsRef      = useRef<Star[]>([]);
  const scoreRef      = useRef(0);
  const ticksRef      = useRef(0);
  const finishedRef   = useRef(false);
  const speedRef      = useRef(4);
  const loopRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const obsSpawnRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starSpawnRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canStartRef   = useRef(false);
  const saveMeRef       = useRef(false);   // "crashed, save me?" overlay showing
  const continueUsedRef = useRef(false);   // only one continue allowed per game
  const bgX           = useRef(new Animated.Value(0)).current;
  const bgXRef        = useRef(0);

  const jumpSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    Audio.Sound.createAsync(require('../../../assets/audio/jumping.wav')).then(({ sound }) => {
      if (cancelled) { sound.unloadAsync(); return; }
      jumpSoundRef.current = sound;
    });
    return () => {
      cancelled = true;
      jumpSoundRef.current?.unloadAsync();
      jumpSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { translateYRef.current = value; });
    const openGuard = setTimeout(() => { canStartRef.current = true; }, 400);
    return () => {
      canStartRef.current = false;
      clearTimeout(openGuard);
      translateY.removeListener(id);
      [loopRef, obsSpawnRef, starSpawnRef].forEach(r => { if (r.current) clearInterval(r.current); });
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
    };
  }, []);

  function doJump() {
    if (isJumping.current || !running || finishedRef.current || pausedRef.current || saveMeRef.current) return;
    isJumping.current = true;
    playSfx(jumpSoundRef.current);
    setMood('jump');
    Animated.sequence([
      Animated.timing(translateY, { toValue: -JUMP_HEIGHT, duration: JUMP_UP_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0,            duration: JUMP_DN_MS, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
    ]).start(() => {
      isJumping.current = false;
      if (!finishedRef.current) setMood('run');
    });
  }

  function togglePause() {
    if (!running || finishedRef.current || saveMeRef.current) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function endGame() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    [loopRef, obsSpawnRef, starSpawnRef].forEach(r => { if (r.current) clearInterval(r.current); });
    setMood('hit');
    setCrashed(true);
    endTimerRef.current = setTimeout(() => onFinish(scoreRef.current), 800);
  }

  function grantContinue() {
    saveMeRef.current = false;
    continueUsedRef.current = true;
    setShowSaveMe(false);
    setCrashed(false);
    setMood('run');
    scheduleNextObstacle();
  }

  function watchAdToContinue() {
    showRewardedAd(() => grantContinue(), () => {
      Alert.alert('Ad Not Available', 'No ad is available right now. Please try again in a moment.');
    });
  }

  function spendDiamondsToContinue() {
    if (spendDiamonds(GAME_CONTINUE_DIAMONDS)) grantContinue();
  }

  function declineSaveMe() {
    saveMeRef.current = false;
    setShowSaveMe(false);
    endGame();
  }

  function scheduleNextObstacle() {
    if (finishedRef.current || saveMeRef.current) return;
    const gap    = GAP_PX * (1 - GAP_JITTER + Math.random() * GAP_JITTER * 2);
    const pxPerMs = speedRef.current / TICK_MS;
    const delay  = Math.max(700, gap / pxPerMs);
    obsSpawnRef.current = setTimeout(() => {
      if (finishedRef.current) return;
      obsRef.current = [...obsRef.current, { id: ++_uid, x: SW + OBS_SIZE }];
      scheduleNextObstacle();
    }, delay);
  }

  function startGame() {
    if (!canStartRef.current) return;
    [loopRef, obsSpawnRef, starSpawnRef].forEach(r => { if (r.current) clearInterval(r.current); });
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    finishedRef.current = false;
    pausedRef.current   = false;
    saveMeRef.current   = false;
    continueUsedRef.current = false;
    bgXRef.current      = 0;
    bgX.setValue(0);
    obsRef.current      = [];
    starsRef.current    = [];
    scoreRef.current    = 0;
    ticksRef.current    = 0;
    speedRef.current    = 2.5 + (level - 1) * 0.3;
    isJumping.current   = false;
    translateY.setValue(0);

    setObstacles([]);
    setStars([]);
    setScore(0);
    setCrashed(false);
    setPaused(false);
    setMood('run');
    setRunning(true);
    setShowSaveMe(false);

    scheduleNextObstacle();

    starSpawnRef.current = setInterval(() => {
      if (finishedRef.current || saveMeRef.current || Math.random() < 0.35) return;
      starsRef.current = [...starsRef.current, { id: ++_uid, x: SW + STAR_SIZE }];
    }, 1500);

    loopRef.current = setInterval(() => {
      if (finishedRef.current || pausedRef.current || saveMeRef.current) return;

      ticksRef.current++;

      speedRef.current = Math.min(speedRef.current + SPEED_ACCEL, MAX_SPEED);

      if (ticksRef.current % 10 === 0) {
        scoreRef.current++;
        setScore(scoreRef.current);
      }

      const spd = speedRef.current;
      const ty  = translateYRef.current;

      bgXRef.current -= spd;
      if (bgXRef.current <= -SW) bgXRef.current += SW;
      bgX.setValue(bgXRef.current);

      obsRef.current   = obsRef.current.map(o => ({ ...o, x: o.x - spd })).filter(o => o.x > -OBS_SIZE);
      starsRef.current = starsRef.current.map(s => ({ ...s, x: s.x - spd })).filter(s => s.x > -STAR_SIZE);

      // Nubkin body hitbox — ignore outer 14px of sprite on each side
      const nTop   = nubkinBaseTop + ty + 12;
      const nBot   = nubkinBaseTop + ty + NUBKIN_SIZE - 6;
      const nLeft  = NUBKIN_X + 14;
      const nRight = NUBKIN_X + NUBKIN_SIZE - 14;

      for (const o of obsRef.current) {
        // Stump trunk hitbox — ignore 12px horizontal padding, 14px off the top
        if (nRight > o.x + 12   &&
            nLeft  < o.x + OBS_SIZE - 12 &&
            nBot   > obsTop + 14 &&
            nTop   < obsTop + OBS_SIZE) {
          if (!continueUsedRef.current) {
            saveMeRef.current = true;
            if (obsSpawnRef.current) clearTimeout(obsSpawnRef.current);
            obsRef.current = [];
            setObstacles([]);
            setMood('hit');
            setShowSaveMe(true);
            return;
          }
          endGame();
          return;
        }
      }

      starsRef.current = starsRef.current.filter(s => {
        const hit = nRight > s.x && nLeft < s.x + STAR_SIZE &&
                    nBot   > starTop && nTop < starTop + STAR_SIZE;
        if (hit) { scoreRef.current += 5; setScore(scoreRef.current); }
        return !hit;
      });

      setObstacles([...obsRef.current]);
      setStars([...starsRef.current]);
    }, TICK_MS);
  }

  const onJumpPress = () => {
    if (!running) {
      startGame();
    } else if (paused) {
      togglePause();
    } else {
      doJump();
    }
  };

  return (
    <View style={styles.root}>
      {/* HUD */}
      <View style={styles.hud}>
        <Text style={styles.scoreText}>{score}</Text>
        <Text style={styles.levelText}>Lv {level}</Text>
      </View>

      {/* Game field */}
      <View style={[styles.field, { height: gameH }]}>
        {/* Flat sky + ground band (ground line sits at the top of the ground area) */}
        <View pointerEvents="none" style={[styles.groundBand, { top: gameH - GROUND_H, height: GROUND_H }]}>
          <View style={styles.groundLine} />
        </View>

        {/* Scrolling ground dashes — the T-Rex-style motion cue */}
        <Animated.View
          pointerEvents="none"
          style={[styles.dashRow, { top: gameH - GROUND_H, transform: [{ translateX: bgX }] }]}
        >
          {Array.from({ length: DASHES_PER_TILE * 2 }).map((_, i) => (
            <View key={i} style={[styles.dash, { left: i * DASH_UNIT }]} />
          ))}
        </Animated.View>

        {/* Coins */}
        {stars.map(s => (
          <Image
            key={s.id}
            source={require('../../../assets/currency/Coin.png')}
            style={[styles.star, { left: s.x, top: starTop }]}
            resizeMode="contain"
          />
        ))}

        {/* Obstacles */}
        {obstacles.map(o => (
          <Image
            key={o.id}
            source={require('../../../assets/minigame_items/stump.png')}
            style={[styles.obstacle, { left: o.x, top: obsTop }]}
            resizeMode="stretch"
          />
        ))}

        {/* Nubkin */}
        <Animated.Image
          source={nubkinImgs[mood]}
          style={[styles.nubkin, { left: NUBKIN_X, top: nubkinBaseTop, transform: [{ translateY }] }]}
          resizeMode="contain"
        />

        {/* Paused overlay */}
        {paused && running && (
          <View style={styles.pausedOverlay}>
            <Text style={styles.pausedText}>PAUSED</Text>
            <Text style={styles.pausedSub}>Tap JUMP to resume</Text>
          </View>
        )}

        {/* Continue prompt — shown on crash, before the run actually ends */}
        {showSaveMe && (
          <View style={styles.saveMeOverlay}>
            <Text style={styles.overlayTitle}>Crashed!</Text>
            <Text style={styles.saveMeScore}>Score: {score}</Text>
            <Text style={styles.saveMeDesc}>Keep running?</Text>
            <TouchableOpacity style={styles.saveMeBtn} onPress={watchAdToContinue}>
              <Text style={styles.saveMeBtnTxt}>▶  Watch Ad to Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveMeBtn, styles.saveMeBtnDiamond, diamonds < GAME_CONTINUE_DIAMONDS && styles.saveMeBtnDisabled]}
              onPress={spendDiamondsToContinue}
              disabled={diamonds < GAME_CONTINUE_DIAMONDS}
            >
              <Text style={styles.saveMeBtnTxt}>◆  Use {GAME_CONTINUE_DIAMONDS} Diamonds</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveMeSkip} onPress={declineSaveMe}>
              <Text style={styles.saveMeSkipTxt}>No thanks</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Start / crash overlay */}
        {!running && (
          <TouchableOpacity style={styles.overlay} onPress={startGame} activeOpacity={1}>
            <Image source={nubkinImgs[crashed ? 'hit' : 'run']} style={styles.overlayNubkin} resizeMode="contain" />
            <Text style={styles.overlayTitle}>Nubkin Jump</Text>
            {crashed && <Text style={styles.overlayScore}>Score: {score}</Text>}
            <Text style={styles.overlayDesc}>
              {crashed
                ? 'Better luck next time!'
                : 'Tap JUMP to start!\nCatch coins for bonus points.'}
              {!crashed && level > 1 ? `\nLevel ${level}: ${Math.round((level - 1) * 12)}% faster!` : ''}
            </Text>
            <View style={styles.startBtn}>
              <Text style={styles.startBtnText}>{crashed ? 'Try Again!' : 'Tap to Start!'}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Retro controller panel */}
      <View style={styles.controller}>
        {/* Pause / resume button */}
        <TouchableOpacity style={styles.pauseBtn} onPress={togglePause} activeOpacity={0.75}>
          {paused ? (
            <View style={styles.playIcon} />
          ) : (
            <View style={styles.pauseIconRow}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          )}
        </TouchableOpacity>

        {/* JUMP button */}
        <TouchableOpacity style={styles.jumpBtn} onPress={onJumpPress} activeOpacity={0.75}>
          <Text style={styles.jumpBtnText}>JUMP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F0F0' },

  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: HUD_H,
    backgroundColor: '#1A1A2E',
  },
  scoreText: { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 20 },
  levelText: { fontFamily: FONT, color: '#7777AA', fontWeight: '700', fontSize: 16 },

  field:    { width: SW, position: 'relative', overflow: 'hidden', backgroundColor: '#CFEFFB' },

  groundBand: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#9FD679' },
  groundLine: { height: 4, backgroundColor: '#6FAF4F' },

  dashRow: { position: 'absolute', left: 0, width: SW * 2, height: 4 },
  dash:    { position: 'absolute', width: DASH_W, height: 4, backgroundColor: '#C9A876', borderRadius: 2 },

  nubkin:   { position: 'absolute', width: NUBKIN_SIZE, height: NUBKIN_SIZE },
  obstacle: { position: 'absolute', width: OBS_SIZE, height: OBS_SIZE },
  star:     { position: 'absolute', width: STAR_SIZE, height: STAR_SIZE },

  pausedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,30,0.65)',
    gap: 12,
  },
  pausedText: { fontFamily: FONT, color: '#EFEFFF', fontSize: 42, fontWeight: '900', letterSpacing: 5 },
  pausedSub:  { fontFamily: FONT, color: '#AAAACC', fontSize: 15 },

  saveMeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  saveMeScore: { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  saveMeBtn: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  saveMeBtnDiamond:  { backgroundColor: '#3498DB' },
  saveMeBtnDisabled: { opacity: 0.4 },
  saveMeBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 15 },
  saveMeSkip:    { marginTop: 4, padding: 8 },
  saveMeSkipTxt: { fontFamily: FONT, color: '#7777AA', fontSize: 14, fontWeight: '700' },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    backgroundColor: '#0F0F23DD',
  },
  overlayNubkin: { width: 80, height: 80, marginBottom: 4 },
  overlayTitle:  { fontFamily: FONT, color: '#EFEFFF', fontSize: 30, fontWeight: '900' },
  overlayScore:  { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  overlayDesc:   { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  startBtn: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 20,
    marginTop: 8,
  },
  startBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 16 },

  // Retro controller
  controller: {
    height: CONTROLLER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F0F0F0',
    borderTopWidth: 4,
    borderTopColor: '#2A2A2A',
    paddingHorizontal: 24,
  },

  pauseBtn: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#888888',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  pauseIconRow: { flexDirection: 'row', gap: 10 },
  pauseBar:     { width: 13, height: 34, backgroundColor: '#FFF', borderRadius: 3 },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 17,
    borderBottomWidth: 17,
    borderLeftWidth: 28,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFF',
    marginLeft: 4,
  },

  jumpBtn: {
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: '#E8304A',
    borderWidth: 6,
    borderColor: '#A3001F',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#A3001F',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  jumpBtnText: {
    fontFamily: FONT,
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
