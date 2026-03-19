import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { getStableUserId } from '@/services/subscriptionService';
import Constants from 'expo-constants';

function getBackendBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
  if (env && typeof env === 'string' && env.trim()) return env.trim().replace(/\/$/, '');
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const protocol = String(hostUri).includes('exp.direct') ? 'https' : 'http';
    return `${protocol}://${hostUri}`;
  }
  return null;
}

function formatAccessThrough(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function RedeemCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter a promo code.');
      return;
    }
    const base = getBackendBaseUrl();
    if (!base) {
      Alert.alert('Error', 'Backend not configured.');
      return;
    }
    setIsSubmitting(true);
    try {
      const userId = await getStableUserId();
      const res = await fetch(`${base}/promo/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const through = data.entitlement_expires_at
          ? formatAccessThrough(data.entitlement_expires_at)
          : '';
        Alert.alert(
          'Success',
          through
            ? `Promo applied! Unlimited access through the end of ${through} (end of that calendar day).`
            : 'Promo applied! You now have unlimited access for a limited time.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        const requestId = data?.request_id ? `\nRequest ID: ${data.request_id}` : '';
        const details = data?.details ? `\nDetails: ${data.details}` : '';
        Alert.alert('Error', `${data.error || 'Could not redeem code.'}${details}${requestId}`);
      }
    } catch (err) {
      console.error('Redeem code error:', err);
      Alert.alert('Error', 'Failed to redeem code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Redeem promo code</Text>
          <Text style={styles.subtitle}>
            One-time codes unlock unlimited recipes for the number of days on your code. You keep access through the end
            of the last day (e.g. a 3-day code = full access on day 1, 2, and 3).
          </Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="Enter promo code"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.button, (!code.trim() || isSubmitting) && styles.buttonDisabled]}
            onPress={handleRedeem}
            disabled={!code.trim() || isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Redeeming…' : 'Redeem'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 32,
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

