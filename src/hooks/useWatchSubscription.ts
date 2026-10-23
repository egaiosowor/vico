import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useIncidentStore } from '../stores/incidentStore';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';
import {
  subscribeToMembers,
  subscribeToMemberLocations,
  subscribeToPendingInvites,
  subscribeToOutgoingInvites,
} from '../services/watchService';
import { calculateDistanceKm } from '../utils/formatting';
import { Friend } from '../types';

const DANGER_RADIUS_KM = 0.5; // 500 metres

/**
 * Real-time Watch subscription hook.
 *
 * 1. Subscribes to the current user's Watch member list from Firestore.
 * 2. Subscribes to live location updates for members who are sharing.
 * 3. Listens for pending incoming invites and surfaces them in the store.
 * 4. Runs a danger-proximity check on every location tick:
 *    - Fires a watch_alert in-app notification when a member is within 500m
 *      of an active incident.
 *    - Deduplicates alerts with a session-scoped Set ref so the same
 *      (member, incident) pair never fires twice in one session.
 */
export const useWatchSubscription = () => {
  const user = useAuthStore((state) => state.user);
  const { setFriends, setMemberLocation, setPendingInvites, setOutgoingInvites } = useSocialStore();
  const incidents = useIncidentStore((state) => state.incidents);
  const showAlert = useInAppNotificationStore((state) => state.showAlert);

  // Tracks (memberId_incidentId) pairs already alerted this session
  const alertedPairsRef = useRef<Set<string>>(new Set());

  // Tracks incoming invite IDs already notified
  const knownInviteIdsRef = useRef<Set<string>>(new Set());
  const isInitialInvitesLoadRef = useRef(true);

  // Keep a mutable ref of latest friends for the location callback closure
  const friendsRef = useRef<Friend[]>([]);

  const checkProximity = (uid: string, latitude: number, longitude: number) => {
    const friend = friendsRef.current.find((f) => f.id === uid);
    if (!friend) return;

    Object.values(incidents).forEach((incident) => {
      if (!incident.active) return;
      const pairKey = `${uid}_${incident.id}`;
      if (alertedPairsRef.current.has(pairKey)) return;

      const distKm = calculateDistanceKm(
        { latitude, longitude },
        incident.location
      );

      if (distKm <= DANGER_RADIUS_KM) {
        alertedPairsRef.current.add(pairKey);
        const distM = Math.round(distKm * 1000);
        showAlert({
          category: 'watch_alert',
          title: `${friend.name} is near a danger zone`,
          message: `Your Circle member is ${distM}m from an active ${incident.category} incident.`,
          distanceText: `${distM}m away`,
        });
      }
    });
  };

  useEffect(() => {
    if (!user?.uid || !user?.phoneNumber) return;

    const unsubs: (() => void)[] = [];

    // 1. Subscribe to current user's Circle members list
    const unsubMembers = subscribeToMembers(user.uid, (members) => {
      if (members && members.length > 0) {
        setFriends(members);
        friendsRef.current = members;
      }

      // 2. Subscribe to live locations of members who are sharing
      const currentMembers = members.length > 0 ? members : useSocialStore.getState().friends;
      const sharingUids = currentMembers
        .filter((m) => m.isLocationSharing)
        .map((m) => m.id);

      const unsubLocs = subscribeToMemberLocations(
        sharingUids,
        (uid, coords, updatedAt, isSharing) => {
          setMemberLocation(uid, coords, updatedAt, isSharing);
          if (isSharing) {
            checkProximity(uid, coords.latitude, coords.longitude);
          }
        },
        user.uid
      );
      unsubs[1] = unsubLocs;
    });
    unsubs[0] = unsubMembers;

    // 3. Subscribe to pending incoming invites (matched by phone number)
    const unsubInvites = subscribeToPendingInvites(
      user.phoneNumber,
      (invites) => {
        if (invites && invites.length > 0) {
          // Trigger in-app banner for new invites arriving in real-time
          if (!isInitialInvitesLoadRef.current) {
            invites.forEach((inv) => {
              if (!knownInviteIdsRef.current.has(inv.id)) {
                showAlert({
                  category: 'system',
                  title: 'New Circle Invite',
                  message: `${inv.fromName} invited you to join their safety Circle.`,
                });
              }
            });
          }
          invites.forEach((inv) => knownInviteIdsRef.current.add(inv.id));
          setPendingInvites(invites);
        }
        isInitialInvitesLoadRef.current = false;
      }
    );
    unsubs[2] = unsubInvites;

    // 4. Subscribe to pending outgoing invites (matched by fromUid)
    const unsubOutgoing = subscribeToOutgoingInvites(
      user.uid,
      (invites) => {
        if (invites && invites.length > 0) {
          setOutgoingInvites(invites);
        }
      }
    );
    unsubs[3] = unsubOutgoing;

    return () => {
      unsubs.forEach((u) => u?.());
    };
  }, [user?.uid, user?.phoneNumber]);

  // Re-run proximity check when incidents list changes
  useEffect(() => {
    friendsRef.current.forEach((friend) => {
      if (friend.liveLocation && friend.isLocationSharing) {
        checkProximity(
          friend.id,
          friend.liveLocation.latitude,
          friend.liveLocation.longitude
        );
      }
    });
  }, [incidents]);
};
