import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { useAudioPlayer } from 'expo-audio';

const { width: SW, height: SH } = Dimensions.get('window');

import { FONT } from '../../lib/theme';
import { getSkinImages } from '../../lib/skinImages';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';
import { playSfx } from '../../lib/sfx';

const LANE_COUNT   = 3;
const LANE_W       = SW / LANE_COUNT;
const OBS_SIZE     = 130;
const CRIT_SIZE    = 70;
const CONTROLLER_H = 180;
const HUD_H        = 48;
const TICK_MS      = 50;

const ROCKET_IMGS = [
  require('../../../assets/minigame_items/rocket.png'),
  require('../../../assets/minigame_items/rocket_blast.png'),
];

interface Obstacle {
  id: number;
  lane: number;
  y: number;
  speed: number;
  variant: 0 | 1;
}

interface Props {
  level: number;
  onFinish: (score: number) => void;
}

let obsId = 0;

export default function ObstacleDash({ level, onFinish }: Props) {
  const equippedSkinId = useGameStore(s => s.creature.equippedSkinId);
  const nubkinImgs     = getSkinImages(equippedSkinId);
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const insets     = useSafeAreaInsets();
  const gameH      = SH - insets.top - insets.bottom - CONTROLLER_H - HUD_H;
  const creatureY  = gameH - 80;

  const [running,   setRunning]  = useState(false);
  const [crashed,   setCrashed]  = useState(false);
  const [paused,    setPaused]   = useState(false);
  const [lane,      setLane]     = useState(1);
  const [obstacles, setObs]      = useState<Obstacle[]>([]);
  const [score,     setScore]    = useState(0);
  const [showSaveMe, setShowSaveMe] = useState(false);

  const laneRef         = useRef(1);
  const obsRef          = useRef<Obstacle[]>([]);
  const scoreRef        = useRef(0);
  const finishedRef     = useRef(false);
  const pausedRef       = useRef(false);
  const rafRef          = useRef<number | null>(null);
  const lastFrameRef    = useRef<number>(0);
  const startTimeRef    = useRef<number>(0);
  const spawnRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laneCooldown    = useRef<number[]>([0, 0, 0]);
  const jumpSound    = useAudioPlayer(require('../../../assets/audio/jumping.wav'));
  const saveMeRef       = useRef(false);   // "crashed, save me?" overlay showing
  const continueUsedRef = useRef(false);   // only one continue allowed per game
  const saveMeAtRef     = useRef(0);       // wall-clock time the prompt opened

  const laneAnim = useRef(new Animated.Value(laneX(1))).current;

  const speedMult  = 1 + (level - 1) * 0.15;
  const baseSpeed  = 5 * speedMult;
  const spawnMs    = Math.max(900, Math.round(1800 / speedMult));
  const laneCoolMs = Math.max(1800, Math.round(3000 / speedMult));

  function laneX(l: number) {
    return l * LANE_W + LANE_W / 2 - CRIT_SIZE / 2;
  }

  const stop = useCallback((final: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    finishTimeout.current = setTimeout(() => onFinish(final), 900);
  }, [onFinish]);

  useEffect(() => {
    return () => {
      finishedRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (finishTimeout.current !== null) clearTimeout(finishTimeout.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  function moveLane(dir: 'left' | 'right') {
    const next = dir === 'left'
      ? Math.max(0, laneRef.current - 1)
      : Math.min(2, laneRef.current + 1);
    if (next === laneRef.current) return;
    laneRef.current = next;
    setLane(next);
    Animated.spring(laneAnim, {
      toValue: laneX(next),
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }

  function togglePause() {
    if (!running || finishedRef.current || saveMeRef.current) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  function grantContinue() {
    const frozenMs = Date.now() - saveMeAtRef.current;
    startTimeRef.current += frozenMs; // keep the elapsed-seconds score accurate
    lastFrameRef.current  = 0;        // avoid a huge delta jump on the next frame
    saveMeRef.current = false;
    continueUsedRef.current = true;
    setCrashed(false);
    setShowSaveMe(false);
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !saveMeRef.current,
      onMoveShouldSetPanResponder:  (_, g) => !saveMeRef.current && Math.abs(g.dx) > 8,
      onPanResponderRelease: (_, g) => {
        if (!finishedRef.current && Math.abs(g.dx) >= 20) {
          moveLane(g.dx < 0 ? 'left' : 'right');
        }
      },
    })
  ).current;

  function startGame() {
    finishedRef.current = false;
    pausedRef.current   = false;
    scoreRef.current    = 0;
    laneRef.current     = 1;
    obsRef.current      = [];
    laneCooldown.current = [0, 0, 0];
    startTimeRef.current = 0;
    saveMeRef.current = false;
    continueUsedRef.current = false;
    setScore(0);
    setLane(1);
    setCrashed(false);
    setPaused(false);
    setObs([]);
    setShowSaveMe(false);
    setRunning(true);
    laneAnim.setValue(laneX(1));

    spawnRef.current = setInterval(() => {
      if (pausedRef.current || saveMeRef.current) return;
      const now = Date.now();
      const available = [0, 1, 2].filter(l => now - laneCooldown.current[l] >= laneCoolMs);
      const pickFrom  = available.length > 0 ? available : [0, 1, 2];
      const pickedLane = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      laneCooldown.current[pickedLane] = now;

      const id = ++obsId;
      const obs: Obstacle = {
        id,
        lane: pickedLane,
        y: -OBS_SIZE,
        speed: baseSpeed * (0.85 + Math.random() * 0.3),
        variant: Math.random() < 0.5 ? 0 : 1,
      };
      obsRef.current = [...obsRef.current, obs];
    }, spawnMs);

    lastFrameRef.current = 0;
    const gameLoop = (timestamp: number) => {
      if (finishedRef.current) return;

      if (pausedRef.current || saveMeRef.current) {
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const delta   = lastFrameRef.current ? timestamp - lastFrameRef.current : TICK_MS;
      lastFrameRef.current = timestamp;
      const step    = delta / TICK_MS;

      const elapsed = Math.floor((timestamp - startTimeRef.current) / 1000);
      if (elapsed !== scoreRef.current) {
        scoreRef.current = elapsed;
        setScore(elapsed);
      }

      const HIT_PAD  = 14;
      const CRIT_TOP = creatureY + HIT_PAD;
      const CRIT_BOT = creatureY + CRIT_SIZE - HIT_PAD;

      let hit = false;
      obsRef.current = obsRef.current
        .map(o => ({ ...o, y: o.y + o.speed * step }))
        .filter(o => {
          const obsTop = o.y + HIT_PAD;
          const obsBot = o.y + OBS_SIZE - HIT_PAD;
          if (o.lane === laneRef.current && obsBot >= CRIT_TOP && obsTop <= CRIT_BOT) {
            hit = true;
          }
          return o.y < gameH + OBS_SIZE;
        });

      setObs([...obsRef.current]);

      if (hit) {
        setCrashed(true);
        if (!continueUsedRef.current) {
          saveMeRef.current = true;
          saveMeAtRef.current = Date.now();
          obsRef.current = [];
          setObs([]);
          setShowSaveMe(true);
          rafRef.current = requestAnimationFrame(gameLoop);
          return;
        }
        stop(scoreRef.current);
        return;
      }
      rafRef.current = requestAnimationFrame(gameLoop);
    };
    rafRef.current = requestAnimationFrame(gameLoop);
  }

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <View style={styles.hud}>
        <Text style={styles.scoreText}>{score}s</Text>
        <Text style={styles.diffText}>Lv{level} · {Math.round(speedMult * 100 - 100)}% faster</Text>
      </View>

      <ImageBackground
        source={require('../../../assets/bg/obstacle_bg.png')}
        style={[styles.field, { height: gameH }]}
        resizeMode="cover"
      >
        {/* Lane dividers */}
        <View style={[styles.divider, { left: LANE_W }]} />
        <View style={[styles.divider, { left: LANE_W * 2 }]} />

        {/* Obstacles */}
        {obstacles.map(o => (
          <Image
            key={o.id}
            source={ROCKET_IMGS[o.variant]}
            style={[styles.obstacle, { left: o.lane * LANE_W + LANE_W / 2 - OBS_SIZE / 2, top: o.y }]}
            resizeMode="contain"
          />
        ))}

        {/* Creature */}
        <Animated.Image
          source={nubkinImgs.happy}
          style={[
            styles.creature,
            { top: creatureY, transform: [{ translateX: laneAnim }], opacity: crashed ? 0.4 : 1 },
          ]}
          resizeMode="contain"
        />

        {/* Paused overlay */}
        {paused && running && (
          <View style={styles.pausedOverlay}>
            <Text style={styles.pausedText}>PAUSED</Text>
            <Text style={styles.pausedSub}>Tap ▶ to resume</Text>
          </View>
        )}

        {/* Continue prompt — shown on crash, before the run actually ends */}
        {showSaveMe && (
          <View style={styles.saveMeOverlay}>
            <Text style={styles.overlayTitle}>Crashed!</Text>
            <Text style={styles.saveMeScore}>Score: {score}s</Text>
            <Text style={styles.saveMeDesc}>Keep dashing?</Text>
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
            <Text style={styles.overlayTitle}>Obstacle Dash</Text>
            <Text style={styles.overlayDesc}>
              Swipe or tap ◀ ▶ to dodge rockets!{'\n'}
              {level > 1 ? `\nLevel ${level}: obstacles are ${Math.round((speedMult - 1) * 100)}% faster!` : ''}
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startGame}>
              <Text style={styles.startBtnText}>Start!</Text>
            </TouchableOpacity>
          </View>
        )}
      </ImageBackground>

      {/* Retro controller panel */}
      <View style={styles.controller}>
        {/* Left button */}
        <TouchableOpacity
          style={styles.moveBtn}
          onPress={() => { playSfx(jumpSound); moveLane('left'); }}
          activeOpacity={0.75}
        >
          <Text style={styles.moveBtnText}>◀</Text>
        </TouchableOpacity>

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

        {/* Right button */}
        <TouchableOpacity
          style={styles.moveBtn}
          onPress={() => { playSfx(jumpSound); moveLane('right'); }}
          activeOpacity={0.75}
        >
          <Text style={styles.moveBtnText}>▶</Text>
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
    paddingHorizontal: 16,
    height: HUD_H,
    backgroundColor: '#0F0F23',
  },
  scoreText: { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 20 },
  diffText:  { fontFamily: FONT, color: '#555577', fontSize: 12 },

  field: { width: SW, position: 'relative', overflow: 'hidden' },

  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#1E1E3A',
  },

  obstacle: {
    position: 'absolute',
    width: OBS_SIZE,
    height: OBS_SIZE,
  },
  creature: {
    position: 'absolute',
    width: CRIT_SIZE,
    height: CRIT_SIZE,
  },

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
    gap: 16,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayTitle:   { fontFamily: FONT, color: '#EFEFFF', fontSize: 32, fontWeight: '900' },
  overlayDesc:    { fontFamily: FONT, color: '#7777AA', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  startBtn:       { backgroundColor: '#9B59B6', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 24, marginTop: 8 },
  startBtnText:   { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },

  // Controller
  controller: {
    height: CONTROLLER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F0F0F0',
    borderTopWidth: 4,
    borderTopColor: '#2A2A2A',
    paddingHorizontal: 16,
  },

  moveBtn: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#2471A3',
    borderWidth: 5,
    borderColor: '#1A5276',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#1A5276',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  moveBtnText: {
    color: '#FFF',
    fontSize: 34,
  },

  pauseBtn: {
    width: 80,
    height: 80,
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
  pauseBar:     { width: 12, height: 30, backgroundColor: '#FFF', borderRadius: 3 },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 15,
    borderBottomWidth: 15,
    borderLeftWidth: 24,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFF',
    marginLeft: 4,
  },
});
