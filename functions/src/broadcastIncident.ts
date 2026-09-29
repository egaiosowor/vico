import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import ngeohash from 'ngeohash';

export const broadcastIncident = onDocumentCreated('incidents/{incidentId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const incident = snapshot.data();
  const incidentId = event.params.incidentId;
  const category = incident.category || 'community';
  const reporterUid = incident.reporterUid;
  const geohashArea = incident.geohashArea; // 5-char geohash

  if (!geohashArea) return;

  // Calculate 9 surrounding area prefixes (center + 8 neighbors)
  const neighbors = ngeohash.neighbors(geohashArea);
  const targetPrefixes = [geohashArea, ...neighbors];

  const db = admin.firestore();

  // Query users whose safeZoneGeohash matches any of the 9 prefixes
  const usersSnapshot = await db
    .collection('users')
    .where('safeZoneGeohash', 'in', targetPrefixes)
    .get();

  const tokensToSend: string[] = [];
  const tokenToUserDoc: Record<string, admin.firestore.DocumentReference> = {};

  usersSnapshot.forEach((docSnap) => {
    const userData = docSnap.data();

    // 1. Never notify the reporter themselves
    if (docSnap.id === reporterUid) return;

    // 2. Filter by notification preferences
    if (userData.notificationPref === 'critical_only' && category !== 'critical') {
      return;
    }

    if (userData.fcmToken) {
      tokensToSend.push(userData.fcmToken);
      tokenToUserDoc[userData.fcmToken] = docSnap.ref;
    }
  });

  if (tokensToSend.length === 0) return;

  const title =
    category === 'critical'
      ? '🚨 CRITICAL INCIDENT NEARBY'
      : category === 'civic'
      ? '⚠️ Civic Issue Reported'
      : '📍 Community Alert';

  const body = incident.description || 'New verified incident reported in your neighborhood.';

  const message: admin.messaging.MulticastMessage = {
    tokens: tokensToSend,
    notification: {
      title,
      body,
    },
    data: {
      incidentId,
      category,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'emergency_alerts',
        color: category === 'critical' ? '#FFAB40' : '#40C4FF',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Prune invalid tokens
  const prunePromises: Promise<any>[] = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const error = resp.error;
      if (
        error?.code === 'messaging/invalid-registration-token' ||
        error?.code === 'messaging/registration-token-not-registered'
      ) {
        const token = tokensToSend[idx];
        const userRef = tokenToUserDoc[token];
        if (userRef) {
          prunePromises.push(userRef.update({ fcmToken: admin.firestore.FieldValue.delete() }));
        }
      }
    }
  });

  if (prunePromises.length > 0) {
    await Promise.all(prunePromises);
  }
});
