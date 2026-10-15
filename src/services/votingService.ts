import { doc, getDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { VoteType } from '../types';
import { SCORE_VALUES } from '../config/constants';

export const votingService = {
  getUserVote: async (incidentId: string, uid: string): Promise<VoteType | null> => {
    try {
      const voteRef = doc(db, 'incidents', incidentId, 'votes', uid);
      const snap = await getDoc(voteRef);
      if (snap.exists()) {
        return (snap.data().voteType as VoteType) || null;
      }
      return null;
    } catch (e) {
      console.warn('[votingService] Error fetching user vote:', e);
      return null;
    }
  },

  castVote: async (
    incidentId: string,
    uid: string,
    newVote: VoteType
  ): Promise<{ userVote: VoteType | null; upvotesDelta: number; downvotesDelta: number }> => {
    const incidentRef = doc(db, 'incidents', incidentId);
    const voteRef = doc(db, 'incidents', incidentId, 'votes', uid);

    let finalVote: VoteType | null = newVote;
    let upDelta = 0;
    let downDelta = 0;
    let reporterScoreDelta = 0;
    let reporterUid: string | null = null;

    await runTransaction(db, async (transaction) => {
      const incidentSnap = await transaction.get(incidentRef);
      if (incidentSnap.exists()) {
        reporterUid = incidentSnap.data().reporterUid || null;
      }

      const voteDoc = await transaction.get(voteRef);

      if (!voteDoc.exists()) {
        // First time voting
        transaction.set(voteRef, {
          voteType: newVote,
          timestamp: Date.now(),
        });
        if (newVote === 'up') {
          upDelta = 1;
          reporterScoreDelta = SCORE_VALUES.UPVOTE_RECEIVED; // +2
        } else {
          downDelta = 1;
          reporterScoreDelta = SCORE_VALUES.DOWNVOTE_RECEIVED; // -1
        }
        finalVote = newVote;
      } else {
        const existingVote = voteDoc.data().voteType as VoteType;
        if (existingVote === newVote) {
          // Un-vote
          transaction.delete(voteRef);
          if (newVote === 'up') {
            upDelta = -1;
            reporterScoreDelta = -SCORE_VALUES.UPVOTE_RECEIVED; // -2
          } else {
            downDelta = -1;
            reporterScoreDelta = -SCORE_VALUES.DOWNVOTE_RECEIVED; // +1
          }
          finalVote = null;
        } else {
          // Switch vote
          transaction.update(voteRef, {
            voteType: newVote,
            timestamp: Date.now(),
          });
          if (newVote === 'up') {
            upDelta = 1;
            downDelta = -1;
            reporterScoreDelta = SCORE_VALUES.UPVOTE_RECEIVED - SCORE_VALUES.DOWNVOTE_RECEIVED; // +3
          } else {
            upDelta = -1;
            downDelta = 1;
            reporterScoreDelta = SCORE_VALUES.DOWNVOTE_RECEIVED - SCORE_VALUES.UPVOTE_RECEIVED; // -3
          }
          finalVote = newVote;
        }
      }

      // Update incident counters
      transaction.update(incidentRef, {
        upvotes: increment(upDelta),
        downvotes: increment(downDelta),
      });

      // Update reporter score if valid
      if (reporterUid && reporterUid !== 'anonymous' && reporterScoreDelta !== 0) {
        const reporterUserRef = doc(db, 'users', reporterUid);
        transaction.update(reporterUserRef, {
          watchdogScore: increment(reporterScoreDelta),
        });
      }
    });

    return {
      userVote: finalVote,
      upvotesDelta: upDelta,
      downvotesDelta: downDelta,
    };
  },

  incrementViewCount: async (incidentId: string): Promise<void> => {
    try {
      const incidentRef = doc(db, 'incidents', incidentId);
      await updateDoc(incidentRef, {
        viewCount: increment(1),
      });
    } catch (e) {
      // Non-critical, ignore
    }
  },
};
