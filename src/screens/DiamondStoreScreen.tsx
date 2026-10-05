import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DIAMOND_IMG = require('../../assets/currency/Diamond.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useGameStore } from '../store/useGameStore';
import { DIAMOND_BUNDLES } from '../data/diamondBundles';
import { FONT } from '../lib/theme';
import { useAds, REMOVE_ADS_PRODUCT_ID, runRestoreWithAlerts } from '../hooks/useAds';

export default function DiamondStoreScreen() {
  const navigation   = useNavigation();
  const diamonds     = useGameStore(s => s.profile.diamonds);
  const gainDiamonds = useGameStore(s => s.gainDiamonds);

  const { adsRemoved, purchaseRemoveAds, restorePurchases } = useAds();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading,  setLoading]  = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setFetching(true);
    Purchases.getOfferings()
      .then(o => { if (o.current?.availablePackages.length) setPackages(o.current.availablePackages); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  async function handlePurchase(bundleId: string) {
    setLoading(bundleId);
    try {
      const pkg = packages.find(p => p.product.identifier === bundleId);
      if (!pkg) {
        Alert.alert('Not Available', 'This bundle is not available right now.');
        return;
      }
      await Purchases.purchasePackage(pkg);
      const diamondsGained = DIAMOND_BUNDLES.find(b => b.id === bundleId)?.diamonds ?? 0;
      gainDiamonds(diamondsGained);
      Alert.alert('Thank you!', `${diamondsGained.toLocaleString()} diamonds added to your account!`);
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Diamonds</Text>
        <View style={styles.balancePill}>
          <Text style={styles.balanceText}>{diamonds} diamonds</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Image source={DIAMOND_IMG} style={styles.heroGem} resizeMode="contain" />
          <Text style={styles.heroTitle}>Diamond Store</Text>
          <Text style={styles.heroSub}>
            Unlock exclusive skins and accessories{'\n'}for your Nubkin
          </Text>
        </View>

        {/* Remove Ads */}
        {!adsRemoved && (
          <TouchableOpacity
            style={[styles.card, styles.removeAdsCard]}
            onPress={async () => {
              setLoading(REMOVE_ADS_PRODUCT_ID);
              try {
                await purchaseRemoveAds();
              } catch (e: any) {
                if (e?.message === 'remove_ads_unavailable') {
                  Alert.alert('Not Available', 'This purchase is not available right now.');
                } else {
                  Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
                }
              } finally {
                setLoading(null);
              }
            }}
            activeOpacity={0.82}
            disabled={!!loading}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.removeAdsEmoji}>🚫</Text>
                <View>
                  <Text style={styles.removeAdsTitle}>Remove Ads</Text>
                  <Text style={styles.removeAdsSub}>One-time purchase · Forever</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.removeAdsPrice}>
                  {packages.find(p => p.product.identifier === REMOVE_ADS_PRODUCT_ID)?.product.priceString ?? '$3.99'}
                </Text>
                <View style={[styles.buyBtn, styles.removeAdsBuyBtn]}>
                  <Text style={styles.buyBtnText}>
                    {loading === REMOVE_ADS_PRODUCT_ID ? '...' : 'Buy'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        {adsRemoved && (
          <View style={[styles.card, styles.removeAdsCard, { opacity: 0.6 }]}>
            <View style={styles.cardRow}>
              <Text style={styles.removeAdsEmoji}>✅</Text>
              <Text style={styles.removeAdsTitle}>Ads Removed — Thank you!</Text>
            </View>
          </View>
        )}

        {/* Bundle cards */}
        <View style={styles.bundles}>
          {DIAMOND_BUNDLES.map(bundle => {
            const livePackage = packages.find(p => p.product.identifier === bundle.id);
            const livePrice   = livePackage?.product.priceString ?? bundle.price;
            const featured    = !!bundle.badge;
            const busy        = loading === bundle.id;

            return (
              <TouchableOpacity
                key={bundle.id}
                style={[styles.card, featured && styles.cardFeatured]}
                onPress={() => handlePurchase(bundle.id)}
                activeOpacity={0.82}
                disabled={!!loading || fetching}
              >
                {bundle.badge && (
                  <View style={styles.badgeWrap}>
                    <Text style={styles.badgeText}>{bundle.badge.toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Image source={DIAMOND_IMG} style={styles.gemIcon} resizeMode="contain" />
                    <View>
                      <Text style={[styles.gemCount, featured && styles.gemCountFeatured]}>
                        {bundle.diamonds.toLocaleString()}
                      </Text>
                      <Text style={styles.gemLabel}>diamonds</Text>
                      {bundle.bonusPct && (
                        <View style={styles.bonusPill}>
                          <Text style={styles.bonusText}>+{bundle.bonusPct}% bonus</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardRight}>
                    <Text style={[styles.price, featured && styles.priceFeatured]}>
                      {livePrice}
                    </Text>
                    <View style={[styles.buyBtn, featured && styles.buyBtnFeatured]}>
                      <Text style={styles.buyBtnText}>
                        {busy ? '...' : fetching ? '—' : 'Get Now'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Restore Purchases (App Store requirement for non-consumables like Remove Ads) */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={async () => {
            setLoading('restore');
            await runRestoreWithAlerts(restorePurchases);
            setLoading(null);
          }}
          disabled={!!loading}
          activeOpacity={0.7}
        >
          <Text style={styles.restoreText}>{loading === 'restore' ? 'Restoring…' : 'Restore Purchases'}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payments securely processed by Apple or Google.{'\n'}
            Diamonds are non-refundable and non-transferable.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#e1e1e4' },
  scroll: { padding: 20, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 24, color: '#01010c' },
  headerTitle: { fontFamily: FONT, color: '#01010f', fontSize: 18, fontWeight: '900' },
  balancePill: {
    backgroundColor: '#1A1A45',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3498DB44',
  },
  balanceText: { fontFamily: FONT, color: '#74B9FF', fontWeight: '800', fontSize: 13 },

  hero: { alignItems: 'center', paddingVertical: 24, gap: 8, marginBottom: 8 },
  heroGem:   { width: 72, height: 72 },
  heroTitle: { fontFamily: FONT, color: '#000005', fontSize: 26, fontWeight: '900' },
  heroSub:   { fontFamily: FONT, color: '#7777AA', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  bundles: { gap: 12, marginBottom: 28 },

  card: {
    backgroundColor: '#dbdbe4',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D2D52',
    overflow: 'hidden',
  },
  cardFeatured: {
    backgroundColor: '#7f76a1',
    borderColor: '#9B59B6',
    borderWidth: 2,
  },

  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#9B59B6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  badgeText: { fontFamily: FONT, color: '#eee5e5', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  cardRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gemIcon:  { width: 44, height: 44 },
  gemCount: { fontFamily: FONT, color: '#56a7f8', fontSize: 28, fontWeight: '900', lineHeight: 32 },
  gemCountFeatured: { color: '#b7e70a' },
  gemLabel: { fontFamily: FONT, color: '#010111', fontSize: 12, fontWeight: '700' },

  bonusPill: {
    marginTop: 4,
    backgroundColor: '#00f365e8',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  bonusText: { fontFamily: FONT, color: '#010f07', fontSize: 10, fontWeight: '800' },

  cardRight: { alignItems: 'flex-end', gap: 8 },
  price:         { fontFamily: FONT, color: '#fc7a00', fontSize: 20, fontWeight: '900' },
  priceFeatured: { color: '#FDCB6E', fontSize: 22 },

  buyBtn:         { backgroundColor: '#2D2D52', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  buyBtnFeatured: { backgroundColor: '#9B59B6' },
  buyBtnText: { fontFamily: FONT, color: '#EFEFFF', fontWeight: '800', fontSize: 13 },

  removeAdsCard: {
    marginBottom: 20,
    borderColor: '#E74C3C',
    backgroundColor: '#f5e6e6',
  },
  removeAdsEmoji:  { fontSize: 32 },
  removeAdsTitle:  { fontFamily: FONT, color: '#C0392B', fontSize: 16, fontWeight: '900' },
  removeAdsSub:    { fontFamily: FONT, color: '#888', fontSize: 11, marginTop: 2 },
  removeAdsPrice:  { fontFamily: FONT, color: '#C0392B', fontSize: 20, fontWeight: '900' },
  removeAdsBuyBtn: { backgroundColor: '#E74C3C' },

  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#e7e7ee',
    borderRadius: 14,
    padding: 14,
  },
  footerIcon: { fontSize: 16 },
  footerText: { fontFamily: FONT, color: '#555577', fontSize: 11, lineHeight: 17, flex: 1 },
  restoreBtn: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#555577',
  },
  restoreText: { fontFamily: FONT, color: '#333355', fontSize: 13, fontWeight: '800' },
});
