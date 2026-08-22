import React, { useEffect, useRef, useState } from 'react';
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
import { Audio } from 'expo-av';
import { FONT } from '../../lib/theme';
import { playSfx } from '../../lib/sfx';
import PauseOverlay from '../../components/PauseOverlay';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';

const { width: SW } = Dimensions.get('window');

const COLS      = 7;
const ROWS      = 8;
const GAP       = 2;
const H_PAD     = 4;
const CELL_SIZE = Math.floor((SW - H_PAD * 2 - (COLS - 1) * GAP) / COLS);
const IMG_SIZE  = CELL_SIZE - 6;
const STEP      = CELL_SIZE + GAP;   // distance between cell origins
const GAME_TIME = 60;
const CONTINUE_TIME = 20;            // bonus seconds granted by a single "Save Me" continue
const SWIPE_MIN = STEP * 0.3;        // minimum drag to count as a swipe

// Each tile type: character image + border color (the primary visual identifier
// at small sizes) + a matching dark background tint.
// Add more entries here as new characters are introduced.
type TileConfig = { image: any; border: string; bg: string };
const TILE_CONFIGS: TileConfig[] = [
  { image: require('../../../assets/nubkins/Nubkin1-Happy.png'),      border: '#2ECC71', bg: '#2ECC71' }, // green
  { image: require('../../../assets/dooyoo/Dooyoo-happy.png'),        border: '#9B59B6', bg: '#9B59B6' }, // purple
  { image: require('../../../assets/louie/louie-happy.png'), border: '#E67E22', bg: '#E67E22' }, // orange
  { image: require('../../../assets/nubkins/Nubkin1-Neutral.png'),    border: '#3498DB', bg: '#3498DB' }, // blue
  { image: require('../../../assets/nubkins/Nubkin1-sad.png'),        border: '#E74C3C', bg: '#E74C3C' }, // red
  { image: require('../../../assets/nubkins/Nubkin1-sleep.png'),      border: '#bcb11a', bg: '#bcb11a' }, // teal
];

interface ParticleData {
  id:      number;
  x:       number;
  y:       number;
  color:   string;
  pos:     Animated.ValueXY;
  opacity: Animated.Value;
  scale:   Animated.Value;
}

interface Props {
  level: number;
  onFinish: (score: number) => void;
}

// ── Pure board helpers ────────────────────────────────────────────────────────

function colorsForLevel(lvl: number) {
  if (lvl <= 2) return 4;
  if (lvl <= 4) return 5;
  return 6;
}

function randTile(nc: number) { return Math.floor(Math.random() * nc); }

function makeBoard(nc: number): number[][] {
  const board: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      let v: number;
      do {
        v = randTile(nc);
      } while (
        (c >= 2 && row[c - 1] === v && row[c - 2] === v) ||
        (r >= 2 && board[r - 1][c] === v && board[r - 2][c] === v)
      );
      row.push(v);
    }
    board.push(row);
  }
  return board;
}

function findMatches(board: number[][]): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const v = board[r][c]; let e = c;
      while (e + 1 < COLS && board[r][e + 1] === v) e++;
      if (e - c >= 2) for (let i = c; i <= e; i++) out.add(`${r},${i}`);
      c = e + 1;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const v = board[r][c]; let e = r;
      while (e + 1 < ROWS && board[e + 1][c] === v) e++;
      if (e - r >= 2) for (let i = r; i <= e; i++) out.add(`${i},${c}`);
      r = e + 1;
    }
  }
  return out;
}

function clearAndRefill(board: number[][], cleared: Set<string>, nc: number): number[][] {
  const b = board.map(row => [...row]);
  for (const k of cleared) {
    const [r, c] = k.split(',').map(Number);
    b[r][c] = -1;
  }
  for (let c = 0; c < COLS; c++) {
    const col = b.map(row => row[c]).filter(v => v >= 0);
    while (col.length < ROWS) col.unshift(randTile(nc));
    for (let r = 0; r < ROWS; r++) b[r][c] = col[r];
  }
  return b;
}

function doSwap(board: number[][], r1: number, c1: number, r2: number, c2: number): number[][] {
  const b = board.map(row => [...row]);
  [b[r1][c1], b[r2][c2]] = [b[r2][c2], b[r1][c1]];
  return b;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GemCrush({ level, onFinish }: Props) {
  const nc          = colorsForLevel(level);
  const activeTiles = TILE_CONFIGS.slice(0, nc);

  const diamonds     = useGameStore(s => s.profile.diamonds);
  const spendDiamonds = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const [board,     setBoard]     = useState<number[][]>(() => makeBoard(nc));
  const [clearing,  setClearing]  = useState<Set<string>>(new Set());
  const [score,     setScore]     = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(GAME_TIME);
  const [running,   setRunning]   = useState(false);
  const [isPaused,  setIsPaused]  = useState(false);
  const [showSaveMe, setShowSaveMe] = useState(false);
  const [combo,     setCombo]     = useState(0);
  // Which two cells are currently being rendered as the animated overlay
  const [animCells, setAnimCells] = useState<{
    srcR: number; srcC: number;
    nbrR: number; nbrC: number;
  } | null>(null);

  // Mutable game state (refs avoid stale closures inside PanResponder / timers)
  const boardRef    = useRef<number[][]>(board);
  const scoreRef    = useRef(0);
  const doneRef     = useRef(false);
  const busyRef     = useRef(false);   // cascade running
  const runRef      = useRef(false);
  const isPausedRef = useRef(false);
  const saveMeRef       = useRef(false);   // "time's up, save me?" overlay showing
  const continueUsedRef = useRef(false);   // only one continue allowed per game
  const animBusy    = useRef(false);   // snap / bounce animation running
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pop animation shared by all currently-clearing cells
  const clearAnim    = useRef(new Animated.Value(0)).current;
  const clearScale   = useRef(clearAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.25, 0], extrapolate: 'clamp' })).current;
  const clearOpacity = useRef(clearAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' })).current;

  // Combo and score bounce
  const comboScale  = useRef(new Animated.Value(1)).current;
  const scoreScale  = useRef(new Animated.Value(1)).current;

  // Sparkle particles
  const particleIdRef = useRef(0);
  const [particles, setParticles] = useState<ParticleData[]>([]);

  // Animation values for the two gems being swapped
  const srcAnim = useRef(new Animated.ValueXY()).current;
  const nbrAnim = useRef(new Animated.ValueXY()).current;

  // Active swipe gesture state
  const drag = useRef<{
    srcR: number; srcC: number;
    nbrR: number; nbrC: number;   // -1 = direction not locked yet
    dir: 'h' | 'v';
  } | null>(null);

  // Grid page-coordinates for hit-testing (filled by onLayout + measure)
  const gridRef     = useRef<View>(null);
  const gridPagePos = useRef({ x: 0, y: 0 });

  // Pop SFX
  const popSoundRef = useRef<Audio.Sound | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    Audio.Sound.createAsync(require('../../../assets/audio/pop.wav')).then(({ sound }) => {
      if (cancelled) { sound.unloadAsync(); return; }
      popSoundRef.current = sound;
    });
    return () => {
      cancelled = true;
      popSoundRef.current?.unloadAsync();
      popSoundRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Bounce the combo label each time the multiplier increases
  useEffect(() => {
    if (combo <= 1) return;
    comboScale.setValue(0.4);
    Animated.spring(comboScale, { toValue: 1, speed: 22, bounciness: 18, useNativeDriver: true }).start();
  }, [combo]);

  // Pulse the score counter whenever points are added
  useEffect(() => {
    if (score === 0) return;
    scoreScale.setValue(1.35);
    Animated.spring(scoreScale, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true }).start();
  }, [score]);

  // ── Game logic ─────────────────────────────────────────────────────────────

  function finish(final: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    runRef.current  = false;
    isPausedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => onFinish(final), 600);
  }

  function pauseGame() {
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

  function declineSaveMe() {
    saveMeRef.current = false;
    setShowSaveMe(false);
    finish(scoreRef.current);
  }

  function watchAdToContinue() {
    showRewardedAd(() => grantContinue(), () => {
      Alert.alert('Ad Not Available', 'No ad is available right now. Please try again in a moment.');
    });
  }

  function spendDiamondsToContinue() {
    if (spendDiamonds(GAME_CONTINUE_DIAMONDS)) grantContinue();
  }

  function handleQuit() {
    if (doneRef.current) return;
    doneRef.current = true;
    runRef.current  = false;
    isPausedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    onFinish(-1);
  }

  // Burst sparkle dots from the centroid of matched cells
  function triggerSparkles(matched: Set<string>) {
    let tx = 0, ty = 0;
    const keys = Array.from(matched);
    keys.forEach(k => {
      const [r, c] = k.split(',').map(Number);
      tx += H_PAD + c * STEP + CELL_SIZE / 2;
      ty += r * STEP + CELL_SIZE / 2;
    });
    const cx = tx / keys.length;
    const cy = ty / keys.length;

    // Sample tile border colours for the particles
    const colors = keys.slice(0, 6).map(k => {
      const [r, c] = k.split(',').map(Number);
      return activeTiles[boardRef.current[r]?.[c]]?.border ?? '#FFFFFF';
    });

    const COUNT = 10;
    const batch: ParticleData[] = Array.from({ length: COUNT }, (_, i) => {
      const angle   = (Math.PI * 2 * i) / COUNT + Math.random() * 0.5;
      const dist    = 26 + Math.random() * 30;
      const pos     = new Animated.ValueXY({ x: 0, y: 0 });
      const opacity = new Animated.Value(1);
      const scale   = new Animated.Value(0);

      Animated.parallel([
        Animated.timing(pos, {
          toValue: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
          duration: 380, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1, duration: 90,  useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 0, duration: 290, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(140),
          Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
        ]),
      ]).start();

      return { id: particleIdRef.current++, x: cx, y: cy, color: colors[i % colors.length], pos, opacity, scale };
    });

    setParticles(prev => [...prev, ...batch]);
    // Clean up after animation completes
    const batchIds = new Set(batch.map(p => p.id));
    setTimeout(() => setParticles(prev => prev.filter(p => !batchIds.has(p.id))), 460);
  }

  function cascade(b: number[][], depth: number) {
    if (doneRef.current) return;
    const matched = findMatches(b);
    if (matched.size === 0) { busyRef.current = false; setCombo(0); return; }
    playSfx(popSoundRef.current);
    scoreRef.current += matched.size * 10 * depth;
    setScore(scoreRef.current);
    setCombo(depth);
    setClearing(new Set(matched));
    clearAnim.setValue(0);
    Animated.timing(clearAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    triggerSparkles(matched);
    setTimeout(() => {
      if (doneRef.current) return;
      clearAnim.setValue(0);
      const next = clearAndRefill(b, matched, nc);
      boardRef.current = next;
      setBoard(next);
      setClearing(new Set());
      setTimeout(() => cascade(next, depth + 1), 180);
    }, 320);
  }

  function commitSwap(r1: number, c1: number, r2: number, c2: number) {
    const next = doSwap(boardRef.current, r1, c1, r2, c2);
    busyRef.current  = true;
    boardRef.current = next;
    setBoard(next);
    cascade(next, 1);
  }

  // ── Animation helpers ──────────────────────────────────────────────────────

  function snapAndCommit(
    srcR: number, srcC: number,
    nbrR: number, nbrC: number,
    dir: 'h' | 'v', positive: boolean,
  ) {
    const tx = dir === 'h' ? (positive ? STEP : -STEP) : 0;
    const ty = dir === 'v' ? (positive ? STEP : -STEP) : 0;
    animBusy.current = true;
    Animated.parallel([
      Animated.spring(srcAnim, { toValue: { x: tx,  y: ty  }, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(nbrAnim, { toValue: { x: -tx, y: -ty }, useNativeDriver: true, speed: 60, bounciness: 0 }),
    ]).start(() => {
      animBusy.current = false;
      srcAnim.setValue({ x: 0, y: 0 });
      nbrAnim.setValue({ x: 0, y: 0 });
      setAnimCells(null);
      commitSwap(srcR, srcC, nbrR, nbrC);
    });
  }

  function bounceBack() {
    animBusy.current = true;
    Animated.parallel([
      Animated.spring(srcAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, speed: 28, bounciness: 14 }),
      Animated.spring(nbrAnim, { toValue: { x: 0, y: 0 }, useNativeDriver: true, speed: 28, bounciness: 14 }),
    ]).start(() => {
      animBusy.current = false;
      setAnimCells(null);
    });
  }

  // ── PanResponder ───────────────────────────────────────────────────────────

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () =>
      runRef.current && !busyRef.current && !doneRef.current && !animBusy.current && !isPausedRef.current && !saveMeRef.current,
    onMoveShouldSetPanResponder: (_, g) =>
      runRef.current && !busyRef.current && !doneRef.current && !animBusy.current && !isPausedRef.current && !saveMeRef.current &&
      (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),

    onPanResponderGrant: (_, g) => {
      if (!runRef.current || busyRef.current || doneRef.current || animBusy.current) return;
      // x0/y0 are page coords; gridPagePos gives the grid's page offset
      const relX = g.x0 - gridPagePos.current.x - H_PAD;
      const relY = g.y0 - gridPagePos.current.y;
      const col  = Math.floor(relX / STEP);
      const row  = Math.floor(relY / STEP);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      srcAnim.setValue({ x: 0, y: 0 });
      nbrAnim.setValue({ x: 0, y: 0 });
      drag.current = { srcR: row, srcC: col, nbrR: -1, nbrC: -1, dir: 'h' };
    },

    onPanResponderMove: (_, g) => {
      const ds = drag.current;
      if (!ds || animBusy.current) return;

      // Lock to one direction once the finger has moved enough
      if (ds.nbrR === -1) {
        const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
        if (ax < 4 && ay < 4) return;

        if (ax >= ay) {
          ds.dir  = 'h';
          ds.nbrR = ds.srcR;
          ds.nbrC = ds.srcC + (g.dx > 0 ? 1 : -1);
        } else {
          ds.dir  = 'v';
          ds.nbrR = ds.srcR + (g.dy > 0 ? 1 : -1);
          ds.nbrC = ds.srcC;
        }

        // Reject out-of-bounds neighbour
        if (ds.nbrR < 0 || ds.nbrR >= ROWS || ds.nbrC < 0 || ds.nbrC >= COLS) {
          drag.current = null;
          return;
        }

        setAnimCells({ srcR: ds.srcR, srcC: ds.srcC, nbrR: ds.nbrR, nbrC: ds.nbrC });
      }

      // Move both gems: source follows finger, neighbour mirrors it
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      if (ds.dir === 'h') {
        const x = clamp(g.dx, -STEP, STEP);
        srcAnim.setValue({ x, y: 0 });
        nbrAnim.setValue({ x: -x, y: 0 });
      } else {
        const y = clamp(g.dy, -STEP, STEP);
        srcAnim.setValue({ x: 0, y });
        nbrAnim.setValue({ x: 0, y: -y });
      }
    },

    onPanResponderRelease: (_, g) => {
      const ds = drag.current;
      drag.current = null;

      // Direction never locked (tiny tap or OOB) — reset silently
      if (!ds || ds.nbrR === -1) {
        srcAnim.setValue({ x: 0, y: 0 });
        nbrAnim.setValue({ x: 0, y: 0 });
        setAnimCells(null);
        return;
      }

      const dist    = ds.dir === 'h' ? Math.abs(g.dx) : Math.abs(g.dy);
      const swapped = doSwap(boardRef.current, ds.srcR, ds.srcC, ds.nbrR, ds.nbrC);
      const valid   = dist >= SWIPE_MIN && findMatches(swapped).size > 0;

      if (valid) {
        const pos = ds.dir === 'h' ? g.dx > 0 : g.dy > 0;
        snapAndCommit(ds.srcR, ds.srcC, ds.nbrR, ds.nbrC, ds.dir, pos);
      } else {
        bounceBack();
      }
    },

    onPanResponderTerminate: () => {
      drag.current = null;
      bounceBack();
    },
  })).current;

  // ── Start ──────────────────────────────────────────────────────────────────

  function measureGrid() {
    gridRef.current?.measure((_x, _y, _w, _h, px, py) => {
      gridPagePos.current = { x: px, y: py };
    });
  }

  function startGame() {
    measureGrid(); // Accurate position after modal is fully presented
    const b = makeBoard(nc);
    boardRef.current = b;
    scoreRef.current = 0;
    doneRef.current  = false;
    busyRef.current  = false;
    runRef.current   = true;
    saveMeRef.current = false;
    continueUsedRef.current = false;
    srcAnim.setValue({ x: 0, y: 0 });
    nbrAnim.setValue({ x: 0, y: 0 });
    setBoard(b);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setClearing(new Set());
    setAnimCells(null);
    setCombo(0);
    setShowSaveMe(false);
    setRunning(true);

    timerRef.current = setInterval(() => {
      if (isPausedRef.current || saveMeRef.current) return;
      setTimeLeft(t => {
        if (t <= 1) {
          if (!continueUsedRef.current) {
            saveMeRef.current = true;
            setShowSaveMe(true);
            return 0;
          }
          finish(scoreRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ImageBackground
      source={require('../../../assets/bg/bgcloud.png')}
      style={styles.root}
      resizeMode="cover"
    >
      {running ? (
        /* ── Active game ── */
        <View style={styles.gameBox}>
          <View style={styles.hud}>
            <View style={styles.scoreWrap}>
              <Image source={require('../../../assets/dooyoo/Dooyoo-happy.png')} style={styles.scoreIcon} resizeMode="contain" />
              <Animated.Text style={[styles.scoreTxt, { transform: [{ scale: scoreScale }] }]}>
                {score}
              </Animated.Text>
            </View>
            {combo > 1
              ? (
                <Animated.View style={{ transform: [{ scale: comboScale }] }}>
                  <Text style={styles.comboTxt}>x{combo} Combo!</Text>
                </Animated.View>
              )
              : <Text style={styles.levelTxt}>Lv{level} · {nc} gems</Text>
            }
            <Text style={[styles.timerTxt, timeLeft <= 10 && styles.urgent]}>
              {timeLeft}s
            </Text>
            <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
              <Text style={styles.pauseIcon}>⏸</Text>
            </TouchableOpacity>
          </View>

          <View
            ref={gridRef}
            style={styles.grid}
            onLayout={measureGrid}
            {...panResponder.panHandlers}
          >
            {board.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((tile, c) => {
                  const k      = `${r},${c}`;
                  const isClr  = clearing.has(k);
                  const isSwap = animCells !== null &&
                    ((r === animCells.srcR && c === animCells.srcC) ||
                     (r === animCells.nbrR && c === animCells.nbrC));
                  const cfg = activeTiles[tile];
                  return (
                    <Animated.View
                      key={c}
                      style={[
                        styles.cell,
                        cfg && { backgroundColor: cfg.bg, borderColor: cfg.border },
                        isSwap && styles.cellHide,
                        isClr && { transform: [{ scale: clearScale }], opacity: clearOpacity },
                      ]}
                    >
                      {cfg && (
                        <Image source={cfg.image} style={styles.tileImg} resizeMode="contain" />
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            ))}

            {/* Sparkle particle burst */}
            {particles.map(p => (
              <Animated.View
                key={p.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: p.x - 5,
                  top:  p.y - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: [...p.pos.getTranslateTransform(), { scale: p.scale }],
                }}
              />
            ))}

            {animCells !== null && (() => {
              const { srcR, srcC, nbrR, nbrC } = animCells;
              const srcCfg = activeTiles[boardRef.current[srcR][srcC]];
              const nbrCfg = activeTiles[boardRef.current[nbrR][nbrC]];
              return (
                <>
                  <Animated.View
                    style={[
                      styles.animGem,
                      srcCfg && { backgroundColor: srcCfg.bg, borderColor: srcCfg.border },
                      { left: H_PAD + srcC * STEP, top: srcR * STEP },
                      { transform: srcAnim.getTranslateTransform() },
                    ]}
                  >
                    {srcCfg && <Image source={srcCfg.image} style={styles.tileImg} resizeMode="contain" />}
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.animGem,
                      nbrCfg && { backgroundColor: nbrCfg.bg, borderColor: nbrCfg.border },
                      { left: H_PAD + nbrC * STEP, top: nbrR * STEP },
                      { transform: nbrAnim.getTranslateTransform() },
                    ]}
                  >
                    {nbrCfg && <Image source={nbrCfg.image} style={styles.tileImg} resizeMode="contain" />}
                  </Animated.View>
                </>
              );
            })()}
          </View>

          {showSaveMe && (
            <View style={styles.saveMeOverlay}>
              <Text style={styles.saveMeTitle}>Time's Up!</Text>
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
        </View>
      ) : (
        /* ── Pre-game overlay (root ImageBackground already shows clouds) ── */
        <View style={styles.overlay}>
          <Text style={styles.ovTitle}>Gem Crush</Text>
          <Text style={styles.ovDesc}>
            Swipe a gem to swap it with its neighbor.{'\n'}
            Match 3 or more in a row to score!{'\n'}
            Cascade combos multiply your points.{'\n'}
            {level > 1
              ? `Lv${level}: ${nc} gem types — harder to match!`
              : `${nc} gem types · ${GAME_TIME} seconds`
            }
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnTxt}>Start!</Text>
          </TouchableOpacity>
        </View>
      )}
      <PauseOverlay visible={isPaused} onResume={resumeGame} onQuit={handleQuit} />
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 5,
    minHeight: 50,
  },
  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreIcon: { width: 30, height: 30 },
  scoreTxt: { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 22 },
  comboTxt: { fontFamily: FONT, color: '#F39C12', fontWeight: '900', fontSize: 17 },
  levelTxt: { fontFamily: FONT, color: '#555577', fontSize: 13 },
  timerTxt: { fontFamily: FONT, color: '#7777AA', fontWeight: '700', fontSize: 18 },
  urgent:   { color: '#E74C3C' },

  gameBox: { marginTop: 100, marginHorizontal: 1, borderWidth: 6, borderColor: '#e0cd5c', borderRadius: 16, padding: 8, overflow: 'hidden', backgroundColor: '#c4c4d1' },
  grid: {
    alignSelf: 'center',
    paddingHorizontal: H_PAD,
    gap: GAP,
  },
  row:      { flexDirection: 'row', gap: GAP },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A35',  // fallback; overridden by per-tile bg
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: 'transparent',  // overridden per tile
  },
  cellHide: { opacity: 0 },           // hidden while its animated copy is on top
  tileImg:  { width: IMG_SIZE, height: IMG_SIZE },

  // Absolute overlay gem (the one that actually moves during a swipe).
  // backgroundColor is set inline per-tile so each type keeps its tint.
  animGem: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: 'transparent',  // overridden per tile
    zIndex: 10,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },

  saveMeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(15,15,35,0.88)',
  },
  saveMeTitle: { fontFamily: FONT, color: '#EFEFFF', fontSize: 28, fontWeight: '900' },
  saveMeScore: { fontFamily: FONT, color: '#F39C12', fontSize: 18, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: '#AAAACC', fontSize: 14, textAlign: 'center', marginBottom: 8 },
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
  ovTitle: { fontFamily: FONT, color: '#1A1A35', fontSize: 32, fontWeight: '900' },
  ovDesc:  { fontFamily: FONT, color: '#2D2D4E', fontSize: 15, textAlign: 'center', lineHeight: 24, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14 },
  startBtn: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 8,
  },
  startBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },
  pauseBtn:    { paddingHorizontal: 6 },
  pauseIcon:   { color: '#7777AA', fontSize: 18, fontWeight: '800' },
});
