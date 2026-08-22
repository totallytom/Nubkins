import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import { useGameStore } from '../store/useGameStore';

export function useBGM() {
  const soundRef      = useRef<Audio.Sound | null>(null);
  const isPlayingGame = useGameStore(s => s.isPlayingGame);
  const bgmEnabled    = useGameStore(s => s.bgmEnabled);
  const bgmVolume     = useGameStore(s => s.bgmVolume);

  // Refs so the AppState handler always sees current values without stale closure
  const bgmEnabledRef    = useRef(bgmEnabled);
  const isPlayingGameRef = useRef(isPlayingGame);
  useEffect(() => { bgmEnabledRef.current = bgmEnabled; },    [bgmEnabled]);
  useEffect(() => { isPlayingGameRef.current = isPlayingGame; }, [isPlayingGame]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/bgm/nubkins.m4a'),
        { isLooping: true, shouldPlay: false, volume: bgmVolume },
      );
      if (cancelled) {
        sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
      // Check current state after the async gap — the store may have loaded from
      // AsyncStorage and changed bgmEnabled since the effect first ran.
      if (bgmEnabledRef.current && !isPlayingGameRef.current) {
        sound.playAsync();
      }
    }

    setup();

    // When the app returns to the foreground, iOS/Android may have paused the audio
    // stream. Re-play if the user had BGM enabled and isn't mid-game.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const sound = soundRef.current;
        if (sound && bgmEnabledRef.current && !isPlayingGameRef.current) {
          sound.playAsync();
        }
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  // Pause/resume based on game state and BGM toggle
  useEffect(() => {
    const sound = soundRef.current;
    if (!sound) return;
    if (!bgmEnabled || isPlayingGame) {
      sound.pauseAsync();
    } else {
      sound.playAsync();
    }
  }, [bgmEnabled, isPlayingGame]);

  // Apply volume changes live
  useEffect(() => {
    soundRef.current?.setVolumeAsync(bgmVolume);
  }, [bgmVolume]);
}
