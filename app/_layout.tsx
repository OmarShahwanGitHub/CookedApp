import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { Keyboard, TouchableWithoutFeedback } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RecipeProvider } from '@/context/RecipeContext';
import { initializeSubscriptions } from '@/services/subscriptionService';
import { isUpdateRequired } from '@/services/versionService';
import UpdateRequiredScreen from '@/components/UpdateRequiredScreen';
import Colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-recipe"
        options={{
          presentation: 'modal',
          title: 'Add Recipe',
        }}
      />
      <Stack.Screen
        name="recipe/[id]"
        options={{
          title: 'Recipe',
        }}
      />
      <Stack.Screen
        name="redeem-code"
        options={{
          title: 'Redeem promo code',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [updateRequired, setUpdateRequired] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isUpdateRequired()
      .then((required) => {
        if (!cancelled) setUpdateRequired(required);
      })
      .catch(() => {
        if (!cancelled) setUpdateRequired(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (updateRequired === null) return;
    SplashScreen.hideAsync();
    if (!updateRequired) initializeSubscriptions().catch(console.warn);
  }, [updateRequired]);

  if (updateRequired === null) return null;
  if (updateRequired) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UpdateRequiredScreen />
      </GestureHandlerRootView>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <RecipeProvider>
            <RootLayoutNav />
          </RecipeProvider>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
