import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { geohashService } from './geohashService';
import { IncidentCategory } from '../types';

interface BroadcastParams {
  incidentId: string;
  category: IncidentCategory;
  description: string;
  geohashArea: string; // 5-char geohash
  reporterUid?: string;
}

export const pushBroadcastService = {
  broadcastProximityAlert: async ({
    incidentId,
    category,
    description,
    geohashArea,
    reporterUid,
  }: BroadcastParams): Promise<void> => {
    try {
      if (!geohashArea) return;

      // 1. Calculate 9 surrounding area prefixes (center + 8 neighbors)
      const surroundingPrefixes = geohashService.getQueryPrefixes(0, 0); // We'll compute from geohashArea
      const { latitude, longitude } = geohashService.decode(geohashArea);
      const prefixes = geohashService.getQueryPrefixes(latitude, longitude);

      // 2. Query all users whose safe zone matches any of the 9 prefixes
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('safeZoneGeohash', 'in', prefixes));
      const querySnap = await getDocs(q);

      const targetTokens: string[] = [];

      querySnap.forEach((docSnap) => {
        const data = docSnap.data();

        // Never alert the reporter themselves
        if (docSnap.id === reporterUid) return;

        // Respect notification preference
        if (data.notificationPref === 'critical_only' && category !== 'critical') {
          return;
        }

        if (data.fcmToken && typeof data.fcmToken === 'string') {
          targetTokens.push(data.fcmToken);
        }
      });

      if (targetTokens.length === 0) return;

      const title =
        category === 'critical'
          ? '🚨 CRITICAL INCIDENT NEARBY'
          : category === 'civic'
          ? '⚠️ Civic Hazard Reported'
          : '📍 Community Alert';

      const body = description || 'New verified incident reported in your safe zone.';

      // 3. Dispatch to Expo's free Push Notification API
      const messages = targetTokens.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: { incidentId, category },
        channelId: 'emergency_alerts',
        priority: 'high',
      }));

      // Expo supports batches of up to 100 messages per request
      const chunks: typeof messages[] = [];
      for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100));
      }

      await Promise.all(
        chunks.map((chunk) =>
          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(chunk),
          })
        )
      );

      console.log(`[PushBroadcast] Successfully alerted ${targetTokens.length} nearby neighbors.`);
    } catch (error) {
      console.warn('[PushBroadcast] Error dispatching push broadcast:', error);
    }
  },
};
