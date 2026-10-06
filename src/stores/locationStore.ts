import { create } from 'zustand';
import * as Location from 'expo-location';
import ngeohash from 'ngeohash';
import { Coordinates } from '../types';
import { GEOHASH_INCIDENT_PRECISION, GEOHASH_NOTIFICATION_PRECISION } from '../config/constants';

interface LocationState {
  currentCoords: Coordinates | null;
  currentGeohash: string | null;
  currentAreaGeohash: string | null;
  hasLocationPermission: boolean;
  isLocating: boolean;
  locationError: string | null;

  // Actions
  setCoords: (coords: Coordinates) => void;
  refreshLocation: () => Promise<Coordinates | null>;
  checkPermissions: () => Promise<boolean>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentCoords: null,
  currentGeohash: null,
  currentAreaGeohash: null,
  hasLocationPermission: false,
  isLocating: false,
  locationError: null,

  setCoords: (coords: Coordinates) => {
    const gh7 = ngeohash.encode(coords.latitude, coords.longitude, GEOHASH_INCIDENT_PRECISION);
    const gh5 = ngeohash.encode(coords.latitude, coords.longitude, GEOHASH_NOTIFICATION_PRECISION);
    set({
      currentCoords: coords,
      currentGeohash: gh7,
      currentAreaGeohash: gh5,
      locationError: null,
    });
  },

  checkPermissions: async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === Location.PermissionStatus.GRANTED;
      set({ hasLocationPermission: granted });
      return granted;
    } catch (error) {
      console.error('[LocationStore] Error checking permissions:', error);
      return false;
    }
  },

  refreshLocation: async () => {
    set({ isLocating: true, locationError: null });
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== Location.PermissionStatus.GRANTED) {
        set({
          hasLocationPermission: false,
          isLocating: false,
          locationError: 'Location permission denied',
        });
        return null;
      }

      set({ hasLocationPermission: true });

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      get().setCoords(coords);
      set({ isLocating: false });
      return coords;
    } catch (error: any) {
      console.error('[LocationStore] Error getting location:', error);
      set({
        isLocating: false,
        locationError: error?.message || 'Failed to determine location',
      });
      return null;
    }
  },
}));
