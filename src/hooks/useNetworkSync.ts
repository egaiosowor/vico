import { useEffect } from 'react';
import * as Network from 'expo-network';
import { syncWorker } from '../services/syncWorker';
import { useAuthStore } from '../stores/authStore';

export const useNetworkSync = () => {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let interval: any = null;

    const checkAndSync = async () => {
      try {
        const netState = await Network.getNetworkStateAsync();
        if (netState.isConnected && netState.isInternetReachable) {
          syncWorker.processQueue(user?.uid);
        }
      } catch (e) {
        // Silently ignore network status check errors
      }
    };

    // Initial check
    checkAndSync();

    // Check periodically for network resumption
    interval = setInterval(checkAndSync, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.uid]);
};
