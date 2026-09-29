import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

export const reapExpiredIncidents = onSchedule('every 1 hours', async () => {
  const db = admin.firestore();
  const storage = admin.storage();
  const bucket = storage.bucket();

  const now = Date.now();
  const expiredSnapshot = await db
    .collection('incidents')
    .where('expiresAt', '<=', now)
    .where('active', '==', true)
    .limit(100)
    .get();

  if (expiredSnapshot.empty) {
    console.log('[Reaper] No expired incidents found.');
    return;
  }

  const deletePromises: Promise<any>[] = [];

  for (const docSnap of expiredSnapshot.docs) {
    const incidentId = docSnap.id;
    const data = docSnap.data();

    // 1. Mark inactive or delete doc
    deletePromises.push(docSnap.ref.delete());

    // 2. Delete storage files
    const mediaPath = `incidents/${incidentId}/media.${data.mediaType === 'video' ? 'mp4' : 'jpg'}`;
    deletePromises.push(
      bucket.file(mediaPath).delete().catch((err) => {
        // Ignore file not found
      })
    );

    // 3. Delete votes subcollection
    const votesSnap = await docSnap.ref.collection('votes').get();
    votesSnap.forEach((vDoc) => {
      deletePromises.push(vDoc.ref.delete());
    });
  }

  await Promise.all(deletePromises);
  console.log(`[Reaper] Successfully reaped ${expiredSnapshot.size} expired incidents.`);
});
