import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';
import { initDB } from './src/services/offlineQueue';
import { ensureFirebaseAuth } from './src/config/firebase';

import { useAuthStore } from './src/stores/authStore';

// Prevent native splash screen from auto-hiding before initialization
SplashScreen.preventAutoHideAsync().catch(() => {});

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    async function prepare() {
      try {
        await Promise.all([initDB(), ensureFirebaseAuth()]);
      } catch (e) {
        console.warn('Initialization error:', e);
      } finally {
        setAppIsReady(true);
        // Hide the static native splash screen so the animated transition takes over seamlessly
        await SplashScreen.hideAsync().catch(() => {});
      }
    }

    prepare();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
        {showSplashOverlay && (
          <AnimatedSplashScreen
            isReady={appIsReady && isHydrated}
            onAnimationComplete={() => setShowSplashOverlay(false)}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
