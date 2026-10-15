import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import * as Linking from 'expo-linking';
import { db } from '../config/firebase';
import { Friend, FriendStatus, WatchInvite, Coordinates } from '../types';
import { getDeterministicUid } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalises a phone string to E.164 (basic, no libphonenumber dependency). Safe against undefined. */
export const normalisePhone = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/\s+/g, '').replace(/^0/, '+44');
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

// ─── User Ascertainment (WhatsApp Model) ──────────────────────────────────────

/**
 * Checks whether a phone number belongs to an existing registered Vico user.
 * 1. Checks deterministic user UID doc in Firestore (O(1) fast lookup).
 * 2. Queries users collection by phoneNumber.
 * 3. Falls back to active social store friends list.
 */
export const lookupUserByPhone = async (
  rawPhone: string
): Promise<{ isMember: boolean; user?: { uid: string; name: string; phoneNumber: string } }> => {
  const normalised = normalisePhone(rawPhone);
  if (!normalised) return { isMember: false };

  // 1. Direct O(1) deterministic UID lookup in Firestore
  try {
    const uid = getDeterministicUid(normalised);
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      const resolvedName =
        data.fullName ||
        [data.firstName, data.lastName].filter(Boolean).join(' ') ||
        'Vico Member';
      return {
        isMember: true,
        user: {
          uid,
          name: resolvedName,
          phoneNumber: normalised,
        },
      };
    }
  } catch (e: any) {
    console.warn('[watchService] lookupUserByPhone doc check notice:', e?.message || e);
  }

  // 2. Query users where phoneNumber == normalised
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', '==', normalised));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      const data = docSnap.data();
      const resolvedName =
        data.fullName ||
        [data.firstName, data.lastName].filter(Boolean).join(' ') ||
        'Vico Member';
      return {
        isMember: true,
        user: {
          uid: docSnap.id,
          name: resolvedName,
          phoneNumber: normalised,
        },
      };
    }
  } catch (e: any) {
    console.warn('[watchService] lookupUserByPhone query notice:', e?.message || e);
  }

  // 3. Fallback: check device local friend list
  try {
    const localFriends = useSocialStore.getState().friends || [];
    const matched = localFriends.find(
      (f) => normalisePhone(f.phoneNumber) === normalised
    );
    if (matched) {
      return {
        isMember: true,
        user: {
          uid: matched.id,
          name: matched.name,
          phoneNumber: normalised,
        },
      };
    }
  } catch (_) {}

  return { isMember: false };
};

// ─── Invites ─────────────────────────────────────────────────────────────────

/**
 * Creates a Watch invite document in Firestore and returns the shareable deep link.
 * Format: vico://invite/{inviteId}
 * Resilient against remote permission errors: always caches in local socialStore.
 */
export const createInvite = async (
  fromUid: string,
  fromName: string,
  fromPhone?: string,
  toPhone?: string,
  toUid?: string,
  toName?: string,
  deliveryMethod: 'in_app' | 'sms' = 'sms'
): Promise<string> => {
  const now = Date.now();
  const inviteId = doc(collection(db, 'watch_invites')).id;
  const invite: WatchInvite = {
    id: inviteId,
    fromUid,
    fromName: fromName || 'Vico User',
    fromPhone: normalisePhone(fromPhone),
    toPhone: normalisePhone(toPhone),
    toUid,
    toName,
    deliveryMethod,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };

  // 1. Attempt Firestore sync
  try {
    const inviteRef = doc(db, 'watch_invites', inviteId);
    await setDoc(inviteRef, {
      fromUid: invite.fromUid,
      fromName: invite.fromName,
      fromPhone: invite.fromPhone,
      toPhone: invite.toPhone,
      toUid: invite.toUid || null,
      toName: invite.toName || null,
      deliveryMethod: invite.deliveryMethod,
      status: invite.status,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    });
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore invite write notice (cached locally):', err?.message || err);
  }

  // 2. Always register in local social store so the user immediately sees it in Option C
  try {
    const socialStore = useSocialStore.getState();
    const currentOutgoing = socialStore.outgoingInvites || [];
    socialStore.setOutgoingInvites([invite, ...currentOutgoing.filter((i) => i.id !== inviteId)]);
  } catch (storeErr) {
    console.warn('[watchService] Local store cache notice:', storeErr);
  }

  const deepLink = Linking.createURL(`invite/${inviteId}`);
  return deepLink;
};

/**
 * Fetches an invite by ID. Returns null if not found.
 */
export const getInvite = async (inviteId: string): Promise<WatchInvite | null> => {
  try {
    const snap = await getDoc(doc(db, 'watch_invites', inviteId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Omit<WatchInvite, 'id'>) };
    }
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore getInvite notice:', err?.message || err);
  }

  // Fallback to local store
  try {
    const socialStore = useSocialStore.getState();
    const localOutgoing = (socialStore.outgoingInvites || []).find((i) => i.id === inviteId);
    if (localOutgoing) return localOutgoing;
    const localPending = (socialStore.pendingInvites || []).find((i) => i.id === inviteId);
    if (localPending) return localPending;
  } catch (_) {}

  return null;
};

/**
 * Accepts a Watch invite using a writeBatch for atomic mutual membership.
 * Writes member records on both sides in a single commit.
 */
export const acceptInvite = async (
  inviteId: string,
  myUid: string,
  myName: string,
  myPhone: string
): Promise<void> => {
  const invite = await getInvite(inviteId);
  if (!invite) throw new Error('Invite not found');
  if (invite.status !== 'pending') throw new Error('Invite already used');
  if (Date.now() > invite.expiresAt) throw new Error('Invite has expired');

  const now = Date.now();

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'watch_invites', inviteId), {
      status: 'accepted',
      toUid: myUid,
    });
    const myMemberRef = doc(db, 'watch_members', myUid, 'members', invite.fromUid);
    batch.set(myMemberRef, {
      uid: invite.fromUid,
      name: invite.fromName,
      phoneNumber: invite.fromPhone,
      avatarInitials: getInitials(invite.fromName),
      isLocationSharing: false,
      status: 'safe' as FriendStatus,
      addedAt: now,
    });
    const theirMemberRef = doc(db, 'watch_members', invite.fromUid, 'members', myUid);
    batch.set(theirMemberRef, {
      uid: myUid,
      name: myName,
      phoneNumber: normalisePhone(myPhone),
      avatarInitials: getInitials(myName),
      isLocationSharing: false,
      status: 'safe' as FriendStatus,
      addedAt: now,
    });
    await batch.commit();
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore batch accept notice:', err?.message || err);
  }

  // Locally add friend to socialStore
  try {
    const socialStore = useSocialStore.getState();
    const newFriend: Friend = {
      id: invite.fromUid,
      name: invite.fromName,
      phoneNumber: invite.fromPhone,
      avatarInitials: getInitials(invite.fromName),
      status: 'safe',
      lastActiveTimestamp: now,
      isLocationSharing: false,
    };
    const currentFriends = socialStore.friends || [];
    if (!currentFriends.some((f) => f.id === newFriend.id)) {
      socialStore.setFriends([...currentFriends, newFriend]);
    }
    socialStore.setPendingInvites(
      (socialStore.pendingInvites || []).filter((i) => i.id !== inviteId)
    );
  } catch (_) {}
};

/**
 * Declines a Watch invite.
 */
export const declineInvite = async (inviteId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'watch_invites', inviteId), { status: 'declined' });
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore decline invite notice:', err?.message || err);
  }
  try {
    const socialStore = useSocialStore.getState();
    socialStore.setPendingInvites(
      (socialStore.pendingInvites || []).filter((i) => i.id !== inviteId)
    );
  } catch (_) {}
};

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * Removes a member from both sides atomically using writeBatch.
 */
export const removeMember = async (myUid: string, theirUid: string): Promise<void> => {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'watch_members', myUid, 'members', theirUid));
    batch.delete(doc(db, 'watch_members', theirUid, 'members', myUid));
    await batch.commit();
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore remove member notice:', err?.message || err);
  }
  try {
    const socialStore = useSocialStore.getState();
    socialStore.removeFriend(theirUid);
  } catch (_) {}
};

/**
 * Subscribes to real-time updates for the current user's Watch members.
 * Returns an unsubscribe function.
 */
export const subscribeToMembers = (
  myUid: string,
  onUpdate: (members: Friend[]) => void
): (() => void) => {
  const membersRef = collection(db, 'watch_members', myUid, 'members');
  return onSnapshot(membersRef, (snapshot) => {
    const members: Friend[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? '',
        phoneNumber: data.phoneNumber ?? '',
        avatarInitials: data.avatarInitials ?? '??',
        status: (data.status as FriendStatus) ?? 'offline',
        lastActiveTimestamp: data.addedAt ?? Date.now(),
        isLocationSharing: data.isLocationSharing ?? false,
      };
    });
    },
    (error) => {
      console.warn('[watchService] subscribeToMembers snapshot listener notice:', error.message);
    }
  );
};

/**
 * Subscribes to live location updates for a list of member UIDs.
 * Calls onUpdate for each individual location change.
 * Returns a single unsubscribe function that clears all listeners.
 */
export const subscribeToMemberLocations = (
  uids: string[],
  onUpdate: (uid: string, coords: Coordinates, updatedAt: number, isSharing: boolean) => void,
  subscriberUid?: string
): (() => void) => {
  if (uids.length === 0) return () => {};
  const unsubs = uids.map((uid) =>
    onSnapshot(doc(db, 'user_locations', uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.latitude == null || data.longitude == null) return;

      let isSharing = data.isSharing ?? false;
      // If the member configured granular privacy (WhatsApp style)
      if (isSharing && data.scope === 'custom' && subscriberUid) {
        const allowed = Array.isArray(data.allowedMemberIds) ? data.allowedMemberIds : [];
        if (!allowed.includes(subscriberUid)) {
          isSharing = false;
        }
      } else if (data.scope === 'none') {
        isSharing = false;
      }

      onUpdate(
        uid,
        { latitude: data.latitude, longitude: data.longitude },
        data.updatedAt ?? Date.now(),
        isSharing
      );
    },
    (error) => {
      console.warn(`[watchService] subscribeToMemberLocations(${uid}) notice:`, error.message);
    })
  );
  return () => unsubs.forEach((u) => u());
};

// ─── Location Publishing ──────────────────────────────────────────────────────

/**
 * Writes the current user's live location to their user_locations document.
 * Only call this when isLocationSharing is enabled.
 */
export const publishMyLocation = async (
  myUid: string,
  coords: Coordinates
): Promise<void> => {
  await setDoc(
    doc(db, 'user_locations', myUid),
    {
      latitude: coords.latitude,
      longitude: coords.longitude,
      updatedAt: Date.now(),
      isSharing: true,
    },
    { merge: true }
  );
};

/**
 * Updates the isSharing flag and privacy scope on the user's location document.
 */
export const toggleLocationSharing = async (
  myUid: string,
  enabled: boolean
): Promise<void> => {
  await setDoc(
    doc(db, 'user_locations', myUid),
    { isSharing: enabled },
    { merge: true }
  );
};

/**
 * Granular location privacy preferences (WhatsApp style).
 */
export const updateLocationSharingPreferences = async (
  myUid: string,
  isSharing: boolean,
  scope: 'all' | 'custom' | 'none',
  allowedMemberIds: string[] = []
): Promise<void> => {
  await setDoc(
    doc(db, 'user_locations', myUid),
    {
      isSharing,
      scope,
      allowedMemberIds,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
};

// ─── Pending Invites ─────────────────────────────────────────────────────────

/**
 * Subscribes to pending Watch invites directed at a given phone number.
 * Returns an unsubscribe function.
 */
export const subscribeToPendingInvites = (
  myPhone: string,
  onUpdate: (invites: WatchInvite[]) => void
): (() => void) => {
  const normalised = normalisePhone(myPhone);
  const invitesRef = collection(db, 'watch_invites');
  const q = query(
    invitesRef,
    where('toPhone', '==', normalised),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const invites: WatchInvite[] = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<WatchInvite, 'id'>) }))
      .filter((inv) => inv.expiresAt > now); // client-side TTL filter
    onUpdate(invites);
  },
  (error) => {
    console.warn('[watchService] subscribeToPendingInvites notice:', error.message);
  });
};

/**
 * Subscribes to outgoing pending Watch invites sent by the current user.
 * Returns an unsubscribe function.
 */
export const subscribeToOutgoingInvites = (
  myUid: string,
  onUpdate: (invites: WatchInvite[]) => void
): (() => void) => {
  const invitesRef = collection(db, 'watch_invites');
  const q = query(
    invitesRef,
    where('fromUid', '==', myUid),
    where('status', '==', 'pending')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const invites: WatchInvite[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<WatchInvite, 'id'>) }))
        .filter((inv) => inv.expiresAt > now);
      onUpdate(invites);
    },
    (error) => {
      console.warn('[watchService] subscribeToOutgoingInvites notice:', error.message);
    }
  );
};

/**
 * Cancels/revokes an outgoing pending Watch invite.
 */
export const cancelInvite = async (inviteId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'watch_invites', inviteId), { status: 'cancelled' });
  } catch (err: any) {
    console.warn('[watchService] Remote Firestore cancel invite notice:', err?.message || err);
  }
  try {
    const socialStore = useSocialStore.getState();
    const currentOutgoing = socialStore.outgoingInvites || [];
    socialStore.setOutgoingInvites(currentOutgoing.filter((i) => i.id !== inviteId));
  } catch (_) {}
};
