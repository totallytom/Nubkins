import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { FONT } from '../../lib/theme';
import { playSfx } from '../../lib/sfx';
import PauseOverlay from '../../components/PauseOverlay';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';

const { width: SW, height: SH } = Dimensions.get('window');
const HUD_H         = 58;
const GAME_H        = SH - HUD_H;
const PADDLE_W      = 120;
const PADDLE_H      = 115;
const BALL_SIZE     = 55;
const GAME_DURATION = 30;
const CONTINUE_TIME = 15;  // bonus seconds granted by a single continue
const FPS_INTERVAL  = 1000 / 60;
const BARRIER_H     = 22;  // height of the red barrier strip at the bottom

// ── Berry definitions ──────────────────────────────────────────────────────────
const BERRIES = [
  { id: 'peach',  image: require('../../../assets/minigame_items/Peachberry.png'),  points:   5, weight: 35 },
  { id: 'sun',    image: require('../../../assets/minigame_items/Sunberry.png'),    points:  10, weight: 28 },
  { id: 'joop',   image: require('../../../assets/minigame_items/Joopberry.png'),   points: -10, weight: 17 },
  { id: 'cherrie',image: require('../../../assets/minigame_items/CherrieBerry.png'),points:  50, weight: 15 },
  { id: '100',    image: require('../../../assets/minigame_items/100berry.png'),    points: 100, weight:  5 },
] as const;

const TOTAL_WEIGHT = BERRIES.reduce((s, b) => s + b.weight, 0);

function pickBerry() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const b of BERRIES) { r -= b.weight; if (r <= 0) return b; }
  return BERRIES[0];
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Ball {
  id:        number;
  x:         number;
  y:         number;
  vy:        number;
  points:    number;
  image:     (typeof BERRIES)[number]['image'];
  missed:    boolean;  // true once it passes the basket without being caught
  windPhase: number;   // offset into the sine wave driving its sideways drift
  windAmp:   number;   // how far it sways side-to-side (px)
  windFreq:  number;   // how quickly it sways
  tilt:      number;   // current visual lean caused by the wind (degrees)
}

interface Props { level: number; onFinish: (score: number) => void }

let ballId = 0;

const faster = (ms: number, level: number) =>
  Math.max(600, Math.round(ms / (1 + (level - 1) * 0.1)));

export default function NubCatch({ level, onFinish }: Props) {
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const [running,  setRunning]  = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score,    setScore]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [balls,    setBalls]    = useState<Ball[]>([]);
  const [paddleX,  setPaddleX]  = useState(SW / 2 - PADDLE_W / 2);
  const [streak,   setStreak]   = useState(0);
  const [flash,    setFlash]    = useState<string | null>(null);
  const [showSaveMe, setShowSaveMe] = useState(false);

  const paddleRef   = useRef(SW / 2 - PADDLE_W / 2);
  const ballsRef    = useRef<Ball[]>([]);
  const scoreRef    = useRef(0);
  const streakRef   = useRef(0);
  const loopRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const flashTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);
  const saveMeRef       = useRef(false);   // "time's up, save me?" overlay showing
  const continueUsedRef = useRef(false);   // only one continue allowed per game
  const windStreaks = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const catchSound = useAudioPlayer(require('../../../assets/audio/pointup.mp3'));
  const missSound  = useAudioPlayer(require('../../../assets/audio/error.mp3'));

  useEffect(() => {
    const anims = windStreaks.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 650),
          Animated.timing(v, {
            toValue: 1,
            duration: 2200 + i * 400,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [windStreaks]);

  const stopGame = useCallback((final: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    isPausedRef.current = false;
    [loopRef, timerRef, spawnRef].forEach(r => { if (r.current) clearInterval(r.current); });
    setTimeout(() => onFinish(final), 600);
  }, [onFinish]);

  function pauseGame() {
    if (saveMeRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
  }

  function resumeGame() {
    isPausedRef.current = false;
    setIsPaused(false);
  }

  function grantContinue() {
    saveMeRef.current = false;
    continueUsedRef.current = true;
    setShowSaveMe(false);
    setTimeLeft(CONTINUE_TIME);
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
    stopGame(scoreRef.current);
  }

  function showFlash(msg: string) {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 600);
  }

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => running && !isPaused && !showSaveMe,
    onMoveShouldSetPanResponder:  () => running && !isPaused && !showSaveMe,
    onPanResponderMove: (_, g) => {
      const next = Math.max(0, Math.min(SW - PADDLE_W, g.moveX - PADDLE_W / 2));
      paddleRef.current = next;
      setPaddleX(next);
    },
  });

  function startGame() {
    finishedRef.current = false;
    scoreRef.current    = 0;
    streakRef.current   = 0;
    ballsRef.current    = [];
    saveMeRef.current   = false;
    continueUsedRef.current = false;
    setScore(0); setStreak(0); setBalls([]); setFlash(null); setShowSaveMe(false);
    setTimeLeft(GAME_DURATION); setRunning(true);

    timerRef.current = setInterval(() => {
      if (isPausedRef.current || saveMeRef.current) return;
      setTimeLeft(t => {
        if (t <= 1) {
          if (!continueUsedRef.current) {
            saveMeRef.current = true;
            setShowSaveMe(true);
            return 0;
          }
          stopGame(scoreRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    const speedMult = 1 + (level - 1) * 0.12;
    spawnRef.current = setInterval(() => {
      if (isPausedRef.current || saveMeRef.current) return;
      const berry = pickBerry();
      const ball: Ball = {
        id:        ++ballId,
        x:         20 + Math.random() * (SW - BALL_SIZE - 40),
        y:         0,
        vy:        (2.5 + Math.random() * 2) * speedMult,
        points:    berry.points,
        image:     berry.image,
        missed:    false,
        windPhase: Math.random() * Math.PI * 2,
        windAmp:   6 + Math.random() * 10,
        windFreq:  0.01 + Math.random() * 0.015,
        tilt:      0,
      };
      ballsRef.current = [...ballsRef.current, ball];
    }, faster(1200, level));

    loopRef.current = setInterval(() => {
      if (isPausedRef.current || saveMeRef.current) return;
      const next: Ball[] = [];
      for (const b of ballsRef.current) {
        const phase = b.y * b.windFreq + b.windPhase;
        const sway  = Math.sin(phase) * b.windAmp * 0.05;
        const tilt  = Math.cos(phase) * (b.windAmp / 2);
        const nextX = Math.max(0, Math.min(SW - BALL_SIZE, b.x + sway));
        const moved = { ...b, x: nextX, y: b.y + b.vy, tilt };

        // ── Zone 1: basket catch line ────────────────────────────────────
        if (!moved.missed && moved.y + BALL_SIZE >= GAME_H - PADDLE_H - 40) {
          const px = paddleRef.current;
          if (moved.x + BALL_SIZE >= px && moved.x <= px + PADDLE_W) {
            // Caught by basket
            if (moved.points > 0) {
              playSfx(catchSound);
              streakRef.current += 1;
              const mult   = streakRef.current >= 5 ? 3 : streakRef.current >= 3 ? 2 : 1;
              const gained = moved.points * mult;
              scoreRef.current = Math.max(0, scoreRef.current + gained);
              setScore(scoreRef.current);
              setStreak(streakRef.current);
              if (moved.points >= 100) showFlash('+100!');
              else if (moved.points >= 50) showFlash('+50!');
            } else {
              // Joopberry
              playSfx(missSound);
              scoreRef.current = Math.max(0, scoreRef.current + moved.points);
              streakRef.current = 0;
              setScore(scoreRef.current);
              setStreak(0);
              showFlash('-10!');
            }
            continue; // caught — remove from play
          }
          // Slipped past basket — mark missed, keep falling
          moved.missed = true;
        }

        // ── Zone 2: barrier at the bottom ───────────────────────────────
        if (moved.missed && moved.y + BALL_SIZE >= GAME_H - BARRIER_H) {
          playSfx(missSound);
          streakRef.current = 0;
          setStreak(0);
          showFlash('MISS!');
          continue; // hit barrier — remove
        }

        if (moved.y < GAME_H) next.push(moved);
      }
      ballsRef.current = next;
      setBalls([...next]);
    }, FPS_INTERVAL);
  }

  return (
    <ImageBackground
      source={require('../../../assets/bg/nubcatch_bg.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.hud}>
        <Text style={styles.scoreText}> {score}</Text>
        {streak >= 3 && <Text style={styles.streakText}> ×{streak}</Text>}
        <Text style={[styles.timerText, timeLeft <= 5 && styles.timerUrgent]}>{timeLeft}s</Text>
        {running && !showSaveMe && (
          <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
            <Text style={styles.pauseIcon}>⏸</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.field} {...panResponder.panHandlers}>
        {running ? (
          <>
            {windStreaks.map((anim, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.windStreak,
                  {
                    top: `${20 + i * 25}%`,
                    opacity: 0.14 + i * 0.03,
                    transform: [
                      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-160, SW + 160] }) },
                      { rotate: '12deg' },
                    ],
                  },
                ]}
              />
            ))}
            {balls.map(b => (
              <Image
                key={b.id}
                source={b.image}
                style={[
                  styles.ball,
                  { left: b.x, top: b.y, transform: [{ rotate: `${b.tilt}deg` }] },
                ]}
                resizeMode="contain"
              />
            ))}
            <Image
              source={require('../../../assets/minigame_items/nubcatch_basket.png')}
              style={[styles.basket, { left: paddleX, bottom: 40 }]}
              resizeMode="contain"
            />
            {/* Barrier */}
            <View style={styles.barrier} pointerEvents="none" />

            {flash && (
              <View style={styles.flashWrap} pointerEvents="none">
                <Text style={[
                  styles.flashText,
                  (flash === 'MISS!' || flash === '-10!') && styles.flashBad,
                  flash === '+100!' && styles.flashEpic,
                  flash === '+50!'  && styles.flashGood,
                ]}>{flash}</Text>
              </View>
            )}

            {showSaveMe && (
              <View style={styles.saveMeOverlay}>
                <Text style={styles.overlayTitle}>Time's Up!</Text>
                <Text style={styles.saveMeScore}>Score: {score}</Text>
                <Text style={styles.saveMeDesc}>Keep playing for {CONTINUE_TIME} more seconds?</Text>
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
          </>
        ) : (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Nub Catch</Text>
            <View style={styles.berryLegend}>
              {BERRIES.map(b => (
                <View key={b.id} style={styles.berryRow}>
                  <Image source={b.image} style={styles.legendImg} resizeMode="contain" />
                  <Text style={[styles.legendPts, b.points < 0 && styles.legendBad]}>
                    {b.points > 0 ? `+${b.points}` : `${b.points}`} pts
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.overlayDesc}>
              Drag the basket to catch berries!
              {'\n'}Avoid the blue Joopberry — it drains points.
              {level > 1 ? `\nLevel ${level}: berries fall ${Math.round((level - 1) * 12)}% faster!` : ''}
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={startGame}>
              <Text style={styles.startBtnText}>Start!</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <PauseOverlay visible={isPaused} onResume={resumeGame} onQuit={() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        isPausedRef.current = false;
        [loopRef, timerRef, spawnRef].forEach(r => { if (r.current) clearInterval(r.current); });
        onFinish(-1);
      }} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  scoreText:    { fontFamily: FONT, color: '#FFF', fontWeight: '900', fontSize: 26, letterSpacing: 0.5,
                  textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  streakText:   { fontFamily: FONT, color: '#FFD34D', fontWeight: '900', fontSize: 18, letterSpacing: 0.5,
                  textShadowColor: '#7A4A00', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  timerText:    { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 22, letterSpacing: 0.5,
                  textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  timerUrgent:  { color: '#FF4444', textShadowColor: '#5A0000' },

  field: { width: SW, flex: 1, position: 'relative', overflow: 'hidden' },

  ball:   { position: 'absolute', width: BALL_SIZE, height: BALL_SIZE },
  basket: { position: 'absolute', width: PADDLE_W,  height: PADDLE_H  },

  windStreak: {
    position: 'absolute',
    width: 120, height: 3, borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  barrier: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: BARRIER_H,
    backgroundColor: 'rgba(255, 50, 50, 0.55)',
    borderTopWidth: 2,
    borderTopColor: '#FF2222',
  },

  flashWrap: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    alignItems: 'center',
  },
  flashText: {
    fontFamily: FONT, color: '#FFF', fontWeight: '900', fontSize: 32, letterSpacing: 1,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5,
  },
  flashBad:  { color: '#FF4444', textShadowColor: '#4A0000' },
  flashGood: { color: '#4DE87A', textShadowColor: '#004A1A' },
  flashEpic: { fontSize: 38, color: '#FFD34D', textShadowColor: '#7A4A00' },

  saveMeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.78)',
  },
  saveMeScore: { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: '#CCDDFF', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  saveMeBtn: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 20, width: '100%', alignItems: 'center',
  },
  saveMeBtnDiamond:  { backgroundColor: '#3498DB' },
  saveMeBtnDisabled: { opacity: 0.4 },
  saveMeBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 15 },
  saveMeSkip:    { marginTop: 4, padding: 8 },
  saveMeSkipTxt: { fontFamily: FONT, color: '#CCDDFF', fontSize: 14, fontWeight: '700' },

  overlay:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32,
                  backgroundColor: 'rgba(0,0,0,0.42)' },
  overlayTitle: { fontFamily: FONT, color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: 1,
                  textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },

  berryLegend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginVertical: 4 },
  berryRow:    { alignItems: 'center', gap: 4 },
  legendImg:   { width: 36, height: 36 },
  legendPts:   { fontFamily: FONT, color: '#AAFFAA', fontSize: 13, fontWeight: '900',
                 textShadowColor: '#003310', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  legendBad:   { color: '#FF7777', textShadowColor: '#4A0000' },

  overlayDesc:  { fontFamily: FONT, color: '#CCDDFF', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  startBtn: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: 24, marginTop: 8,
  },
  startBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },
  pauseBtn:     { paddingHorizontal: 8 },
  pauseIcon:    { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
