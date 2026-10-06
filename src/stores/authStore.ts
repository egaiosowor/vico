import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserTier } from '../types';
import { USER_TIERS } from '../config/constants';
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export const calculateTier = (score: number): UserTier => {
  if (score >= USER_TIERS.SENTINEL.min) return 'Sentinel';
  if (score >= USER_TIERS.GUARDIAN.min) return 'Guardian';
  if (score >= USER_TIERS.PATROL.min) return 'Patrol';
  return 'New Watch';
};

export const hashPin = (pin: string): string => {
  let hash = 0;
  const salted = `nw_sec_${pin}_v1`;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return 'pin_' + Math.abs(hash).toString(16);
};

export const getDeterministicUid = (phoneNumber: string): string => {
  let hash = 0;
  for (let i = 0; i < phoneNumber.length; i++) {
    hash = (hash << 5) - hash + phoneNumber.charCodeAt(i);
    hash |= 0;
  }
  return 'usr_' + Math.abs(hash);
};

interface AuthState {
  user: User | null;
  firebaseUid: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isHydrated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setFirebaseUid: (uid: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setHydrated: (isHydrated: boolean) => void;
  fetchUserProfile: (uid: string) => Promise<User | null>;
  registerUser: (data: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phoneNumber: string;
    pin?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  createAccountFromOtp: (phoneNumber: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  updateName: (firstName: string, lastName: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPin: (phoneNumber: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  updateEmail: (email: string) => Promise<void>;
  updatePin: (pin: string) => Promise<void>;
  updateSafeZone: (geohash: string, center: { latitude: number; longitude: number }, radiusKm: number) => Promise<void>;
  updateNotificationPref: (pref: 'all' | 'critical_only') => Promise<void>;
  updateFcmToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUid: null,
      isLoading: false,
      isAuthenticated: false,
      isOnboarded: false,
      isHydrated: false,

      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          isOnboarded: !!user?.safeZoneGeohash,
        });
      },

      setFirebaseUid: (firebaseUid) => {
        set({ firebaseUid });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setHydrated: (isHydrated) => {
        set({ isHydrated });
      },

  fetchUserProfile: async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as User;
        const userWithTier: User = {
          ...data,
          tier: calculateTier(data.watchdogScore || 0),
        };
        get().setUser(userWithTier);
        return userWithTier;
      }
      return null;
    } catch (error) {
      console.error('[AuthStore] Error fetching profile:', error);
      return null;
    }
  },

  registerUser: async ({ firstName, lastName, fullName, email, phoneNumber, pin }) => {
    try {
      const uid = getDeterministicUid(phoneNumber);
      const userRef = doc(db, 'users', uid);
      const pinHash = pin ? hashPin(pin) : undefined;
      const resolvedFullName = fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Watchdog Sentinel';

      // Check if user already exists
      const existingSnap = await getDoc(userRef).catch(() => null);
      let userData: User;

      if (existingSnap && existingSnap.exists()) {
        const existingData = existingSnap.data() as User;
        userData = {
          ...existingData,
          firstName: firstName || existingData.firstName,
          lastName: lastName || existingData.lastName,
          fullName: resolvedFullName || existingData.fullName,
          email: email || existingData.email || '',
          phoneNumber,
          ...(pinHash ? { pinHash } : {}),
        };
      } else {
        userData = {
          uid,
          firstName,
          lastName,
          fullName: resolvedFullName,
          email: email || '',
          phoneNumber,
          ...(pinHash ? { pinHash } : {}),
          watchdogScore: 0,
          tier: 'New Watch',
          notificationPref: 'all',
          createdAt: Date.now(),
        };
      }

      await setDoc(userRef, userData, { merge: true }).catch((err) => {
        console.warn('[AuthStore] Remote Firestore profile sync failed (using local):', err);
      });

      get().setFirebaseUid(uid);
      get().setUser(userData);
      return { success: true, user: userData };
    } catch (error: any) {
      console.error('[AuthStore] registerUser error:', error);
      return { success: false, error: error?.message || 'Failed to create account' };
    }
  },

  createAccountFromOtp: async (phoneNumber: string) => {
    try {
      const uid = getDeterministicUid(phoneNumber);
      const userRef = doc(db, 'users', uid);

      const existingSnap = await getDoc(userRef).catch(() => null);
      let userData: User;

      if (existingSnap && existingSnap.exists()) {
        const existingData = existingSnap.data() as User;
        userData = {
          ...existingData,
          phoneNumber,
        };
      } else {
        userData = {
          uid,
          phoneNumber,
          firstName: '',
          lastName: '',
          fullName: '',
          email: '',
          watchdogScore: 0,
          tier: 'New Watch',
          notificationPref: 'all',
          isProfileComplete: false,
          createdAt: Date.now(),
        };
      }

      await setDoc(userRef, userData, { merge: true }).catch((err) => {
        console.warn('[AuthStore] Remote Firestore profile sync failed (using local):', err);
      });

      get().setFirebaseUid(uid);
      get().setUser(userData);
      return { success: true, user: userData };
    } catch (error: any) {
      console.error('[AuthStore] createAccountFromOtp error:', error);
      return { success: false, error: error?.message || 'Failed to initialize account' };
    }
  },

  updateName: async (firstName: string, lastName: string) => {
    try {
      const { user } = get();
      if (!user) return { success: false, error: 'No active user session' };

      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const resolvedFullName = `${trimmedFirst} ${trimmedLast}`;

      const updatedUser: User = {
        ...user,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        fullName: resolvedFullName,
        isProfileComplete: true,
      };

      get().setUser(updatedUser);

      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          firstName: trimmedFirst,
          lastName: trimmedLast,
          fullName: resolvedFullName,
          isProfileComplete: true,
        },
        { merge: true }
      ).catch((err) => {
        console.warn('[AuthStore] Remote Firestore updateName sync failed:', err);
      });

      return { success: true };
    } catch (error: any) {
      console.error('[AuthStore] updateName error:', error);
      return { success: false, error: error?.message || 'Failed to update name' };
    }
  },

  updateEmail: async (email: string) => {
    const { user } = get();
    if (!user) return;

    get().setUser({ ...user, email });

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { email }, { merge: true });
    } catch (error) {
      console.warn('[AuthStore] Remote Firestore email sync failed:', error);
    }
  },

  updatePin: async (pin: string) => {
    const { user } = get();
    if (!user) return;

    const pinHash = hashPin(pin);
    get().setUser({ ...user, pinHash });

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { pinHash }, { merge: true });
    } catch (error) {
      console.warn('[AuthStore] Remote Firestore PIN sync failed:', error);
    }
  },

  signInWithPin: async (phoneNumber: string, pin: string) => {
    try {
      const uid = getDeterministicUid(phoneNumber);
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef).catch(() => null);

      if (!userSnap || !userSnap.exists()) {
        // Also check if current stored user matches this phone number
        const currentUser = get().user;
        if (currentUser && currentUser.phoneNumber === phoneNumber) {
          if (!currentUser.pinHash || currentUser.pinHash === hashPin(pin)) {
            get().setUser(currentUser);
            get().setFirebaseUid(uid);
            return { success: true };
          }
        }
        return {
          success: false,
          error: 'No account found with this phone number. Please register first.',
        };
      }

      const userData = userSnap.data() as User;
      const expectedPinHash = userData.pinHash;

      // If user has a registered PIN, verify it. If legacy account with no PIN, allow access
      if (expectedPinHash && expectedPinHash !== hashPin(pin)) {
        return {
          success: false,
          error: 'Incorrect 4-digit PIN. Please try again or verify via SMS.',
        };
      }

      const userWithTier: User = {
        ...userData,
        tier: calculateTier(userData.watchdogScore || 0),
      };

      get().setFirebaseUid(uid);
      get().setUser(userWithTier);
      return { success: true };
    } catch (error: any) {
      console.error('[AuthStore] signInWithPin error:', error);
      return { success: false, error: error?.message || 'Sign in failed' };
    }
  },

  updateSafeZone: async (geohash, center, radiusKm) => {
    const { user } = get();
    const updates = {
      safeZoneGeohash: geohash,
      safeZoneCenter: center,
      safeZoneRadiusKm: radiusKm,
    };

    const targetUser: User = user
      ? { ...user, ...updates }
      : {
          uid: get().firebaseUid || 'user_' + Date.now(),
          firstName: 'Watchdog',
          lastName: 'Sentinel',
          fullName: 'Watchdog Sentinel',
          phoneNumber: '',
          ...updates,
          watchdogScore: 0,
          tier: 'New Watch',
          notificationPref: 'all',
          createdAt: Date.now(),
        };

    // Optimistically update local state immediately so user is never blocked
    set({
      user: targetUser,
      isAuthenticated: true,
      isOnboarded: true,
    });

    try {
      const userRef = doc(db, 'users', targetUser.uid);
      setDoc(userRef, updates, { merge: true }).catch((error) => {
        console.warn('[AuthStore] Remote Firestore safe zone sync failed:', error);
      });
    } catch (error) {
      console.warn('[AuthStore] Remote Firestore safe zone sync failed (using local profile):', error);
    }
  },

  updateNotificationPref: async (pref) => {
    const { user } = get();
    if (!user) return;

    get().setUser({ ...user, notificationPref: pref });

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { notificationPref: pref }, { merge: true });
    } catch (error) {
      console.warn('[AuthStore] Remote Firestore notification pref sync failed:', error);
    }
  },

  updateFcmToken: async (token) => {
    const { user } = get();
    if (!user) return;

    get().setUser({ ...user, fcmToken: token });

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { fcmToken: token }, { merge: true });
    } catch (error) {
      console.warn('[AuthStore] Remote Firestore FCM token sync failed:', error);
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[AuthStore] Error signing out:', error);
    } finally {
      set({
        user: null,
        firebaseUid: null,
        isAuthenticated: false,
        isOnboarded: false,
      });
    }
  },
}),
    {
      name: 'nightwatch_auth_storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        firebaseUid: state.firebaseUid,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

