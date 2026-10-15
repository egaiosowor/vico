import { Image } from 'react-native';
import { Incident, Coordinates } from '../types';
import { geohashService } from './geohashService';

const thumb = (mod: number): string => Image.resolveAssetSource(mod).uri;

// Poster frames extracted from each demo video (used for map pins)
const THUMBS: Record<string, string> = {
  'sim-crit-roundabout-crash': thumb(require('../../assets/thumbs/incident1.jpg')),
  'sim-crit-rally-rollover': thumb(require('../../assets/thumbs/incident2.jpg')),
  'sim-crit-attenuator-crash': thumb(require('../../assets/thumbs/incident3.jpg')),
  'sim-crit-factory-explosion': thumb(require('../../assets/thumbs/incident4.jpg')),
  'sim-crit-firefighter-pov': thumb(require('../../assets/thumbs/incident5.jpg')),
  'sim-crit-house-fire': thumb(require('../../assets/thumbs/incident6.jpg')),
};

/**
 * Generates realistic tactical incident reports dynamically scattered around
 * the user's current GPS coordinates so the map radar pins can be previewed live.
 */
export const generateMockIncidents = (center: Coordinates): Incident[] => {
  const now = Date.now();

  const templates = [
    {
      id: 'sim-crit-roundabout-crash',
      category: 'critical' as const,
      description: 'Speeding car crashes into multiple vehicles while driving through roundabout. Major multi-car collision; traffic obstructed.',
      address: 'Circus Roundabout & High Street',
      locationName: 'Central Roundabout Sector',
      dLat: 0.0018,
      dLng: -0.0014,
      timeOffsetMins: 4,
      upvotes: 68,
      downvotes: 1,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/incident001.mp4',
      reporterName: 'Marcus Vance',
      reporterTier: 'Sentinel' as const,
      isAnonymous: false,
    },
    {
      id: 'sim-crit-rally-rollover',
      category: 'critical' as const,
      description: 'Severe high-speed vehicle rollover crash off roadway into embankment. Vehicle flipped multiple times; emergency response deployed.',
      address: 'North Ridge Road & Curve 6',
      locationName: 'Highland Ridge Curve',
      dLat: -0.0031,
      dLng: 0.0039,
      timeOffsetMins: 14,
      upvotes: 94,
      downvotes: 2,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/EPIC%20VOLVO%20240%20RALLY%20CRASH!%20Car%20Flips%206%20Times%20in%20Crazy%20Rally%20Accident.mp4',
      reporterName: 'Sarah Connor',
      reporterTier: 'Sentinel' as const,
      isAnonymous: false,
    },
    {
      id: 'sim-crit-attenuator-crash',
      category: 'critical' as const,
      description: 'Vehicle high-speed impact into highway attenuator construction truck. Heavy debris across roadway; right lanes shut down.',
      address: 'Expressway Route 10 & Exit 4',
      locationName: 'Highway Work Zone Sector',
      dLat: 0.0035,
      dLng: 0.0042,
      timeOffsetMins: 19,
      upvotes: 82,
      downvotes: 1,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/Distracted%20Driver%20Crashes%20Into%20Attenuator%20Truck%20-%20DRAMATIC%20CRASH%20%20carcrash%20%20dashcam%20%20shorts.mp4',
      reporterName: 'Officer Ray Chen',
      reporterTier: 'Sentinel' as const,
      isAnonymous: false,
    },
    {
      id: 'sim-crit-factory-explosion',
      category: 'critical' as const,
      description: 'Industrial warehouse explosion and major multi-alarm fire. Massive fireball observed; emergency evacuation perimeter in effect.',
      address: '480 Industrial Parkway & Wharf Rd',
      locationName: 'Industrial Sector Warehouse District',
      dLat: -0.0048,
      dLng: -0.0035,
      timeOffsetMins: 28,
      upvotes: 112,
      downvotes: 0,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/Firefighters%20Nearly%20Engulfed%20By%20Fireball%20As%20Melbourne%20Factory%20Explodes%20_%2010%20News%20First.mp4',
      reporterName: 'Captain Miller',
      reporterTier: 'Sentinel' as const,
      isAnonymous: false,
    },
    {
      id: 'sim-crit-firefighter-pov',
      category: 'critical' as const,
      description: 'Active residential structure fire with interior suppression in progress. Fire attack lines deployed; perimeter secured.',
      address: '214 Crestview Terrace',
      locationName: 'North Residential Hill',
      dLat: 0.0022,
      dLng: 0.0031,
      timeOffsetMins: 35,
      upvotes: 128,
      downvotes: 1,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/GoPro%20_%20A%20Firefighter\'s%20POV%20%F0%9F%8E%AC%20Erik%20Fernandez%20%23Shorts%20%23Firefighting.mp4',
      reporterName: 'Lt. Erik Fernandez',
      reporterTier: 'Sentinel' as const,
      isAnonymous: false,
    },
    {
      id: 'sim-crit-house-fire',
      category: 'critical' as const,
      description: 'Fully involved residential structure fire. Heavy flames engulfing newly constructed home; mutual aid ladder companies en route.',
      address: '880 Timber Ridge Circle',
      locationName: 'Timber Ridge Estates',
      dLat: -0.0025,
      dLng: -0.0042,
      timeOffsetMins: 42,
      upvotes: 145,
      downvotes: 0,
      mediaType: 'video' as const,
      mediaUrl: 'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/Fire%20Engulfs%20Newly%20Built%20House%20-%20Intense%20Flames%20Caught%20on%20Camera!%20%F0%9F%94%A5%20Part%201.mp4',
      reporterName: 'David Miller',
      reporterTier: 'Guardian' as const,
      isAnonymous: false,
    },
  ];

  return templates.map((t) => {
    const lat = center.latitude + t.dLat;
    const lng = center.longitude + t.dLng;
    const geohash = geohashService.getIncidentGeohash(lat, lng);
    const geohashArea = geohashService.getAreaGeohash(lat, lng);

    return {
      id: t.id,
      category: t.category,
      description: t.description,
      address: t.address,
      locationName: t.locationName,
      mediaUrl: t.mediaUrl,
      mediaType: t.mediaType,
      thumbnailUrl: THUMBS[t.id],
      location: { latitude: lat, longitude: lng },
      geohash,
      geohashArea,
      timestamp: now - t.timeOffsetMins * 60 * 1000,
      expiresAt: now + 24 * 3600 * 1000,
      upvotes: t.upvotes,
      downvotes: t.downvotes,
      viewCount: t.upvotes * 3 + 12,
      shareCount: Math.max(1, Math.floor(t.upvotes * 0.45)),
      active: true,
      isAnonymous: t.isAnonymous,
      reporterName: t.reporterName,
      reporterTier: t.reporterTier,
    };
  });
};
