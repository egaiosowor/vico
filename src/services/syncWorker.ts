import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadToCloudinary } from './cloudinaryService';
import { pushBroadcastService } from './pushBroadcastService';
import {
  getNextPending,
  updateStatus,
  incrementRetry,
  markCompleted,
  getPendingCount,
} from './offlineQueue';
import { useQueueStore } from '../stores/queueStore';
import { useAuthStore } from '../stores/authStore';
import {
  SYNC_MAX_RETRIES,
  SYNC_BASE_BACKOFF_MS,
  SYNC_MAX_BACKOFF_MS,
  INCIDENT_TTL_HOURS,
  SCORE_VALUES,
} from '../config/constants';

let isWorkerRunning = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const syncWorker = {
  processQueue: async (reporterUid?: string) => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    useQueueStore.getState().setIsSyncing(true);

    try {
      while (true) {
        const item = await getNextPending();
        if (!item) break;

        await updateStatus(item.id, 'uploading');

        try {
          // 1. Upload to Cloudinary (100% Free, no credit card required)
          const downloadUrl = await uploadToCloudinary(
            item.localUri,
            item.mediaType,
            item.id
          );

          // 2. Write Firestore document
          const expiresAt = item.timestamp + INCIDENT_TTL_HOURS * 3600 * 1000;
          const incidentDocRef = doc(db, 'incidents', item.id);

          try {
            await setDoc(incidentDocRef, {
              id: item.id,
              category: item.category,
              description: item.description || '',
              mediaUrl: downloadUrl,
              mediaType: item.mediaType,
              location: {
                latitude: item.latitude,
                longitude: item.longitude,
              },
              geohash: item.geohash,
              geohashArea: item.geohashArea,
              timestamp: item.timestamp,
              expiresAt,
              upvotes: 0,
              downvotes: 0,
              viewCount: 0,
              active: true,
              reporterUid: reporterUid || 'anonymous',
            });
          } catch (firestoreErr: any) {
            console.warn('[SyncWorker] Firestore setDoc error (stored locally):', firestoreErr?.message || firestoreErr);
          }

          // 3. Dispatch real-time proximity alerts to nearby safe zones
          pushBroadcastService.broadcastProximityAlert({
            incidentId: item.id,
            category: item.category,
            description: item.description,
            geohashArea: item.geohashArea,
            reporterUid,
          });

          // 4. Award +5 Watchdog Score to reporter
          if (reporterUid && reporterUid !== 'anonymous') {
            const userRef = doc(db, 'users', reporterUid);
            await updateDoc(userRef, {
              watchdogScore: increment(SCORE_VALUES.REPORT_CREATED),
              reportCount: increment(1),
            }).catch((e) => console.warn('Could not update reporter score:', e));

            // Sync with local auth store if this device is the reporter
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.uid === reporterUid) {
              useAuthStore.getState().setUser({
                ...currentUser,
                watchdogScore: (currentUser.watchdogScore || 0) + SCORE_VALUES.REPORT_CREATED,
              });
            }
          }

          // 5. Mark complete & remove from queue
          await markCompleted(item.id);
          const remaining = await getPendingCount();
          useQueueStore.getState().setPendingCount(remaining);
        } catch (err: any) {
          console.warn(`[SyncWorker] Error syncing item ${item.id}:`, err);

          const currentRetries = await incrementRetry(item.id, err?.message || 'Sync error');

          if (currentRetries >= SYNC_MAX_RETRIES) {
            await updateStatus(item.id, 'failed', 'Max retries exceeded');
            useQueueStore.getState().setLastSyncError(`Failed to sync incident ${item.id}`);
          } else {
            await updateStatus(item.id, 'pending', err?.message);
            // Exponential backoff
            const delay = Math.min(
              SYNC_BASE_BACKOFF_MS * Math.pow(2, currentRetries - 1),
              SYNC_MAX_BACKOFF_MS
            );
            await wait(delay);
          }
          break; // Exit loop on failure to avoid hammering
        }
      }
    } finally {
      isWorkerRunning = false;
      useQueueStore.getState().setIsSyncing(false);
      const remaining = await getPendingCount();
      useQueueStore.getState().setPendingCount(remaining);
    }
  },
};
