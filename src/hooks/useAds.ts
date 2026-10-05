import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { useGameStore } from '../store/useGameStore';

export const AD_PLAY_REWARD = 3;
export const REMOVE_ADS_PRODUCT_ID = 'remove_ads_permanent';
export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

const REWARDED_AD_UNIT_ID = Platform.select({
  ios:     'ca-app-pub-3981993675235210/762741695',
  android: 'ca-app-pub-3981993675235210/5459025017',
})!;
const INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios:     'ca-app-pub-3981993675235210/7648080756',
  android: 'ca-app-pub-3981993675235210/1466020679',
})!;

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export function useAds() {
  const adsRemoved    = useGameStore(s => s.profile.adsRemoved ?? false);
  const setAdsRemoved = useGameStore(s => s.setAdsRemoved);

  function showRewardedAd(onRewarded: () => void, onError?: () => void) {
    // Require inside the function so it never runs at module load time in Expo Go
    let RNAds: typeof import('react-native-google-mobile-ads') | null = null;
    try { RNAds = require('react-native-google-mobile-ads'); } catch {}

    if (!RNAds) {
      onRewarded(); // Expo Go fallback
      return;
    }

    const { AdEventType, RewardedAd, RewardedAdEventType } = RNAds;
    const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribers: Array<() => void> = [];
    const cleanup = () => unsubscribers.forEach(u => u());

    unsubscribers.push(rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      rewarded.show();
    }));
    unsubscribers.push(rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      onRewarded();
      cleanup();
    }));
    unsubscribers.push(rewarded.addAdEventListener(AdEventType.ERROR, () => {
      onError?.();
      cleanup();
    }));

    rewarded.load();
  }

  function showInterstitialAd() {
    if (useGameStore.getState().profile.adsRemoved) return;

    // Require inside the function so it never runs at module load time in Expo Go
    let RNAds: typeof import('react-native-google-mobile-ads') | null = null;
    try { RNAds = require('react-native-google-mobile-ads'); } catch {}
    if (!RNAds) return; // Expo Go — no-op, nothing to show

    const { AdEventType, InterstitialAd } = RNAds;
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribers: Array<() => void> = [];
    const cleanup = () => unsubscribers.forEach(u => u());

    unsubscribers.push(interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitial.show();
    }));
    unsubscribers.push(interstitial.addAdEventListener(AdEventType.CLOSED, cleanup));
    unsubscribers.push(interstitial.addAdEventListener(AdEventType.ERROR, cleanup));

    interstitial.load();
  }

  async function purchaseRemoveAds(): Promise<boolean> {
    if (IS_EXPO_GO) return false;
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages
      .find(p => p.product.identifier === REMOVE_ADS_PRODUCT_ID);
    if (!pkg) throw new Error('remove_ads_unavailable');
    try {
      await Purchases.purchasePackage(pkg);
      setAdsRemoved(true);
      return true;
    } catch (e: any) {
      if (e.userCancelled) return false;
      throw e;
    }
  }

  // Re-syncs purchases with the App Store / Play Store (e.g. on a new phone or
  // after reinstalling). Only Remove Ads can come back — diamonds are consumables.
  async function restorePurchases(): Promise<'restored' | 'nothing'> {
    if (IS_EXPO_GO) return 'nothing';
    const info = await Purchases.restorePurchases();
    const active = !!info.entitlements.active[REMOVE_ADS_ENTITLEMENT];
    setAdsRemoved(active);
    return active ? 'restored' : 'nothing';
  }

  return { adsRemoved, showRewardedAd, showInterstitialAd, purchaseRemoveAds, restorePurchases };
}

// Shared Restore Purchases flow (Settings + Diamond Store) with user-facing alerts.
export async function runRestoreWithAlerts(restore: () => Promise<'restored' | 'nothing'>) {
  try {
    const result = await restore();
    if (result === 'restored') {
      Alert.alert('Purchases Restored', 'Remove Ads is active again. Thanks for your support!');
    } else {
      Alert.alert('Nothing to Restore', 'No previous purchases were found for this Apple / Google account.');
    }
  } catch {
    Alert.alert('Restore Failed', 'Could not reach the store. Check your connection and try again.');
  }
}
