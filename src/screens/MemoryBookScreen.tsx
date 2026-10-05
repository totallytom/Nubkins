import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/useGameStore';
import { getThemeById } from '../data/themes';
import { getFoodById } from '../data/food';
import { FONT, KAWAII } from '../lib/theme';
import { outfitProps } from '../lib/outfit';
import { dayNumber, daysSince, nextAnniversary } from '../lib/together';
import { Memory } from '../types';
import NubkinCreature from '../components/NubkinCreature';
import { getTrait } from '../data/personality';

const KIND_STICKER: Record<Memory['kind'], string> = {
  'hatch':            '🥚',
  'first-level-up':   '⭐',
  'first-outfit':     '👗',
  'first-high-score': '🏆',
  'favorite-food':    '🍓',
  'anniversary':      '🎉',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function MemoryCard({ memory, index }: { memory: Memory; index: number }) {
  const theme  = getThemeById(memory.themeId);
  const outfit = outfitProps(memory.accessoryId, memory.tattooId, memory.specialId);
  // Alternate a slight tilt so the book feels like pinned photos.
  const tilt = index % 2 === 0 ? '-1.5deg' : '1.5deg';
  return (
    <View style={[styles.polaroid, { transform: [{ rotate: tilt }] }]}>
      <View style={[styles.photo, { backgroundColor: theme.pageBg }]}>
        <View style={styles.photoCreature} pointerEvents="none">
          <NubkinCreature
            mood={memory.mood}
            skinId={memory.skinId}
            {...outfit}
            hideGlow
            onTap={() => {}}
          />
        </View>
        <Text style={styles.sticker}>{KIND_STICKER[memory.kind]}</Text>
      </View>
      <Text style={styles.memTitle}>{memory.title}</Text>
      <Text style={styles.memCaption}>{memory.caption}</Text>
      <Text style={styles.memMeta}>
        Day {memory.daysTogether} · Lv.{memory.level} · {formatDate(memory.date)}
      </Text>
    </View>
  );
}

export default function MemoryBookScreen() {
  const navigation = useNavigation<any>();
  const creature   = useGameStore(s => s.creature);
  const memories   = useGameStore(s => s.memories);
  const themeId    = useGameStore(s => s.themeId);
  const theme      = getThemeById(themeId);

  const day      = dayNumber(creature.createdAt);
  const next     = nextAnniversary(creature.createdAt);
  const daysLeft = next ? next.days - daysSince(creature.createdAt) : 0;
  const favorite = creature.favoriteRevealed && creature.favoriteBerryId ? getFoodById(creature.favoriteBerryId) : null;
  const dislike  = creature.dislikeRevealed && creature.dislikedBerryId ? getFoodById(creature.dislikedBerryId) : null;
  const newestFirst = [...memories].reverse();
  const trait = getTrait(creature.trait);

  const header = (
    <View style={styles.profile}>
      <Text style={styles.profileName}>{creature.name}</Text>
      {trait && <Text style={styles.profileTrait}>{trait.emoji} {trait.label}</Text>}
      {trait && <Text style={styles.profileNext}>{trait.description}</Text>}
      <Text style={styles.profileDays}>💞 Day {day} together</Text>
      {next && (
        <Text style={styles.profileNext}>
          Next surprise: {next.isBirthday ? 'Birthday 🎂' : next.title.replace('!', '')} in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
        </Text>
      )}

      <View style={styles.tasteRow}>
        <View style={[styles.taste, { backgroundColor: '#FFE3F1', borderColor: KAWAII.cardBorder }]}>
          <Text style={styles.tasteLabel}>💖 Favorite</Text>
          {favorite ? (
            <View style={styles.tasteFood}>
              {favorite.image && <Image source={favorite.image} style={styles.tasteImg} resizeMode="contain" />}
              <Text style={styles.tasteName}>{favorite.name}</Text>
            </View>
          ) : (
            <Text style={styles.tasteUnknown}>??? — try feeding berries!</Text>
          )}
        </View>
        <View style={[styles.taste, { backgroundColor: '#EDE7F6', borderColor: KAWAII.lilac }]}>
          <Text style={styles.tasteLabel}>😖 Dislikes</Text>
          {dislike ? (
            <View style={styles.tasteFood}>
              {dislike.image && <Image source={dislike.image} style={styles.tasteImg} resizeMode="contain" />}
              <Text style={styles.tasteName}>{dislike.name}</Text>
            </View>
          ) : (
            <Text style={styles.tasteUnknown}>??? — still a mystery</Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>📸 Memories · {memories.length}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.pageBg }]} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Memory Book</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={newestFirst}
        keyExtractor={m => m.id}
        renderItem={({ item, index }) => <MemoryCard memory={item} index={index} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No photos yet! Memories are saved automatically — level up, try on an outfit, or set a high score.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: KAWAII.ink, fontWeight: '900' },
  title:     { fontFamily: FONT, color: KAWAII.ink, fontSize: 22, fontWeight: '900' },
  list:      { paddingHorizontal: 20, paddingBottom: 40, gap: 22 },

  profile: {
    backgroundColor: KAWAII.card,
    borderWidth: 4,
    borderColor: KAWAII.cardBorder,
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  profileName: { fontFamily: FONT, color: KAWAII.ink, fontSize: 26, fontWeight: '900' },
  profileTrait: { fontFamily: FONT, color: KAWAII.ink, fontSize: 13, fontWeight: '800' },
  profileDays: { fontFamily: FONT, color: KAWAII.orange, fontSize: 15, fontWeight: '900' },
  profileNext: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12 },
  tasteRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
  taste: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  tasteLabel:   { fontFamily: FONT, color: KAWAII.ink, fontSize: 12, fontWeight: '900' },
  tasteFood:    { alignItems: 'center', gap: 2 },
  tasteImg:     { width: 36, height: 36 },
  tasteName:    { fontFamily: FONT, color: KAWAII.ink, fontSize: 13, fontWeight: '800' },
  tasteUnknown: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 11, textAlign: 'center' },
  sectionLabel: { fontFamily: FONT, color: KAWAII.ink, fontSize: 15, fontWeight: '900', marginTop: 14, alignSelf: 'flex-start' },

  polaroid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    paddingBottom: 16,
    borderWidth: 2,
    borderColor: KAWAII.ink,
    shadowColor: KAWAII.ink,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  photo: {
    height: 190,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoCreature: { transform: [{ scale: 0.95 }] },
  sticker: { position: 'absolute', top: 8, right: 10, fontSize: 26 },
  memTitle:   { fontFamily: FONT, color: KAWAII.ink, fontSize: 18, fontWeight: '900', marginTop: 10 },
  memCaption: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 13, marginTop: 2 },
  memMeta:    { fontFamily: FONT, color: '#A08AA6', fontSize: 11, marginTop: 6 },

  empty:     { padding: 24, alignItems: 'center' },
  emptyText: { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
