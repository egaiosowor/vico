import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ngeohash from 'ngeohash';
import Slider from '@react-native-community/slider';
import { spacing, typography } from '../theme/theme';
import { darkMapStyle } from '../theme/darkMapStyle';
import {
  DEFAULT_SAFE_ZONE_RADIUS_KM,
  MIN_SAFE_ZONE_RADIUS_KM,
  MAX_SAFE_ZONE_RADIUS_KM,
  GEOHASH_NOTIFICATION_PRECISION,
} from '../config/constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { notificationService } from '../services/notificationService';
import { useLocationStore } from '../stores/locationStore';
import { useAuthStore } from '../stores/authStore';

const DEFAULT_CENTER = { latitude: 6.5244, longitude: 3.3792 }; // Lagos fallback

export const GeofenceSetupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentCoords, refreshLocation } = useLocationStore();
  const { updateSafeZone } = useAuthStore();
  const mapRef = useRef<MapView | null>(null);

  const [radiusKm, setRadiusKm] = useState(DEFAULT_SAFE_ZONE_RADIUS_KM);
  const [isSaving, setIsSaving] = useState(false);
  const [heading, setHeading] = useState<number>(0);
  const [sliderWidth, setSliderWidth] = useState<number>(0);

  // Watch device compass heading for directional indicator
  useEffect(() => {
    let headingSub: Location.LocationSubscription | null = null;
    let isMounted = true;

    const startHeadingWatch = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status === Location.PermissionStatus.GRANTED && isMounted) {
          headingSub = await Location.watchHeadingAsync((headingData) => {
            if (!isMounted) return;
            const h = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
            if (h >= 0) {
              setHeading(Math.round(h));
            }
          });
        }
      } catch (err) {
        console.warn('Heading watch initialization failed:', err);
      }
    };

    startHeadingWatch();

    return () => {
      isMounted = false;
      headingSub?.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      // 1. Request native Location permission first
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch (e) {
        console.warn('Location permission request failed:', e);
      }

      // Small delay to allow iOS to complete dismissing the Location dialog
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 2. Request native Notification permission sequentially
      try {
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
      } catch (e) {
        console.warn('Notification permission request failed:', e);
      }

      // Small delay to allow iOS to complete dismissing the Notification dialog
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 3. Request native Camera permission sequentially
      try {
        await Camera.requestCameraPermissionsAsync();
      } catch (e) {
        console.warn('Camera permission request failed:', e);
      }

      // 3. Trigger GPS refresh and push token registration in background
      refreshLocation()
        .then((coords) => {
          if (coords) {
            mapRef.current?.animateToRegion(
              {
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              600
            );
          }
        })
        .catch(() => {});

      notificationService.registerForPushNotifications().catch(() => {});
    })();
  }, []);

  const center = currentCoords || DEFAULT_CENTER;

  // Calculate position of the floating tooltip directly above the slider thumb
  const minRadius = MIN_SAFE_ZONE_RADIUS_KM;
  const maxRadius = MAX_SAFE_ZONE_RADIUS_KM;
  const sliderRatio = Math.max(0, Math.min(1, (radiusKm - minRadius) / (maxRadius - minRadius)));
  const THUMB_OFFSET = 15;
  const TOOLTIP_WIDTH = 46;
  const availableTrack = sliderWidth > 0 ? sliderWidth - THUMB_OFFSET * 2 : 0;
  const thumbX = THUMB_OFFSET + sliderRatio * availableTrack;
  const tooltipLeft = Math.max(0, Math.min(sliderWidth - TOOLTIP_WIDTH, thumbX - TOOLTIP_WIDTH / 2));
  const caretLeft = thumbX - tooltipLeft - 5;

  const roundedRadius = Math.round(radiusKm * 10) / 10;
  const formattedRadius = roundedRadius % 1 === 0 ? `${roundedRadius}` : `${roundedRadius.toFixed(1)}`;

  const handleRecenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      400
    );
  };

  const handleConfirmSafeZone = async () => {
    setIsSaving(true);
    try {
      const wasAlreadyOnboarded = useAuthStore.getState().isOnboarded;
      const gh5 = ngeohash.encode(center.latitude, center.longitude, GEOHASH_NOTIFICATION_PRECISION);
      await updateSafeZone(gh5, center, radiusKm);

      if (wasAlreadyOnboarded && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainMap' }],
        });
      }
    } catch (error: any) {
      console.error('[GeofenceSetupScreen] handleConfirmSafeZone error:', error);
      Alert.alert('Save Failed', error?.message || 'Failed to save alert radius.');
    } finally {
      setIsSaving(false);
    }
  };

  const initialRegion = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          customMapStyle={darkMapStyle}
          userInterfaceStyle="dark"
        >
          {/* Safe Zone Boundary Circle */}
          <Circle
            center={center}
            radius={radiusKm * 1000} // meters
            strokeWidth={2}
            strokeColor="#FFFFFF"
            fillColor="rgba(255, 255, 255, 0.12)"
          />

          {/* Directional Location Indicator Anchored to Live Location */}
          <Marker
            coordinate={center}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={true}
          >
            <View style={styles.directionalMarkerContainer}>
              {/* Heading Beam & Pointer (Rotates with user heading) */}
              <View
                style={[
                  styles.headingRotator,
                  { transform: [{ rotate: `${heading}deg` }] },
                ]}
              >
                <View style={styles.headingBeam} />
                <View style={styles.headingPointer} />
              </View>

              {/* Ambient GPS Pulse Ring */}
              <View style={styles.puckPulseHalo} />

              {/* Center Location Puck */}
              <View style={styles.puckOuter}>
                <View style={styles.puckInner} />
              </View>
            </View>
          </Marker>
        </MapView>

        {/* Floating Back Button (if navigated from Profile) */}
        {navigation.canGoBack() && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Recenter on Live Location Button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={25} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Bottom Floating Control Bar */}
        <View style={styles.bottomCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Set Your Alert Radius</Text>
            <Text style={styles.cardSub}>
              You'll receive real-time alerts for incidents occurring within this distance of your location.
            </Text>
          </View>

          {/* Smooth Radius Slider with Floating Tooltip */}
          <View
            style={styles.sliderContainer}
            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
          >
            {/* Tooltip Speech Bubble above Slider Thumb */}
            {sliderWidth > 0 && (
              <View
                style={[styles.tooltipContainer, { left: tooltipLeft }]}
                pointerEvents="none"
              >
                <View style={styles.tooltipBubble}>
                  <Text style={styles.tooltipText}>{formattedRadius}</Text>
                </View>
                <View style={[styles.tooltipCaret, { left: Math.max(6, Math.min(TOOLTIP_WIDTH - 16, caretLeft)) }]} />
              </View>
            )}

            <Slider
              style={styles.slider}
              minimumValue={MIN_SAFE_ZONE_RADIUS_KM}
              maximumValue={MAX_SAFE_ZONE_RADIUS_KM}
              step={0.1}
              value={radiusKm}
              onValueChange={(val) => setRadiusKm(Math.round(val * 10) / 10)}
              minimumTrackTintColor="#FFFFFF"
              maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
              thumbTintColor="#FFFFFF"
            />
            <View style={styles.sliderLimits}>
              <Text style={styles.limitText}>{MIN_SAFE_ZONE_RADIUS_KM} km</Text>
              <Text style={styles.limitText}>{MAX_SAFE_ZONE_RADIUS_KM} km</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, isSaving && { opacity: 0.7 }]}
            onPress={handleConfirmSafeZone}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Alert Radius</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  directionalMarkerContainer: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingRotator: {
    position: 'absolute',
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingBeam: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderTopWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 122, 255, 0.38)',
  },
  headingPointer: {
    position: 'absolute',
    top: 15,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#007AFF',
  },
  puckPulseHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.18)',
  },
  puckOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  puckInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
  },
  bottomCard: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeader: {
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
    lineHeight: 18,
  },
  sliderContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingTop: 36,
    position: 'relative',
  },
  tooltipContainer: {
    position: 'absolute',
    top: 0,
    width: 46,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipBubble: {
    backgroundColor: '#252733',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tooltipCaret: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#252733',
    alignSelf: 'flex-start',
    marginTop: -0.5,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderLimits: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: -4,
    marginBottom: spacing.xs,
  },
  limitText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: typography.fontWeights.semibold,
  },
  confirmButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  recenterButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 270,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 20,
  },
});
