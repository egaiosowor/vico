import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const deleteUserData = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to delete account data.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  try {
    // 1. Find user's reported incidents
    const incidentsSnap = await db
      .collection('incidents')
      .where('reporterUid', '==', uid)
      .get();

    for (const docSnap of incidentsSnap.docs) {
      const incId = docSnap.id;
      const data = docSnap.data();

      // Delete storage media
      const mediaPath = `incidents/${incId}/media.${data.mediaType === 'video' ? 'mp4' : 'jpg'}`;
      await bucket.file(mediaPath).delete().catch(() => {});

      // Delete incident
      await docSnap.ref.delete();
    }

    // 2. Delete user doc
    await db.collection('users').doc(uid).delete();

    // 3. Delete Firebase Auth account
    await admin.auth().deleteUser(uid);

    return { success: true, message: 'Account and associated reports deleted.' };
  } catch (error: any) {
    throw new HttpsError('internal', error?.message || 'Failed to delete user account data.');
  }
});
