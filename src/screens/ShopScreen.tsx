import React, { useState } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../store/useGameStore';
import { COSMETICS } from '../data/cosmetics';
import { COINS_PER_DIAMOND } from '../data/economy';
import { SHOP_CATEGORIES, shopItemsOf } from '../data/shopCategories';
import { Cosmetic } from '../types';
import { FONT, KAWAII, KAWAII_BTN } from '../lib/theme';
import CoinDisplay from '../components/CoinDisplay';
import TooltipCard from '../components/TooltipCard';
import CosmeticPreviewModal, { RARITY_COLOR } from '../components/shop/CosmeticPreviewModal';
import CoinExchangeModal from '../components/shop/CoinExchangeModal';
import { useTooltip } from '../hooks/useTooltip';

const DIAMOND_IMG = require('../../assets/currency/Diamond.png');
const COIN_IMG    = require('../../assets/currency/Coin.png');

const FEATURED_IDS = [
  'skin-starry', 'acc-fighthat', 'acc-frostcrown', 'acc-halo',
  'acc-witch4', 'acc-witch5', 'acc-glasses', 'acc-bow',
];

function getDailyFeatured(): Cosmetic | null {
  const day = Math.floor(Date.now() / 86400000);
  const id  = FEATURED_IDS[day % FEATURED_IDS.length];
  return COSMETICS.find(c => c.id === id) ?? null;
}

// Shop hub: currency actions, today's featured item, and a card per category.
// Each category opens its own page (ShopCategoryScreen).
export default function ShopScreen() {
  // The circle tab bar floats over the screen; keep content clear of it.
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const profile    = useGameStore(s => s.profile);
  const shopTooltip = useTooltip('first_shop');

  const [preview,      setPreview]      = useState<Cosmetic | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  const diamondsAvailable = Math.floor(profile.coins / COINS_PER_DIAMOND);
  const progressPct       = Math.min((profile.coins % COINS_PER_DIAMOND) / COINS_PER_DIAMOND, 1);
  const featuredItem      = getDailyFeatured();
  const featuredOwned     = !!featuredItem && profile.ownedCosmeticIds.includes(featuredItem.id);

  return (
    <ImageBackground source={require('../../assets/bg/shopbg.png')} style={styles.bg} resizeMode="stretch">
      <View style={styles.bgOverlay} />
      <SafeAreaView style={[styles.safe, { paddingBottom: tabBarHeight }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>Shop</Text>
              <Text style={styles.subtitle}>Customize your Nubkin</Text>
            </View>
            <CoinDisplay coins={profile.coins} diamonds={profile.diamonds} />
          </View>

          {/* Currency actions — two separate buttons */}
          <View style={styles.currencyRow}>
            <TouchableOpacity
              style={[styles.currencyBtn, { backgroundColor: KAWAII.sky }]}
              onPress={() => navigation.navigate('DiamondStore')}
              activeOpacity={0.8}
            >
              <Image source={DIAMOND_IMG} style={styles.currencyIcon} resizeMode="contain" />
              <Text style={styles.currencyTitle}>Get Diamonds</Text>
              <Text style={styles.currencySub}>Diamond bundles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.currencyBtn, { backgroundColor: KAWAII.yellow }]}
              onPress={() => setExchangeOpen(true)}
              activeOpacity={0.8}
            >
              <View style={styles.exchangeIcons}>
                <Image source={COIN_IMG} style={styles.exchangeIcon} resizeMode="contain" />
                <Text style={styles.exchangeArrow}>→</Text>
                <Image source={DIAMOND_IMG} style={styles.exchangeIcon} resizeMode="contain" />
              </View>
              <Text style={styles.currencyTitle}>Coin Exchange</Text>
              {diamondsAvailable >= 1 ? (
                <Text style={styles.currencySub}>{diamondsAvailable} ready to convert!</Text>
              ) : (
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${Math.round(progressPct * 100)}%` }]} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Featured today */}
          {featuredItem && (
            <TouchableOpacity style={styles.featured} onPress={() => setPreview(featuredItem)} activeOpacity={0.85}>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>⭐ FEATURED TODAY</Text>
              </View>
              <View style={styles.featuredRow}>
                {featuredItem.image
                  ? <Image source={featuredItem.image} style={styles.featuredImg} resizeMode="contain" />
                  : <Text style={styles.featuredEmoji}>{featuredItem.emoji}</Text>
                }
                <View style={styles.featuredInfo}>
                  <Text style={styles.featuredName}>{featuredItem.name}</Text>
                  <Text style={[styles.featuredRarity, { color: RARITY_COLOR[featuredItem.rarity] }]}>
                    {featuredItem.rarity.toUpperCase()}
                  </Text>
                  <Text style={styles.featuredDesc} numberOfLines={2}>{featuredItem.description}</Text>
                  <View style={styles.featuredFooter}>
                    {!featuredOwned && featuredItem.priceDiamond > 0 ? (
                      <View style={styles.featuredPriceRow}>
                        <Text style={styles.featuredPrice}>{featuredItem.priceDiamond}</Text>
                        <Image source={DIAMOND_IMG} style={styles.featuredPriceIcon} resizeMode="contain" />
                      </View>
                    ) : (
                      <Text style={styles.featuredPrice}>
                        {featuredOwned ? 'Owned' : featuredItem.priceCoin === 0 ? 'Free' : `${featuredItem.priceCoin} coins`}
                      </Text>
                    )}
                    <View style={[styles.featuredBtn, featuredOwned && { backgroundColor: KAWAII.mint }]}>
                      <Text style={styles.featuredBtnText}>{featuredOwned ? 'Equip' : 'View'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Categories — each opens its own page */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionLabel}>Browse</Text>
          </View>
          {SHOP_CATEGORIES.map(cat => {
            const items = shopItemsOf(cat.type);
            const owned = items.filter(i => profile.ownedCosmeticIds.includes(i.id)).length;
            return (
              <TouchableOpacity
                key={cat.type}
                style={[styles.categoryCard, { backgroundColor: cat.color }]}
                onPress={() => navigation.navigate('ShopCategory', { type: cat.type })}
                activeOpacity={0.85}
              >
                <View style={styles.categoryIconWrap}>
                  {cat.icon
                    ? <Image source={cat.icon} style={styles.categoryIcon} resizeMode="contain" />
                    : <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  }
                </View>
                <View style={styles.categoryText}>
                  <Text style={styles.categoryTitle}>{cat.title}</Text>
                  <Text style={styles.categoryBlurb}>{cat.blurb}</Text>
                  <Text style={styles.categoryCount}>{items.length} items · {owned} owned</Text>
                </View>
                <Text style={styles.categoryArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <CosmeticPreviewModal item={preview} onClose={() => setPreview(null)} />
        <CoinExchangeModal visible={exchangeOpen} onClose={() => setExchangeOpen(false)} />

        <TooltipCard
          visible={shopTooltip.visible}
          icon="🛍️"
          title="Welcome to the Shop!"
          message="Spend coins on common items and diamonds on rare cosmetics. Earn diamonds from daily logins and milestone levels!"
          onDismiss={shopTooltip.dismiss}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:        { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,235,180,0.18)' },
  safe:      { flex: 1, backgroundColor: 'transparent' },
  scroll:    { padding: 16, paddingBottom: 24, gap: 12 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleWrap: { backgroundColor: 'rgba(255,246,251,0.9)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  title:     { fontFamily: FONT, color: KAWAII.ink, fontSize: 26, fontWeight: '900' },
  subtitle:  { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12, marginTop: 2 },

  // Currency buttons
  currencyRow: { flexDirection: 'row', gap: 12 },
  currencyBtn: {
    ...KAWAII_BTN,
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 3,
  },
  currencyIcon:  { width: 34, height: 34 },
  currencyTitle: { fontFamily: FONT, color: KAWAII.ink, fontSize: 15, fontWeight: '900' },
  currencySub:   { fontFamily: FONT, color: KAWAII.ink, fontSize: 11, opacity: 0.75, textAlign: 'center' },
  exchangeIcons: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 34 },
  exchangeIcon:  { width: 26, height: 26 },
  exchangeArrow: { fontFamily: FONT, color: KAWAII.ink, fontSize: 16, fontWeight: '900' },
  miniTrack: {
    width: '80%',
    height: 8,
    marginTop: 3,
    backgroundColor: KAWAII.card,
    borderWidth: 1.5,
    borderColor: KAWAII.ink,
    borderRadius: 4,
    overflow: 'hidden',
  },
  miniFill: { height: '100%', backgroundColor: KAWAII.orange },

  // Featured
  featured: {
    backgroundColor: KAWAII.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 2.5,
    borderBottomWidth: 5,
    borderColor: KAWAII.ink,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: KAWAII.yellow,
    borderWidth: 1.5,
    borderColor: KAWAII.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 8,
  },
  featuredBadgeText: { fontFamily: FONT, color: KAWAII.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  featuredRow:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featuredImg:    { width: 84, height: 84 },
  featuredEmoji:  { fontSize: 54, width: 84, textAlign: 'center' },
  featuredInfo:   { flex: 1, gap: 2 },
  featuredName:   { fontFamily: FONT, color: KAWAII.ink, fontSize: 18, fontWeight: '900' },
  featuredRarity: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  featuredDesc:   { fontFamily: FONT, color: KAWAII.inkSoft, fontSize: 12, lineHeight: 17 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  featuredPrice:  { fontFamily: FONT, color: KAWAII.ink, fontWeight: '900', fontSize: 14 },
  featuredPriceRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredPriceIcon: { width: 16, height: 16 },
  featuredBtn: {
    backgroundColor: KAWAII.pink,
    borderWidth: 2,
    borderColor: KAWAII.ink,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  featuredBtnText: { fontFamily: FONT, color: KAWAII.ink, fontWeight: '900', fontSize: 13 },

  // Categories
  sectionWrap: {
    alignSelf: 'flex-start',
    backgroundColor: KAWAII.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  sectionLabel: { fontFamily: FONT, color: KAWAII.ink, fontSize: 15, fontWeight: '900' },
  categoryCard: {
    ...KAWAII_BTN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  categoryIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: KAWAII.card,
    borderWidth: 2,
    borderColor: KAWAII.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryIcon:  { width: 48, height: 48 },
  categoryEmoji: { fontSize: 28 },
  categoryText:  { flex: 1 },
  categoryTitle: { fontFamily: FONT, color: KAWAII.ink, fontSize: 18, fontWeight: '900' },
  categoryBlurb: { fontFamily: FONT, color: KAWAII.ink, fontSize: 12, opacity: 0.75 },
  categoryCount: { fontFamily: FONT, color: KAWAII.ink, fontSize: 11, fontWeight: '800', marginTop: 3 },
  categoryArrow: { fontFamily: FONT, color: KAWAII.ink, fontSize: 28, fontWeight: '900' },
});
