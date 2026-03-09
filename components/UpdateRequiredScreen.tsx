import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
const APP_STORE_ID = (extra?.appStoreId as string) || null;
const PLAY_STORE_PACKAGE = (extra?.playStorePackage as string) || 'com.cooked.recipe';

function getStoreUrl(): string | null {
  if (Platform.OS === 'ios' && APP_STORE_ID) {
    return `https://apps.apple.com/app/id${APP_STORE_ID}`;
  }
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
  }
  return null;
}

export default function UpdateRequiredScreen() {
  const storeUrl = getStoreUrl();

  const handleUpdate = () => {
    const url = storeUrl;
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <AlertCircle size={56} color={Colors.primary} />
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.message}>
          A new version of Cooked is available. Please update the app to continue.
        </Text>
        {storeUrl ? (
          <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
            <Text style={styles.buttonText}>
              {Platform.OS === 'ios' ? 'Open App Store' : 'Open Play Store'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.fallback}>
            Open the {Platform.OS === 'ios' ? 'App' : 'Play'} Store and update Cooked.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  fallback: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
