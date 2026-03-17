import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_RECIPE_LIMIT = 10;
const LIFETIME_COUNT_KEY = 'cooked_lifetime_recipe_count';
const ANON_USER_ID_KEY = 'cooked_anon_user_id';

let Purchases: any = null;

async function getPurchases() {
  if (Purchases) return Purchases;

  if (Platform.OS === 'web') {
    console.warn('RevenueCat is not available on web');
    return null;
  }

  // Expo Go doesn't include react-native-purchases; skip so the app still runs (mock paywall only).
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  try {
    const mod = require('react-native-purchases');
    Purchases = mod.default || mod;
    return Purchases;
  } catch {
    console.warn('react-native-purchases not available');
    return null;
  }
}

export async function initializeSubscriptions(): Promise<void> {
  const purchases = await getPurchases();
  if (!purchases) return;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn('RevenueCat API key not configured. Set REVENUECAT_API_KEY environment variable.');
    return;
  }

  try {
    await purchases.configure({
      apiKey,
    });
    const keyPreview = apiKey.substring(0, 8) + '...';
    console.log('[RevenueCat] Initialized with key', keyPreview, apiKey.startsWith('appl_') ? '(iOS)' : '(not appl_ - use iOS public key)');
  } catch (error) {
    console.error('[RevenueCat] Configure failed:', error);
  }
}

// Expo only inlines EXPO_PUBLIC_* with static access. Use EXPO_PUBLIC_REVENUECAT_API_KEY in .env / EAS.
function getRevenueCatApiKey(): string | null {
  if (typeof process === 'undefined' || !process.env) return null;
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || process.env.REVENUECAT_API_KEY || null;
}

/** True if the RevenueCat API key is set (used to show the right message when offerings are empty). */
export function isRevenueCatConfigured(): boolean {
  return !!getRevenueCatApiKey();
}

export function getRecipeLimit(): number {
  return FREE_RECIPE_LIMIT;
}

/** Stable ID for this install (persists in Keychain on iOS across reinstall when possible). Used to sync lifetime recipe count with backend. */
export async function getStableUserId(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      let id = await AsyncStorage.getItem(ANON_USER_ID_KEY);
      if (!id) {
        id = 'web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        await AsyncStorage.setItem(ANON_USER_ID_KEY, id);
      }
      return id;
    }
    const SecureStore = require('expo-secure-store').default;
    let id = await SecureStore.getItemAsync(ANON_USER_ID_KEY);
    if (!id) {
      const uuid = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await SecureStore.setItemAsync(ANON_USER_ID_KEY, uuid);
      id = uuid;
    }
    return id;
  } catch {
    const fallback = 'local_' + Math.random().toString(36).slice(2);
    return fallback;
  }
}

function getBackendBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
  if (env && typeof env === 'string' && env.trim()) return env.trim().replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ?? (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const protocol = String(hostUri).includes('exp.direct') ? 'https' : 'http';
    return `${protocol}://${hostUri}`;
  }
  return null;
}

async function hasActivePromo(): Promise<boolean> {
  const base = getBackendBaseUrl();
  if (!base) return false;
  try {
    const userId = await getStableUserId();
    const res = await fetch(`${base}/promo/entitlement?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return !!data?.active;
  } catch {
    return false;
  }
}

/** Lifetime number of recipes ever created (never decreases on delete). Used to enforce free limit and survive reinstall when synced to backend. */
export async function getLifetimeRecipeCount(): Promise<number> {
  let local = 0;
  try {
    const s = await AsyncStorage.getItem(LIFETIME_COUNT_KEY);
    if (s != null) local = Math.max(0, parseInt(s, 10) || 0);
  } catch {}

  const base = getBackendBaseUrl();
  if (base) {
    try {
      const userId = await getStableUserId();
      const res = await fetch(`${base}/recipe-count?user_id=${encodeURIComponent(userId)}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const server = typeof data?.count === 'number' ? data.count : 0;
        return Math.max(local, server);
      }
    } catch {}
  }
  return local;
}

/** Call this when the user successfully adds a new recipe. Increments local and (if backend configured) server count. */
export async function incrementLifetimeRecipeCount(): Promise<void> {
  const next = (await getLifetimeRecipeCount()) + 1;
  try {
    await AsyncStorage.setItem(LIFETIME_COUNT_KEY, String(next));
  } catch {}

  const base = getBackendBaseUrl();
  if (base) {
    try {
      const userId = await getStableUserId();
      await fetch(`${base}/recipe-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
    } catch {}
  }
}

export async function checkSubscriptionStatus(): Promise<{
  isSubscribed: boolean;
  canAddRecipe: boolean;
  currentCount: number;
  limit: number;
}> {
  const purchases = await getPurchases();

  if (purchases) {
    try {
      const customerInfo = await purchases.getCustomerInfo();
      const isSubscribed = customerInfo.entitlements.active['premium'] !== undefined;

      if (isSubscribed) {
        return {
          isSubscribed: true,
          canAddRecipe: true,
          currentCount: 0,
          limit: Infinity,
        };
      }
    } catch (error) {
      console.warn('Failed to check subscription:', error);
    }
  }

  const promoActive = await hasActivePromo();
  if (promoActive) {
    return {
      isSubscribed: true,
      canAddRecipe: true,
      currentCount: 0,
      limit: Infinity,
    };
  }

  const currentCount = await getLifetimeRecipeCount();
  return {
    isSubscribed: false,
    canAddRecipe: currentCount < FREE_RECIPE_LIMIT,
    currentCount,
    limit: FREE_RECIPE_LIMIT,
  };
}

/** Use lifetime recipe count so deleting recipes cannot bypass the free limit. No argument needed. */
export async function canAddRecipe(): Promise<boolean> {
  const status = await checkSubscriptionStatus();
  if (status.isSubscribed) return true;
  return status.currentCount < FREE_RECIPE_LIMIT;
}

let lastOfferingsDebug: string = '';

export function getLastOfferingsDebug(): string {
  return lastOfferingsDebug;
}

export async function getOfferings(): Promise<any[]> {
  const purchases = await getPurchases();
  if (!purchases) {
    lastOfferingsDebug = 'Purchases module not available (e.g. web or missing native module).';
    console.warn('[RevenueCat] getOfferings:', lastOfferingsDebug);
    return [];
  }

  try {
    const offerings = await purchases.getOfferings();
    const hasCurrent = !!offerings?.current;
    const packageCount = offerings?.current?.availablePackages?.length ?? 0;
    const allIds = offerings?.all ? Object.keys(offerings.all) : [];
    console.log('[RevenueCat] getOfferings: current=', hasCurrent, 'packages=', packageCount, 'offeringIds=', allIds);

    if (offerings?.current) {
      lastOfferingsDebug = packageCount > 0 ? '' : `Current offering has 0 packages. Add a package in RevenueCat → default → Packages.`;
      return offerings.current.availablePackages;
    }

    if (allIds.length > 0) {
      lastOfferingsDebug = 'No offering is set as Current. In RevenueCat → Offerings → set "default" as Current (checkmark).';
    } else {
      lastOfferingsDebug = 'No offerings from RevenueCat. Check App Store Connect API Key in RevenueCat Project Settings, and product com.cooked.recipe.pro_monthly in App Store Connect.';
    }
    return [];
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    lastOfferingsDebug = `RevenueCat error: ${msg}`;
    console.error('[RevenueCat] getOfferings failed:', msg);
    return [];
  }
}

export async function purchasePackage(pkg: any): Promise<boolean> {
  const purchases = await getPurchases();
  if (!purchases) return false;

  try {
    const { customerInfo } = await purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error: any) {
    if (error.userCancelled) {
      return false;
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const purchases = await getPurchases();
  if (!purchases) return false;

  try {
    const customerInfo = await purchases.restorePurchases();
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return false;
  }
}
