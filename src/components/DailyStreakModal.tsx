import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONT, KAWAII, KAWAII_BTN } from '../lib/theme';
import { getSkinImages } from '../lib/skinImages';
import { useGameStore } from '../store/useGameStore';

// Coins earned on each day of a 7-day cycle (streak bonus = min(day*10, 100))
const DAY_COINS = [40, 50, 60, 70, 80, 90, 130];

const COIN_IMG    = require('../../assets/currency/Coin.png');
const DIAMOND_IMG = require('../../assets/currency/Diamond.png');

interface SlotProps {
  day: number;
  state: 'done' | 'today' | 'future';
  glowAnim: Animated.Value;
}

function DaySlot({ day, state, glowAnim }: SlotProps) {
  const isDone   = state === 'done';
  const isToday  = state === 'today';
  const isFuture = state === 'future';

  const glowStyle = isToday
    ? {
        shadowColor: '#FFB300',
        shadowOpacity: glowAnim as unknown as number,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }
    : {};

  return (
    <Animated.View
      style={[
        styles.slot,
        isDone   && styles.slotDone,
        isToday  && styles.slotToday,
        isFuture && styles.slotFuture,
        glowStyle,
      ]}
    >
      {isDone ? (
        <Text style={styles.slotCheck}>✓</Text>
      ) : (
        <Text style={[styles.slotDay, isFuture && styles.slotDayFuture]}>
          {day === 7 ? '👑' : `${day}`}
        </Text>
      )}
      {day === 7 ? (
        <Text style={[styles.slotReward, isFuture && styles.slotRewardFuture]}>👑</Text>
      ) : (
        <View style={styles.slotRewardRow}>
          <Text style={[styles.slotReward, isFuture && styles.slotRewardFuture]}>
            +{DAY_COINS[day - 1]}
          </Text>
          <Image
            source={COIN_IMG}
            style={[styles.slotCoinImg, isFuture && { opacity: 0.3 }]}
            resizeMode="contain"
          />
        </View>
      )}
      {isToday && <Text style={styles.slotTodayLabel}>TODAY</Text>}
    </Animated.View>
  );
}

interface Props {
  visible:       boolean;
  streak:        number;
  coinsEarned:   number;
  diamondsEarned:number;
  streakBonus:   number;
  onCollect:     () => void;
}

export default function DailyStreakModal({
  visible, streak, coinsEarned, diamondsEarned, streakBonus, onCollect,
}: Props) {
  const equippedSkinId = useGameStore(s => s.creature.equippedSkinId);
  const nubkinImgs     = getSkinImages(equippedSkinId);

  const cardAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const nubkinY  = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) return;
    cardAnim.setValue(0);
    nubkinY.setValue(20);

    Animated.parallel([
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
      Animated.spring(nubkinY,  { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();

    // Pulsing glow on the today slot
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, [visible]);

  // Which position in the 7-day cycle is today?
  const weekPos = ((streak - 1) % 7) + 1; // 1-7

  const cardStyle = {
    opacity:   cardAnim,
    transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCollect}>
        <Pressable onPress={() => {}}>
          <Animated.View style={[styles.card, cardStyle]}>

            {/* Nubkin */}
            <Animated.Image
              source={nubkinImgs.excited}
              style={[styles.nubkin, { transform: [{ translateY: nubkinY }] }]}
              resizeMode="contain"
            />

            {/* Header */}
            <Text style={styles.fireRow}>🔥 {streak}-Day Streak! 🔥</Text>
            <Text style={styles.title}>Daily Reward</Text>

            {/* 7-day grid */}
            <View style={styles.slotsRow}>
              {[1, 2, 3, 4, 5, 6, 7].map(day => {
                const state =
                  day < weekPos  ? 'done'   :
                  day === weekPos ? 'today'  : 'future';
                return (
                  <DaySlot
                    key={day}
                    day={day}
                    state={state}
                    glowAnim={glowAnim}
                  />
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Rewards earned today */}
            <Text style={styles.earnedLabel}>You earned today</Text>
            <View style={styles.rewardsRow}>
              <View style={styles.rewardPill}>
                <Text style={styles.rewardAmount}>+{coinsEarned}</Text>
                <Image source={COIN_IMG} style={styles.rewardIconImg} resizeMode="contain" />
              </View>
              <View style={[styles.rewardPill, styles.rewardPillDiamond]}>
                <Text style={styles.rewardAmount}>+{diamondsEarned}</Text>
                <Image source={DIAMOND_IMG} style={styles.rewardIconImg} resizeMode="contain" />
              </View>
            </View>
            {streakBonus > 0 && (
              <Text style={styles.bonusNote}>Includes +{streakBonus} streak bonus!</Text>
            )}

            {/* Collect button */}
            <TouchableOpacity style={styles.collectBtn} onPress={onCollect} activeOpacity={0.8}>
              <Text style={styles.collectText}>Collect!</Text>
            </TouchableOpacity>

            {/* Come back tomorrow */}
            <Text style={styles.footer}>Come back tomorrow for Day {weekPos < 7 ? weekPos + 1 : 1}!</Text>

          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: KAWAII.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: KAWAII.card,
    borderRadius: 44,
    borderWidth: 5,
    borderColor: KAWAII.cardBorder,
    padding: 24,
    paddingTop: 12,
    alignItems: 'center',
    width: 340,
    gap: 10,
  },

  nubkin: {
    width: 110,
    height: 110,
    marginBottom: -8,
  },

  fireRow: {
    fontFamily: FONT,
    color: KAWAII.orange,
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },

  // ── 7-day slots ───────────────────────────────────────────────────────────
  slotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  slot: {
    width: 40,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFC2E0',
    backgroundColor: '#FFFFFF',
  },
  slotDone: {
    borderColor: '#3CC48A',
    backgroundColor: '#C8F5E1',
  },
  slotToday: {
    borderColor: '#F5A300',
    backgroundColor: '#FFE98A',
  },
  slotFuture: {
    borderColor: '#E9DDEE',
    backgroundColor: '#F6F0F8',
    opacity: 0.85,
  },
  slotCheck: {
    color: '#1F8F5F',
    fontSize: 16,
    fontWeight: '900',
  },
  slotDay: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  slotDayFuture: {
    color: '#A08AA6',
  },
  slotRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  slotReward: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  slotRewardFuture: {
    color: '#A08AA6',
  },
  slotCoinImg: {
    width: 9,
    height: 9,
  },
  slotTodayLabel: {
    fontFamily: FONT,
    color: KAWAII.orange,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Rewards ───────────────────────────────────────────────────────────────
  divider: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFC2E0',
    marginVertical: 2,
  },
  earnedLabel: {
    fontFamily: FONT,
    color: KAWAII.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1B8',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F5A300',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rewardPillDiamond: {
    backgroundColor: '#EADFFF',
    borderColor: '#9B6BFF',
  },
  rewardAmount: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  rewardIconImg: {
    width: 26,
    height: 26,
  },
  bonusNote: {
    fontFamily: FONT,
    color: KAWAII.orange,
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.85,
  },

  // ── Collect button ────────────────────────────────────────────────────────
  collectBtn: {
    ...KAWAII_BTN,
    backgroundColor: KAWAII.pink,
    paddingHorizontal: 52,
    paddingVertical: 14,
    marginTop: 4,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  collectText: {
    fontFamily: FONT,
    color: KAWAII.ink,
    fontWeight: '900',
    fontSize: 18,
  },
  footer: {
    fontFamily: FONT,
    color: KAWAII.inkSoft,
    fontSize: 11,
    textAlign: 'center',
  },
});
