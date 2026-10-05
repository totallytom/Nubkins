import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/useGameStore';
import { COSMETICS, getCosmeticById } from '../data/cosmetics';
import NubkinCreature from '../components/NubkinCreature';
import { FONT } from '../lib/theme';
import { getThemeById } from '../data/themes';

export default function WardrobeScreen() {
  const navigation = useNavigation();
  const creature       = useGameStore(s => s.creature);
  const profile         = useGameStore(s => s.profile);
  const equipAccessory  = useGameStore(s => s.equipAccessory);
  const equipTattoo     = useGameStore(s => s.equipTattoo);
  const equipSkin       = useGameStore(s => s.equipSkin);
  const equipSpecial    = useGameStore(s => s.equipSpecial);
  const themeId         = useGameStore(s => s.themeId);
  const theme = getThemeById(themeId);

  const equippedAcc         = creature.equippedAccessoryId ? getCosmeticById(creature.equippedAccessoryId) : null;
  const accessoryEmoji      = equippedAcc?.emoji ?? null;
  const accessoryImage      = equippedAcc?.image ?? null;
  const accessoryImageStyle = equippedAcc?.imageStyle ?? undefined;
  const equippedTattoo      = creature.equippedTattooId ? getCosmeticById(creature.equippedTattooId) : null;
  const tattooImage         = equippedTattoo?.image ?? undefined;
  const tattooImageStyle    = equippedTattoo?.imageStyle ?? undefined;
  const equippedSpecial     = creature.equippedSpecialId ? getCosmeticById(creature.equippedSpecialId) : null;
  const specialImage        = equippedSpecial?.image ?? undefined;
  const specialImageStyle   = equippedSpecial?.imageStyle ?? undefined;

  const ownedSkins = COSMETICS.filter(
    c => c.type === 'skin' && profile.ownedCosmeticIds.includes(c.id)
  );
  const ownedAccessories = COSMETICS.filter(
    c => c.type === 'accessory' && profile.ownedCosmeticIds.includes(c.id)
  );
  const ownedTattoos = COSMETICS.filter(
    c => c.type === 'tattoo' && profile.ownedCosmeticIds.includes(c.id)
  );
  const ownedSpecials = COSMETICS.filter(
    c => c.type === 'special' && profile.ownedCosmeticIds.includes(c.id)
  );

  function handleTap(id: string) {
    equipAccessory(creature.equippedAccessoryId === id ? null : id);
  }

  function handleTattooTap(id: string) {
    equipTattoo(creature.equippedTattooId === id ? null : id);
  }

  function handleSpecialTap(id: string) {
    equipSpecial(creature.equippedSpecialId === id ? null : id);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.pageBg }]} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wardrobe</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Nubkin preview */}
        <View style={styles.previewCard}>
          <View style={styles.previewCreature}>
            <NubkinCreature
              mood="happy"
              skinId={creature.equippedSkinId}
              accessoryEmoji={accessoryEmoji}
              accessoryImage={accessoryImage}
              accessoryImageStyle={accessoryImageStyle}
              tattooImage={tattooImage}
              tattooImageStyle={tattooImageStyle}
              specialImage={specialImage}
              specialImageStyle={specialImageStyle}
              trait={creature.trait}
              hideGlow
              onTap={() => {}}
            />
          </View>
          <Text style={styles.previewName}>{creature.name}</Text>
          <Text style={styles.previewSub}>
            {equippedAcc ? `Wearing: ${equippedAcc.name}` : 'No accessory equipped'}
            {equippedTattoo ? `  ·  ${equippedTattoo.name}` : ''}
          </Text>

          {/* Skin switcher */}
          {ownedSkins.length > 1 && (
            <FlatList
              data={ownedSkins}
              keyExtractor={s => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.skinRow}
              renderItem={({ item: skin }) => {
                const active = creature.equippedSkinId === skin.id;
                return (
                  <TouchableOpacity
                    style={[styles.skinThumb, active && styles.skinThumbActive]}
                    onPress={() => equipSkin(skin.id)}
                    activeOpacity={0.75}
                  >
                    {skin.image ? (
                      <Image source={skin.image} style={styles.skinThumbImg} resizeMode="contain" />
                    ) : (
                      <Text style={styles.skinThumbEmoji}>{skin.emoji}</Text>
                    )}
                    {active && <View style={styles.skinActiveDot} />}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* Accessories grid */}
        <Text style={styles.sectionLabel}>Your Accessories</Text>

        {ownedAccessories.length === 0 ? (
          <View style={styles.empty}>
<Text style={styles.emptyText}>Nothing here yet — visit the Shop to get accessories!</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {ownedAccessories.map(acc => {
              const equipped = creature.equippedAccessoryId === acc.id;
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.card, equipped && styles.cardEquipped]}
                  onPress={() => handleTap(acc.id)}
                  activeOpacity={0.75}
                >
                  {acc.image ? (
                    <Image source={acc.image} style={styles.accImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.accEmoji}>{acc.emoji}</Text>
                  )}
                  <Text style={styles.accName} numberOfLines={2}>{acc.name}</Text>
                  {equipped && (
                    <View style={styles.equippedBadge}>
                      <Text style={styles.equippedText}>✓ On</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Tattoos grid */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Your Tattoos</Text>

        {ownedTattoos.length === 0 ? (
          <View style={styles.empty}>
<Text style={styles.emptyText}>No tattoos yet — visit the Shop to grab one!</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {ownedTattoos.map(t => {
              const equipped = creature.equippedTattooId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.card, equipped && styles.cardEquipped]}
                  onPress={() => handleTattooTap(t.id)}
                  activeOpacity={0.75}
                >
                  {t.image ? (
                    <Image source={t.image} style={styles.accImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.accEmoji}>{t.emoji}</Text>
                  )}
                  <Text style={styles.accName} numberOfLines={2}>{t.name}</Text>
                  {equipped && (
                    <View style={styles.equippedBadge}>
                      <Text style={styles.equippedText}>✓ On</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Special items grid */}
        {ownedSpecials.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Special Items</Text>
            <View style={styles.grid}>
              {ownedSpecials.map(s => {
                const equipped = creature.equippedSpecialId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.card, equipped && styles.cardEquipped]}
                    onPress={() => handleSpecialTap(s.id)}
                    activeOpacity={0.75}
                  >
                    {s.image ? (
                      <Image source={s.image} style={styles.accImg} resizeMode="contain" />
                    ) : (
                      <Text style={styles.accEmoji}>{s.emoji}</Text>
                    )}
                    <Text style={styles.accName} numberOfLines={2}>{s.name}</Text>
                    {equipped && (
                      <View style={styles.equippedBadge}>
                        <Text style={styles.equippedText}>✓ On</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.hint}>Tap to equip · tap again to remove</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 24, color: '#333' },
  title: { fontFamily: FONT, color: '#111', fontSize: 22, fontWeight: '900' },

  // Preview
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E0E0F0',
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 28,
    gap: 6,
  },
  previewCreature: { marginBottom: 8 },
  previewName: { fontFamily: FONT, color: '#111', fontSize: 18, fontWeight: '900' },
  previewSub:  { fontFamily: FONT, color: '#7777AA', fontSize: 13 },

  skinRow: { paddingHorizontal: 8, gap: 10, marginTop: 14 },
  skinThumb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F0EEFF',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinThumbActive: {
    borderColor: '#9B59B6',
    backgroundColor: '#EDE0FF',
  },
  skinThumbImg:   { width: 42, height: 42 },
  skinThumbEmoji: { fontSize: 28 },
  skinActiveDot: {
    position: 'absolute',
    bottom: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#9B59B6',
  },

  // Section
  sectionLabel: { fontFamily: FONT, color: '#111', fontWeight: '900', fontSize: 18, marginBottom: 14 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '30%',
    backgroundColor: '#F5F5FF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 12,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  cardEquipped: {
    borderColor: '#9B59B6',
    backgroundColor: '#F0E8FF',
  },
  accImg:   { width: 64, height: 64 },
  accEmoji: { fontSize: 40 },
  accName:  { fontFamily: FONT, color: '#222', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  equippedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#9B59B6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equippedText: { fontFamily: FONT, color: '#FFF', fontSize: 9, fontWeight: '800' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  hint: { fontFamily: FONT, color: '#AAAACC', fontSize: 12, textAlign: 'center', marginTop: 20 },
});
