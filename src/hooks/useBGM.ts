import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useGameStore } from '../store/useGameStore';

export function useBGM() {
  // Released automatically when the app root unmounts.
  const player        = useAudioPlayer(require('../../assets/bgm/nubkins.m4a'));
  const isPlayingGame = useGameStore(s => s.isPlayingGame);
  const bgmEnabled    = useGameStore(s => s.bgmEnabled);
  const bgmVolume     = useGameStore(s => s.bgmVolume);

  // Refs so the AppState handler always sees current values without stale closure
  const bgmEnabledRef    = useRef(bgmEnabled);
  const isPlayingGameRef = useRef(isPlayingGame);
  useEffect(() => { bgmEnabledRef.current = bgmEnabled; },    [bgmEnabled]);
  useEffect(() => { isPlayingGameRef.current = isPlayingGame; }, [isPlayingGame]);

  useEffect(() => {
    // Play even with the iPhone's silent switch on (same as before with expo-av).
    setAudioModeAsync({ playsInSilentMode: true });
    player.loop = true;

    // When the app returns to the foreground, iOS/Android may have paused the audio
    // stream. Re-play if the user had BGM enabled and isn't mid-game.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && bgmEnabledRef.current && !isPlayingGameRef.current) {
        player.play();
      }
    });
    return () => sub.remove();
  }, [player]);

  // Pause/resume based on game state and BGM toggle. This also starts the music
  // once the store has loaded the saved bgmEnabled setting.
  useEffect(() => {
    if (!bgmEnabled || isPlayingGame) player.pause();
    else player.play();
  }, [player, bgmEnabled, isPlayingGame]);

  // Apply volume changes live
  useEffect(() => {
    player.volume = bgmVolume;
  }, [player, bgmVolume]);
}
