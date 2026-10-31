import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/authStore';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { initDB } from '../services/offlineQueue';
import { InAppAlertBanner } from '../components/InAppAlertBanner';

// Screens
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { NameSetupScreen } from '../screens/NameSetupScreen';
import { GeofenceSetupScreen } from '../screens/GeofenceSetupScreen';
import { MainMapScreen } from '../screens/MainMapScreen';
import { CameraCaptureScreen } from '../screens/CameraCaptureScreen';
import { ConfirmationScreen } from '../screens/ConfirmationScreen';
import { IncidentPlaybackScreen } from '../screens/IncidentPlaybackScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CirclesScreen } from '../screens/CirclesScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { AcceptInviteScreen } from '../screens/AcceptInviteScreen';
import { colors } from '../theme/theme';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'vico://', 'nightwatch://'],
  config: {
    screens: {
      MainMap: 'feed',
      Circles: 'circles',
      ChatRoom: 'chat',
      IncidentPlayback: 'incident/:incidentId',
      AcceptInvite: 'invite/:inviteId',
    },
  },
};


export const navigationRef = createNavigationContainerRef<any>();

const Stack = createStackNavigator();

export const RootNavigator: React.FC = () => {
  const { user, isAuthenticated, isOnboarded, isHydrated } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Check if profile has been completed (first/last name provided)
  const isProfileComplete = Boolean(
    user?.isProfileComplete ?? (user?.fullName && user.fullName.trim().length > 0)
  );

  // Activate background network-sync monitor
  useNetworkSync();

  useEffect(() => {
    initDB()
      .catch((e) => console.warn('Database init error:', e))
      .finally(() => setIsInitializing(false));
  }, []);

  if (isInitializing || !isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.critical} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: colors.background },
          }}
        >
          {!isAuthenticated ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Auth" component={AuthScreen} />
            </>
          ) : !isProfileComplete ? (
            <Stack.Screen name="NameSetup" component={NameSetupScreen} />
          ) : !isOnboarded ? (
            <Stack.Screen name="GeofenceSetup" component={GeofenceSetupScreen} />
          ) : (
            <>
              <Stack.Screen name="MainMap" component={MainMapScreen} />
              <Stack.Screen
                name="CameraCapture"
                component={CameraCaptureScreen}
                options={{
                  presentation: 'card',
                }}
              />
              <Stack.Screen
                name="Confirmation"
                component={ConfirmationScreen as any}
                options={{
                  presentation: 'card',
                }}
              />
              <Stack.Screen
                name="IncidentPlayback"
                component={IncidentPlaybackScreen as any}
                options={{
                  presentation: 'card',
                  cardStyle: { backgroundColor: '#000000' },
                }}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="GeofenceSetup" component={GeofenceSetupScreen} />
              <Stack.Screen name="Circles" component={CirclesScreen} />
              <Stack.Screen name="ChatRoom" component={ChatRoomScreen as any} />
              <Stack.Screen
                name="AcceptInvite"
                component={AcceptInviteScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Realtime In-App Notification Alert Banner */}
      <InAppAlertBanner
        onPressAlert={(alert) => {
          if (alert.incidentId && navigationRef.isReady()) {
            navigationRef.navigate('IncidentPlayback', { incidentId: alert.incidentId });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
