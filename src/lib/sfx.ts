import { Audio } from 'expo-av';
import { useGameStore } from '../store/useGameStore';

// One-shot sound effect — respects the Sound Effects toggle in Settings.
export function playSfx(sound: Audio.Sound | null) {
  if (!sound || !useGameStore.getState().sfxEnabled) return;
  sound.replayAsync();
}

// Continuous/looping sound effect (e.g. NubCatch's vacuum) — start/resume respect
// the toggle, but pause/stop always run so playback can't get stuck on when disabled mid-loop.
export function startLoopSfx(sound: Audio.Sound | null) {
  if (!sound || !useGameStore.getState().sfxEnabled) return;
  sound.replayAsync();
}

export function resumeLoopSfx(sound: Audio.Sound | null) {
  if (!sound || !useGameStore.getState().sfxEnabled) return;
  sound.playAsync();
}
