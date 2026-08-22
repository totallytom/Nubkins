import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { useGameStore } from '../store/useGameStore';
import { REMOVE_ADS_ENTITLEMENT } from './useAds';

const RC_KEY_IOS     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export function useRevenueCat() {
  const setAdsRemoved = useGameStore(s => s.setAdsRemoved);

  useEffect(() => {
    if (IS_EXPO_GO) return;
    const apiKey = Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID;
    if (!apiKey) return;
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });

    // Sync entitlement state (handles reinstalls, cross-device, and refunds/chargebacks
    // revoking a previously-granted entitlement).
    Purchases.getCustomerInfo()
      .then(info => {
        setAdsRemoved(!!info.entitlements.active[REMOVE_ADS_ENTITLEMENT]);
      })
      .catch(() => {});
  }, []);
}
