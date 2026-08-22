import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, SLEEP_WAKE_COST, SLEEP_WAKE_ENERGY } from '../store/useGameStore';
import { CreatureMood } from '../types';
import NubkinCreature, { type NubkinCreatureRef } from '../components/NubkinCreature';
import CoinDisplay from '../components/CoinDisplay';
import { FOOD_ITEMS } from '../data/food';
import { getCosmeticById } from '../data/cosmetics';
import { FONT, FONT_MARU } from '../lib/theme';
import { getThemeById, CapsuleTheme } from '../data/themes';
import DailyStreakModal from '../components/DailyStreakModal';
import TooltipCard from '../components/TooltipCard';
import { useTooltip } from '../hooks/useTooltip';

function deriveMood(hunger: number, happiness: number, _energy: number, sleepingSince: string | null): CreatureMood {
  if (sleepingSince) {
    const hoursAsleep = (Date.now() - new Date(sleepingSince).getTime()) / 3_600_000;
    if (hoursAsleep >= 15) return 'sad';
    if (hoursAsleep >= 10) return 'neutral';
    return 'sleeping';
  }
  if (hunger < 20 || happiness < 20) return 'sad';
  if (happiness > 80) return 'happy';
  return 'neutral';
}

function statFillColor(value: number, baseColor: string): string {
  if (value < 25) return '#E74C3C';
  if (value < 50) return '#F0984A';
  return baseColor;
}

function MiniStat({ icon, value, color, trackColor }: { icon: string; value: number; color: string; trackColor: string }) {
  const fillColor  = statFillColor(value, color);
  const isCritical = value < 25;
  return (
    <View style={styles.miniStatItem}>
      <Text style={[styles.miniStatIcon, isCritical && { color: '#E74C3C' }]}>{icon}</Text>
      <View style={[styles.miniStatTrack, { backgroundColor: trackColor }]}>
        <View style={[styles.miniStatFill, { width: `${Math.round(value)}%`, backgroundColor: fillColor }]} />
      </View>
      {isCritical && <View style={styles.miniStatAlert} />}
    </View>
  );
}

const MOOD_PHRASES: Record<string, string> = {
  happy:    'I feel great today!',
  excited:  'That was SO fun!!',
  neutral:  "I'm doing okay~",
  sad:      'I need some love...',
  sleeping: 'Zzz...',
};

function MoodBadge({ mood }: { mood: string }) {
  const phrase = MOOD_PHRASES[mood] ?? MOOD_PHRASES.neutral;
  return (
    <View style={styles.speechWrap}>
      <View style={styles.speechBubble}>
        <Text style={styles.speechText}>{phrase}</Text>
      </View>
      <View style={styles.speechTailOuter} />
      <View style={styles.speechTailInner} />
    </View>
  );
}

function CapsuleButton({
  emoji, imageSource, label, onPress, large, theme, disabled,
}: {
  emoji?: string; imageSource?: any; label: string; onPress: () => void; large?: boolean; theme: CapsuleTheme; disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (disabled) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 20, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 25 }),
    ]).start();
    onPress();
  }

  const btnSize = large ? 72 : 58;

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={[styles.capsuleBtnWrap, disabled && { opacity: 0.35 }]}>
        <Animated.View style={[
          styles.capsuleBtn,
          {
            width: btnSize, height: btnSize, borderRadius: btnSize / 2,
            backgroundColor: theme.btn,
            borderTopColor: theme.btnLight,
            borderLeftColor: theme.btnMid,
            borderRightColor: theme.btnDark,
            borderBottomColor: theme.btnDeep,
            transform: [{ scale }],
          },
        ]}>
          <View style={styles.capsuleBtnSheen} />
          {imageSource ? (
            <Image source={imageSource} style={[styles.capsuleBtnImg, large && styles.capsuleBtnImgLg]} resizeMode="contain" />
          ) : (
            <Text style={[styles.capsuleBtnEmoji, large && styles.capsuleBtnEmojiLg]}>{emoji}</Text>
          )}
        </Animated.View>
        <Text style={styles.capsuleBtnLabel}>{label}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const COIN_N = 10;

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const creature         = useGameStore(s => s.creature);
  const profile           = useGameStore(s => s.profile);
  const petCreature       = useGameStore(s => s.petCreature);
  const feedCreature      = useGameStore(s => s.feedCreature);
  const wakeCreature      = useGameStore(s => s.wakeCreature);
  const checkIn           = useGameStore(s => s.checkIn);
  const levelUpEvent      = useGameStore(s => s.levelUpEvent);
  const clearLevelUpEvent = useGameStore(s => s.clearLevelUpEvent);
  const themeId           = useGameStore(s => s.themeId);
  const theme = getThemeById(themeId);
  const [feedModalOpen, setFeedModalOpen]   = useState(false);
  const [toastMsg, setToastMsg]             = useState('');
  const [streakResult, setStreakResult]     = useState<{
    streak: number; coinsEarned: number; diamondsEarned: number; streakBonus: number;
  } | null>(null);
  const [streakVisible, setStreakVisible]   = useState(false);
  const toastAnim    = useRef(new Animated.Value(0)).current;
  const [petCount, setPetCount] = useState(0);
  const creatureRef  = useRef<NubkinCreatureRef>(null);
  const coinShowerPendingRef = useRef(false);
  const [showerActive, setShowerActive] = useState(false);
  const lockAnim    = useRef(new Animated.Value(0)).current;
  const lockScale   = useRef(new Animated.Value(0.8)).current;
  const lockPulse   = useRef(new Animated.Value(1)).current;
  const lockLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const coinParticles = useRef(
    Array.from({ length: COIN_N }, () => {
      const y         = new Animated.Value(-60);
      const x         = new Animated.Value(0);
      const opacity   = new Animated.Value(0);
      const rotate    = new Animated.Value(0);
      const rotateDeg = rotate.interpolate({ inputRange: [-360, 0, 360], outputRange: ['-360deg', '0deg', '360deg'] });
      return { y, x, opacity, rotate, rotateDeg };
    })
  ).current;

  const [overrideMood, setOverrideMood] = useState<CreatureMood | null>(null);
  const mood      = overrideMood ?? deriveMood(creature.hunger, creature.happiness, creature.energy, creature.sleepingSince ?? null);
  const equippedAcc        = creature.equippedAccessoryId ? getCosmeticById(creature.equippedAccessoryId) : null;
  const accessory           = equippedAcc?.emoji ?? null;
  const accessoryImage      = equippedAcc?.image ?? null;
  const accessoryImageStyle = equippedAcc?.imageStyle ?? null;
  const equippedTattoo      = creature.equippedTattooId ? getCosmeticById(creature.equippedTattooId) : null;
  const tattooImage         = equippedTattoo?.image ?? undefined;
  const tattooImageStyle    = equippedTattoo?.imageStyle ?? undefined;
  const equippedSpecial     = creature.equippedSpecialId ? getCosmeticById(creature.equippedSpecialId) : null;
  const specialImage        = equippedSpecial?.image ?? undefined;
  const specialImageStyle   = equippedSpecial?.imageStyle ?? undefined;
  const xpPct = creature.xpToNext > 0 ? creature.xp / creature.xpToNext : 1;

  function startCoinShower() {
    setShowerActive(true);
    const anims = coinParticles.map((c, i) => {
      const startX = -160 + Math.random() * 320;
      const delay  = i * 90 + Math.random() * 60;
      const dir    = Math.random() > 0.5 ? 1 : -1;
      c.y.setValue(-60); c.x.setValue(startX); c.opacity.setValue(0); c.rotate.setValue(0);
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(c.opacity, { toValue: 1,          duration: 200,  useNativeDriver: true }),
          Animated.timing(c.y,       { toValue: 750,        duration: 1500, useNativeDriver: true }),
          Animated.timing(c.rotate,  { toValue: 360 * dir,  duration: 1500, useNativeDriver: true }),
        ]),
        Animated.timing(c.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]);
    });
    Animated.parallel(anims).start(() => setShowerActive(false));
  }

  useEffect(() => {
    (async () => {
      const result = await checkIn();
      setStreakResult({
        streak:         result.streak,
        coinsEarned:    result.coinsEarned,
        diamondsEarned: result.diamondsEarned,
        streakBonus:    result.streakBonus,
      });
      if (result.isNew) {
        setStreakVisible(true);
        coinShowerPendingRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!streakVisible && coinShowerPendingRef.current) {
      coinShowerPendingRef.current = false;
      startCoinShower();
    }
  }, [streakVisible]);

  useEffect(() => {
    if (levelUpEvent) {
      showToast(`Level ${levelUpEvent.level}! +${levelUpEvent.diamonds} diamonds`);
      clearLevelUpEvent();
      creatureRef.current?.celebrate();
    }
  }, [levelUpEvent]);

  function showToast(msg: string) {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }

  function flashMood(m: CreatureMood, ms = 1500) {
    setOverrideMood(m);
    setTimeout(() => setOverrideMood(null), ms);
  }

  function handleTap() {
    petCreature();
    flashMood('happy');
    setPetCount(c => c + 1);
    if ((petCount + 1) % 5 === 0) showToast(`${creature.name} loves you!`);
  }

  const isSleeping   = mood === 'sleeping';
  const sleepTooltip = useTooltip('first_sleep', isSleeping);

  function handleWakeUp() {
    const ok = wakeCreature();
    if (ok) {
      flashMood('happy');
      showToast(`${creature.name} woke up!`);
    } else {
      showToast(`Need ${SLEEP_WAKE_COST} coins to wake up!`);
    }
  }

  useEffect(() => {
    if (isSleeping) {
      Animated.parallel([
        Animated.timing(lockAnim,  { toValue: 1,   duration: 450, useNativeDriver: true }),
        Animated.spring(lockScale, { toValue: 1,   useNativeDriver: true, speed: 10, bounciness: 14 }),
      ]).start();
      lockLoopRef.current?.stop();
      lockLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(lockPulse, { toValue: 1.2,  duration: 900, useNativeDriver: true }),
        Animated.timing(lockPulse, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      ]));
      lockLoopRef.current.start();
    } else {
      Animated.parallel([
        Animated.timing(lockAnim,  { toValue: 0,   duration: 300, useNativeDriver: true }),
        Animated.timing(lockScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]).start();
      lockLoopRef.current?.stop();
      lockLoopRef.current = null;
      lockPulse.setValue(1);
    }
  }, [isSleeping]);

  function handleFeed(foodId: string) {
    const food = FOOD_ITEMS.find(f => f.id === foodId);
    if (!food) return;
    const ok = feedCreature(food.hungerRestore, food.happinessBonus, food.coinCost, food.energyRestore);
    if (ok) {
      flashMood('excited');
      showToast(`${creature.name} ate ${food.name}!`);
      setFeedModalOpen(false);
      creatureRef.current?.feedJump();
    } else {
      showToast(`Not enough coins!`);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.pageBg }]} edges={['top']}>
      <View style={styles.container}>

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.streakBtn}
            onPress={() => setStreakVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.streakBtnText}>Daily Streaks {profile.checkInStreak}</Text>
          </TouchableOpacity>
          <CoinDisplay coins={profile.coins} diamonds={profile.diamonds} />
        </View>

        {/* ══ CAPSULE DEVICE ══ */}
        <View style={styles.capsuleWrapper}>

          {/* Keychain ring at the top */}
          <View style={[styles.keychainRing, { borderColor: theme.keychain }]} />

          {/* Device shell */}
          <View style={styles.capsuleOutline}>
          <View style={[styles.capsule, {
            backgroundColor: theme.shell,
            borderTopColor: theme.shellLight,
            borderLeftColor: theme.shellMid,
            borderRightColor: theme.shellDark,
            borderBottomColor: theme.shellDeep,
          }]}>

            {/* Speaker dots + LED */}
            <View style={styles.topDecoRow}>
              <View style={[styles.ledGreen, { backgroundColor: theme.led, shadowColor: theme.led }]} />
              <View style={styles.speakerGroup}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={[styles.speakerDot, { backgroundColor: theme.speaker }]} />
                ))}
              </View>
            </View>

            {/* ── SCREEN ── */}
            <View style={[styles.screenBezel, { backgroundColor: theme.bezel }]}>
              <View style={[styles.screen, { backgroundColor: theme.screen }]}>

                {/* Brand + stats wrapper */}
                <View style={[styles.statsBrandWrap, {
                  backgroundColor: theme.statsPanelBg,
                  borderColor: theme.statsPanelBorder,
                }]}>
                  <View style={styles.brandRow}>
                    <Text style={styles.brandTag}>NUBKINS</Text>
                    <Text style={styles.screenLvl}>Lv.{creature.level}</Text>
                  </View>
                  <View style={styles.statGrid}>
                    <View style={styles.statRow}>
                      <MiniStat icon="🍔" value={creature.hunger}      color="#F39C12" trackColor={theme.statTrack} />
                      <MiniStat icon="😊" value={creature.happiness}   color="#9B59B6" trackColor={theme.statTrack} />
                    </View>
                    <View style={styles.statRow}>
                      <MiniStat icon="⚡" value={creature.energy}      color="#3498DB" trackColor={theme.statTrack} />
                      <MiniStat icon="🫧" value={creature.cleanliness} color="#1ABC9C" trackColor={theme.statTrack} />
                    </View>
                  </View>
                </View>

                {/* Mood badge */}
                <MoodBadge mood={mood} />

                {/* Creature zone */}
                <View style={styles.creatureZone}>
                  <View style={styles.creatureScale}>
                    <NubkinCreature
                      ref={creatureRef}
                      mood={mood}
                      skinId={creature.equippedSkinId}
                      accessoryEmoji={accessory}
                      accessoryImage={accessoryImage}
                      accessoryImageStyle={accessoryImageStyle ?? undefined}
                      tattooImage={tattooImage}
                      tattooImageStyle={tattooImageStyle}
                      specialImage={specialImage}
                      specialImageStyle={specialImageStyle}
                      onTap={isSleeping ? handleWakeUp : handleTap}
                    />
                  </View>
                  <View style={[styles.screenFloor, { backgroundColor: theme.screenFloor }]} />
                </View>

                {/* XP bar */}
                <View style={styles.xpRow}>
                  <View style={[styles.xpTrack, { backgroundColor: theme.statTrack }]}>
                    <View style={[styles.xpFill, { width: `${Math.round(xpPct * 100)}%`, backgroundColor: theme.xpBar }]} />
                  </View>
                  <Text style={styles.xpText}>{creature.xp}/{creature.xpToNext} XP</Text>
                </View>

                {/* Sleep lock overlay — covers the whole screen when Nubkin is asleep */}
                <Animated.View
                  style={[StyleSheet.absoluteFillObject, styles.sleepLock, { opacity: lockAnim }]}
                  pointerEvents={isSleeping ? 'auto' : 'none'}
                >
                  <TouchableOpacity style={styles.sleepLockInner} onPress={handleWakeUp} activeOpacity={0.85}>
                    <Animated.Text style={[styles.sleepLockIcon, { transform: [{ scale: lockPulse }, { scale: lockScale }] }]}>
                      🔒
                    </Animated.Text>
                    <Text style={styles.sleepLockTitle}>Fast Asleep</Text>
                    <View style={styles.sleepLockBadge}>
                      <Text style={styles.sleepLockBadgeText}>Wake Up · 30 </Text>
                      <Image source={require('../../assets/currency/Coin.png')} style={styles.sleepLockCoinImg} resizeMode="contain" />
                    </View>
                  </TouchableOpacity>
                </Animated.View>

              </View>
            </View>
            {/* ── END SCREEN ── */}

            {/* Physical seam */}
            <View style={[styles.seam, { backgroundColor: theme.seam, borderTopColor: theme.seamHighlight }]} />

            {/* ── EMBEDDED BUTTONS ── */}
            <View style={[styles.btnPanel, {
              backgroundColor: theme.panel,
              borderTopColor: theme.panelLight,
              borderLeftColor: theme.panelMid,
              borderRightColor: theme.panelDark,
              borderBottomColor: theme.panelDeep,
            }]}>
              <CapsuleButton imageSource={require('../../assets/custom-items/Feed.png')}          label="Feed"     onPress={() => setFeedModalOpen(true)} theme={theme} disabled={isSleeping} />
              {isSleeping ? (
                <CapsuleButton emoji="⏰" label={`Wake (${SLEEP_WAKE_COST}c)`} onPress={handleWakeUp} large theme={theme} />
              ) : (
                <CapsuleButton imageSource={require('../../assets/nubkins/Nubkin1-Happy.png')}  label="Pet"      onPress={handleTap} large theme={theme} />
              )}
              <CapsuleButton imageSource={require('../../assets/custom-items/nubkin_witchhat5.png')} label="Wardrobe" onPress={() => navigation.navigate('Wardrobe')} theme={theme} disabled={isSleeping} />
            </View>

          </View>
          </View>{/* capsuleOutline */}
        </View>
        {/* ══ END CAPSULE ══ */}

        <Animated.View style={[
          styles.toast,
          {
            opacity: toastAnim,
            transform: [{
              translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
            }],
          },
        ]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>

      </View>

      {/* Feed Modal */}
      <Modal
        visible={feedModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setFeedModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Feed {creature.name}</Text>
            <Text style={styles.modalSub}>You have {profile.coins} coins</Text>
            <ScrollView>
              {FOOD_ITEMS.map(food => (
                <TouchableOpacity key={food.id} style={styles.foodRow} onPress={() => handleFeed(food.id)}>
                  {food.image
                    ? <Image source={food.image} style={styles.foodImg} resizeMode="contain" />
                    : <Text style={styles.foodEmoji}>{food.emoji}</Text>
                  }
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={styles.foodStats}>+{food.hungerRestore} hunger  +{food.happinessBonus} happy</Text>
                  </View>
                  <View style={styles.foodCost}>
                    <Text style={styles.foodCostText}>{food.coinCost} coins</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Daily Streak Modal */}
      {streakResult && (
        <DailyStreakModal
          visible={streakVisible}
          streak={streakResult.streak}
          coinsEarned={streakResult.coinsEarned}
          diamondsEarned={streakResult.diamondsEarned}
          streakBonus={streakResult.streakBonus}
          onCollect={() => setStreakVisible(false)}
        />
      )}

      <TooltipCard
        visible={sleepTooltip.visible}
        icon="💤"
        title="Nubkin fell asleep!"
        message={`After 5 hours without interaction, Nubkin needs rest. Tap Wake Up to pay ${SLEEP_WAKE_COST} coins, or wait for energy to restore naturally.`}
        onDismiss={sleepTooltip.dismiss}
      />

      {/* Coin shower overlay — fires after streak modal closes */}
      {showerActive && (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {coinParticles.map((c, i) => (
            <Animated.Image
              key={i}
              source={require('../../assets/currency/Coin.png')}
              style={[styles.coinParticle, {
                opacity:   c.opacity,
                transform: [{ translateX: c.x }, { translateY: c.y }, { rotate: c.rotateDeg }],
              }]}
              resizeMode="contain"
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#1C1917' },
  container:     { flex: 1 },
  coinParticle:  { position: 'absolute', width: 28, height: 28, top: 0, left: '50%' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  streakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fcfaf8',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#F39C12',
  },
  streakBtnText: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── CAPSULE SHELL ─────────────────────────────────
  capsuleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  keychainRing: {
    width: 36,
    height: 19,
    borderRadius: 18,
    borderWidth: 5,
    borderColor: '#B45309',
    backgroundColor: 'transparent',
    marginBottom: -6,
    zIndex: 2,
  },
  capsuleOutline: {
    borderWidth: 6,
    borderColor: '#0D0D0D',
    borderRadius: 56,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 16 },
    shadowOpacity: 0.95,
    shadowRadius: 22,
    elevation: 24,
  },
  capsule: {
    width: 340,
    backgroundColor: '#FACC15',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    borderWidth: 3,
    borderTopColor: '#FDE047',
    borderLeftColor: '#EAB308',
    borderRightColor: '#A16207',
    borderBottomColor: '#78350F',
  },

  // ── TOP DECO ROW ──────────────────────────────────
  topDecoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 14,
  },
  ledGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F43F5E',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  speakerGroup: {
    flexDirection: 'row',
    gap: 3,
  },
  speakerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A16207',
  },
  statsBrandWrap: {
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAB308',
    padding: 10,
    marginBottom: 6,
  },
  brandTag: {
    fontFamily: FONT_MARU,
    color: '#121212',
    fontSize:12,
    letterSpacing: 4,
    fontWeight: '700',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  // ── SCREEN ───────────────────────────────────────
  screenBezel: {
    backgroundColor: '#FEF9C3',
    borderRadius: 32,
    padding: 8,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  screen: {
    backgroundColor: '#78a77a',
    borderRadius: 26,
    padding: 14,
    overflow: 'hidden',
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  screenName: {
    fontFamily: FONT,
    color: '#C9A0EE',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  screenLvl: {
    fontFamily: FONT,
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── MINI STATS ────────────────────────────────────
  statGrid: { marginBottom: 6 },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  miniStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatIcon: {
    fontSize: 11,
    width: 20,
    textAlign: 'center',
  },
  miniStatTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#2D2060',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniStatFill: {
    height: '100%',
    borderRadius: 3,
  },
  miniStatAlert: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E74C3C',
    marginLeft: 3,
  },

  // ── MOOD SPEECH BUBBLE ────────────────────────────
  speechWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1A1A3A',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  speechText: {
    fontFamily: FONT,
    color: '#1A1A3A',
    fontSize: 12,
    fontWeight: '700',
  },
  speechTailOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A3A',
  },
  speechTailInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -8,
  },

  // ── CREATURE ZONE ─────────────────────────────────
  creatureZone: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  moodBubbleText: {
    fontFamily: FONT,
    color: '#C9A0EE',
    fontSize: 11,
  },
  sleepProgressTrack: {
    height: 3,
    backgroundColor: '#2D2060',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
    width: 80,
  },
  sleepProgressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 2,
  },
  creatureScale: {
    transform: [{ scale: 0.9 }],
  },
  screenFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2D2060',
    borderRadius: 2,
  },

  // ── XP ───────────────────────────────────────────
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  xpTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#2D2060',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#FACC15',
    borderRadius: 3,
  },
  xpText: {
    fontFamily: FONT,
    color: '#A78BFA',
    fontSize: 9,
  },

  // ── SEAM ─────────────────────────────────────────
  seam: {
    height: 3,
    backgroundColor: '#B45309',
    borderTopWidth: 1,
    borderTopColor: '#FDE047',
    marginHorizontal: -6,
    marginBottom: 18,
  },

  // ── BUTTON PANEL ─────────────────────────────────
  btnPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#EC4899',
    borderRadius: 36,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2.5,
    borderTopColor: '#F9A8D4',
    borderLeftColor: '#F472B6',
    borderRightColor: '#BE185D',
    borderBottomColor: '#9D174D',
  },
  capsuleBtnWrap: {
    alignItems: 'center',
    gap: 6,
  },
  capsuleBtn: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2.5,
    borderTopColor: '#F3F4F6',
    borderLeftColor: '#E5E7EB',
    borderRightColor: '#9CA3AF',
    borderBottomColor: '#6B7280',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
  },
  capsuleBtnPrimary: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#F3F4F6',
    borderLeftColor: '#E5E7EB',
    borderRightColor: '#9CA3AF',
    borderBottomColor: '#6B7280',
  },
  capsuleBtnSheen: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  capsuleBtnEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  capsuleBtnEmojiLg: {
    fontSize: 28,
  },
  capsuleBtnImg: {
    width: 45,
    height: 45,
  },
  capsuleBtnImgLg: {
    width: 34,
    height: 34,
  },
  capsuleBtnLabel: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── TOAST ────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#2D2D4E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: {
    fontFamily: FONT,
    color: '#EFEFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── MODAL ────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(46, 45, 45, 0.05)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#eeeeee',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3D3D6B',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: FONT,
    color: '#7777AA',
    fontSize: 13,
    marginBottom: 16,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b8b8f1',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  foodEmoji: { fontFamily: FONT, fontSize: 32 },
  foodImg:   { width: 40, height: 40 },
  foodInfo:  { flex: 1 },
  foodName:  { fontFamily: FONT, color: '#EFEFFF', fontWeight: '700', fontSize: 15 },
  foodStats: { fontFamily: FONT, color: '#7777AA', fontSize: 12, marginTop: 2 },
  foodCost:  { backgroundColor: '#14142A', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  foodCostText: { fontFamily: FONT, color: '#F39C12', fontWeight: '700', fontSize: 13 },

  // ── SLEEP LOCK OVERLAY ────────────────────────────
  sleepLock: {
    backgroundColor: 'rgba(8,4,28,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepLockInner: {
    alignItems: 'center',
    gap: 10,
  },
  sleepLockIcon: {
    fontSize: 52,
  },
  sleepLockTitle: {
    fontFamily: FONT,
    color: '#C9A0EE',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sleepLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginTop: 2,
    shadowColor: '#3498DB',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  sleepLockBadgeText: {
    fontFamily: FONT,
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  sleepLockCoinImg: { width: 18, height: 18 },
});
