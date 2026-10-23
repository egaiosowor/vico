import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useIncidentStore } from '../stores/incidentStore';
import { useLocationStore } from '../stores/locationStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';
import { geohashService } from '../services/geohashService';
import { calculateDistanceKm, formatDistance } from '../utils/formatting';
import { generateMockIncidents } from '../services/mockIncidentService';
import { Incident } from '../types';

export const useIncidentSubscription = () => {
  const currentCoords = useLocationStore((state) => state.currentCoords);
  const setIncidents = useIncidentStore((state) => state.setIncidents);
  const user = useAuthStore((state) => state.user);
  const showAlert = useInAppNotificationStore((state) => state.showAlert);

  const isInitialLoadRef = useRef(true);
  const knownIncidentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentCoords) return;

    // Instantly seed simulated incidents if store is empty or has simulated incidents
    const currentList = Object.values(useIncidentStore.getState().incidents);
    const hasOnlySimulated = currentList.length > 0 && currentList.every((inc) => inc.id.startsWith('sim-'));
    if (currentList.length === 0 || hasOnlySimulated) {
      setIncidents(generateMockIncidents(currentCoords));
    }

    // Anchor demo watch member pins near the user's current coordinates
    useSocialStore.getState().syncMockFriendsLocation(currentCoords);

    // Get 9 surrounding prefixes (center + 8 neighbors)
    const prefixes = geohashService.getQueryPrefixes(
      currentCoords.latitude,
      currentCoords.longitude
    );

    const incidentsRef = collection(db, 'incidents');
    
    // Subscribe to active incidents in surrounding geohash areas
    let q;
    try {
      q = query(
        incidentsRef,
        where('active', '==', true),
        where('geohashArea', 'in', prefixes)
      );
    } catch (e) {
      q = query(incidentsRef, where('active', '==', true));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const incidents: Incident[] = [];
        const now = Date.now();
        const newIncidentsToAlert: Incident[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const expiresAt = data.expiresAt || data.timestamp + 86400000;

          // 24-hour TTL client filter: automatically drop expired reports
          if (expiresAt <= now) return;

          const incident: Incident = {
            id: docSnap.id,
            category: data.category || 'community',
            description: data.description || '',
            mediaUrl: data.mediaUrl || '',
            mediaType: data.mediaType || 'photo',
            thumbnailUrl: data.thumbnailUrl,
            location: data.location || { latitude: 0, longitude: 0 },
            geohash: data.geohash || '',
            geohashArea: data.geohashArea || '',
            timestamp: data.timestamp || Date.now(),
            expiresAt,
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            viewCount: data.viewCount || 0,
            active: data.active ?? true,
          };

          incidents.push(incident);

          // If not the first load and this incident is brand new
          if (
            !isInitialLoadRef.current &&
            !knownIncidentIdsRef.current.has(incident.id) &&
            now - incident.timestamp < 15 * 60 * 1000 // fresh (within 15 mins)
          ) {
            newIncidentsToAlert.push(incident);
          }

          knownIncidentIdsRef.current.add(incident.id);
        });

        // Trigger in-app notification alerts for new incoming broadcasts
        if (!isInitialLoadRef.current && newIncidentsToAlert.length > 0) {
          newIncidentsToAlert.forEach((newInc) => {
            // Respect user's notification preference
            const userPref = user?.notificationPref || 'all';
            if (userPref === 'critical_only' && newInc.category !== 'critical') {
              return;
            }

            let distStr: string | undefined;
            if (currentCoords && newInc.location) {
              const km = calculateDistanceKm(currentCoords, newInc.location);
              distStr = formatDistance(km);
            }

            const categoryTitles: Record<string, string> = {
              critical: 'Critical Alert Reported',
              community: 'Community Update Nearby',
              civic: 'Civic Advisory Reported',
            };

            showAlert({
              incidentId: newInc.id,
              category: newInc.category,
              title: categoryTitles[newInc.category] || 'New Incident Nearby',
              message: newInc.description || 'Tap to view evidence and playback.',
              distanceText: distStr,
            });
          });
        }

        // Fallback to simulated mock incidents around currentCoords if remote Firestore has no active incidents in this area
        const finalIncidents = incidents.length > 0 
          ? incidents 
          : generateMockIncidents(currentCoords);

        isInitialLoadRef.current = false;
        setIncidents(finalIncidents);
      },
      (error) => {
        console.warn('[useIncidentSubscription] Snapshot error (falling back to simulation):', error);
        if (currentCoords) {
          setIncidents(generateMockIncidents(currentCoords));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentCoords?.latitude, currentCoords?.longitude, setIncidents, showAlert, user?.notificationPref]);
};
