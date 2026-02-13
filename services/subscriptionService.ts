import { Platform } from 'react-native';

const FREE_RECIPE_LIMIT = 10;

let Purchases: any = null;

async function getPurchases() {
  if (Purchases) return Purchases;

  if (Platform.OS === 'web') {
    console.warn('RevenueCat is not available on web');
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

  return {
    isSubscribed: false,
    canAddRecipe: true,
    currentCount: 0,
    limit: FREE_RECIPE_LIMIT,
  };
}

export async function canAddRecipe(currentRecipeCount: number): Promise<boolean> {
  const status = await checkSubscriptionStatus();

  if (status.isSubscribed) return true;

  return currentRecipeCount < FREE_RECIPE_LIMIT;
}

export async function getOfferings(): Promise<any[]> {
  const purchases = await getPurchases();
  if (!purchases) {
    console.warn('[RevenueCat] getOfferings: Purchases module not available');
    return [];
  }

  try {
    const offerings = await purchases.getOfferings();
    const hasCurrent = !!offerings?.current;
    const packageCount = offerings?.current?.availablePackages?.length ?? 0;
    const allIds = offerings?.all ? Object.keys(offerings.all) : [];
    console.log('[RevenueCat] getOfferings: current=', hasCurrent, 'packages=', packageCount, 'offeringIds=', allIds);
    if (!hasCurrent && allIds.length > 0) {
      console.warn('[RevenueCat] No offering is set as Current. In RevenueCat dashboard → Offerings → set one as "Current".');
    }
    if (hasCurrent && packageCount === 0) {
      console.warn('[RevenueCat] Current offering has 0 packages. Add a package (with a product) to the current offering.');
    }
    if (offerings?.current) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (error: any) {
    console.error('[RevenueCat] getOfferings failed:', error?.message ?? error);
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
