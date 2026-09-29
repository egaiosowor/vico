import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const calculateTier = (score: number): string => {
  if (score >= 500) return 'Sentinel';
  if (score >= 200) return 'Guardian';
  if (score >= 50) return 'Patrol';
  return 'New Watch';
};

export const onVoteCreated = onDocumentWritten(
  'incidents/{incidentId}/votes/{voteId}',
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Determine score delta for reporter
    let scoreDelta = 0;

    const beforeVote = beforeData?.voteType;
    const afterVote = afterData?.voteType;

    if (!beforeVote && afterVote) {
      // New vote
      scoreDelta = afterVote === 'up' ? 2 : -1;
    } else if (beforeVote && !afterVote) {
      // Vote removed
      scoreDelta = beforeVote === 'up' ? -2 : 1;
    } else if (beforeVote && afterVote && beforeVote !== afterVote) {
      // Switched vote
      scoreDelta = afterVote === 'up' ? 3 : -3;
    }

    if (scoreDelta === 0) return;

    const incidentId = event.params.incidentId;
    const db = admin.firestore();

    const incidentDoc = await db.collection('incidents').doc(incidentId).get();
    if (!incidentDoc.exists) return;

    const reporterUid = incidentDoc.data()?.reporterUid;
    if (!reporterUid || reporterUid === 'anonymous') return;

    const userRef = db.collection('users').doc(reporterUid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return;

      const currentScore = userDoc.data()?.watchdogScore || 0;
      const newScore = Math.max(0, currentScore + scoreDelta);
      const newTier = calculateTier(newScore);

      transaction.update(userRef, {
        watchdogScore: newScore,
        tier: newTier,
      });
    });
  }
);
