import React, { useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGameStore } from '../store/useGameStore';
import { Cosmetic, CosmeticType } from '../types';
import { getShopCategory, shopItemsOf } from '../data/shopCategories';
import { FONT, KAWAII } from '../lib/theme';
import CoinDisplay from '../components/CoinDisplay';
import ShopItemCard from '../components/shop/ShopItemCard';
import CosmeticPreviewModal from '../components/shop/CosmeticPreviewModal';

// One Shop category (Skins, Accessories, …) on its own page.
export default function ShopCategoryScreen() {
  const navigation = useNavigation<any>();
  const { type } = useRoute<any>().params as { type: CosmeticType };
  const insets   = useSafeAreaInsets();
  const profile  = useGameStore(s => s.profile);
  const creature = useGameStore(s => s.creature);
  const themeId  = useGameStore(s => s.themeId);

  const category = getShopCategory(type);
  const items    = shopItemsOf(type);
  const ownedCount = items.filter(i => profile.ownedCosmeticIds.includes(i.id)).length;
  const [preview, setPreview] = useState<Cosmetic | null>(null);

  function isEquipped(item: Cosmetic) {
    switch (item.type) {
      case 'skin':       return creature.equippedSkinId === item.id;
      case 'accessory':  return creature.equippedAccessoryId === item.id;
      case 'tattoo':     return creature.equippedTattooId === item.id;
      case 'special':    return creature.equippedSpecialId === item.id;
      case 'background': return themeId === item.id;
    }
  }

  return (
    <ImageBackground source={require('../../assets/bg/shopbg.png')} style={styles.bg} resizeMode="stretch">
      <View style={styles.bgOverlay} />
      <SafeAreaView style={styles.safe} edges={['top']}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back to Shop">
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <CoinDisplay coins={profile.coins} diamonds={profile.diamonds} />
        </View>

        <View style={[styles.banner, { backgroundColor: category.color }]}>
          <Text style={styles.bannerTitle}>{category.emoji} {category.title}</Text>
          <Text style={styles.bannerSub}>{category.blurb}</Text>
          <View style={styles.bannerCount}>
            <Text style={styles.bannerCountText}>{ownedCount} / {items.length} owned</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}>
          {items.map(item => (
            <ShopItemCard
              key={item.id}
              item={item}
              owned={profile.ownedCosmeticIds.includes(item.id)}
              equipped={isEquipped(item)}
              playerLevel={creature.level}
              accent={category.color}
              onPress={() => setPreview(item)}
            />
          ))}
          {items.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌟</Text>
              <Text style={styles.emptyTitle}>Coming Soon</Text>
              <Text style={styles.emptyDesc}>More {category.title.toLowerCase()} are on the way!</Text>
            </View>
          )}
        </ScrollView>

        <CosmeticPreviewModal item={preview} onClose={() => setPreview(null)} />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:        { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,235,180,0.18)' },
  safe:      { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: KAWAII.card,
    borderWidth: 2.5,
    borderColor: KAWAII.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: KAWAII.ink, fontWeight: '900' },

  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 24,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: KAWAII.ink,
    padding: 16,
    gap: 2,
  },
  bannerTitle: { fontFamily: FONT, color: KAWAII.ink, fontSize: 26, fontWeight: '900' },
  bannerSub:   { fontFamily: FONT, color: KAWAII.ink, fontSize: 13, opacity: 0.8 },
  bannerCount: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: KAWAII.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: KAWAII.ink,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  bannerCountText: { fontFamily: FONT, color: KAWAII.ink, fontSize: 12, fontWeight: '800' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  empty:      { alignItems: 'center', paddingVertical: 48, gap: 8, width: '100%' },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: FONT, color: KAWAII.ink, fontWeight: '800', fontSize: 18 },
  emptyDesc:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 13 },
});
