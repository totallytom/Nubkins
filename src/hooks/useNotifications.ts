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
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
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

// A few variants per reminder, keyed by the pet's name, so notifications feel
// like they come from *your* Nubkin rather than a generic system alert.
type Message = { title: string; body: string };
const MESSAGES: Record<'hunger' | 'happiness' | 'energy', ((n: string) => Message)[]> = {
  hunger: [
    n => ({ title: `${n} is hungry! 🍎`,          body: `${n}'s tummy is rumbling… come share a snack!` }),
    n => ({ title: `${n} is waiting by the bowl 🥺`, body: `Just a little something to eat? ${n} would love that.` }),
    n => ({ title: `Snack time for ${n}? 🍓`,       body: `${n} is dreaming about food. Come feed them!` }),
  ],
  happiness: [
    n => ({ title: `${n} misses you! 💙`,           body: `${n} keeps looking at the door. Come say hi!` }),
    n => ({ title: `${n} wants a pet 🫶`,           body: `A few head pats would make ${n}'s whole day.` }),
    n => ({ title: `Where did you go? 🥺`,          body: `${n} is feeling a little lonely without you.` }),
  ],
  energy: [
    n => ({ title: `${n} is getting sleepy ⚡`,      body: `${n}'s energy is almost out — come play before naptime!` }),
    n => ({ title: `${n} wants one more game! 🎮`,   body: `Energy is running low. Play with ${n} while they're still awake!` }),
  ],
};

function pick(kind: keyof typeof MESSAGES, name: string): Message {
  const pool = MESSAGES[kind];
  return pool[Math.floor(Math.random() * pool.length)](name);
}

async function scheduleAll(creature: Creature) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const name = creature.name || 'Your Nubkin';
  const notifications: ({ seconds: number } & Message)[] = [];

  if (creature.hunger > THRESHOLDS.hunger) {
    const hours = (creature.hunger - THRESHOLDS.hunger) / DECAY.hunger;
    notifications.push({ seconds: Math.max(60, Math.round(hours * 3600)), ...pick('hunger', name) });
  }

  if (creature.happiness > THRESHOLDS.happiness) {
    const hours = (creature.happiness - THRESHOLDS.happiness) / DECAY.happiness;
    notifications.push({ seconds: Math.max(60, Math.round(hours * 3600)), ...pick('happiness', name) });
  }

  if (creature.energy > THRESHOLDS.energy) {
    const hours = (creature.energy - THRESHOLDS.energy) / DECAY.energy;
    notifications.push({ seconds: Math.max(60, Math.round(hours * 3600)), ...pick('energy', name) });
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
