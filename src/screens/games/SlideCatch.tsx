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
import { useAudioPlayer } from 'expo-audio';
import { FONT, KAWAII, KAWAII_BTN } from '../../lib/theme';
import { playSfx } from '../../lib/sfx';
import PauseOverlay from '../../components/PauseOverlay';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';

const { width: SW } = Dimensions.get('window');

// ── Board geometry ──────────────────────────────────────────────────────────
// Same plus/cross board as Twist Catch: a 9x9 grid where only the middle band
// of 3 columns (3-5) and the middle band of 3 rows (3-5) are valid cells.
// Every valid cell sits on exactly one row line and one column line; lines
// through the hub span all 9 cells, lines through an arm span only 3.
const SIZE      = 9;
const HUB_LO    = 3;
const HUB_HI    = 5;
const MATCH_MIN = 3;

const GAP       = 2;
const H_PAD     = 4;
const CELL_SIZE = Math.floor((SW - H_PAD * 2 - (SIZE - 1) * GAP) / SIZE);
const IMG_SIZE  = CELL_SIZE - 6;
const STEP      = CELL_SIZE + GAP;
const GAME_TIME = 60;
const CONTINUE_TIME = 20;
const DRAG_SLOP = 10;   // px before a drag locks to an axis
const SNAP_MS   = 120;

type Axis = 'row' | 'col';
type Line = { axis: Axis; idx: number };

type TileConfig = { image: any; border: string; bg: string };
const TILE_CONFIGS: TileConfig[] = [
  { image: require('../../../assets/nubkins/Nubkin1-Happy.png'),   border: '#2ECC71', bg: '#2ECC71' },
  { image: require('../../../assets/dooyoo/Dooyoo-happy.png'),     border: '#9B59B6', bg: '#9B59B6' },
  { image: require('../../../assets/louie/louie-happy.png'),       border: '#E67E22', bg: '#E67E22' },
  { image: require('../../../assets/nubkins/Nubkin1-Neutral.png'), border: '#3498DB', bg: '#3498DB' },
  { image: require('../../../assets/nubkins/Nubkin1-sad.png'),     border: '#E74C3C', bg: '#E74C3C' },
  { image: require('../../../assets/nubkins/Nubkin1-sleep.png'),   border: '#bcb11a', bg: '#bcb11a' },
];

interface ParticleData {
  id: number; x: number; y: number; color: string;
  pos: Animated.ValueXY; opacity: Animated.Value; scale: Animated.Value;
}

interface Props {
  level: number;
  onFinish: (score: number) => void;
}

// ── Pure board helpers ────────────────────────────────────────────────────

function colorsForLevel(lvl: number) {
  if (lvl <= 2) return 4;
  if (lvl <= 4) return 5;
  return 6;
}

function randTile(nc: number) { return Math.floor(Math.random() * nc); }

function isValid(r: number, c: number) {
  return (c >= HUB_LO && c <= HUB_HI) || (r >= HUB_LO && r <= HUB_HI);
}

// The valid index-range along a line. Symmetric for rows and columns: a line
// through the hub band spans the whole board, any other line only the band.
function bandRange(i: number): [number, number] {
  return (i >= HUB_LO && i <= HUB_HI) ? [0, SIZE - 1] : [HUB_LO, HUB_HI];
}

function lineCells({ axis, idx }: Line): [number, number][] {
  const [lo, hi] = bandRange(idx);
  const out: [number, number][] = [];
  for (let i = lo; i <= hi; i++) out.push(axis === 'row' ? [idx, i] : [i, idx]);
  return out;
}

function makeBoard(nc: number): number[][] {
  const b: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isValid(r, c)) continue;
      let v: number;
      do {
        v = randTile(nc);
      } while (
        (c >= 2 && b[r][c - 1] === v && b[r][c - 2] === v) ||
        (r >= 2 && b[r - 1][c] === v && b[r - 2][c] === v)
      );
      b[r][c] = v;
    }
  }
  return b;
}

// Runs of MATCH_MIN+ identical tiles. Invalid cells hold -1, which breaks runs
// at the edge of the cross without special-casing.
function findMatches(board: number[][]): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      const v = board[r][c];
      if (v < 0) { c++; continue; }
      let e = c;
      while (e + 1 < SIZE && board[r][e + 1] === v) e++;
      if (e - c + 1 >= MATCH_MIN) for (let i = c; i <= e; i++) out.add(`${r},${i}`);
      c = e + 1;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0;
    while (r < SIZE) {
      const v = board[r][c];
      if (v < 0) { r++; continue; }
      let e = r;
      while (e + 1 < SIZE && board[e + 1][c] === v) e++;
      if (e - r + 1 >= MATCH_MIN) for (let i = r; i <= e; i++) out.add(`${i},${c}`);
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
  for (let c = 0; c < SIZE; c++) {
    const [lo, hi] = bandRange(c);
    const kept: number[] = [];
    for (let r = lo; r <= hi; r++) if (b[r][c] >= 0) kept.push(b[r][c]);
    const missing = (hi - lo + 1) - kept.length;
    const refilled = Array.from({ length: missing }, () => randTile(nc)).concat(kept);
    for (let i = 0; i < refilled.length; i++) b[lo + i][c] = refilled[i];
  }
  return b;
}

// The core mechanic: cyclically shift one line by k cells (positive = right
// for rows, down for columns). Tiles pushed off one end wrap to the other.
function shiftLine(board: number[][], line: Line, k: number): number[][] {
  const b = board.map(row => [...row]);
  const cells = lineCells(line);
  const n = cells.length;
  const vals = cells.map(([r, c]) => board[r][c]);
  for (let i = 0; i < n; i++) {
    const [r, c] = cells[(((i + k) % n) + n) % n];
    b[r][c] = vals[i];
  }
  return b;
}

function hasMove(board: number[][]): boolean {
  for (const axis of ['row', 'col'] as Axis[]) {
    for (let idx = 0; idx < SIZE; idx++) {
      const line = { axis, idx };
      const n = lineCells(line).length;
      for (let k = 1; k < n; k++) {
        if (findMatches(shiftLine(board, line, k)).size > 0) return true;
      }
    }
  }
  return false;
}

function makeSolvableBoard(nc: number): number[][] {
  let b = makeBoard(nc);
  let tries = 0;
  while (!hasMove(b) && tries < 50) { b = makeBoard(nc); tries++; }
  return b;
}

// ── Component ────────────────────────────────────────────────────────────

export default function SlideCatch({ level, onFinish }: Props) {
  const nc          = colorsForLevel(level);
  const activeTiles = TILE_CONFIGS.slice(0, nc);

  const diamonds      = useGameStore(s => s.profile.diamonds);
  const spendDiamonds = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const [board,      setBoard]      = useState<number[][]>(() => makeBoard(nc));
  const [clearing,   setClearing]   = useState<Set<string>>(new Set());
  const [score,      setScore]      = useState(0);
  const [timeLeft,   setTimeLeft]   = useState(GAME_TIME);
  const [running,    setRunning]    = useState(false);
  const [isPaused,   setIsPaused]   = useState(false);
  const [showSaveMe, setShowSaveMe] = useState(false);
  const [combo,      setCombo]      = useState(0);
  const [dragLine,   setDragLine]   = useState<Line | null>(null);

  const boardRef    = useRef<number[][]>(board);
  const scoreRef    = useRef(0);
  const doneRef     = useRef(false);
  const busyRef     = useRef(false);   // cascade or snap animation running
  const runRef      = useRef(false);
  const isPausedRef = useRef(false);
  const saveMeRef       = useRef(false);
  const continueUsedRef = useRef(false);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drag gesture bookkeeping: the cell the finger went down on, and the line
  // it locked onto once movement passed DRAG_SLOP.
  const dragStartRef = useRef<{ r: number; c: number } | null>(null);
  const dragLineRef  = useRef<Line | null>(null);
  const dragOffset   = useRef(new Animated.Value(0)).current;
  const dragOffsetRef = useRef(0);

  const clearAnim    = useRef(new Animated.Value(0)).current;
  const clearScale   = useRef(clearAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.25, 0], extrapolate: 'clamp' })).current;
  const clearOpacity = useRef(clearAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' })).current;

  const comboScale = useRef(new Animated.Value(1)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;

  const particleIdRef = useRef(0);
  const [particles, setParticles] = useState<ParticleData[]>([]);

  const popSound = useAudioPlayer(require('../../../assets/audio/pop.wav'));

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => () => {
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (combo <= 1) return;
    comboScale.setValue(0.4);
    Animated.spring(comboScale, { toValue: 1, speed: 22, bounciness: 18, useNativeDriver: true }).start();
  }, [combo]);

  useEffect(() => {
    if (score === 0) return;
    scoreScale.setValue(1.35);
    Animated.spring(scoreScale, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true }).start();
  }, [score]);

  // ── Game logic ─────────────────────────────────────────────────────────

  function finish(final: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    runRef.current  = false;
    isPausedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => onFinish(final), 600);
  }

  function pauseGame() { isPausedRef.current = true; setIsPaused(true); }
  function resumeGame() { isPausedRef.current = false; setIsPaused(false); }

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
    const batchIds = new Set(batch.map(p => p.id));
    setTimeout(() => setParticles(prev => prev.filter(p => !batchIds.has(p.id))), 460);
  }

  function cascade(b: number[][], depth: number) {
    if (doneRef.current) return;
    const matched = findMatches(b);
    if (matched.size === 0) {
      // Board is stable — make sure the player still has a move available.
      if (!hasMove(b)) {
        const reshuffled = makeSolvableBoard(nc);
        boardRef.current = reshuffled;
        setBoard(reshuffled);
      }
      busyRef.current = false;
      setCombo(0);
      return;
    }
    playSfx(popSound);
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

  // ── Drag handling ──────────────────────────────────────────────────────

  function canInteract() {
    return runRef.current && !busyRef.current && !doneRef.current && !isPausedRef.current && !saveMeRef.current;
  }

  function endDrag() {
    dragStartRef.current = null;
    dragLineRef.current  = null;
    dragOffsetRef.current = 0;
    dragOffset.setValue(0);
    setDragLine(null);
  }

  function onDragStart(x: number, y: number) {
    if (!canInteract()) return;
    const c = Math.floor((x - H_PAD) / STEP);
    const r = Math.floor(y / STEP);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || !isValid(r, c)) return;
    dragStartRef.current = { r, c };
  }

  function onDragMove(dx: number, dy: number) {
    const start = dragStartRef.current;
    if (!start) return;
    if (!dragLineRef.current) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return;
      const line: Line = Math.abs(dx) > Math.abs(dy)
        ? { axis: 'row', idx: start.r }
        : { axis: 'col', idx: start.c };
      dragLineRef.current = line;
      setDragLine(line);
    }
    const off = dragLineRef.current.axis === 'row' ? dx : dy;
    dragOffsetRef.current = off;
    dragOffset.setValue(off);
  }

  function onDragEnd() {
    const line = dragLineRef.current;
    if (!line) { dragStartRef.current = null; return; }

    const n = lineCells(line).length;
    const k = Math.round(dragOffsetRef.current / STEP);
    const kMod = ((k % n) + n) % n;
    const next = kMod === 0 || !canInteract() ? null : shiftLine(boardRef.current, line, kMod);
    const valid = next !== null;

    // Every slide sticks, match or not — snap to the nearest cell and commit.
    // Only a drag that lands back on its start (or happens while the game is
    // paused/over) slides back.
    busyRef.current = true;
    dragStartRef.current = null;
    Animated.timing(dragOffset, {
      toValue: valid ? k * STEP : 0,
      duration: SNAP_MS,
      useNativeDriver: false,
    }).start(() => {
      if (valid && next && !doneRef.current) {
        boardRef.current = next;
        setBoard(next);
        endDrag();
        cascade(next, 1);
      } else {
        endDrag();
        busyRef.current = false;
      }
    });
  }

  // PanResponder is created once, so it calls through a ref to always reach
  // this render's handlers.
  const dragHandlers = useRef({ onDragStart, onDragMove, onDragEnd });
  dragHandlers.current = { onDragStart, onDragMove, onDragEnd };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant:     e => dragHandlers.current.onDragStart(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove:      (_, g) => dragHandlers.current.onDragMove(g.dx, g.dy),
    onPanResponderRelease:   () => dragHandlers.current.onDragEnd(),
    onPanResponderTerminate: () => dragHandlers.current.onDragEnd(),
  })).current;

  // ── Start ──────────────────────────────────────────────────────────────

  function startGame() {
    const b = makeSolvableBoard(nc);
    boardRef.current = b;
    scoreRef.current = 0;
    doneRef.current  = false;
    busyRef.current  = false;
    runRef.current   = true;
    saveMeRef.current = false;
    continueUsedRef.current = false;
    endDrag();
    setBoard(b);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setClearing(new Set());
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

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderTile(tile: number, key: string, style: any) {
    const isClr = clearing.has(key);
    const cfg = activeTiles[tile];
    return (
      <Animated.View
        key={key}
        pointerEvents="none"
        style={[
          styles.cell,
          style,
          cfg && { backgroundColor: cfg.bg, borderColor: cfg.border },
          isClr && { transform: [{ scale: clearScale }], opacity: clearOpacity },
        ]}
      >
        {cfg && <Image source={cfg.image} style={styles.tileImg} resizeMode="contain" />}
      </Animated.View>
    );
  }

  // The line being dragged is drawn inside a clipping strip. Each tile slides
  // by the drag offset modulo the line length, with a twin one line-length
  // behind it, so tiles leaving one end reappear at the other.
  function renderDragLine(line: Line) {
    const cells = lineCells(line);
    const n = cells.length;
    const L = n * STEP;
    const [r0, c0] = cells[0];
    const isRow = line.axis === 'row';
    return (
      <View
        pointerEvents="none"
        style={[
          styles.dragStrip,
          {
            left:   H_PAD + c0 * STEP,
            top:    r0 * STEP,
            width:  isRow ? L - GAP : CELL_SIZE,
            height: isRow ? CELL_SIZE : L - GAP,
          },
        ]}
      >
        {cells.map(([r, c], i) => {
          const pos  = Animated.modulo(Animated.add(dragOffset, i * STEP), L);
          const twin = Animated.add(pos, -L);
          const key  = `${r},${c}`;
          const t = (v: Animated.AnimatedModulo<number> | Animated.AnimatedAddition<number>) =>
            ({ position: 'absolute', left: 0, top: 0, transform: [isRow ? { translateX: v } : { translateY: v }] });
          return (
            <React.Fragment key={key}>
              {renderTile(board[r][c], key, t(pos))}
              {renderTile(board[r][c], `${key}-twin`, t(twin))}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  const dragKeys = new Set(dragLine ? lineCells(dragLine).map(([r, c]) => `${r},${c}`) : []);
  const staticCells: { r: number; c: number; tile: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isValid(r, c) || dragKeys.has(`${r},${c}`)) continue;
      staticCells.push({ r, c, tile: board[r][c] });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <ImageBackground
      source={require('../../../assets/bg/bgcloud.png')}
      style={styles.root}
      resizeMode="cover"
    >
      {running ? (
        <View style={styles.gameBox}>
          <View style={styles.hud}>
            <View style={styles.scoreWrap}>
              <Image source={require('../../../assets/louie/louie-happy.png')} style={styles.scoreIcon} resizeMode="contain" />
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
              : <Text style={styles.levelTxt}>Lv{level} · {nc} nubkins</Text>
            }
            <Text style={[styles.timerTxt, timeLeft <= 10 && styles.urgent]}>
              {timeLeft}s
            </Text>
            <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
              <Text style={styles.pauseIcon}>⏸</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid} {...panResponder.panHandlers}>
            {staticCells.map(({ r, c, tile }) =>
              renderTile(tile, `${r},${c}`, { position: 'absolute', left: H_PAD + c * STEP, top: r * STEP })
            )}

            {dragLine && renderDragLine(dragLine)}

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
        <View style={styles.overlay}>
          <Text style={styles.ovTitle}>Slide Catch</Text>
          <Text style={styles.ovDesc}>
            Drag any row or column to slide it.{'\n'}
            Nubkins pushed off one end wrap around to the other —{'\n'}
            line up 3 or more to pop them!{'\n'}
            {level > 1
              ? `Lv${level}: ${nc} nubkin types — harder to match!`
              : `${nc} nubkin types · ${GAME_TIME} seconds`
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

// ── Styles ───────────────────────────────────────────────────────────────

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

  gameBox: { marginTop: 104, marginHorizontal: 1, borderWidth: 6, borderColor: '#e0cd5c', borderRadius: 16, padding: 8, overflow: 'hidden', backgroundColor: '#c4c4d1' },
  grid: {
    alignSelf: 'center',
    width: H_PAD * 2 + SIZE * CELL_SIZE + (SIZE - 1) * GAP,
    height: SIZE * CELL_SIZE + (SIZE - 1) * GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A35',
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  tileImg: { width: IMG_SIZE, height: IMG_SIZE },

  dragStrip: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.45)',
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
    backgroundColor: KAWAII.backdrop,
  },
  saveMeTitle: { fontFamily: FONT, color: KAWAII.ink, fontSize: 28, fontWeight: '900' },
  saveMeScore: { fontFamily: FONT, color: KAWAII.orange, fontSize: 18, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  saveMeBtn: {
    ...KAWAII_BTN,
    backgroundColor: KAWAII.mint,
    paddingHorizontal: 28,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  saveMeBtnDiamond:  { backgroundColor: KAWAII.sky },
  saveMeBtnDisabled: { opacity: 0.4 },
  saveMeBtnTxt: { fontFamily: FONT, color: KAWAII.ink, fontWeight: '800', fontSize: 15 },
  saveMeSkip:    { marginTop: 4, padding: 8 },
  saveMeSkipTxt: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14, fontWeight: '700' },
  ovTitle: { fontFamily: FONT, color: '#1A1A35', fontSize: 32, fontWeight: '900' },
  ovDesc:  { fontFamily: FONT, color: '#2D2D4E', fontSize: 15, textAlign: 'center', lineHeight: 24, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, padding: 14 },
  startBtn: {
    backgroundColor: '#E67E22',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 8,
  },
  startBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },
  pauseBtn:    { paddingHorizontal: 6 },
  pauseIcon:   { color: '#7777AA', fontSize: 18, fontWeight: '800' },
});
