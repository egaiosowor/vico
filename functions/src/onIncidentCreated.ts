import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const calculateTier = (score: number): string => {
  if (score >= 500) return 'Sentinel';
  if (score >= 200) return 'Guardian';
  if (score >= 50) return 'Patrol';
  return 'New Watch';
};

export const onIncidentCreated = onDocumentCreated('incidents/{incidentId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const incident = snapshot.data();
  const reporterUid = incident.reporterUid;

  if (!reporterUid || reporterUid === 'anonymous') return;

  const db = admin.firestore();
  const userRef = db.collection('users').doc(reporterUid);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return;

    const currentScore = userDoc.data()?.watchdogScore || 0;
    const newScore = Math.max(0, currentScore + 5);
    const newTier = calculateTier(newScore);

    transaction.update(userRef, {
      watchdogScore: newScore,
      tier: newTier,
      reportCount: admin.firestore.FieldValue.increment(1),
    });
  });
});
