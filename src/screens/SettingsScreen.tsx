import React, { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useGameStore } from '../store/useGameStore';
import { THEMES, CapsuleTheme, getThemeById } from '../data/themes';
import { MINI_GAMES } from '../data/minigames';
import { FONT } from '../lib/theme';

const APP_VERSION = '1.0.0';

const TUTORIAL_SECTIONS: { title: string; entries: { icon: string; name: string; desc: string }[] }[] = [
  {
    title: 'STATS',
    entries: [
      {
        icon: '🍔',
        name: 'Hunger',
        desc: 'How full your Nubkin is. Drops gradually over time. When it falls below 20%, your Nubkin gets sad and their mood sours. Feed them from the home screen to restore it!',
      },
      {
        icon: '😊',
        name: 'Happiness',
        desc: 'How joyful your Nubkin feels. Drops slowly over time and also below 20% causes a sad mood. Boost it by petting, feeding, or playing games together.',
      },
      {
        icon: '⚡',
        name: 'Energy',
        desc: 'Your Nubkin\'s stamina for activities. Each mini-game costs 10 energy. When it hits 0, all games are locked. Energy auto-refills to 80 after 15 minutes of rest.',
      },
      {
        icon: '🫧',
        name: 'Cleanliness',
        desc: 'How clean your Nubkin is. Drops slowly over time but doesn\'t directly affect mood. Play Bath Time in Activities to restore it fully and earn bonus XP!',
      },
    ],
  },
  {
    title: 'SLEEP',
    entries: [
      {
        icon: '💤',
        name: 'Falling Asleep',
        desc: 'After 5 hours without interaction (feeding, petting, cleaning, or playing), your Nubkin automatically falls asleep. The home screen locks and activities pause.',
      },
      {
        icon: '⏰',
        name: 'Waking Up',
        desc: 'Tap "Wake Up" on the home screen and pay 30 coins to wake your Nubkin early. Energy slowly recovers while they sleep and they\'ll auto-wake when restored to 80.',
      },
      {
        icon: '⚡',
        name: 'Energy vs. Sleep',
        desc: 'Energy and sleep are separate! Running out of energy only locks games for 15 minutes — it doesn\'t make your Nubkin sleep. Sleep is purely about how long they\'ve been left alone.',
      },
    ],
  },
  {
    title: 'MOODS',
    entries: [
      {
        icon: '😄',
        name: 'Happy',
        desc: 'Happiness is above 80%. Your Nubkin is thriving! They bob and glow with joy. Keep all stats healthy to stay here.',
      },
      {
        icon: '😐',
        name: 'Neutral',
        desc: 'Stats are in a decent range. Things are fine but your Nubkin could use a little more love and attention.',
      },
      {
        icon: '😢',
        name: 'Sad',
        desc: 'Hunger or happiness dropped below 20%. Your Nubkin tilts and shows a "..." bubble. Feed them, pet them, or play a game to cheer them up!',
      },
      {
        icon: '💤',
        name: 'Sleeping',
        desc: 'Your Nubkin fell asleep after 5 hours of inactivity. A lock overlay appears on their screen. Pay 30 coins to wake them early, or wait for natural recovery.',
      },
    ],
  },
  {
    title: 'CURRENCY',
    entries: [
      {
        icon: '🪙',
        name: 'Coins',
        desc: 'The main currency. Earned from playing games, daily check-ins, and streak bonuses. Spend on food, waking Nubkin early, and most shop items.',
      },
      {
        icon: '💎',
        name: 'Diamonds',
        desc: 'Premium currency. Earned from daily login rewards and reaching milestone levels (every 5 levels). Used to buy rare and legendary cosmetics in the Shop.',
      },
    ],
  },
  {
    title: 'ACTIVITIES',
    entries: [
      {
        icon: '🎮',
        name: 'Daily Plays',
        desc: 'Each game has a limited number of free plays per day. When you run out, watch an ad to unlock extra plays (once per game per day). Plays reset at midnight.',
      },
      {
        icon: '📺',
        name: 'Watch Ads',
        desc: 'Watching a rewarded ad unlocks 3 bonus plays for a game. Ads are optional — if you\'ve removed ads, plays still have a daily limit.',
      },
      {
        icon: '⚡',
        name: 'Energy Cost',
        desc: 'Every game play costs 10 energy. When energy hits 0, all games show "Tired" and are locked until energy recharges (15 minutes). Plan your sessions wisely!',
      },
    ],
  },
  {
    title: 'PROGRESSION',
    entries: [
      {
        icon: '📅',
        name: 'Daily Check-In',
        desc: 'Open the app every day to collect coins + diamonds. Your streak increases each consecutive day — longer streaks earn bigger bonuses (up to +100 bonus coins)!',
      },
      {
        icon: '⭐',
        name: 'XP & Leveling',
        desc: 'Earn XP from feeding (+5), petting (+2), cleaning (+3), and playing games. Level up to unlock new cosmetics in the shop and earn diamond rewards at milestones.',
      },
      {
        icon: '👗',
        name: 'Cosmetics',
        desc: 'Visit the Shop to buy skins, accessories, tattoos, and special items. Some items are locked behind a level requirement. Achievement items unlock automatically by hitting game score goals.',
      },
    ],
  },
];
const PRIVACY_URL = 'https://www.theamuletstudios.com/privacy-policy';
const TERMS_URL   = 'https://www.theamuletstudios.com/terms-of-service';

// ── Mini capsule card inside the modal ───────────────
function ThemeCard({ theme, selected, locked, onSelect }: {
  theme: CapsuleTheme;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected, locked && styles.cardLocked]}
      onPress={onSelect}
      activeOpacity={locked ? 0.6 : 0.8}
    >
      <View style={[styles.miniCapsule, { backgroundColor: theme.shell, opacity: locked ? 0.4 : 1 }]}>
        <View style={[styles.miniLed, { backgroundColor: theme.led }]} />
        <View style={[styles.miniBezel, { backgroundColor: theme.bezel }]}>
          <View style={[styles.miniLcd, { backgroundColor: theme.screen }]}>
            <View style={[styles.miniXp, { backgroundColor: theme.xpBar }]} />
          </View>
        </View>
        <View style={[styles.miniPanel, { backgroundColor: theme.panel }]}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.miniBtn, { backgroundColor: theme.btn }]} />
          ))}
        </View>
      </View>
      <Text style={[styles.themeName, locked && { opacity: 0.5 }]}>{theme.emoji} {theme.name}</Text>
      {selected && !locked && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedCheck}>✓</Text>
        </View>
      )}
      {locked && (
        <View style={styles.lockBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Reusable section wrapper ──────────────────────────
function Section({ label, children, bare }: { label: string; children: React.ReactNode; bare?: boolean }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <View style={bare ? styles.sectionBodyBare : styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Tappable row ─────────────────────────────────────
function Row({
  label, value, onPress, last,
}: {
  label: string; value?: string; onPress?: () => void; last?: boolean;
}) {
  const Inner = (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value !== undefined && (
        <Text style={[styles.rowValue, onPress && styles.rowValueTappable]}>{value}</Text>
      )}
      {onPress && <Text style={styles.rowChevron}>›</Text>}
    </View>
  );

  if (!onPress) return Inner;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {Inner}
    </TouchableOpacity>
  );
}

// ── Volume dots widget ────────────────────────────────
const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1];

function VolumeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const idx = VOLUME_STEPS.reduce((best, s, i) =>
    Math.abs(s - value) < Math.abs(VOLUME_STEPS[best] - value) ? i : best, 0);

  return (
    <View style={styles.volRow}>
      <TouchableOpacity
        onPress={() => idx > 0 && onChange(VOLUME_STEPS[idx - 1])}
        style={styles.volBtn}
        activeOpacity={0.6}
      >
        <Text style={styles.volBtnText}>−</Text>
      </TouchableOpacity>
      <View style={styles.volDots}>
        {VOLUME_STEPS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => onChange(VOLUME_STEPS[i])}>
            <View style={[styles.volDot, i <= idx && styles.volDotFilled]} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => idx < VOLUME_STEPS.length - 1 && onChange(VOLUME_STEPS[idx + 1])}
        style={styles.volBtn}
        activeOpacity={0.6}
      >
        <Text style={styles.volBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────
export default function SettingsScreen() {
  const themeId           = useGameStore(s => s.themeId);
  const setTheme          = useGameStore(s => s.setTheme);
  const ownedCosmeticIds  = useGameStore(s => s.profile.ownedCosmeticIds);
  const bgmEnabled        = useGameStore(s => s.bgmEnabled);
  const bgmVolume         = useGameStore(s => s.bgmVolume);
  const sfxEnabled        = useGameStore(s => s.sfxEnabled);
  const setBgmEnabled     = useGameStore(s => s.setBgmEnabled);
  const setBgmVolume      = useGameStore(s => s.setBgmVolume);
  const setSfxEnabled     = useGameStore(s => s.setSfxEnabled);
  const gainDiamonds      = useGameStore(s => s.gainDiamonds);
  const refillPlays       = useGameStore(s => s.refillPlays);
  const [themeModalOpen,   setThemeModalOpen]   = useState(false);
  const [tutorialOpen,     setTutorialOpen]     = useState(false);
  const [notifStatus, setNotifStatus]       = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
    });
  }, []);

  async function handleNotifToggle(enable: boolean) {
    if (enable) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
      if (status === 'denied') {
        Alert.alert(
          'Notifications Blocked',
          'Open your device Settings to allow notifications for Nubkins.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      }
    } else {
      Alert.alert(
        'Turn Off Notifications',
        'To disable notifications, open your device Settings.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  }

  function isThemeLocked(id: string) {
    const FREE_THEMES = new Set([
      'lemon-pop', 'candy-shell', 'ocean-toy', 'berry-punch',
      'mint-dream', 'sunset-blaze', 'galaxy-night', 'cherry-blossom'
    ]);
    if (FREE_THEMES.has(id)) return false;
    return !ownedCosmeticIds.includes(id);
  }

  const activeTheme = getThemeById(themeId);

  return (
    <ImageBackground
      source={require('../../assets/bg/settingsbg.png')}
      style={styles.bgImage}
      resizeMode="stretch"
    >
      <View style={styles.bgOverlay} />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Capsule */}
        <Section label="CAPSULE">
          <Row
            label="Capsule Theme"
            value={`${activeTheme.emoji} ${activeTheme.name}`}
            onPress={() => setThemeModalOpen(true)}
            last
          />
        </Section>

        {/* Audio */}
        <Section label="AUDIO" bare>
          <View style={styles.audioWrap}>
            <View style={[styles.row, styles.rowSwitch, !bgmEnabled && styles.rowLast]}>
              <Text style={styles.rowLabel}>Background Music</Text>
              <Switch
                value={bgmEnabled}
                onValueChange={setBgmEnabled}
                trackColor={{ false: '#2A2A50', true: '#9B59B6' }}
                thumbColor="#FFFFFF"
              />
            </View>
            {bgmEnabled && (
              <View style={[styles.row, styles.rowSwitch, styles.rowLast]}>
                <Text style={styles.rowLabel}>BGM Volume</Text>
                <VolumeControl value={bgmVolume} onChange={setBgmVolume} />
              </View>
            )}
          </View>
          <View style={[styles.audioWrap, { marginTop: 8 }]}>
            <View style={[styles.row, styles.rowSwitch, styles.rowLast]}>
              <Text style={styles.rowLabel}>Sound Effects</Text>
              <Switch
                value={sfxEnabled}
                onValueChange={setSfxEnabled}
                trackColor={{ false: '#2A2A50', true: '#9B59B6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Section>

        {/* Notifications */}
        <Section label="NOTIFICATIONS" bare>
          <View style={styles.audioWrap}>
            <View style={[styles.row, styles.rowSwitch, styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Play Reminders</Text>
                <Text style={styles.rowSub}>Alerts when your Nubkin needs care</Text>
              </View>
              <Switch
                value={notifStatus === 'granted'}
                onValueChange={handleNotifToggle}
                trackColor={{ false: '#2A2A50', true: '#9B59B6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Section>

        {/* Help */}
        <Section label="HELP">
          <Row
            label="How to Play"
            value="Guide ›"
            onPress={() => setTutorialOpen(true)}
            last
          />
        </Section>

        {/* Legal */}
        <Section label="LEGAL">
          <Row
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Row
            label="Terms of Service"
            onPress={() => Linking.openURL(TERMS_URL)}
            last
          />
        </Section>

        {/* App */}
        <Section label="APP">
          <Row label="Version" value={APP_VERSION} last />
        </Section>

        {/* Dev-only test tools — stripped from release builds */}
        {__DEV__ && (
          <Section label="DEV TOOLS">
            <Row
              label="Add 10,000 Diamonds"
              onPress={() => gainDiamonds(10000)}
            />
            <Row
              label="Refill All Game Plays"
              onPress={() => MINI_GAMES.forEach(g => refillPlays(g.id))}
              last
            />
          </Section>
        )}
      </ScrollView>

      {/* ── Capsule theme picker modal ── */}
      <Modal
        visible={themeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setThemeModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setThemeModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Capsule Theme</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {THEMES.map(theme => {
                  const locked = isThemeLocked(theme.id);
                  return (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      selected={themeId === theme.id}
                      locked={locked}
                      onSelect={() => {
                        if (locked) {
                          Alert.alert('Locked', `Buy ${theme.name} in the Shop to unlock this theme.`);
                          return;
                        }
                        setTheme(theme.id);
                        setThemeModalOpen(false);
                      }}
                    />
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── Tutorial / How to Play modal ── */}
      <Modal
        visible={tutorialOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTutorialOpen(false)}
      >
        <View style={styles.tutBackdrop}>
          <View style={styles.tutSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>How to Play</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tutScroll}>
              {TUTORIAL_SECTIONS.map(section => (
                <View key={section.title} style={styles.tutSection}>
                  <Text style={styles.tutSectionTitle}>{section.title}</Text>
                  {section.entries.map(entry => (
                    <View key={entry.name} style={styles.tutEntry}>
                      <Text style={styles.tutEntryIcon}>{entry.icon}</Text>
                      <View style={styles.tutEntryBody}>
                        <Text style={styles.tutEntryName}>{entry.name}</Text>
                        <Text style={styles.tutEntryDesc}>{entry.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.tutCloseBtn} onPress={() => setTutorialOpen(false)} activeOpacity={0.8}>
              <Text style={styles.tutCloseBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage:   { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(240, 240, 245, 0.47)' },
  safe:      { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 48 },

  pageTitle: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 28,
  },

  // ── SECTIONS ─────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionLabelWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: FONT,
    color: '#111111',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  sectionBodyBare: {
    gap: 0,
  },
  audioWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#000000',
  },

  // ── ROWS ─────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#252548',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontFamily: FONT,
    color: '#121212',
    fontSize: 15,
    flex: 1,
  },
  rowValue: {
    fontFamily: FONT,
    color: '#555577',
    fontSize: 14,
    marginRight: 6,
  },
  rowSub: {
    fontFamily: FONT,
    color: '#888899',
    fontSize: 11,
    marginTop: 2,
  },
  rowValueTappable: {
    color: '#9B59B6',
  },
  rowChevron: {
    color: '#555577',
    fontSize: 20,
    lineHeight: 22,
  },

  // ── SWITCH ROW ───────────────────────────────────────
  rowSwitch: {
    justifyContent: 'space-between',
  },

  // ── VOLUME CONTROL ────────────────────────────────────
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEEEF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    lineHeight: 22,
  },
  volDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  volDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CCCCDD',
  },
  volDotFilled: {
    backgroundColor: '#9B59B6',
  },

  // ── MODAL ────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#13132A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#070707',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONT,
    color: '#070707',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },

  // ── THEME GRID ────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    width: '47%',
    backgroundColor: '#1A1A35',
    borderRadius: 18,
    padding: 12,
    borderWidth: 2,
    borderColor: '#2A2A50',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#9B59B6',
    backgroundColor: '#1E1040',
  },
  cardLocked: {
    borderColor: '#2A2A50',
    backgroundColor: '#111128',
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  lockIcon: {
    fontSize: 14,
  },

  // ── MINI CAPSULE PREVIEW ──────────────────────────────
  miniCapsule: {
    width: '100%',
    height: 110,
    borderRadius: 18,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  miniLed: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniBezel: {
    width: '100%',
    borderRadius: 10,
    padding: 4,
    flex: 1,
    marginBottom: 6,
  },
  miniLcd: {
    flex: 1,
    borderRadius: 7,
    padding: 4,
    justifyContent: 'flex-end',
  },
  miniXp: {
    height: 3,
    width: '60%',
    borderRadius: 2,
  },
  miniPanel: {
    width: '100%',
    borderRadius: 10,
    height: 22,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  miniBtn: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // ── CARD LABEL ────────────────────────────────────────
  themeName: {
    fontFamily: FONT,
    color: '#EFEFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── TUTORIAL MODAL ───────────────────────────────────
  tutBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  tutSheet: {
    backgroundColor: '#f7f7fc',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '92%',
  },
  tutScroll: {
    paddingBottom: 8,
  },
  tutSection: {
    marginBottom: 22,
  },
  tutSectionTitle: {
    fontFamily: FONT,
    color: '#9B59B6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A50',
  },
  tutEntry: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  tutEntryIcon: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
    lineHeight: 32,
  },
  tutEntryBody: {
    flex: 1,
  },
  tutEntryName: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  tutEntryDesc: {
    fontFamily: FONT,
    color: '#000000',
    fontSize: 12,
    lineHeight: 19,
  },
  tutCloseBtn: {
    backgroundColor: '#9B59B6',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  tutCloseBtnText: {
    fontFamily: FONT,
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },

  // ── SELECTED BADGE ────────────────────────────────────
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9B59B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
