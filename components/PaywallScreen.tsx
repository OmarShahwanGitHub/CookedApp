import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import { Lock, Crown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getBackendBaseUrl } from '@/utils/parseRecipe';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  getRecipeLimit,
  isRevenueCatConfigured,
  getLastOfferingsDebug,
} from '@/services/subscriptionService';

const PRIVACY_URL = () => getBackendBaseUrl().replace(/\/$/, '');
const TERMS_URL = () => `${PRIVACY_URL()}/terms.html`;

/** Mock package shown when RevenueCat offerings are empty (sandbox/preview). */
const MOCK_PACKAGE = {
  _mock: true as const,
  product: { title: 'Cooked Pro Monthly', priceString: '$9.99/month' },
};

interface PaywallScreenProps {
  onDismiss: () => void;
  onSubscribed: () => void;
}

export default function PaywallScreen({ onDismiss, onSubscribed }: PaywallScreenProps) {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const limit = getRecipeLimit();

  useEffect(() => {
    loadOfferings();
  }, []);

  const [offeringsDebug, setOfferingsDebug] = useState('');

  const loadOfferings = async () => {
    try {
      const packages = await getOfferings();
      setOfferings(packages);
      setOfferingsDebug(getLastOfferingsDebug());
    } catch (error) {
      setOfferingsDebug(getLastOfferingsDebug() || 'Failed to load offerings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (pkg: any) => {
    if (pkg._mock) {
      Alert.alert('Coming Soon', 'The app is under development and not accepting payments yet.');
      return;
    }
    setIsPurchasing(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        onSubscribed();
      }
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Restored!', 'Your subscription has been restored.');
        onSubscribed();
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const features = [
    'Unlimited saved recipes',
    'Full recipe parsing with AI',
    'Unlimited grocery lists',
    'Priority support',
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Crown size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Unlock Cooked Pro</Text>
          <Text style={styles.subtitle}>
            You've reached the free limit of {limit} recipes. Upgrade to save unlimited recipes and access all features.
          </Text>
        </View>

        <View style={styles.features}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Check size={20} color={Colors.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.offerings}>
            {(offerings.length > 0 ? offerings : [MOCK_PACKAGE]).map((pkg: any, index: number) => (
              <TouchableOpacity
                key={pkg._mock ? 'mock' : index}
                style={styles.offeringButton}
                onPress={() => handlePurchase(pkg)}
                disabled={!pkg._mock && isPurchasing}
              >
                {!pkg._mock && isPurchasing ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Text style={styles.offeringTitle}>{pkg.product?.title || 'Subscribe'}</Text>
                    <Text style={styles.offeringPrice}>{pkg.product?.priceString || ''}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL())}>
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL())}>
            <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  features: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.text,
  },
  loader: {
    marginVertical: 24,
  },
  offerings: {
    gap: 12,
    marginBottom: 16,
  },
  offeringButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 4,
  },
  offeringTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  offeringPrice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  noOfferings: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  noOfferingsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  debugText: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
    fontStyle: 'italic',
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 4,
  },
  legalLinkText: {
    fontSize: 14,
    color: Colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '500' as const,
  },
  legalSeparator: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
