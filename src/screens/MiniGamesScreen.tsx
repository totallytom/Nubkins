import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore, ENERGY_RECHARGE_MINUTES } from '../store/useGameStore';
import { MINI_GAMES } from '../data/minigames';
import { MiniGameId } from '../types';
import CoinDisplay from '../components/CoinDisplay';
import TooltipCard from '../components/TooltipCard';
import { useTooltip } from '../hooks/useTooltip';
import { FONT } from '../lib/theme';
import { getThemeById } from '../data/themes';
import { useAds, AD_PLAY_REWARD } from '../hooks/useAds';
import GemCrush      from './games/GemCrush';
import BathTime      from './games/BathTime';
import NubkinJump    from './games/NubkinJump';

const { width: SCREEN_W } = Dimensions.get('window');
const FEAT_W = (SCREEN_W - 48) / 2;

type ActiveGame = MiniGameId | null;

const MAIN_IDS: MiniGameId[] = ['gem-crush', 'bath-time', 'nubkin-jump'];

const FEAT_ACCENT: Record<string, string> = {
  'gem-crush':   '#9B59B6',
  'bath-time':   '#2980B9',
  'nubkin-jump': '#E74C3C',
};

const GAME_IMG: Record<string, ReturnType<typeof require>> = {
  'gem-crush':   require('../../assets/dooyoo/Dooyoo-happy.png'),
  'bath-time':   require('../../assets/minigame_items/foam-left.png'),
  'nubkin-jump': require('../../assets/minigame_items/stump.png'),
};

// Achievement reward previews — standalone graphics shown on the game card
const ACHIEVEMENT_REWARD: Record<string, ReturnType<typeof require>> = {
  'gem-crush': require('../../assets/custom-items/Amu.png'),
  'bath-time': require('../../assets/custom-items/EarthBall.png'),
};

function badgeColor(left: number, max: number) {
  if (left === 0)   return '#E74C3C';
  if (left === max) return '#27AE60';
  return '#F39C12';
}

export default function MiniGamesScreen() {
  const navigation = useNavigation<any>();
  const profile              = useGameStore(s => s.profile);
  const creature              = useGameStore(s => s.creature);
  const recordGamePlay        = useGameStore(s => s.recordGamePlay);
  const playsLeftToday        = useGameStore(s => s.playsLeftToday);
  const addPlays              = useGameStore(s => s.addPlays);
  const hasWatchedAdForGame   = useGameStore(s => s.hasWatchedAdForGame);
  const markAdWatchedForGame  = useGameStore(s => s.markAdWatchedForGame);
  const cleanCreature         = useGameStore(s => s.cleanCreature);
  const themeId               = useGameStore(s => s.themeId);
  const setIsPlayingGame      = useGameStore(s => s.setIsPlayingGame);
  const incrementAdSessionCount = useGameStore(s => s.incrementAdSessionCount);
  const { adsRemoved, showRewardedAd, showInterstitialAd } = useAds();
  const activeTheme = getThemeById(themeId);
  const insets = useSafeAreaInsets();
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [resultModal, setResultModal] = useState<{
    gameId: MiniGameId; score: number; coins: number; xp: number;
  } | null>(null);

  // Runs on every way a game session can end — finished, lost, or quit
  // mid-play — so the forced interstitial cadence counts them all the same.
  // Persisted via the store so the count survives app restarts.
  function exitGame() {
    const count = incrementAdSessionCount();
    if (count % 3 === 0) showInterstitialAd();
    setActiveGame(null);
    setIsPlayingGame(false);
  }

  function handleGameFinish(gameId: MiniGameId, score: number) {
    // score < 0 means the player quit via pause — close silently, no save
    if (score < 0) {
      exitGame();
      return;
    }
    const safeScore = Math.max(0, score);
    let coins: number;
    let xp: number;
    if (gameId === 'gem-crush') {
      coins = Math.min(500, Math.floor(safeScore / 5));
      xp    = Math.min(500, Math.floor(safeScore / 5));
    } else if (gameId === 'obstacle-dash') {
      coins = Math.min(300, safeScore); // 1 coin per second survived, cap 300
      xp    = Math.min(300, safeScore);
    } else {
      const def = MINI_GAMES.find(g => g.id === gameId)!;
      coins = Math.min(300, Math.round(def.baseCoinsPerPlay * (1 + safeScore * 0.05)));
      xp    = Math.min(300, Math.round(def.baseXpPerPlay    * (1 + safeScore * 0.02)));
    }
    recordGamePlay(gameId, score, coins, xp);
    if (gameId === 'bath-time') cleanCreature();
    exitGame();
    setResultModal({ gameId, score, coins, xp });
  }

  function handleWatchAd(gameId: MiniGameId) {
    showRewardedAd(() => {
      addPlays(gameId, AD_PLAY_REWARD);
      markAdWatchedForGame(gameId);
      setActiveGame(gameId);
      setIsPlayingGame(true);
    }, () => {
      Alert.alert('Ad Not Available', 'No ad is available right now. Please try again in a moment.');
    });
  }

  const mainGames = MINI_GAMES.filter(g => MAIN_IDS.includes(g.id));

  const noEnergy = creature.energy <= 0;
  const activitiesTooltip = useTooltip('first_activities');
  const energyTooltip     = useTooltip('energy_depleted', noEnergy);

  return (
    <ImageBackground
      source={require('../../assets/bg/minigamebg.png')}
      style={styles.bgImage}
      resizeMode="stretch"
      imageStyle={{ opacity: 0.45 }}
    >
      <View style={styles.bgOverlay} />
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Full-screen game modal */}
      <Modal visible={activeGame !== null} animationType="slide" statusBarTranslucent onRequestClose={exitGame}>
        <View style={[styles.gameModal, { paddingTop: insets.top }]}>
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 60 }]} onPress={exitGame}>
            <Text style={styles.backBtnText}>X Quit</Text>
          </TouchableOpacity>
          {activeGame === 'gem-crush'   && <GemCrush   level={creature.level} onFinish={s => handleGameFinish('gem-crush',   s)} />}
          {activeGame === 'bath-time'   && <BathTime   level={creature.level} onFinish={s => handleGameFinish('bath-time',   s)} />}
          {activeGame === 'nubkin-jump' && <NubkinJump level={creature.level} onFinish={s => handleGameFinish('nubkin-jump', s)} />}
        </View>
      </Modal>

      {/* Result modal */}
      <Modal visible={resultModal !== null} transparent animationType="fade" onRequestClose={() => setResultModal(null)}>
        <Pressable style={styles.resultBackdrop} onPress={() => setResultModal(null)}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Game Over!</Text>
            <Text style={styles.resultScore}>Score: {resultModal?.score ?? 0}</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>+{resultModal?.coins} coins</Text>
              <Text style={styles.rewardItem}>+{resultModal?.xp} XP</Text>
            </View>
            <Text style={styles.resultPet}>
              {resultModal?.gameId === 'bath-time'
                ? `${creature.name} is sparkling clean!`
                : `${creature.name} loved playing!`}
            </Text>
            <TouchableOpacity style={styles.resultBtn} onPress={() => setResultModal(null)}>
              <Text style={styles.resultBtnText}>Sweet!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>Activities</Text>
            <Text style={styles.subtitle}>Play to earn coins & XP</Text>
          </View>
          <CoinDisplay coins={profile.coins} diamonds={profile.diamonds} />
        </View>

        {/* Energy depleted — prompt to use the Happy Potion */}
        {noEnergy && (
          <TouchableOpacity
            style={styles.energyBanner}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}
          >
            <Text style={styles.energyBannerIcon}>🧪</Text>
            <View style={styles.energyBannerText}>
              <Text style={styles.energyBannerTitle}>Unlock Happy Potion to wake your Nubkin!</Text>
              <Text style={styles.energyBannerSub}>250 coins · restores energy</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Best scores banner */}
        {Object.keys(profile.highScores).length > 0 && (
          <View style={styles.hsBanner}>
            <Text style={styles.hsBannerTitle}> Your Best Scores</Text>
            <View style={styles.hsRow}>
              {mainGames.filter(g => profile.highScores[g.id]).map(g => (
                <View key={g.id} style={styles.hsPill}>
                  <Text style={styles.hsGame}>{g.name}</Text>
                  <Text style={styles.hsVal}>{profile.highScores[g.id]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Main games (2-col) ── */}
        <View style={styles.labelWrapper}><Text style={styles.sectionLabel}>Main Games</Text></View>
        <View style={styles.featGrid}>
          {mainGames.map(game => {
            const left       = playsLeftToday(game.id);
            const exhausted  = left === 0;
            const adWatched  = hasWatchedAdForGame(game.id);
            const canWatchAd = exhausted && !adWatched && !adsRemoved;
            const doneForDay = exhausted && (adWatched || adsRemoved);
            const accent     = FEAT_ACCENT[game.id] ?? '#9B59B6';
            const bc         = badgeColor(left, game.maxPlaysPerDay);
            return (
              <TouchableOpacity
                key={game.id}
                style={[styles.featCard, (doneForDay || noEnergy) && styles.cardFaded]}
                onPress={() => {
                  if (noEnergy) return;
                  if (!exhausted) { setActiveGame(game.id); setIsPlayingGame(true); }
                  else if (canWatchAd) { handleWatchAd(game.id); }
                }}
                activeOpacity={0.78}
              >
                {/* Coloured banner */}
                <View style={[styles.featBanner, { backgroundColor: accent + '30' }]}>
                  {GAME_IMG[game.id]
                    ? <Image source={GAME_IMG[game.id]} style={styles.featBannerImg} resizeMode="contain" />
                    : <Text style={styles.featEmoji}>{game.emoji}</Text>
                  }
                  {ACHIEVEMENT_REWARD[game.id] && (
                    <View style={styles.achieveBadge}>
                      <Image source={ACHIEVEMENT_REWARD[game.id]} style={styles.achieveImg} resizeMode="contain" />
                    </View>
                  )}
                </View>

                <View style={styles.featBody}>
                  <Text style={styles.featName}>{game.name}</Text>
                  <Text style={styles.featDesc} numberOfLines={2}>{game.description}</Text>

                  <View style={styles.chips}>
                    <Text style={styles.chip}>{game.baseCoinsPerPlay}+ coins</Text>
                    <Text style={styles.chip}>{game.baseXpPerPlay}+ XP</Text>
                  </View>

                  <View style={styles.featFooter}>
                    <View style={[styles.badge, { borderColor: bc, backgroundColor: bc + '22' }]}>
                      <Text style={[styles.badgeNum, { color: bc }]}>{left}</Text>
                      <Text style={styles.badgeSub}>left</Text>
                    </View>
                    {doneForDay
                      ? <View style={[styles.playBtn, { backgroundColor: '#888' }]}>
                          <Text style={styles.playBtnText}>Tomorrow</Text>
                        </View>
                      : noEnergy
                        ? <View style={[styles.playBtn, styles.energyBtn]}>
                            <Text style={styles.playBtnText}>⚡ Tired</Text>
                          </View>
                        : canWatchAd
                          ? <View style={[styles.playBtn, styles.adBtn]}>
                              <Text style={styles.playBtnText}>📺 +{AD_PLAY_REWARD}</Text>
                            </View>
                          : <View style={[styles.playBtn, { backgroundColor: accent }]}>
                              <Text style={styles.playBtnText}>Play</Text>
                            </View>
                    }
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.footer}>Plays reset at midnight</Text>
      </ScrollView>

      <TooltipCard
        visible={activitiesTooltip.visible}
        icon="🎮"
        title="Welcome to Activities!"
        message="Each game costs 10 energy and earns coins & XP. You get limited plays per day — watch an ad to unlock more!"
        onDismiss={activitiesTooltip.dismiss}
      />
      <TooltipCard
        visible={energyTooltip.visible}
        icon="⚡"
        title="Nubkin is too tired!"
        message={`Games are locked when energy hits 0. Energy auto-refills to 80 after ${ENERGY_RECHARGE_MINUTES} minutes of rest.`}
        onDismiss={energyTooltip.dismiss}
      />

    </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage:   { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  safe:      { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 16, paddingBottom: 48 },

  // Header
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  title:    { fontFamily: FONT, color: '#000', fontSize: 26, fontWeight: '900' },
  subtitle: { fontFamily: FONT, color: '#555', fontSize: 10, marginTop: 2 },
  titleWrapper: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  labelWrapper: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgb(255, 255, 255)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 6,
    marginBottom: 8,
  },

  // Best scores
  hsBanner:      { backgroundColor: '#ecebe5c2', borderColor: 'black', borderRadius: 16, padding: 14, marginBottom: 20 },
  hsBannerTitle: { fontFamily: FONT, color: '#01010c', fontWeight: '700', fontSize: 14, marginBottom: 10 },
  hsRow:         { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  hsPill:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, gap: 6 },
  hsGame:        { fontFamily: FONT, color: '#555577', fontWeight: '700', fontSize: 11 },
  hsVal:         { fontFamily: FONT, color: '#000000', fontWeight: '800', fontSize: 15 },

  // Section labels
  sectionLabel: { fontFamily: FONT, color: '#111', fontWeight: '900', fontSize: 15 },
  sectionSub:   { fontFamily: FONT, color: '#555', fontSize: 11, marginTop: 2 },

  // Featured 2-col grid
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 2 },
  featCard: {
    width: FEAT_W,
    backgroundColor: '#f7f8be',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D52',
    overflow: 'hidden',
  },
  featBanner:    { height: 100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  achieveBadge:  { position: 'absolute', top: 6, right: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  achieveImg:    { width: 30, height: 30 },
  featEmoji:     { fontSize: 46 },
  featBannerImg: { width: 80, height: 80 },
  featBody:   { padding: 12, gap: 5 },
  featName:   { fontFamily: FONT, color: '#000002', fontWeight: '800', fontSize: 14 },
  featDesc:   { fontFamily: FONT, color: '#00000c', fontSize: 11, lineHeight: 15 },
  featFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  // Shared atoms
  chips:      { flexDirection: 'row', gap: 5, marginTop: 2 },
  chip:       { fontFamily: FONT, color: '#070707', fontSize: 10, fontWeight: '700', backgroundColor: '#ffffff', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  badge:      { alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeNum:   { fontFamily: FONT, fontWeight: '900', fontSize: 17 },
  badgeSub:   { fontFamily: FONT, color: '#7777AA', fontSize: 10 },
  playBtn:    { backgroundColor: '#06f197', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  playBtnText:{ fontFamily: FONT, color: '#000000', fontWeight: '800', fontSize: 12 },
  adBtn:      { backgroundColor: '#E67E22' },
  doneText:   { fontFamily: FONT, color: '#555577', fontSize: 10, textAlign: 'center' },
  cardFaded:  { opacity: 0.42 },

  footer: { fontFamily: FONT, color: '#555577', fontSize: 12, textAlign: 'center', marginTop: 16 },

  // Energy depleted
  energyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F39C12',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 16,
  },
  energyBannerIcon:  { fontSize: 22 },
  energyBannerText:  { flex: 1 },
  energyBannerTitle: { fontFamily: FONT, color: '#B7770D', fontWeight: '800', fontSize: 17 },
  energyBannerSub:   { fontFamily: FONT, color: '#9E6B00', fontSize: 13, marginTop: 1 },
  energyBtn:         { backgroundColor: '#888' },

  // Game modal
  gameModal:   { flex: 1, backgroundColor: '#0F0F23' },
  backBtn:     { position: 'absolute', right: 16, zIndex: 10, backgroundColor: '#1A1A35', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  backBtnText: { fontFamily: FONT, color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Result modal
  resultBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  resultCard:     { backgroundColor: '#1A1A35', borderRadius: 24, padding: 28, alignItems: 'center', width: '80%', gap: 12, borderWidth: 1, borderColor: '#3D3D6B' },
  resultTitle:    { fontFamily: FONT, color: '#EFEFFF', fontSize: 26, fontWeight: '900' },
  resultScore:    { fontFamily: FONT, color: '#F39C12', fontSize: 20, fontWeight: '800' },
  rewardRow:      { flexDirection: 'row', gap: 20 },
  rewardItem:     { fontFamily: FONT, color: '#CCCCEE', fontSize: 16, fontWeight: '700' },
  resultPet:      { fontFamily: FONT, color: '#9B59B6', fontSize: 14, fontStyle: 'italic' },
  resultBtn:      { backgroundColor: '#9B59B6', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 18, marginTop: 4 },
  resultBtnText:  { fontFamily: FONT, color: '#FFF', fontWeight: '800', fontSize: 16 },
});
