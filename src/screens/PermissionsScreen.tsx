import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { useLocationStore } from '../stores/locationStore';
import { notificationService } from '../services/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PermissionsScreenProps {
  onComplete: () => void;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onComplete }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const { refreshLocation } = useLocationStore();

  // Auto-pop the native iOS permission prompt after a brief 400ms delay on mount,
  // matching the Uber experience in the screenshot
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerPermissionsPopup();
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const triggerPermissionsPopup = async () => {
    if (isRequesting) return;
    setIsRequesting(true);

    try {
      // 1. Trigger the native iOS Location permission popup directly
      const locRes = await Location.requestForegroundPermissionsAsync();
      if (locRes.granted) {
        refreshLocation().catch(() => {});
      }

      // 2. Request Notification permission
      await notificationService.registerForPushNotifications().catch(() => {});
      await Notifications.requestPermissionsAsync().catch(() => {});

      // 3. Complete and advance to Geofence setup
      onComplete();
    } catch (e) {
      console.warn('Permission request error:', e);
      onComplete();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Branding (like Uber logo) */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
          <Text style={styles.logoTitle}>VICO</Text>
        </View>
      </View>

      {/* Center Simulated Native Permission Card (Uber-style visual) */}
      <View style={styles.centerContainer}>
        <View style={styles.permissionCard}>
          {/* Card Header & Explanatory Text */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardPromptTitle}>
              Allow “Vico” to use your location?
            </Text>
            <Text style={styles.cardPromptSubtitle}>
              For real-time neighborhood protection, Vico collects location data to display
              active incidents and send instant proximity alerts when threats enter your safe zone.
            </Text>
          </View>

          {/* Styled Map Graphic Snippet */}
          <View style={styles.mapSnippet}>
            {/* Map Grid Pattern */}
            <View style={styles.mapGridRow}>
              <View style={styles.mapGridBlock} />
              <View style={styles.mapGridRoadV} />
              <View style={styles.mapGridBlock} />
            </View>
            <View style={styles.mapGridRoadH} />
            <View style={styles.mapGridRow}>
              <View style={styles.mapGridBlock} />
              <View style={styles.mapGridRoadV} />
              <View style={styles.mapGridBlock} />
            </View>

            {/* "Precise: On" Badge (from native iOS location prompt) */}
            <View style={styles.precisePill}>
              <Ionicons name="navigate" size={13} color="#2979FF" />
              <Text style={styles.preciseText}>Precise: On</Text>
            </View>

            {/* Glowing Blue Location Beacon */}
            <View style={styles.beaconOuterPulse}>
              <View style={styles.beaconCoreDot} />
            </View>
          </View>

          {/* Native Action Buttons Visual */}
          <TouchableOpacity
            style={styles.cardActionRow}
            onPress={triggerPermissionsPopup}
            activeOpacity={0.7}
          >
            <Text style={styles.cardActionText}>Allow While Using App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionRow}
            onPress={triggerPermissionsPopup}
            activeOpacity={0.7}
          >
            <Text style={styles.cardActionText}>Allow Once</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardActionRow, styles.cardActionRowLast]}
            onPress={triggerPermissionsPopup}
            activeOpacity={0.7}
          >
            <Text style={styles.cardActionText}>Don’t Allow</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Pinned "Get Started ->" Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={triggerPermissionsPopup}
          disabled={isRequesting}
          activeOpacity={0.85}
        >
          {isRequesting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF', // Deep vibrant royal blue matching the Uber prompt backdrop
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoTitle: {
    fontSize: 26,
    fontWeight: typography.fontWeights.heavy,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#E8EDF5',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  cardPromptTitle: {
    fontSize: 17,
    fontWeight: typography.fontWeights.bold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  cardPromptSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 17,
  },
  mapSnippet: {
    width: '100%',
    height: 140,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
  },
  mapGridRow: {
    flexDirection: 'row',
    width: '100%',
    height: '45%',
  },
  mapGridBlock: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    margin: 4,
    borderRadius: 4,
  },
  mapGridRoadV: {
    width: 24,
    backgroundColor: '#E2E8F0',
  },
  mapGridRoadH: {
    height: 20,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  precisePill: {
    position: 'absolute',
    top: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  preciseText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: '#2979FF',
  },
  beaconOuterPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(41, 121, 255, 0.25)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconCoreDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2979FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardActionRow: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    backgroundColor: '#E8EDF5',
  },
  cardActionRowLast: {
    borderBottomWidth: 0,
  },
  cardActionText: {
    fontSize: 16,
    fontWeight: typography.fontWeights.semibold,
    color: '#007AFF', // Native iOS system blue
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.xl,
    paddingTop: spacing.md,
  },
  getStartedButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.5,
  },
});
