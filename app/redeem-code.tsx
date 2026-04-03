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
import { getStableUserId, savePromoRedeemSnapshot } from '@/services/subscriptionService';
import Constants from 'expo-constants';

function getBackendBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
  if (env && typeof env === 'string' && env.trim()) return env.trim().replace(/\/$/, '');
  return null;
}

const REDEEM_FETCH_ATTEMPTS = 4;

/** POST can fail transiently on mobile / cold Render while GET works; retry with backoff. */
async function postPromoRedeem(endpoint: string, payload: { code: string; user_id: string }): Promise<Response> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  };
  let lastErr: unknown;
  for (let i = 0; i < REDEEM_FETCH_ATTEMPTS; i++) {
    try {
      const res = await fetch(endpoint, init);
      return res;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Promo][Client] redeem fetch attempt ${i + 1}/${REDEEM_FETCH_ATTEMPTS} failed:`, msg);
      if (i < REDEEM_FETCH_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 900 * (i + 1)));
      }
    }
  }
  throw lastErr;
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
      Alert.alert(
        'Backend not configured',
        'Set EXPO_PUBLIC_VIDEO_BACKEND_URL in .env to your Render backend URL, then restart Expo.'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const userId = await getStableUserId();
      const endpoint = `${base}/promo/redeem`;
      const payload = { code: code.trim().toUpperCase(), user_id: userId };
      console.log('[Promo][Client] redeem request', { endpoint, payload });
      try {
        await fetch(`${base.replace(/\/$/, '')}/health`, { method: 'GET' }).catch(() => undefined);
      } catch {
        /* ignore — warm Render / DNS before POST */
      }
      const res = await postPromoRedeem(endpoint, payload);
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }
      console.log('[Promo][Client] redeem response', {
        endpoint,
        status: res.status,
        ok: res.ok,
        body: data,
      });
      if (res.ok && data.success) {
        const redeemedCode = code.trim().toUpperCase();
        await savePromoRedeemSnapshot(redeemedCode, userId);
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
        Alert.alert('Error', data?.error || 'Could not redeem code.');
      }
    } catch (err) {
      console.error('Redeem code error:', err);
      const isNetwork =
        err instanceof TypeError &&
        (String(err.message).includes('Network request failed') || String(err.message).includes('Failed to fetch'));
      Alert.alert(
        'Could not reach server',
        isNetwork
          ? 'Your phone could not complete the request to the Cooked backend. Try again in a few seconds, switch Wi‑Fi/cellular, or open Render logs to confirm the service is up. GET /health and GET /promo/entitlement working but POST failing usually means a transient drop—retries often fix it.'
          : 'Failed to redeem code. Please try again.'
      );
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
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Redeem promo code</Text>
          <Text style={styles.subtitle}>
            Access lasts through the end of the last calendar day of your promo (UTC). For example, redeem on a Thursday
            with a 3-day code → use through the end of Monday.
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

