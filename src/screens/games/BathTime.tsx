import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Image, ImageBackground,
  PanResponder, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Audio } from 'expo-av';
import { FONT } from '../../lib/theme';
import { getSkinImages } from '../../lib/skinImages';
import { useGameStore } from '../../store/useGameStore';
import { useAds } from '../../hooks/useAds';
import { GAME_CONTINUE_DIAMONDS } from '../../data/economy';
import { playSfx } from '../../lib/sfx';
import PauseOverlay from '../../components/PauseOverlay';

const { width: SW, height: SH } = Dimensions.get('window');

const CANVAS_H    = SH * 0.78;
const PLAY_H      = CANVAS_H * 0.70;
const MARGIN      = 55;

const APPROACH_MS = 1000;
const HIT_WINDOW  = 320;
const CIRCLE_R    = 35;
const SLIDER_R    = 30;
const BALL_R      = 20;
const WAYPOINT_R  = 12;
const MAX_MISSES  = 3;
const TICK_MS     = 10;

const CIRCLE_COL  = '#5B8FE8';
const SLIDER_COL  = '#E85B8F';

interface Pt { x: number; y: number }

interface HitCircle {
  kind: 'circle';
  id: number;
  x: number; y: number;
  deadline: number;
  state: 'active' | 'hit';
}

interface Slider {
  kind: 'slider';
  id: number;
  points: Pt[];     // 2 pts = 1 seg · 3 pts = 2 segs · 4 pts = 3 segs
  deadline: number;
  state: 'active' | 'held' | 'completed';
  progress: number; // 0–1 along total polyline
}

type GameObj = HitCircle | Slider;

interface Particle {
  id: number; x: number; y: number;
  label: string; opacity: Animated.Value;
}

interface Judgment {
  id: number; x: number; y: number;
  label: string; color: string;
  scale: Animated.Value; opacity: Animated.Value; y2: Animated.Value;
}

interface StarBit {
  id: number; x: number; y: number;
  pos: Animated.ValueXY; opacity: Animated.Value; scale: Animated.Value;
  rotateDeg: Animated.AnimatedInterpolation<string>;
}

const JUDGMENT_STYLE: Record<'PERFECT!' | 'GREAT!' | 'OK' | 'NICE!', string> = {
  'PERFECT!': '#FFD34D',
  'GREAT!':   '#5BD8E8',
  'OK':       '#EFEFFF',
  'NICE!':    '#B85BE8',
};

interface Props { level: number; onFinish: (score: number) => void }

// ── Polyline math (outside component) ────────────────────────────────────────

function polyLen(pts: Pt[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++)
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return len;
}

function ptAt(pts: Pt[], t: number): Pt {
  const total  = polyLen(pts);
  const target = Math.min(t, 1) * total;
  let accum    = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx  = pts[i + 1].x - pts[i].x;
    const dy  = pts[i + 1].y - pts[i].y;
    const seg = Math.hypot(dx, dy);
    if (accum + seg >= target || i === pts.length - 2) {
      const lT = seg === 0 ? 0 : Math.min(1, (target - accum) / seg);
      return { x: pts[i].x + dx * lT, y: pts[i].y + dy * lT };
    }
    accum += seg;
  }
  return pts[pts.length - 1];
}

// Projects the touch onto the polyline, but only considers a local window
// ahead of `fromT` (the progress reached so far). A global nearest-point
// search would let the touch "snap" onto a distant later segment — which
// happens routinely on closed-ish shapes, since makeShapePath() ends each
// path back near its own start, putting the first and last segments right
// next to each other. Without this window, a single tap near the start
// point can jump straight to ~90% progress and auto-complete the shape.
function projectPoly(tx: number, ty: number, pts: Pt[], fromT: number = 0, maxAheadFrac: number = 0.35): number {
  const total = polyLen(pts);
  if (total === 0) return 0;
  let best = fromT, bestDist = Infinity, accum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx  = pts[i + 1].x - pts[i].x;
    const dy  = pts[i + 1].y - pts[i].y;
    const seg = Math.hypot(dx, dy);
    const segStartT = accum / total;
    const segEndT   = (accum + seg) / total;
    // Skip segments outside the allowed window (a little slack behind for smoothness)
    if (segEndT < fromT - 0.03 || segStartT > fromT + maxAheadFrac) { accum += seg; continue; }
    const lT  = seg === 0 ? 0 : Math.max(0, Math.min(1,
      ((tx - pts[i].x) * dx + (ty - pts[i].y) * dy) / (seg * seg)
    ));
    const dist = Math.hypot(tx - (pts[i].x + dx * lT), ty - (pts[i].y + dy * lT));
    if (dist < bestDist) { bestDist = dist; best = (accum + lT * seg) / total; }
    accum += seg;
  }
  return best;
}

// ── Shape sliders — Hold & Drag paths trace a recognizable outline ───────────

type ShapeKind = 'triangle' | 'square' | 'hexagon' | 'star' | 'heart';

// Unit-scale outline vertices, centered at the origin, radius ~1.
function unitShapePoints(kind: ShapeKind): Pt[] {
  const fromAngles = (degs: number[]) => degs.map(d => {
    const r = (d * Math.PI) / 180;
    return { x: Math.cos(r), y: Math.sin(r) };
  });
  switch (kind) {
    case 'triangle': return fromAngles([-90, 30, 150]);
    case 'square':   return fromAngles([45, 135, 225, 315]);
    case 'hexagon':  return fromAngles([-90, -30, 30, 90, 150, 210]);
    case 'star': {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? 1 : 0.45;
        const ang = ((-90 + i * 36) * Math.PI) / 180;
        pts.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
      }
      return pts;
    }
    case 'heart': {
      const pts: Pt[] = [];
      const N = 12;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const x = Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        pts.push({ x, y: -y / 17 }); // flipped so the point sits at the bottom on screen
      }
      return pts;
    }
  }
}

// Places a shape in the play field: random center/radius/rotation, clamped to
// bounds, with the path ending 90% of the way back to its start so the start
// and end caps stay visually distinct instead of overlapping on a full close.
function makeShapePath(kind: ShapeKind): Pt[] {
  const radius = 55 + Math.random() * 35;
  const cx = MARGIN + radius + Math.random() * Math.max(0, SW - MARGIN * 2 - radius * 2);
  const cy = MARGIN + radius + Math.random() * Math.max(0, PLAY_H - MARGIN - radius * 2);
  const rot = Math.random() * Math.PI * 2;
  const cos = Math.cos(rot), sin = Math.sin(rot);

  const pts = unitShapePoints(kind).map(p => {
    const rx = p.x * cos - p.y * sin;
    const ry = p.x * sin + p.y * cos;
    return {
      x: Math.max(MARGIN, Math.min(SW - MARGIN, cx + rx * radius)),
      y: Math.max(MARGIN, Math.min(PLAY_H,      cy + ry * radius)),
    };
  });

  const first = pts[0];
  const last  = pts[pts.length - 1];
  pts.push({ x: last.x + (first.x - last.x) * 0.9, y: last.y + (first.y - last.y) * 0.9 });
  return pts;
}

// Shape pool widens (more vertices, harder to trace) the longer the run goes.
function shapePoolFor(t: number): ShapeKind[] {
  if (t < 20)  return ['triangle', 'square'];
  if (t < 50)  return ['triangle', 'square', 'hexagon'];
  if (t < 100) return ['square', 'hexagon', 'star'];
  return ['hexagon', 'star', 'heart'];
}

let _uid = 0;

export default function BathTime({ onFinish }: Props) {
  const equippedSkinId = useGameStore(s => s.creature.equippedSkinId);
  const nubkinImgs     = getSkinImages(equippedSkinId);
  const diamonds       = useGameStore(s => s.profile.diamonds);
  const spendDiamonds  = useGameStore(s => s.spendDiamonds);
  const { showRewardedAd } = useAds();

  const [phase,    setPhase]    = useState<'intro' | 'playing' | 'done'>('intro');
  const [now,      setNow]      = useState(Date.now());
  const [objects,   setObjects]   = useState<GameObj[]>([]);
  const [parts,     setParts]     = useState<Particle[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [stars,     setStars]     = useState<StarBit[]>([]);
  const [score,    setScore]    = useState(0);
  const [combo,    setCombo]    = useState(1);
  const [misses,   setMisses]   = useState(0);
  const [mood,     setMood]     = useState<'happy' | 'neutral' | 'sad'>('happy');
  const [showContinue, setShowContinue] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const objRef      = useRef<GameObj[]>([]);
  const partRef     = useRef<Particle[]>([]);
  const judgRef     = useRef<Judgment[]>([]);
  const starRef     = useRef<StarBit[]>([]);
  const scoreRef    = useRef(0);
  const comboRef    = useRef(1);
  const missesRef   = useRef(0);
  const phaseRef    = useRef<'intro' | 'playing' | 'done'>('intro');
  const doneRef     = useRef(false);
  const startRef    = useRef(0);
  const loopRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldSlider  = useRef<number | null>(null);
  const foamOpacity = useRef(new Animated.Value(0)).current;
  const missFlash   = useRef(new Animated.Value(0)).current;
  const comboScale  = useRef(new Animated.Value(1)).current;
  const isPausedRef = useRef(false);
  const pausedAtRef = useRef(0);
  const continuePromptRef   = useRef(false);
  const continuePromptAtRef = useRef(0);
  const continueUsedRef     = useRef(false);   // only one continue allowed per game
  const bathSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    Audio.Sound.createAsync(require('../../../assets/audio/bathsound.mp3')).then(({ sound }) => {
      if (cancelled) { sound.unloadAsync(); return; }
      bathSoundRef.current = sound;
    });
    return () => {
      cancelled = true;
      bathSoundRef.current?.unloadAsync();
      bathSoundRef.current = null;
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function showFoam() {
    foamOpacity.stopAnimation();
    foamOpacity.setValue(1);
    Animated.timing(foamOpacity, { toValue: 0, duration: 700, useNativeDriver: true }).start();
    playSfx(bathSoundRef.current);
  }

  function spawnParticle(x: number, y: number, label: string) {
    const opacity = new Animated.Value(1);
    const p: Particle = { id: ++_uid, x: x + (Math.random() * 28 - 14), y: y - 10, label, opacity };
    partRef.current = [...partRef.current, p];
    setParts([...partRef.current]);
    Animated.timing(opacity, { toValue: 0, duration: 650, useNativeDriver: true }).start(() => {
      partRef.current = partRef.current.filter(q => q.id !== p.id);
      setParts([...partRef.current]);
    });
  }

  function spawnJudgment(x: number, y: number, label: keyof typeof JUDGMENT_STYLE) {
    const j: Judgment = {
      id: ++_uid, x, y, label, color: JUDGMENT_STYLE[label],
      scale: new Animated.Value(0.4), opacity: new Animated.Value(1), y2: new Animated.Value(0),
    };
    judgRef.current = [...judgRef.current, j];
    setJudgments([...judgRef.current]);
    Animated.sequence([
      Animated.spring(j.scale, { toValue: 1, speed: 26, bounciness: 16, useNativeDriver: true }),
      Animated.delay(260),
      Animated.parallel([
        Animated.timing(j.opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(j.y2,      { toValue: -24, duration: 260, useNativeDriver: true }),
      ]),
    ]).start(() => {
      judgRef.current = judgRef.current.filter(q => q.id !== j.id);
      setJudgments([...judgRef.current]);
    });
  }

  function spawnStarBurst(x: number, y: number) {
    const COUNT = 7;
    const batch: StarBit[] = Array.from({ length: COUNT }, (_, i) => {
      const angle   = (Math.PI * 2 * i) / COUNT + Math.random() * 0.4;
      const dist    = 40 + Math.random() * 34;
      const pos     = new Animated.ValueXY({ x: 0, y: 0 });
      const opacity = new Animated.Value(1);
      const scale   = new Animated.Value(0);
      const spin    = new Animated.Value(0);

      Animated.parallel([
        Animated.timing(pos, {
          toValue: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
          duration: 480, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 260, delay: 120, useNativeDriver: true }),
        ]),
        Animated.timing(spin, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(280),
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]),
      ]).start();

      const rotateDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${Math.random() > 0.5 ? 1 : -1}80deg`] });
      return { id: ++_uid, x, y, pos, opacity, scale, rotateDeg };
    });

    starRef.current = [...starRef.current, ...batch];
    setStars([...starRef.current]);
    const batchIds = new Set(batch.map(s => s.id));
    setTimeout(() => {
      starRef.current = starRef.current.filter(s => !batchIds.has(s.id));
      setStars([...starRef.current]);
    }, 520);
  }

  function triggerMissFlash() {
    missFlash.stopAnimation();
    missFlash.setValue(0.55);
    Animated.timing(missFlash, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  }

  function addScore(pts: number, x: number, y: number, judgment: keyof typeof JUDGMENT_STYLE) {
    const total      = pts * comboRef.current;
    scoreRef.current += total;
    comboRef.current  = Math.min(10, comboRef.current + 1);
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    spawnParticle(x, y, `+${total}`);
    spawnJudgment(x, y, judgment);
    spawnStarBurst(x, y);
    comboScale.setValue(1.5);
    Animated.spring(comboScale, { toValue: 1, speed: 22, bounciness: 14, useNativeDriver: true }).start();
  }

  function addMiss() {
    if (doneRef.current || continuePromptRef.current) return;
    missesRef.current += 1;
    comboRef.current   = 1;
    setMisses(missesRef.current);
    setCombo(1);
    setMood(missesRef.current >= MAX_MISSES - 1 ? 'sad' : 'neutral');
    triggerMissFlash();
    if (missesRef.current >= MAX_MISSES) {
      if (!continueUsedRef.current) triggerContinuePrompt();
      else endGame();
    }
  }

  function elapsed(): number {
    return (Date.now() - startRef.current) / 1000;
  }

  function scheduleNextSpawn() {
    if (doneRef.current || phaseRef.current !== 'playing' || continuePromptRef.current) return;
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    // Gap shrinks from 500ms toward a 120ms floor, ramping over ~90s and then holding —
    // the run is endless, so this keeps getting harder well past the old fixed-time cap.
    const delay = Math.max(120, 500 - elapsed() * 4.2);
    spawnTimer.current = setTimeout(() => {
      if (phaseRef.current === 'playing' && !doneRef.current && !continuePromptRef.current) spawnObject();
    }, delay);
  }

  function triggerContinuePrompt() {
    continuePromptRef.current   = true;
    continuePromptAtRef.current = Date.now();
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    objRef.current = [];
    setObjects([]);
    setShowContinue(true);
  }

  function grantContinue() {
    // Don't let decision time count against the difficulty ramp.
    startRef.current += Date.now() - continuePromptAtRef.current;
    missesRef.current = 0;
    setMisses(0);
    setMood('happy');
    continuePromptRef.current = false;
    continueUsedRef.current   = true;
    setShowContinue(false);
    scheduleNextSpawn();
  }

  function watchAdToContinue() {
    showRewardedAd(() => grantContinue(), () => {
      Alert.alert('Ad Not Available', 'No ad is available right now. Please try again in a moment.');
    });
  }

  function spendDiamondsToContinue() {
    if (spendDiamonds(GAME_CONTINUE_DIAMONDS)) grantContinue();
  }

  function declineContinue() {
    continuePromptRef.current = false;
    setShowContinue(false);
    endGame();
  }

  function endGame() {
    if (doneRef.current) return;
    doneRef.current  = true;
    isPausedRef.current = false;
    continuePromptRef.current = false;
    clearInterval(loopRef.current!);
    clearTimeout(spawnTimer.current!);
    phaseRef.current = 'done';
    setMood('sad');
    setPhase('done');
    setTimeout(() => onFinish(scoreRef.current), 900);
  }

  function pauseGame() {
    if (continuePromptRef.current) return;
    isPausedRef.current = true;
    pausedAtRef.current = Date.now();
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    setIsPaused(true);
  }

  function resumeGame() {
    startRef.current += Date.now() - pausedAtRef.current;
    isPausedRef.current = false;
    setIsPaused(false);
    scheduleNextSpawn();
  }

  function handleQuit() {
    if (doneRef.current) return;
    doneRef.current = true;
    isPausedRef.current = false;
    continuePromptRef.current = false;
    clearInterval(loopRef.current!);
    clearTimeout(spawnTimer.current!);
    phaseRef.current = 'done';
    onFinish(-1);
  }

  function spawnObject() {
    const t        = elapsed();
    const deadline = Date.now() + APPROACH_MS;

    // Slider probability: 20% at t=0, ramping toward 75% and holding — endless run,
    // so this keeps climbing well past where the old fixed-time round used to end.
    const sliderProb = Math.min(0.75, 0.20 + t * 0.0035);

    if (Math.random() < sliderProb) {
      const pool  = shapePoolFor(t);
      const shape = pool[Math.floor(Math.random() * pool.length)];
      const points = makeShapePath(shape);

      const s: Slider = { kind: 'slider', id: ++_uid, points, deadline, state: 'active', progress: 0 };
      objRef.current = [...objRef.current, s];
    } else {
      const c: HitCircle = {
        kind: 'circle', id: ++_uid,
        x: MARGIN + Math.random() * (SW - MARGIN * 2),
        y: MARGIN + Math.random() * PLAY_H,
        deadline, state: 'active',
      };
      objRef.current = [...objRef.current, c];
    }
    setObjects([...objRef.current]);
  }

  // ── PanResponder ─────────────────────────────────────────────────────────────

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => phaseRef.current === 'playing' && !isPausedRef.current && !continuePromptRef.current,
    onMoveShouldSetPanResponder:  () => phaseRef.current === 'playing' && !isPausedRef.current && !continuePromptRef.current,

    onPanResponderGrant: (e) => {
      const { locationX: tx, locationY: ty } = e.nativeEvent;
      const ts = Date.now();

      // Tap circle?
      for (const o of objRef.current) {
        if (o.kind !== 'circle' || o.state !== 'active') continue;
        const dt = ts - o.deadline;
        if (Math.hypot(o.x - tx, o.y - ty) <= CIRCLE_R * 1.7 && Math.abs(dt) <= HIT_WINDOW) {
          objRef.current = objRef.current.map(x =>
            x.id === o.id ? { ...x, state: 'hit' } as GameObj : x
          );
          setObjects([...objRef.current]);
          const acc = Math.abs(dt);
          addScore(
            acc < 100 ? 30 : acc < 200 ? 20 : 10, o.x, o.y,
            acc < 100 ? 'PERFECT!' : acc < 200 ? 'GREAT!' : 'OK',
          );
          showFoam();
          setTimeout(() => {
            objRef.current = objRef.current.filter(x => x.id !== o.id);
            setObjects([...objRef.current]);
            scheduleNextSpawn();
          }, 200);
          return;
        }
      }

      // Hold slider start?
      for (const o of objRef.current) {
        if (o.kind !== 'slider' || o.state !== 'active') continue;
        const start = o.points[0];
        const dt    = ts - o.deadline;
        if (Math.hypot(start.x - tx, start.y - ty) <= SLIDER_R * 1.7 && Math.abs(dt) <= HIT_WINDOW) {
          heldSlider.current = o.id;
          objRef.current = objRef.current.map(x =>
            x.id === o.id ? { ...x, state: 'held' } as GameObj : x
          );
          setObjects([...objRef.current]);
          return;
        }
      }
    },

    onPanResponderMove: (e) => {
      if (heldSlider.current === null) return;
      const { locationX: tx, locationY: ty } = e.nativeEvent;
      const idx = objRef.current.findIndex(o => o.id === heldSlider.current);
      if (idx === -1) return;
      const o = objRef.current[idx] as Slider;
      if (o.kind !== 'slider' || o.state !== 'held') return;

      // Project finger onto polyline, searching only a window ahead of where
      // it already got to — prevents snapping onto a distant later segment.
      const newT    = projectPoly(tx, ty, o.points, o.progress);
      const clamped = Math.max(o.progress, newT);

      const updated = [...objRef.current] as GameObj[];
      (updated[idx] as Slider).progress = clamped;
      objRef.current = updated;
      setObjects([...objRef.current]);

      if (clamped >= 0.88) {
        const endPt = o.points[o.points.length - 1];
        // Bonus points per extra segment
        addScore(50 + (o.points.length - 2) * 20, endPt.x, endPt.y, 'NICE!');
        showFoam();
        objRef.current     = objRef.current.filter(x => x.id !== o.id);
        heldSlider.current = null;
        setObjects([...objRef.current]);
        scheduleNextSpawn();
      }
    },

    onPanResponderRelease: () => {
      if (heldSlider.current !== null) {
        const o = objRef.current.find(x => x.id === heldSlider.current) as Slider | undefined;
        if (o && o.state === 'held' && o.progress < 0.88) {
          addMiss();
          const ballPt = ptAt(o.points, o.progress);
          spawnParticle(ballPt.x, ballPt.y, 'X');
          objRef.current = objRef.current.filter(x => x.id !== o.id);
          setObjects([...objRef.current]);
          scheduleNextSpawn();
        }
        heldSlider.current = null;
      }
    },
  })).current;

  // ── Game loop ─────────────────────────────────────────────────────────────────

  function startGame() {
    doneRef.current    = false;
    phaseRef.current   = 'playing';
    objRef.current     = [];
    partRef.current    = [];
    scoreRef.current   = 0;
    comboRef.current   = 1;
    missesRef.current  = 0;
    heldSlider.current = null;
    startRef.current   = Date.now();
    continuePromptRef.current = false;
    continueUsedRef.current   = false;

    setObjects([]); setParts([]);
    setScore(0); setCombo(1); setMisses(0); setShowContinue(false);
    setMood('happy'); setPhase('playing');

    spawnObject();

    loopRef.current = setInterval(() => {
      if (phaseRef.current !== 'playing' || isPausedRef.current || continuePromptRef.current) return;
      const ts = Date.now();
      setNow(ts);

      const expired: number[] = [];
      for (const o of objRef.current) {
        if (o.state !== 'active') continue;
        if (ts > o.deadline + HIT_WINDOW) {
          expired.push(o.id);
          const px = o.kind === 'circle' ? o.x : o.points[0].x;
          const py = o.kind === 'circle' ? o.y : o.points[0].y;
          spawnParticle(px, py, '!');
          addMiss();
        }
      }
      if (expired.length) {
        objRef.current = objRef.current.filter(o => !expired.includes(o.id));
        setObjects([...objRef.current]);
        scheduleNextSpawn();
      }
    }, TICK_MS);
  }

  useEffect(() => () => {
    clearInterval(loopRef.current!);
    clearTimeout(spawnTimer.current!);
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────────

  function approachScale(deadline: number): number {
    return 1 + Math.max(0, (deadline - now) / APPROACH_MS) * 1.9;
  }
  function approachOpacity(deadline: number): number {
    return Math.max(0, Math.min(1, ((deadline - now) / APPROACH_MS) * 2));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ImageBackground source={require('../../../assets/bg/bathroom.png')} style={styles.root} resizeMode="cover">

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <Text style={styles.scoreText}>{score}</Text>
          {combo > 1 && (
            <Animated.Text style={[styles.comboText, { transform: [{ scale: comboScale }] }]}>
              ×{combo}
            </Animated.Text>
          )}
        </View>
        <View style={styles.missBar}>
          {Array.from({ length: MAX_MISSES }).map((_, i) => (
            <View key={i} style={[styles.missSlot, i < misses && styles.missSlotFilled]} />
          ))}
          <Text style={styles.missLabel}></Text>
          {phase === 'playing' && !showContinue && (
            <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
              <Text style={styles.pauseIcon}>⏸</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Intro */}
      {phase === 'intro' && (
        <View style={styles.overlay}>
          <Image source={nubkinImgs.neutral} style={styles.overlayNubkin} resizeMode="contain" />
          <Text style={styles.title}>Bath Time!</Text>
          <Text style={styles.desc}>
            {'Tap circles to scrub dirt!\n\nFor sliders — hold the start circle and drag all the way to the end. Sliders can have bends!\n\nEndless mode — patterns get faster and more complex the longer you last.\n3 misses and you can watch an ad or spend diamonds to keep going.'}
          </Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: CIRCLE_COL }]}>
              <Text style={styles.legendIcon}></Text>
            </View>
            <Text style={styles.legendLabel}>Tap</Text>
            <View style={[styles.legendDot, { backgroundColor: SLIDER_COL }]}>
              <Text style={styles.legendIcon}></Text>
            </View>
            <Text style={styles.legendLabel}>Hold & Drag</Text>
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Start!</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Done */}
      {phase === 'done' && (
        <View style={styles.overlay}>
          <Image source={nubkinImgs.sad} style={styles.overlayNubkin} resizeMode="contain" />
          <Text style={styles.title}>Too Dirty!</Text>
          <Text style={styles.bigScore}>{score}</Text>
          <Text style={styles.desc}>points</Text>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Try Again!</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game canvas */}
      {phase === 'playing' && (
        <View style={[styles.canvas, { height: CANVAS_H }]} {...pan.panHandlers}>

          <Image
            source={nubkinImgs[mood]}
            style={styles.nubkin}
            resizeMode="contain"
            pointerEvents="none"
          />
          <Animated.Image
            source={require('../../../assets/minigame_items/foam-left.png')}
            style={[styles.foamLeft, { opacity: foamOpacity }]}
            resizeMode="contain"
            pointerEvents="none"
          />
          <Animated.Image
            source={require('../../../assets/minigame_items/foam-right.png')}
            style={[styles.foamRight, { opacity: foamOpacity }]}
            resizeMode="contain"
            pointerEvents="none"
          />

          {objects.map(o => {
            if (o.kind === 'circle') {
              const sc  = approachScale(o.deadline);
              const aOp = approachOpacity(o.deadline);
              return (
                <View key={o.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {/* Shrinking approach ring */}
                  <View style={{
                    position: 'absolute',
                    left: o.x - CIRCLE_R * sc, top: o.y - CIRCLE_R * sc,
                    width: CIRCLE_R * 2 * sc, height: CIRCLE_R * 2 * sc,
                    borderRadius: CIRCLE_R * sc,
                    borderWidth: 2.5, borderColor: CIRCLE_COL, opacity: aOp,
                  }} />
                  {/* Hit circle */}
                  <View style={[styles.hitCircle, {
                    left: o.x - CIRCLE_R, top: o.y - CIRCLE_R,
                    opacity: o.state === 'hit' ? 0.25 : 1,
                  }]}>
                    <View style={styles.hitCircleGloss} />
                    <Text style={styles.objIcon}></Text>
                  </View>
                </View>
              );
            } else {
              // Multi-segment slider
              const sc    = approachScale(o.deadline);
              const aOp   = approachOpacity(o.deadline);
              const start = o.points[0];
              const end   = o.points[o.points.length - 1];
              const ball  = o.state === 'held' ? ptAt(o.points, o.progress) : null;

              return (
                <View key={o.id} pointerEvents="none" style={StyleSheet.absoluteFill}>

                  {/* Track for each segment */}
                  {o.points.slice(0, -1).map((pt, i) => {
                    const nx  = o.points[i + 1];
                    const dx  = nx.x - pt.x;
                    const dy  = nx.y - pt.y;
                    const len = Math.hypot(dx, dy);
                    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
                    const mx  = (pt.x + nx.x) / 2;
                    const my  = (pt.y + nx.y) / 2;
                    return (
                      <View key={i} style={{
                        position: 'absolute',
                        left: mx - len / 2, top: my - 10,
                        width: len, height: 20, borderRadius: 10,
                        backgroundColor: 'rgba(232,91,143,0.35)',
                        borderWidth: 1.5, borderColor: SLIDER_COL,
                        transform: [{ rotate: `${ang}deg` }],
                      }} />
                    );
                  })}

                  {/* Waypoint circles at bends */}
                  {o.points.slice(1, -1).map((pt, i) => (
                    <View key={`wp-${i}`} style={{
                      position: 'absolute',
                      left: pt.x - WAYPOINT_R, top: pt.y - WAYPOINT_R,
                      width: WAYPOINT_R * 2, height: WAYPOINT_R * 2,
                      borderRadius: WAYPOINT_R,
                      backgroundColor: 'rgba(232,91,143,0.45)',
                      borderWidth: 2, borderColor: SLIDER_COL,
                    }} />
                  ))}

                  {/* End cap */}
                  <View style={[styles.sliderEnd, { left: end.x - SLIDER_R, top: end.y - SLIDER_R }]} />

                  {/* Approach ring on start */}
                  <View style={{
                    position: 'absolute',
                    left: start.x - SLIDER_R * sc, top: start.y - SLIDER_R * sc,
                    width: SLIDER_R * 2 * sc, height: SLIDER_R * 2 * sc,
                    borderRadius: SLIDER_R * sc,
                    borderWidth: 2.5, borderColor: SLIDER_COL, opacity: aOp,
                  }} />

                  {/* Start circle */}
                  <View style={[styles.sliderStart, { left: start.x - SLIDER_R, top: start.y - SLIDER_R }]}>
                    <View style={styles.sliderStartGloss} />
                    <Text style={styles.objIcon}></Text>
                  </View>

                  {/* Drag ball */}
                  {ball && (
                    <View style={[styles.sliderBall, { left: ball.x - BALL_R, top: ball.y - BALL_R }]} />
                  )}
                </View>
              );
            }
          })}

          {parts.map(p => (
            <Animated.Text key={p.id} pointerEvents="none"
              style={[styles.particle, { left: p.x, top: p.y, opacity: p.opacity }]}>
              {p.label}
            </Animated.Text>
          ))}

          {/* Star burst — pops on every successful tap / hold / drag */}
          {stars.map(s => (
            <Animated.Text
              key={s.id}
              pointerEvents="none"
              style={[
                styles.starBit,
                {
                  left: s.x - 12, top: s.y - 12,
                  opacity: s.opacity,
                  transform: [...s.pos.getTranslateTransform(), { scale: s.scale }, { rotate: s.rotateDeg }],
                },
              ]}
            >
              ★
            </Animated.Text>
          ))}

          {/* Judgment text — PERFECT! / GREAT! / OK / NICE! */}
          {judgments.map(j => (
            <Animated.Text
              key={j.id}
              pointerEvents="none"
              style={[
                styles.judgmentText,
                {
                  left: j.x, top: j.y - 46, color: j.color,
                  opacity: j.opacity,
                  transform: [{ scale: j.scale }, { translateY: j.y2 }],
                },
              ]}
            >
              {j.label}
            </Animated.Text>
          ))}
        </View>
      )}

      {/* Red blare — flashes across the whole screen on a miss */}
      <Animated.View pointerEvents="none" style={[styles.missFlash, { opacity: missFlash }]} />

      {/* Continue prompt — shown after the 3rd miss, before the run actually ends */}
      {showContinue && (
        <View style={styles.continueOverlay}>
          <Image source={nubkinImgs.sad} style={styles.overlayNubkin} resizeMode="contain" />
          <Text style={styles.title}>Too Dirty!</Text>
          <Text style={styles.continueScore}>Score: {score}</Text>
          <Text style={styles.desc}>Keep scrubbing?</Text>
          <TouchableOpacity style={styles.continueBtn} onPress={watchAdToContinue}>
            <Text style={styles.continueBtnText}>▶  Watch Ad to Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueBtn, styles.continueBtnDiamond, diamonds < GAME_CONTINUE_DIAMONDS && styles.continueBtnDisabled]}
            onPress={spendDiamondsToContinue}
            disabled={diamonds < GAME_CONTINUE_DIAMONDS}
          >
            <Text style={styles.continueBtnText}>◆  Use {GAME_CONTINUE_DIAMONDS} Diamonds</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueSkip} onPress={declineContinue}>
            <Text style={styles.continueSkipText}>No thanks</Text>
          </TouchableOpacity>
        </View>
      )}

      <PauseOverlay visible={isPaused} onResume={resumeGame} onQuit={handleQuit} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  canvas: { width: SW, position: 'relative' },

  hud: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  hudLeft:   { flex: 1 },
  scoreText: {
    fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 20,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  comboText: { fontFamily: FONT, color: '#F39C12', fontWeight: '900', fontSize: 13 },

  missBar:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  missSlot:       { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: '#FFF' },
  missSlotFilled: { backgroundColor: '#E74C3C' },
  missLabel:      { fontSize: 16, marginLeft: 2 },
  pauseBtn:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  pauseIcon:      { color: '#FFF', fontSize: 16, fontWeight: '800' },

  nubkin: {
    position: 'absolute', width: 160, height: 160,
    bottom: 0, left: SW / 2 - 80,
  },

  hitCircle: {
    position: 'absolute',
    width: CIRCLE_R * 2, height: CIRCLE_R * 2, borderRadius: CIRCLE_R,
    backgroundColor: 'rgb(31, 107, 240)',
    borderWidth: 3, borderColor: CIRCLE_COL,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: CIRCLE_COL, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  hitCircleGloss: {
    position: 'absolute', top: 4, left: CIRCLE_R * 0.55,
    width: CIRCLE_R * 0.9, height: CIRCLE_R * 0.5, borderRadius: CIRCLE_R * 0.45,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  sliderStartGloss: {
    position: 'absolute', top: 4, left: SLIDER_R * 0.55,
    width: SLIDER_R * 0.9, height: SLIDER_R * 0.5, borderRadius: SLIDER_R * 0.45,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  sliderStart: {
    position: 'absolute',
    width: SLIDER_R * 2, height: SLIDER_R * 2, borderRadius: SLIDER_R,
    backgroundColor: 'rgb(238, 0, 87)',
    borderWidth: 3, borderColor: SLIDER_COL,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: SLIDER_COL, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  sliderEnd: {
    position: 'absolute',
    width: SLIDER_R * 2, height: SLIDER_R * 2, borderRadius: SLIDER_R,
    backgroundColor: 'rgb(255, 0, 93)',
    borderWidth: 2, borderColor: SLIDER_COL,
    shadowColor: SLIDER_COL, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  sliderBall: {
    position: 'absolute',
    width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 3, borderColor: SLIDER_COL,
    shadowColor: SLIDER_COL, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  starBit: {
    position: 'absolute', fontSize: 24, color: '#FFD34D',
    textShadowColor: 'rgba(200,120,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  judgmentText: {
    position: 'absolute', fontFamily: FONT, fontWeight: '900', fontSize: 22,
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  missFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF1A1A',
  },

  objIcon:  { fontSize: 22 },
  particle: {
    position: 'absolute', fontFamily: FONT, fontWeight: '800', fontSize: 15, color: '#FFF',
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.62)',
  },
  overlayNubkin: { width: 120, height: 120, marginBottom: 4 },
  title:         { fontFamily: FONT, color: '#EFEFFF', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  bigScore:      { fontFamily: FONT, color: '#F39C12', fontSize: 56, fontWeight: '900' },
  desc:          { fontFamily: FONT, color: '#CCCCEE', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  continueOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.78)',
  },
  continueScore: { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  continueBtn: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 20, width: '100%', alignItems: 'center', marginTop: 4,
  },
  continueBtnDiamond:  { backgroundColor: '#3498DB' },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 16 },
  continueSkip:     { marginTop: 2, padding: 8 },
  continueSkipText: { fontFamily: FONT, color: '#7777AA', fontSize: 14, fontWeight: '700' },

  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  legendDot:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  legendIcon:  { fontSize: 20 },
  legendLabel: { fontFamily: FONT, color: '#CCCCEE', fontSize: 13 },

  startBtn:     { backgroundColor: '#9B59B6', paddingHorizontal: 48, paddingVertical: 14, borderRadius: 24, marginTop: 6 },
  startBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 18 },

  foamLeft: {
    position: 'absolute', width: 100, height: 100,
    bottom: 50, left: SW / 2 - 150,
  },
  foamRight: {
    position: 'absolute', width: 100, height: 100,
    bottom: 50, left: SW / 2 + 50,
  },
});
