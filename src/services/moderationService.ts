import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';

const FLAGGED_INCIDENTS_STORAGE_KEY = 'nightwatch_flagged_incident_ids';

export type FlagReason =
  | 'false_report'
  | 'inappropriate_media'
  | 'spam_harassment'
  | 'privacy_risk'
  | 'other';

export interface FlagOption {
  key: FlagReason;
  label: string;
  description: string;
  icon: string;
}

export const FLAG_OPTIONS: FlagOption[] = [
  {
    key: 'false_report',
    label: 'False or Misleading Report',
    description: 'Information appears fabricated, inaccurate, or outdated.',
    icon: 'alert-circle-outline',
  },
  {
    key: 'inappropriate_media',
    label: 'Inappropriate or Graphic Media',
    description: 'Contains disturbing, violent, or explicit imagery.',
    icon: 'eye-off-outline',
  },
  {
    key: 'spam_harassment',
    label: 'Spam or Harassment',
    description: 'Commercial advertisement, trolling, or targeted abuse.',
    icon: 'warning-outline',
  },
  {
    key: 'privacy_risk',
    label: 'Privacy or Safety Risk',
    description: 'Exposes private identities, phone numbers, or active threats.',
    icon: 'shield-outline',
  },
  {
    key: 'other',
    label: 'Other Concern',
    description: 'Any other safety or moderation policy violation.',
    icon: 'help-circle-outline',
  },
];

class ModerationService {
  private cachedFlaggedIds: Set<string> = new Set();
  private isLoaded = false;

  /**
   * Load previously flagged incident IDs from AsyncStorage into memory cache.
   */
  async init(): Promise<string[]> {
    if (this.isLoaded) {
      return Array.from(this.cachedFlaggedIds);
    }
    try {
      const stored = await AsyncStorage.getItem(FLAGGED_INCIDENTS_STORAGE_KEY);
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        this.cachedFlaggedIds = new Set(ids);
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('[ModerationService] Failed to load flagged IDs from storage:', e);
    }
    return Array.from(this.cachedFlaggedIds);
  }

  /**
   * Returns whether a given incident ID was flagged by the local user.
   */
  isFlagged(incidentId: string): boolean {
    return this.cachedFlaggedIds.has(incidentId);
  }

  /**
   * Returns all flagged incident IDs.
   */
  getFlaggedIds(): string[] {
    return Array.from(this.cachedFlaggedIds);
  }

  /**
   * Submit a flag / report for an incident.
   */
  async flagIncident(
    incidentId: string,
    userId: string,
    reason: FlagReason,
    customNote?: string
  ): Promise<boolean> {
    try {
      // 1. Add to local memory cache
      this.cachedFlaggedIds.add(incidentId);

      // 2. Persist to AsyncStorage
      const currentList = Array.from(this.cachedFlaggedIds);
      await AsyncStorage.setItem(
        FLAGGED_INCIDENTS_STORAGE_KEY,
        JSON.stringify(currentList)
      );

      // 3. Attempt Firestore submission (resilient to offline / placeholder keys)
      try {
        const reportsCol = collection(db, 'incident_reports');
        await addDoc(reportsCol, {
          incidentId,
          flaggedBy: userId || 'anonymous',
          reason,
          customNote: customNote || null,
          timestamp: Date.now(),
          status: 'pending_review',
        });

        // Optionally increment flag count on the incident itself
        const incidentDoc = doc(db, 'incidents', incidentId);
        await updateDoc(incidentDoc, {
          flagCount: increment(1),
        }).catch(() => {
          // Incident document might be mock or read-only
        });
      } catch (firestoreError) {
        // Safe fallback if offline or mock Firestore
        console.log('[ModerationService] Firestore sync skipped/offline:', firestoreError);
      }

      return true;
    } catch (e) {
      console.error('[ModerationService] Failed to flag incident:', e);
      return false;
    }
  }

  /**
   * Clear all locally flagged incidents (useful for development/testing).
   */
  async clearAllFlagged(): Promise<void> {
    this.cachedFlaggedIds.clear();
    await AsyncStorage.removeItem(FLAGGED_INCIDENTS_STORAGE_KEY);
  }
}

export const moderationService = new ModerationService();
