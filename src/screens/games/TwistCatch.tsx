import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
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

// ── Board geometry ──────────────────────────────────────────────────────────
// A 9x9 grid where only a plus/cross shape of cells is valid:
//   - the middle band of 3 columns (3,4,5) spans all 9 rows (top arm + hub + bottom arm)
//   - the middle band of 3 rows    (3,4,5) spans all 9 columns (left arm + hub + right arm)
// The 3x3 overlap of those two bands (rows 3-5, cols 3-5) is the rotating hub.
const SIZE    = 9;
const HUB_LO  = 3;
const HUB_HI  = 5;
const MATCH_MIN = 4; // this mode requires 4+ in a row/column, not 3

const GAP       = 2;
const H_PAD     = 4;
const CELL_SIZE = Math.floor((SW - H_PAD * 2 - (SIZE - 1) * GAP) / SIZE);
const IMG_SIZE  = CELL_SIZE - 6;
const STEP      = CELL_SIZE + GAP;
const HUB_BOX   = 3 * CELL_SIZE + 2 * GAP;
const GAME_TIME = 60;
const CONTINUE_TIME = 20;
const ROTATE_MS = 220;

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

// A cell is part of the cross iff it's in the vertical band (hub columns,
// spanning all rows) or the horizontal band (hub rows, spanning all columns).
function isValid(r: number, c: number) {
  return (c >= HUB_LO && c <= HUB_HI) || (r >= HUB_LO && r <= HUB_HI);
}

// For gravity/refill: the valid row-range within a given column.
function colRange(c: number): [number, number] {
  return (c >= HUB_LO && c <= HUB_HI) ? [0, SIZE - 1] : [HUB_LO, HUB_HI];
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

// Runs of MATCH_MIN+ identical tiles, scanned per-row and per-column.
// Invalid cells hold -1, which never equals a tile value, so they naturally
// break runs at the boundary of the cross shape without special-casing.
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

// Gravity + refill, scoped per-column to that column's valid row-range —
// this is what lets the two arm-only columns and the tall hub column all
// "fall" correctly without leaking into cells outside the cross.
function clearAndRefill(board: number[][], cleared: Set<string>, nc: number): number[][] {
  const b = board.map(row => [...row]);
  for (const k of cleared) {
    const [r, c] = k.split(',').map(Number);
    b[r][c] = -1;
  }
  for (let c = 0; c < SIZE; c++) {
    const [lo, hi] = colRange(c);
    const kept: number[] = [];
    for (let r = lo; r <= hi; r++) if (b[r][c] >= 0) kept.push(b[r][c]);
    const missing = (hi - lo + 1) - kept.length;
    const refilled = Array.from({ length: missing }, () => randTile(nc)).concat(kept);
    for (let i = 0; i < refilled.length; i++) b[lo + i][c] = refilled[i];
  }
  return b;
}

// The core mechanic: rotate the 3x3 hub sub-grid in place. Nothing outside
// the hub moves — but because the hub's own border cells are what touch each
// arm, this single rotation changes what's adjacent to all four arms at once.
function rotateHub(board: number[][], dir: 1 | -1): number[][] {
  const b = board.map(row => [...row]);
  const sub: number[][] = [];
  for (let r = 0; r < 3; r++) {
    sub.push([b[HUB_LO + r][HUB_LO], b[HUB_LO + r][HUB_LO + 1], b[HUB_LO + r][HUB_LO + 2]]);
  }
  const rotated: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      rotated[r][c] = dir === 1 ? sub[2 - c][r] : sub[c][2 - r];
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      b[HUB_LO + r][HUB_LO + c] = rotated[r][c];
    }
  }
  return b;
}

// There are only 3 distinct non-identity hub states (90/180/270). If none of
// them produce a match, the board is stuck and needs a reshuffle.
function hasMove(board: number[][]): boolean {
  let b = board;
  for (let i = 0; i < 3; i++) {
    b = rotateHub(b, 1);
    if (findMatches(b).size > 0) return true;
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

export default function TwistCatch({ level, onFinish }: Props) {
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

  const boardRef    = useRef<number[][]>(board);
  const scoreRef    = useRef(0);
  const doneRef     = useRef(false);
  const busyRef     = useRef(false);   // cascade running
  const runRef      = useRef(false);
  const isPausedRef = useRef(false);
  const saveMeRef       = useRef(false);
  const continueUsedRef = useRef(false);
  const rotateBusyRef   = useRef(false);   // spin animation running
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAnim    = useRef(new Animated.Value(0)).current;
  const clearScale   = useRef(clearAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.25, 0], extrapolate: 'clamp' })).current;
  const clearOpacity = useRef(clearAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' })).current;

  const comboScale = useRef(new Animated.Value(1)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;

  const hubSpin = useRef(new Animated.Value(0)).current;
  const hubRotateStr = hubSpin.interpolate({ inputRange: [-90, 0, 90], outputRange: ['-90deg', '0deg', '90deg'] });

  const particleIdRef = useRef(0);
  const [particles, setParticles] = useState<ParticleData[]>([]);

  const popSoundRef = useRef<Audio.Sound | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────

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

  function commitRotate(dir: 1 | -1) {
    const next = rotateHub(boardRef.current, dir);
    busyRef.current  = true;
    boardRef.current = next;
    setBoard(next);
    cascade(next, 1);
  }

  function handleHubPress() {
    if (!runRef.current || busyRef.current || doneRef.current || rotateBusyRef.current || isPausedRef.current || saveMeRef.current) return;
    rotateBusyRef.current = true;
    hubSpin.setValue(0);
    Animated.timing(hubSpin, { toValue: 90, duration: ROTATE_MS, useNativeDriver: true }).start(() => {
      hubSpin.setValue(0);
      rotateBusyRef.current = false;
      commitRotate(1);
    });
  }

  // ── Start ──────────────────────────────────────────────────────────────

  function startGame() {
    const b = makeSolvableBoard(nc);
    boardRef.current = b;
    scoreRef.current = 0;
    doneRef.current  = false;
    busyRef.current  = false;
    runRef.current   = true;
    rotateBusyRef.current = false;
    saveMeRef.current = false;
    continueUsedRef.current = false;
    hubSpin.setValue(0);
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

  const armCells: { r: number; c: number; tile: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isValid(r, c)) continue;
      const inHub = r >= HUB_LO && r <= HUB_HI && c >= HUB_LO && c <= HUB_HI;
      if (inHub) continue;
      armCells.push({ r, c, tile: board[r][c] });
    }
  }
  const hubCells: { r: number; c: number; tile: number }[] = [];
  for (let r = HUB_LO; r <= HUB_HI; r++) {
    for (let c = HUB_LO; c <= HUB_HI; c++) {
      hubCells.push({ r, c, tile: board[r][c] });
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
              : <Text style={styles.levelTxt}>Lv{level} · {nc} nubkins</Text>
            }
            <Text style={[styles.timerTxt, timeLeft <= 10 && styles.urgent]}>
              {timeLeft}s
            </Text>
            <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
              <Text style={styles.pauseIcon}>⏸</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {armCells.map(({ r, c, tile }) =>
              renderTile(tile, `${r},${c}`, { position: 'absolute', left: H_PAD + c * STEP, top: r * STEP })
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleHubPress}
              style={[styles.hubBox, { left: H_PAD + HUB_LO * STEP, top: HUB_LO * STEP }]}
            >
              <Animated.View style={[styles.hubSpinner, { transform: [{ rotate: hubRotateStr }] }]}>
                {hubCells.map(({ r, c, tile }) =>
                  renderTile(tile, `${r},${c}`, {
                    position: 'absolute',
                    left: (c - HUB_LO) * STEP,
                    top:  (r - HUB_LO) * STEP,
                  })
                )}
              </Animated.View>
            </TouchableOpacity>

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
          <Text style={styles.ovTitle}>Twist Catch</Text>
          <Text style={styles.ovDesc}>
            Tap the center hub to spin it 90°.{'\n'}
            Rotating shifts tiles at the junction of all four arms —{'\n'}
            match 4 or more in a row or column to catch them!{'\n'}
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

  gameBox: { marginTop: 60, marginHorizontal: 1, borderWidth: 6, borderColor: '#e0cd5c', borderRadius: 16, padding: 8, overflow: 'hidden', backgroundColor: '#c4c4d1' },
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

  hubBox: {
    position: 'absolute',
    width: HUB_BOX,
    height: HUB_BOX,
  },
  hubSpinner: {
    width: HUB_BOX,
    height: HUB_BOX,
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
