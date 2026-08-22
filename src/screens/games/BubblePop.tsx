import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ImageBackground, TouchableOpacity, Image, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { FONT } from '../../lib/theme';
import { playSfx } from '../../lib/sfx';
import PauseOverlay from '../../components/PauseOverlay';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';

interface Props {
  level: number;
  onFinish: (score: number) => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 7;
const ROWS = 9;
const GAME_DURATION = 60;
const CONTINUE_TIME = 20;  // bonus seconds granted by a single continue
const BUBBLE_SIZE = Math.floor(SCREEN_W / COLS);
const BUBBLE_R = BUBBLE_SIZE / 2;
const GRID_TOP = 62;
const SHOOTER_Y = GRID_TOP + ROWS * BUBBLE_SIZE + BUBBLE_R;
const STEP = BUBBLE_SIZE * 0.4;
const COLORS = ['#FF6B9D', '#4FC3F7', '#FFD54F', '#81C784', '#CE93D8'];

const PURPLE_SKY = require('../../../assets/bg/purplesky.png');

const BUBBLE_ASSETS: Record<string, { idle: ReturnType<typeof require>; popped: ReturnType<typeof require> }> = {
  '#FF6B9D': { idle: require('../../../assets/bubbles/redbubble.png'),    popped: require('../../../assets/bubbles/redBubble-Popped.png') },
  '#4FC3F7': { idle: require('../../../assets/bubbles/bluebobble.png'),   popped: require('../../../assets/bubbles/bluebubble-Popped.png') },
  '#FFD54F': { idle: require('../../../assets/bubbles/yellowbubble.png'), popped: require('../../../assets/bubbles/yellowbubble-Popped.png') },
  '#81C784': { idle: require('../../../assets/bubbles/greenbubble.png'),  popped: require('../../../assets/bubbles/greenbubble-Popped.png') },
  '#CE93D8': { idle: require('../../../assets/bubbles/redbubble.png'),    popped: require('../../../assets/bubbles/redBubble-Popped.png') },
};

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeGrid(level: number): (string | null)[][] {
  const filled = Math.min(4 + Math.floor(level / 4), 7);
  return Array.from({ length: ROWS }, (_, r) =>
    r < filled ? Array.from({ length: COLS }, () => rand(COLORS)) : Array(COLS).fill(null)
  );
}

function cellXY(r: number, c: number) {
  return { x: c * BUBBLE_SIZE + BUBBLE_R, y: GRID_TOP + r * BUBBLE_SIZE + BUBBLE_R };
}

function getNeighbors(r: number, c: number): [number, number][] {
  return ([
    [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
    [r - 1, c - 1], [r - 1, c + 1],
  ] as [number, number][]).filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
}

function findCluster(grid: (string | null)[][], r: number, c: number): [number, number][] {
  const color = grid[r][c];
  if (!color) return [];
  const seen = new Set<string>();
  const q: [number, number][] = [[r, c]];
  const result: [number, number][] = [];
  while (q.length) {
    const [cr, cc] = q.shift()!;
    const k = `${cr},${cc}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (grid[cr][cc] !== color) continue;
    result.push([cr, cc]);
    for (const n of getNeighbors(cr, cc)) {
      if (!seen.has(`${n[0]},${n[1]}`) && grid[n[0]][n[1]] === color) q.push(n);
    }
  }
  return result;
}

function findOrphans(grid: (string | null)[][]): [number, number][] {
  const reachable = new Set<string>();
  const q: [number, number][] = [];
  for (let c = 0; c < COLS; c++) {
    if (grid[0][c]) { q.push([0, c]); reachable.add(`0,${c}`); }
  }
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [nr, nc] of getNeighbors(r, c)) {
      const k = `${nr},${nc}`;
      if (!reachable.has(k) && grid[nr][nc]) { reachable.add(k); q.push([nr, nc]); }
    }
  }
  const orphans: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] && !reachable.has(`${r},${c}`)) orphans.push([r, c]);
  return orphans;
}

function findEmptyCol(grid: (string | null)[][], row: number, start: number): number {
  for (let d = 0; d < COLS; d++) {
    if (start + d < COLS && !grid[row][start + d]) return start + d;
    if (start - d >= 0  && !grid[row][start - d]) return start - d;
  }
  return start;
}

function bestSlot(grid: (string | null)[][], hitR: number, hitC: number, ax: number, ay: number): [number, number] {
  let best: [number, number] = [Math.max(0, hitR - 1), hitC];
  let bestD = Infinity;
  for (const [nr, nc] of getNeighbors(hitR, hitC)) {
    if (grid[nr][nc]) continue;
    const { x, y } = cellXY(nr, nc);
    const d = (ax - x) ** 2 + (ay - y) ** 2;
    if (d < bestD) { bestD = d; best = [nr, nc]; }
  }
  return best;
}

function calcPath(angle: number, grid: (string | null)[][]): { frames: {x:number;y:number}[]; landR: number; landC: number } {
  let x = SCREEN_W / 2;
  let y = SHOOTER_Y;
  let dx = Math.cos(angle) * STEP;
  let dy = Math.sin(angle) * STEP;
  const frames: {x: number; y: number}[] = [];

  for (let i = 0; i < 2000; i++) {
    x += dx; y += dy;
    if (x - BUBBLE_R < 0)        { x = BUBBLE_R;             dx = Math.abs(dx); }
    if (x + BUBBLE_R > SCREEN_W) { x = SCREEN_W - BUBBLE_R;  dx = -Math.abs(dx); }
    frames.push({ x, y });

    if (y - BUBBLE_R <= GRID_TOP) {
      const c0 = Math.max(0, Math.min(COLS - 1, Math.round((x - BUBBLE_R) / BUBBLE_SIZE)));
      return { frames, landR: 0, landC: findEmptyCol(grid, 0, c0) };
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        const { x: bx, y: by } = cellXY(r, c);
        if ((x - bx) ** 2 + (y - by) ** 2 < (BUBBLE_SIZE * 0.88) ** 2) {
          const slot = bestSlot(grid, r, c, x - dx, y - dy);
          return { frames, landR: slot[0], landC: slot[1] };
        }
      }
    }
  }
  return { frames, landR: 0, landC: Math.floor(COLS / 2) };
}

function BubbleFace({ size, color, popping, style }: {
  size: number; color: string; popping?: boolean; style?: object;
}) {
  const assets = BUBBLE_ASSETS[color] ?? BUBBLE_ASSETS['#FF6B9D'];
  return (
    <Image
      source={popping ? assets.popped : assets.idle}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}

export default function BubblePop({ level, onFinish }: Props) {
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const [grid, setGrid]         = useState<(string | null)[][]>(() => makeGrid(level));
  const [curColor, setCur]      = useState(() => rand(COLORS));
  const [nxtColor, setNxt]      = useState(() => rand(COLORS));
  const [score, setScore]       = useState(0);
  const [timeLeft, setTime]     = useState(GAME_DURATION);
  const [ballPos, setBall]      = useState<{x:number;y:number}|null>(null);
  const [aimAngle, setAim]      = useState<number|null>(null);
  const [shooting, setShot]     = useState(false);
  const [running, setRunning]   = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const [showSaveMe, setShowSaveMe] = useState(false);

  const gridRef  = useRef(grid);   gridRef.current  = grid;
  const scoreRef = useRef(0);
  const shotRef  = useRef(false);  shotRef.current  = shooting;
  const curRef   = useRef(curColor); curRef.current = curColor;
  const nxtRef   = useRef(nxtColor); nxtRef.current = nxtColor;
  const doneRef     = useRef(false);
  const animRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);
  const saveMeRef       = useRef(false);   // "danger/time's up, save me?" overlay showing
  const continueUsedRef = useRef(false);   // only one continue allowed per game
  const popSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    Audio.Sound.createAsync(require('../../../assets/audio/ballpop.wav')).then(({ sound }) => {
      if (cancelled) { sound.unloadAsync(); return; }
      popSoundRef.current = sound;
    });
    return () => {
      cancelled = true;
      popSoundRef.current?.unloadAsync();
      popSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running || isPaused || showSaveMe) return;
    const t = setInterval(() => {
      setTime(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, isPaused, showSaveMe]);

  useEffect(() => {
    if (timeLeft === 0 && !doneRef.current && !saveMeRef.current) {
      triggerSaveMeOrFinish();
    }
  }, [timeLeft]);

  function finish(final: number) {
    if (doneRef.current) return;
    doneRef.current = true;
    isPausedRef.current = false;
    saveMeRef.current = false;
    setTimeout(() => onFinish(final), 300);
  }

  function triggerSaveMeOrFinish() {
    if (doneRef.current || saveMeRef.current) return;
    if (!continueUsedRef.current) {
      saveMeRef.current = true;
      setShowSaveMe(true);
    } else {
      finish(scoreRef.current);
    }
  }

  function grantContinue() {
    saveMeRef.current = false;
    continueUsedRef.current = true;
    setShowSaveMe(false);
    // Clear the bottom rows so the stack isn't still touching the danger line
    const g = gridRef.current.map(row => [...row]);
    for (let r = Math.max(0, ROWS - 3); r < ROWS; r++) g[r] = Array(COLS).fill(null);
    setGrid(g); gridRef.current = g;
    setTime(CONTINUE_TIME);
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
    finish(scoreRef.current);
  }

  function pauseGame() {
    if (saveMeRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
  }

  function resumeGame() {
    isPausedRef.current = false;
    setIsPaused(false);
  }

  function handleQuit() {
    if (doneRef.current) return;
    doneRef.current = true;
    isPausedRef.current = false;
    if (animRef.current) clearInterval(animRef.current);
    setRunning(false);
    onFinish(-1);
  }

  function startGame() {
    const fresh = makeGrid(level);
    setGrid(fresh); gridRef.current = fresh;
    scoreRef.current = 0; setScore(0);
    doneRef.current = false;
    saveMeRef.current = false;
    continueUsedRef.current = false;
    setTime(GAME_DURATION);
    setCur(rand(COLORS)); setNxt(rand(COLORS));
    setBall(null); setAim(null); setShot(false);
    setClearing(new Set());
    setShowSaveMe(false);
    setRunning(true);
  }

  function clampAngle(tx: number, ty: number): number {
    let a = Math.atan2(ty - SHOOTER_Y, tx - SCREEN_W / 2);
    const MIN = (-175 * Math.PI) / 180;
    const MAX = (-5   * Math.PI) / 180;
    if (a > 0) a = a > Math.PI / 2 ? MIN : MAX;
    return Math.max(MIN, Math.min(MAX, a));
  }

  function doShoot(angle: number) {
    if (shotRef.current || doneRef.current) return;
    setShot(true); shotRef.current = true;

    const color = curRef.current;
    const { frames, landR, landC } = calcPath(angle, gridRef.current);

    const target = 35;
    const skip = Math.max(1, Math.floor(frames.length / target));
    const anim = frames.filter((_, i) => i % skip === 0);
    if (anim[anim.length - 1] !== frames[frames.length - 1]) anim.push(frames[frames.length - 1]);

    let fi = 0;
    animRef.current = setInterval(() => {
      if (fi < anim.length) { setBall(anim[fi++]); return; }
      clearInterval(animRef.current!);
      setBall(null);
      landBubble(color, landR, landC);
    }, 14);
  }

  function landBubble(color: string, r: number, c: number) {
    const g = gridRef.current.map(row => [...row]);

    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !g[r][c]) {
      g[r][c] = color;
      const cluster = findCluster(g, r, c);

      if (cluster.length >= 3) {
        playSfx(popSoundRef.current);
        // Find orphans with cluster pre-removed
        const tmpG = g.map(row => [...row]);
        for (const [cr, cc] of cluster) tmpG[cr][cc] = null;
        const orphans = findOrphans(tmpG);

        const toRemove: [number, number][] = [...cluster, ...orphans];
        const popKeys = new Set(toRemove.map(([cr, cc]) => `${cr},${cc}`));

        const gained = cluster.length * 10 + orphans.length * 5;
        if (gained) { scoreRef.current += gained; setScore(scoreRef.current); }

        // Show popped faces, then remove after 250 ms
        setGrid(g); gridRef.current = g;
        setClearing(popKeys);

        setTimeout(() => {
          const g2 = gridRef.current.map(row => [...row]);
          for (const [cr, cc] of toRemove) g2[cr][cc] = null;
          setClearing(new Set());

          const allClear  = g2.every(row => row.every(cell => !cell));
          const hitDanger = g2[ROWS - 2].some(Boolean);
          setGrid(g2); gridRef.current = g2;

          if (allClear && !doneRef.current) {
            scoreRef.current += 200; setScore(scoreRef.current);
            finish(scoreRef.current);
            return;
          }
          if (hitDanger && !doneRef.current && !saveMeRef.current) {
            triggerSaveMeOrFinish();
            return;
          }

          const next2 = rand(COLORS);
          setCur(nxtRef.current); curRef.current = nxtRef.current;
          setNxt(next2); nxtRef.current = next2;
          setShot(false); shotRef.current = false;
          setAim(null);
        }, 250);
        return;
      }

      const allClear  = g.every(row => row.every(cell => !cell));
      const hitDanger = g[ROWS - 2].some(Boolean);

      if (allClear && !doneRef.current) {
        scoreRef.current += 200; setScore(scoreRef.current);
        setGrid(g); gridRef.current = g;
        finish(scoreRef.current);
        return;
      }
      if (hitDanger && !doneRef.current && !saveMeRef.current) {
        setGrid(g); gridRef.current = g;
        triggerSaveMeOrFinish();
        return;
      }
    }

    setGrid(g); gridRef.current = g;
    const next2 = rand(COLORS);
    setCur(nxtRef.current); curRef.current = nxtRef.current;
    setNxt(next2);          nxtRef.current = next2;
    setShot(false); shotRef.current = false;
    setAim(null);
  }

  const bsz = BUBBLE_SIZE - 4;

  return (
    <ImageBackground source={PURPLE_SKY} style={styles.container} resizeMode="cover">
      {running ? (
        <>
          <View style={styles.header}>
            <Text style={styles.stat}>{timeLeft}s</Text>
            <Text style={styles.title}>Bubble Pop</Text>
            <View style={styles.headerRight}>
              <Text style={[styles.stat, styles.statRight]}>{score}</Text>
              {!showSaveMe && (
                <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
                  <Text style={styles.pauseIcon}>⏸</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View
            style={styles.area}
            onStartShouldSetResponder={() => !isPausedRef.current && !saveMeRef.current}
            onResponderMove={e => {
              if (!shotRef.current && !isPausedRef.current && !saveMeRef.current) setAim(clampAngle(e.nativeEvent.locationX, e.nativeEvent.locationY));
            }}
            onResponderRelease={e => {
              if (isPausedRef.current || saveMeRef.current) return;
              const a = clampAngle(e.nativeEvent.locationX, e.nativeEvent.locationY);
              setAim(a);
              doShoot(a);
            }}
          >
            {/* Grid bubbles */}
            {grid.map((row, r) =>
              row.map((color, c) => {
                if (!color) return null;
                const { x, y } = cellXY(r, c);
                return (
                  <BubbleFace
                    key={`${r}-${c}`}
                    size={bsz}
                    color={color}
                    popping={clearing.has(`${r},${c}`)}
                    style={{ position: 'absolute', left: x - BUBBLE_R + 2, top: y - BUBBLE_R + 2 }}
                  />
                );
              })
            )}

            {aimAngle !== null && !shooting && <AimDots angle={aimAngle} color={curColor} />}

            {/* In-flight bubble */}
            {ballPos && (
              <BubbleFace
                size={bsz}
                color={curColor}
                style={{ position: 'absolute', left: ballPos.x - BUBBLE_R + 2, top: ballPos.y - BUBBLE_R + 2 }}
              />
            )}

            {/* Shooter (current color) */}
            <BubbleFace
              size={bsz}
              color={curColor}
              style={{ position: 'absolute', left: SCREEN_W / 2 - BUBBLE_R + 2, top: SHOOTER_Y - BUBBLE_R + 2 }}
            />

            {/* Next bubble preview */}
            <View style={[styles.nextWrap, { top: SHOOTER_Y - BUBBLE_SIZE, right: 24 }]}>
              <Text style={styles.nextLabel}>Next</Text>
              <BubbleFace size={Math.round(BUBBLE_SIZE * 0.65)} color={nxtColor} />
            </View>

            {/* Continue prompt — shown on danger/time-out, before the run actually ends */}
            {showSaveMe && (
              <View style={styles.saveMeOverlay}>
                <Text style={styles.ovTitle}>Uh oh!</Text>
                <Text style={styles.saveMeScore}>Score: {score}</Text>
                <Text style={styles.saveMeDesc}>Keep popping for {CONTINUE_TIME} more seconds?</Text>
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
          <PauseOverlay visible={isPaused} onResume={resumeGame} onQuit={handleQuit} />
        </>
      ) : (
        <View style={styles.overlay}>
          <Text style={styles.ovTitle}>Bubble Pop</Text>
          <Text style={styles.ovDesc}>
            Aim and shoot bubbles to match 3 or more!{'\n'}
            Orphaned clusters fall for bonus points.{'\n'}
            Clear the board for a +200 bonus!{'\n'}
            {level > 1 ? `Level ${level} — more rows to clear!` : `${GAME_DURATION} seconds on the clock`}
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnTxt}>Start!</Text>
          </TouchableOpacity>
        </View>
      )}
    </ImageBackground>
  );
}

function AimDots({ angle, color }: { angle: number; color: string }) {
  const dots = [];
  const gap = BUBBLE_SIZE * 0.9;
  for (let i = 1; i <= 7; i++) {
    let x = SCREEN_W / 2 + Math.cos(angle) * gap * i;
    let y = SHOOTER_Y + Math.sin(angle) * gap * i;
    if (x < BUBBLE_R) x = BUBBLE_R * 2 - x;
    if (x > SCREEN_W - BUBBLE_R) x = (SCREEN_W - BUBBLE_R) * 2 - x;
    if (y < GRID_TOP) break;
    dots.push(
      <View key={i} style={{
        position: 'absolute', left: x - 6, top: y - 6,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: color, opacity: Math.max(0.1, 1 - i * 0.13),
      }} />
    );
  }
  return <>{dots}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: 60, paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  title:     { fontFamily: FONT, color: '#EFEFFF', fontSize: 18, fontWeight: '900' },
  stat:        { fontFamily: FONT, color: '#FFD54F', fontSize: 15, fontWeight: '800', minWidth: 60 },
  statRight:   { textAlign: 'right' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pauseBtn:    { paddingHorizontal: 6 },
  pauseIcon:   { color: '#FFF', fontSize: 18, fontWeight: '800' },
  area:      { flex: 1, position: 'relative' },
  nextWrap:  { position: 'absolute', alignItems: 'center' },
  nextLabel: { fontFamily: FONT, color: '#E8D5FF', fontSize: 11, marginBottom: 4 },

  saveMeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.82)',
  },
  saveMeScore: { fontFamily: FONT, color: '#FFD54F', fontSize: 20, fontWeight: '800' },
  saveMeDesc:  { fontFamily: FONT, color: '#E8D5FF', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  saveMeBtn: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 20, width: '100%', alignItems: 'center',
  },
  saveMeBtnDiamond:  { backgroundColor: '#3498DB' },
  saveMeBtnDisabled: { opacity: 0.4 },
  saveMeBtnTxt: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 15 },
  saveMeSkip:    { marginTop: 4, padding: 8 },
  saveMeSkipTxt: { fontFamily: FONT, color: '#E8D5FF', fontSize: 14, fontWeight: '700' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingHorizontal: 32,
  },
  ovTitle:    { fontFamily: FONT, color: '#FFF', fontSize: 34, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4 },
  ovDesc:     { fontFamily: FONT, color: '#2D1060', fontSize: 15, textAlign: 'center', lineHeight: 24, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 16 },
  startBtn:   { backgroundColor: '#9B59B6', paddingHorizontal: 52, paddingVertical: 16, borderRadius: 24, marginTop: 4 },
  startBtnTxt:{ fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },
});
