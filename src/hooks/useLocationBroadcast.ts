import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useLocationStore } from '../stores/locationStore';
import { publishMyLocation } from '../services/watchService';

const BROADCAST_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Foreground-only location broadcast hook.
 *
 * Polls every 15 seconds while the app is active and the user has
 * location sharing enabled. Writes to user_locations/{uid} in Firestore.
 *
 * No expo-task-manager required — stops automatically when the app
 * is backgrounded. Member pins go semi-transparent after 60s of no update.
 */
export const useLocationBroadcast = () => {
  const myUid = useAuthStore((state) => state.user?.uid ?? null);
  const isLocationSharing = useSocialStore((state) => state.isLocationSharing);
  const currentCoords = useLocationStore((state) => state.currentCoords);
  const refreshLocation = useLocationStore((state) => state.refreshLocation);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearBroadcast = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startBroadcast = () => {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(async () => {
      if (!myUid || !isLocationSharing) {
        clearBroadcast();
        return;
      }
      if (appStateRef.current !== 'active') return;

      try {
        let coords = currentCoords;
        if (!coords) {
          coords = await refreshLocation();
        }
        if (coords) {
          await publishMyLocation(myUid, coords);
        }
      } catch (err) {
        // Silent — location failures should never crash the app
        console.warn('[useLocationBroadcast] publish error:', err);
      }
    }, BROADCAST_INTERVAL_MS);
  };

  // Listen for app foreground/background transitions
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && myUid && isLocationSharing) {
        startBroadcast();
      } else if (nextState !== 'active') {
        clearBroadcast();
      }
    });
    return () => sub.remove();
  }, [myUid, isLocationSharing]);

  // Start/stop based on sharing toggle and auth state
  useEffect(() => {
    if (myUid && isLocationSharing && appStateRef.current === 'active') {
      startBroadcast();
    } else {
      clearBroadcast();
    }
    return clearBroadcast;
  }, [myUid, isLocationSharing]);
};
