import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';

const { width: SW, height: SH } = Dimensions.get('window');

import { FONT } from '../../lib/theme';
import { getSkinImages } from '../../lib/skinImages';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';
import { playSfx } from '../../lib/sfx';

const HUD_H          = 48;
const NUBKIN_SIZE     = 90;
const NUBKIN_R        = NUBKIN_SIZE / 2;
const COIN_SIZE       = 60;
const BOOST_SIZE      = 80;
const SPRING_SIZE     = 86;
const PLATFORM_H      = 22;
const GROUND_PLATFORM_W = 170;   // width of the starting platform Nubkin stands on
const GROUND_PLATFORM_H = 22;    // height/thickness of the starting platform

const GRAVITY          = 1500;   // px/s^2
const MAX_PULL         = 100;    // px
const MAX_LAUNCH_SPEED = 950;    // px/s at max pull
const MIN_PULL_TO_FIRE = 18;     // px, ignore tiny drags
const SETTLE_SPEED     = 70;     // px/s, below this while grounded = settling
const SETTLE_FRAMES    = 14;     // consecutive settled frames to confirm a landing
const SPRING_BOOST_VY     = -880;
const TRAMPOLINE_BOOST_VY = -680;
const BOOST_PAD_VX_ADD    = 480;
const MAX_VX               = 1400;
const COURSE_LENGTH    = 3100;   // world px
const CAMERA_ANCHOR_X  = SW * 0.32;
const MAX_FLIGHT_MS    = 20000;  // safety cap against endless bounce loops

type PropType = 'platform' | 'spring' | 'trampoline' | 'boost' | 'coin' | 'goal';

interface CourseProp {
  id: number;
  type: PropType;
  x: number; y: number; w: number; h: number;
  consumed: boolean;
}

interface Props {
  level: number;
  onFinish: (score: number) => void;
}

let propId = 0;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function generateCourse(level: number, gameH: number, slingX: number, slingY: number): CourseProp[] {
  const props: CourseProp[] = [];
  const groundY = gameH - 30;
  const gap = Math.max(170, 260 - (level - 1) * 10);

  // Ground platform Nubkin stands on at the start
  props.push({
    id: ++propId, type: 'platform',
    x: 0, y: slingY + NUBKIN_R, w: GROUND_PLATFORM_W, h: GROUND_PLATFORM_H,
    consumed: false,
  });

  let x = 420;
  while (x < COURSE_LENGTH - 260) {
    const roll = Math.random();
    const y = groundY - 40 - Math.random() * (gameH - 220);

    if (roll < 0.28) {
      const w = 110 - Math.min(30, (level - 1) * 4);
      props.push({ id: ++propId, type: 'platform', x, y, w, h: PLATFORM_H, consumed: false });
    } else if (roll < 0.48) {
      props.push({ id: ++propId, type: 'spring', x, y: groundY - SPRING_SIZE, w: SPRING_SIZE, h: SPRING_SIZE, consumed: false });
    } else if (roll < 0.68) {
      props.push({ id: ++propId, type: 'trampoline', x, y, w: 90, h: 18, consumed: false });
    } else if (roll < 0.85) {
      props.push({ id: ++propId, type: 'boost', x, y, w: BOOST_SIZE, h: BOOST_SIZE, consumed: false });
    } else {
      // small coin cluster
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        props.push({
          id: ++propId, type: 'coin',
          x: x + i * 34, y: y - 30 - (i % 2) * 24,
          w: COIN_SIZE, h: COIN_SIZE, consumed: false,
        });
      }
    }
    x += gap + Math.random() * 80;
  }

  // Extra scattered coins along the whole course
  for (let i = 0; i < 14; i++) {
    props.push({
      id: ++propId, type: 'coin',
      x: 300 + Math.random() * (COURSE_LENGTH - 500),
      y: 60 + Math.random() * (gameH - 200),
      w: COIN_SIZE, h: COIN_SIZE, consumed: false,
    });
  }

  // Guaranteed goal platform near the end
  props.push({
    id: ++propId, type: 'goal',
    x: COURSE_LENGTH - 220, y: groundY - PLATFORM_H - 10,
    w: 160, h: PLATFORM_H, consumed: false,
  });

  return props;
}

export default function NubkinLaunch({ level, onFinish }: Props) {
  const equippedSkinId = useGameStore(s => s.creature.equippedSkinId);
  const nubkinImgs     = getSkinImages(equippedSkinId);
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const insets = useSafeAreaInsets();
  const gameH  = SH - insets.top - insets.bottom - HUD_H;
  const slingX = 70;
  const slingY = gameH - 90;

  const [running,   setRunning]   = useState(false);
  const [phase,     setPhase]     = useState<'aim' | 'flight' | 'ended'>('aim');
  const phaseRef = useRef<'aim' | 'flight' | 'ended'>('aim');
  function setPhaseSynced(p: 'aim' | 'flight' | 'ended') {
    phaseRef.current = p;
    setPhase(p);
  }
  const [score,     setScore]     = useState(0);
  const [coinsGot,  setCoinsGot]  = useState(0);
  const [combo,     setCombo]     = useState(0);
  const [nubPos,    setNubPos]    = useState({ x: slingX, y: slingY });
  const [cameraX,   setCameraX]   = useState(0);
  const [pullVec,   setPullVec]   = useState<{ dx: number; dy: number } | null>(null);
  const [propsList, setPropsList] = useState<CourseProp[]>([]);
  const [mood,      setMood]      = useState<'happy' | 'excited' | 'sad'>('happy');
  const [showSaveMe, setShowSaveMe] = useState(false);
  const [fellMsg,    setFellMsg]    = useState('Fell off the course!');

  const scoreRef        = useRef(0);
  const comboRef         = useRef(0);
  const propsRef         = useRef<CourseProp[]>([]);
  const posRef            = useRef({ x: slingX, y: slingY });
  const velRef            = useRef({ x: 0, y: 0 });
  const groundedFramesRef = useRef(0);
  const flightStartRef    = useRef(0);
  const lastFrameRef      = useRef(0);
  const rafRef            = useRef<number | null>(null);
  const finishedRef       = useRef(false);
  const pausedRef         = useRef(false);
  const [paused, setPaused] = useState(false);
  const saveMeRef        = useRef(false);
  const continueUsedRef  = useRef(false);
  const finishTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const boingSoundRef = useRef<Audio.Sound | null>(null);
  const coinSoundRef  = useRef<Audio.Sound | null>(null);
  const fallSoundRef  = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      Audio.Sound.createAsync(require('../../../assets/audio/jumping.wav')),
      Audio.Sound.createAsync(require('../../../assets/audio/pointup.mp3')),
      Audio.Sound.createAsync(require('../../../assets/audio/error.mp3')),
    ]).then(([boing, coin, fall]) => {
      if (cancelled) { boing.sound.unloadAsync(); coin.sound.unloadAsync(); fall.sound.unloadAsync(); return; }
      boingSoundRef.current = boing.sound;
      coinSoundRef.current  = coin.sound;
      fallSoundRef.current  = fall.sound;
    });
    return () => {
      cancelled = true;
      boingSoundRef.current?.unloadAsync();
      coinSoundRef.current?.unloadAsync();
      fallSoundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    return () => {
      finishedRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (finishTimeout.current !== null) clearTimeout(finishTimeout.current);
    };
  }, []);

  const stop = useCallback((final: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setPhaseSynced('ended');
    finishTimeout.current = setTimeout(() => onFinish(final), 900);
  }, [onFinish]);

  function resetToAim() {
    posRef.current = { x: slingX, y: slingY };
    velRef.current = { x: 0, y: 0 };
    groundedFramesRef.current = 0;
    setNubPos({ x: slingX, y: slingY });
    setCameraX(0);
    setMood('happy');
    setPhase('aim');
  }

  function startGame() {
    finishedRef.current = false;
    pausedRef.current   = false;
    saveMeRef.current    = false;
    continueUsedRef.current = false;
    scoreRef.current  = 0;
    comboRef.current  = 0;
    setScore(0);
    setCoinsGot(0);
    setCombo(0);
    setPaused(false);
    setShowSaveMe(false);
    propsRef.current = generateCourse(level, gameH, slingX, slingY);
    setPropsList(propsRef.current);
    resetToAim();
    setRunning(true);
  }

  function launch(vx: number, vy: number) {
    velRef.current = { x: vx, y: vy };
    groundedFramesRef.current = 0;
    flightStartRef.current = 0;
    lastFrameRef.current   = 0;
    setMood('excited');
    setPhase('flight');
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  function endedFall() {
    playSfx(fallSoundRef.current);
    setMood('sad');
    if (!continueUsedRef.current) {
      saveMeRef.current = true;
      setFellMsg('Fell off the course!');
      setShowSaveMe(true);
      return;
    }
    stop(scoreRef.current);
  }

  function endedLand(bonus: number) {
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setMood('happy');
    stop(scoreRef.current);
  }

  const gameLoop = (timestamp: number) => {
    if (finishedRef.current) return;
    if (pausedRef.current || saveMeRef.current) {
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (!flightStartRef.current) flightStartRef.current = timestamp;
    const deltaMs = lastFrameRef.current ? Math.min(timestamp - lastFrameRef.current, 48) : 16;
    lastFrameRef.current = timestamp;
    const dt = deltaMs / 1000;

    if (timestamp - flightStartRef.current > MAX_FLIGHT_MS) {
      endedFall();
      return;
    }

    // Integrate physics
    const vel = velRef.current;
    vel.y += GRAVITY * dt;
    vel.x = clamp(vel.x, -MAX_VX, MAX_VX);
    const pos = posRef.current;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;

    // Collisions
    let grounded = false;
    let bouncedThisFrame = false;
    for (const prop of propsRef.current) {
      if (prop.consumed) continue;
      const closestX = clamp(pos.x, prop.x, prop.x + prop.w);
      const closestY = clamp(pos.y, prop.y, prop.y + prop.h);
      const dx = pos.x - closestX;
      const dy = pos.y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= NUBKIN_R * NUBKIN_R) continue;

      if (prop.type === 'coin') {
        prop.consumed = true;
        scoreRef.current += 25;
        setScore(scoreRef.current);
        setCoinsGot(c => c + 1);
        playSfx(coinSoundRef.current);
        continue;
      }
      if (prop.type === 'boost') {
        prop.consumed = true;
        vel.x = clamp(vel.x + BOOST_PAD_VX_ADD, -MAX_VX, MAX_VX);
        continue;
      }

      const dist = Math.sqrt(distSq) || 0.0001;
      const nx = dx / dist, ny = dy / dist;
      const penetration = NUBKIN_R - dist;
      pos.x += nx * penetration;
      pos.y += ny * penetration;
      const fromAbove = ny < -0.35;

      if (prop.type === 'spring' || prop.type === 'trampoline') {
        if (fromAbove) {
          vel.y = prop.type === 'spring' ? SPRING_BOOST_VY : TRAMPOLINE_BOOST_VY;
          comboRef.current += 1;
          setCombo(comboRef.current);
          const bonus = 15 * comboRef.current;
          scoreRef.current += bonus;
          setScore(scoreRef.current);
          playSfx(boingSoundRef.current);
          bouncedThisFrame = true;
        } else {
          vel.x = -vel.x * 0.5;
        }
        continue;
      }

      // platform / goal
      if (fromAbove) {
        const speed = Math.hypot(vel.x, vel.y);
        if (speed < SETTLE_SPEED) {
          vel.y = 0;
          vel.x *= 0.72;
          grounded = true;
        } else {
          vel.y = -vel.y * 0.35;
          vel.x *= 0.85;
        }
      } else {
        vel.x = -vel.x * 0.4;
        vel.y *= 0.6;
      }

      if (prop.type === 'goal' && !bouncedThisFrame) {
        const speed = Math.hypot(vel.x, vel.y);
        if (speed < SETTLE_SPEED * 1.6) {
          endedLand(150);
          return;
        }
      }
    }

    if (grounded) {
      groundedFramesRef.current += 1;
      if (groundedFramesRef.current >= SETTLE_FRAMES) {
        endedLand(40);
        return;
      }
    } else {
      groundedFramesRef.current = 0;
    }

    // Fell into the pit
    if (pos.y - NUBKIN_R > gameH + 60) {
      endedFall();
      return;
    }

    // Camera follow
    const cam = clamp(pos.x - CAMERA_ANCHOR_X, 0, COURSE_LENGTH - SW);

    setNubPos({ x: pos.x, y: pos.y });
    setCameraX(cam);
    if (propsRef.current.some(p => p.consumed)) {
      setPropsList([...propsRef.current]);
      propsRef.current = propsRef.current.filter(p => !p.consumed);
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  };

  function grantContinue() {
    saveMeRef.current = false;
    continueUsedRef.current = true;
    setShowSaveMe(false);
    resetToAim();
    lastFrameRef.current = 0;
    flightStartRef.current = 0;
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
    stop(scoreRef.current);
  }

  function togglePause() {
    if (!running || finishedRef.current || saveMeRef.current || phase !== 'flight') return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phase === 'aim' && !saveMeRef.current,
      onMoveShouldSetPanResponder:  () => phase === 'aim' && !saveMeRef.current,
      onPanResponderMove: (_, g) => {
        const dx = clamp(g.dx, -MAX_PULL, MAX_PULL);
        const dy = clamp(g.dy, -MAX_PULL * 0.6, MAX_PULL);
        setPullVec({ dx, dy });
      },
      onPanResponderRelease: (_, g) => {
        const dx = clamp(g.dx, -MAX_PULL, MAX_PULL);
        const dy = clamp(g.dy, -MAX_PULL * 0.6, MAX_PULL);
        const pullDist = Math.hypot(dx, dy);
        setPullVec(null);
        if (pullDist < MIN_PULL_TO_FIRE) return;
        const power = Math.min(pullDist / MAX_PULL, 1);
        const vx = -dx * (MAX_LAUNCH_SPEED / MAX_PULL) * power;
        const vy = -dy * (MAX_LAUNCH_SPEED / MAX_PULL) * power;
        posRef.current = { x: slingX, y: slingY };
        launch(vx, vy);
      },
    })
  ).current;

  // Trajectory preview while aiming
  const trajectoryDots: { x: number; y: number }[] = [];
  if (phase === 'aim' && pullVec) {
    const pullDist = Math.hypot(pullVec.dx, pullVec.dy);
    if (pullDist >= MIN_PULL_TO_FIRE) {
      const power = Math.min(pullDist / MAX_PULL, 1);
      const vx0 = -pullVec.dx * (MAX_LAUNCH_SPEED / MAX_PULL) * power;
      const vy0 = -pullVec.dy * (MAX_LAUNCH_SPEED / MAX_PULL) * power;
      const startX = slingX;
      const startY = slingY;
      for (let i = 1; i <= 10; i++) {
        const t = i * 0.07;
        const x = startX + vx0 * t;
        const y = startY + vy0 * t + 0.5 * GRAVITY * t * t;
        if (y > gameH || x > SW + 40) break;
        trajectoryDots.push({ x, y });
      }
    }
  }

  const nubMoodImg = nubkinImgs[mood];
  const nubScreenX = phase === 'flight' ? nubPos.x - cameraX : nubPos.x;

  return (
    <View style={styles.root}>
      <View style={styles.hud}>
        <Text style={styles.scoreText}>{score} pts</Text>
        <Text style={styles.hudSub}>🪙 {coinsGot}{combo > 0 ? `  ·  🔥 x${combo}` : ''}</Text>
        <Text style={styles.diffText}>Lv{level}</Text>
      </View>

      <ImageBackground
        source={require('../../../assets/bg/purplesky.png')}
        style={[styles.field, { height: gameH }]}
        resizeMode="cover"
        {...panResponder.panHandlers}
      >
        {/* Course props */}
        {propsList.filter(p => !p.consumed).map(p => {
          const left = p.x - cameraX;
          if (left < -80 || left > SW + 80) return null;
          if (p.type === 'coin') {
            return (
              <Image key={p.id} source={require('../../../assets/currency/Coin.png')}
                style={[styles.coinImg, { left, top: p.y }]} resizeMode="contain" />
            );
          }
          if (p.type === 'boost') {
            return (
              <View key={p.id} style={[styles.boostPad, { left, top: p.y }]}>
                <Text style={styles.boostArrow}>➤➤</Text>
              </View>
            );
          }
          if (p.type === 'spring') {
            return <View key={p.id} style={[styles.spring, { left, top: p.y }]} />;
          }
          if (p.type === 'trampoline') {
            return <View key={p.id} style={[styles.trampoline, { left, top: p.y, width: p.w }]} />;
          }
          if (p.type === 'goal') {
            return (
              <View key={p.id} style={[styles.goalPlatform, { left, top: p.y, width: p.w }]}>
                <Text style={styles.goalFlag}>🏁</Text>
              </View>
            );
          }
          return <View key={p.id} style={[styles.platform, { left, top: p.y, width: p.w }]} />;
        })}

        {/* Trajectory preview */}
        {trajectoryDots.map((d, i) => (
          <View key={i} style={[styles.trajDot, { left: d.x, top: d.y }]} />
        ))}

        {/* Slingshot band */}
        {phase === 'aim' && pullVec && (
          <View
            style={[
              styles.slingBand,
              {
                left: slingX,
                top: slingY - 1.5,
                width: Math.hypot(pullVec.dx, pullVec.dy),
                transform: [
                  { translateX: Math.hypot(pullVec.dx, pullVec.dy) / 2 },
                  { rotate: `${Math.atan2(pullVec.dy, pullVec.dx)}rad` },
                  { translateX: -Math.hypot(pullVec.dx, pullVec.dy) / 2 },
                ],
              },
            ]}
          />
        )}

        {/* Nubkin */}
        <Image
          source={nubMoodImg}
          style={[styles.nubkin, { left: nubScreenX - NUBKIN_R, top: nubPos.y - NUBKIN_R }]}
          resizeMode="contain"
        />

        {/* Paused overlay */}
        {paused && (
          <View style={styles.pausedOverlay}>
            <Text style={styles.pausedText}>PAUSED</Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={togglePause}>
              <Text style={styles.saveMeBtnTxt}>Resume</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Continue prompt */}
        {showSaveMe && (
          <View style={styles.saveMeOverlay}>
            <Text style={styles.overlayTitle}>{fellMsg}</Text>
            <Text style={styles.saveMeScore}>Score so far: {score}</Text>
            <Text style={styles.saveMeDesc}>Take another shot?</Text>
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

        {/* Start overlay */}
        {!running && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Nubkin Launch</Text>
            <Text style={styles.overlayDesc}>
              Pull back and release to launch your Nubkin!{'\n'}
              Bounce off springs & trampolines, grab coins and boost pads, then land safely to score big.
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startGame}>
              <Text style={styles.startBtnText}>Start!</Text>
            </TouchableOpacity>
          </View>
        )}
      </ImageBackground>

      {running && phase === 'flight' && (
        <TouchableOpacity style={styles.pauseFab} onPress={togglePause} activeOpacity={0.75}>
          <View style={styles.pauseIconRow}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B1440' },

  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: HUD_H,
    backgroundColor: '#0F0F23',
  },
  scoreText: { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 18 },
  hudSub:    { fontFamily: FONT, color: '#FDCB6E', fontWeight: '700', fontSize: 13 },
  diffText:  { fontFamily: FONT, color: '#555577', fontSize: 12 },

  field: { width: SW, position: 'relative', overflow: 'hidden' },

  nubkin: { position: 'absolute', width: NUBKIN_SIZE, height: NUBKIN_SIZE },

  coinImg:  { position: 'absolute', width: COIN_SIZE, height: COIN_SIZE },
  boostPad: {
    position: 'absolute', width: BOOST_SIZE, height: BOOST_SIZE,
    borderRadius: 8, backgroundColor: '#F39C12', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#B7770D',
  },
  boostArrow: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  spring: {
    position: 'absolute', width: SPRING_SIZE, height: SPRING_SIZE,
    borderRadius: SPRING_SIZE / 2, backgroundColor: '#E74C3C',
    borderWidth: 3, borderColor: '#922B21',
  },
  trampoline: {
    position: 'absolute', height: 18, borderRadius: 10,
    backgroundColor: '#2ECC71', borderWidth: 2, borderColor: '#1E8449',
  },
  platform: {
    position: 'absolute', height: PLATFORM_H, borderRadius: 6,
    backgroundColor: '#8D6E63', borderWidth: 2, borderColor: '#5D4037',
  },
  goalPlatform: {
    position: 'absolute', height: PLATFORM_H, borderRadius: 6,
    backgroundColor: '#F1C40F', borderWidth: 2, borderColor: '#B7950B',
    alignItems: 'center', justifyContent: 'center',
  },
  goalFlag: { position: 'absolute', top: -26, fontSize: 22 },

  trajDot: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  slingBand: {
    position: 'absolute', height: 3, backgroundColor: '#B08968', borderRadius: 2,
  },

  pausedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,10,30,0.65)', gap: 14,
  },
  pausedText: { fontFamily: FONT, color: '#EFEFFF', fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  resumeBtn: { backgroundColor: '#27AE60', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 16 },

  pauseFab: {
    position: 'absolute', top: HUD_H + 10, right: 12,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15,15,35,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  pauseIconRow: { flexDirection: 'row', gap: 5 },
  pauseBar:     { width: 5, height: 16, backgroundColor: '#FFF', borderRadius: 2 },

  saveMeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  saveMeScore: { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  saveMeBtn: {
    backgroundColor: '#27AE60', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 20, width: '100%', alignItems: 'center',
  },
  saveMeBtnDiamond:  { backgroundColor: '#3498DB' },
  saveMeBtnDisabled: { opacity: 0.4 },
  saveMeBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 15 },
  saveMeSkip:    { marginTop: 4, padding: 8 },
  saveMeSkipTxt: { fontFamily: FONT, color: '#7777AA', fontSize: 14, fontWeight: '700' },

  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    gap: 16, paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayTitle: { fontFamily: FONT, color: '#EFEFFF', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  overlayDesc:  { fontFamily: FONT, color: '#CCCCEE', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  startBtn:     { backgroundColor: '#9B59B6', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 24, marginTop: 8 },
  startBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },
});
