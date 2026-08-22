import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useGameStore } from '../store/useGameStore';
import { Creature } from '../types';

// Mirrors decay rates in useGameStore applyDecay
const DECAY = {
  hunger:    10, // pts per hour
  happiness:  5,
  energy:     6,
};

const THRESHOLDS = {
  hunger:    30,
  happiness: 30,
  energy:    20,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

async function requestPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nubkins', {
      name:      'Nubkin Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound:     'default',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleAll(creature: Creature) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const notifications: { seconds: number; title: string; body: string }[] = [];

  if (creature.hunger > THRESHOLDS.hunger) {
    const hours = (creature.hunger - THRESHOLDS.hunger) / DECAY.hunger;
    notifications.push({
      seconds: Math.max(60, Math.round(hours * 3600)),
      title:   'Your Nubkin is hungry! 🍎',
      body:    'Come back and feed them before they get too sad.',
    });
  }

  if (creature.happiness > THRESHOLDS.happiness) {
    const hours = (creature.happiness - THRESHOLDS.happiness) / DECAY.happiness;
    notifications.push({
      seconds: Math.max(60, Math.round(hours * 3600)),
      title:   'Your Nubkin misses you! 💙',
      body:    'Your Nubkin is feeling lonely. Come say hi!',
    });
  }

  if (creature.energy > THRESHOLDS.energy) {
    const hours = (creature.energy - THRESHOLDS.energy) / DECAY.energy;
    notifications.push({
      seconds: Math.max(60, Math.round(hours * 3600)),
      title:   'Your Nubkin is low on energy! ⚡',
      body:    'Energy is almost out — games will be locked soon. Come play before it runs dry!',
    });
  }

  for (const n of notifications) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, sound: true, ...(Platform.OS === 'android' && { channelId: 'nubkins' }) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: n.seconds },
    });
  }
}

export function useNotifications() {
  const creature  = useGameStore(s => s.creature);
  const appState  = useRef(AppState.currentState);
  const granted   = useRef(false);

  useEffect(() => {
    requestPermissions().then(ok => { granted.current = ok; });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (!granted.current) return;

      if (next === 'background') {
        scheduleAll(creature);
      }

      if (appState.current.match(/inactive|background/) && next === 'active') {
        Notifications.cancelAllScheduledNotificationsAsync();
      }

      appState.current = next;
    });
    return () => sub.remove();
  }, [creature]);
}
