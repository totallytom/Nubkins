import { AudioPlayer } from 'expo-audio';
import { useGameStore } from '../store/useGameStore';

// Sound effects are expo-audio players created per screen with `useAudioPlayer`
// (which releases them automatically on unmount); these helpers play them.

// One-shot sound effect — respects the Sound Effects toggle in Settings.
// Rewinds first so rapid repeats (pops, jumps) restart instead of being ignored.
export function playSfx(player: AudioPlayer | null) {
  if (!player || !useGameStore.getState().sfxEnabled) return;
  player.seekTo(0);
  player.play();
}

// Continuous/looping sound effect — start/resume respect the toggle, but
// pausing always works so playback can't get stuck on when disabled mid-loop.
export function startLoopSfx(player: AudioPlayer | null) {
  if (!player || !useGameStore.getState().sfxEnabled) return;
  player.loop = true;
  player.seekTo(0);
  player.play();
}

export function resumeLoopSfx(player: AudioPlayer | null) {
  if (!player || !useGameStore.getState().sfxEnabled) return;
  player.play();
}
