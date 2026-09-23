export type IncidentCategory = 'critical' | 'advisory' | 'community' | 'civic';

export type VoteType = 'up' | 'down';

export type UserTier = 'New Watch' | 'Patrol' | 'Guardian' | 'Sentinel';

export type NotificationPreference = 'all' | 'critical_only';

export type MediaType = 'photo' | 'video';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Incident {
  id: string;
  category: IncidentCategory;
  description: string;
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  location: Coordinates;
  geohash: string; // 7-character geohash
  geohashArea: string; // 5-character geohash
  timestamp: number; // Unix timestamp in ms
  expiresAt: number; // Unix timestamp in ms (24h TTL)
  upvotes: number;
  downvotes: number;
  viewCount: number;
  shareCount?: number;
  active: boolean;
  reporterUid?: string; // Only populated locally for reporter or in backend
  reporterName?: string;
  reporterUsername?: string;
  reporterAvatar?: string;
  reporterTier?: UserTier;
  isAnonymous?: boolean;
  address?: string;
  locationName?: string;
}

export interface User {
  uid: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  pinHash?: string;
  safeZoneGeohash?: string;
  safeZoneCenter?: Coordinates;
  safeZoneRadiusKm?: number;
  watchdogScore: number;
  tier: UserTier;
  notificationPref: NotificationPreference;
  fcmToken?: string;
  isProfileComplete?: boolean;
  createdAt: number;
}

export interface Vote {
  incidentId: string;
  uid: string;
  voteType: VoteType;
  timestamp: number;
}

export interface QueuedMedia {
  id: string;
  localUri: string;
  mediaType: MediaType;
  category: IncidentCategory;
  description: string;
  latitude: number;
  longitude: number;
  geohash: string;
  geohashArea: string;
  timestamp: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  retryCount: number;
  lastError?: string;
}

// GeoJSON Types for Mapbox
export interface IncidentGeoJsonProperties {
  id: string;
  category: IncidentCategory;
  description: string;
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
}

export interface IncidentGeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: IncidentGeoJsonProperties;
}

export interface IncidentGeoJsonCollection {
  type: 'FeatureCollection';
  features: IncidentGeoJsonFeature[];
}

// Social & Messaging Types
export type FriendStatus = 'safe' | 'sos' | 'offline';

export interface Friend {
  id: string; // User UID
  name: string;
  phoneNumber: string;
  avatarInitials: string;
  status: FriendStatus;
  lastActiveTimestamp: number;
  sectorGeohash?: string;
  distanceKm?: number;
  // Mutual Watch fields
  isLocationSharing?: boolean;
  liveLocation?: Coordinates;
  locationUpdatedAt?: number;
}

export interface WatchInvite {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhone: string;
  toPhone: string;       // normalized E.164
  toUid?: string;        // filled if already a member or when recipient accepts
  toName?: string;       // recipient member name if known
  deliveryMethod?: 'in_app' | 'sms';
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
  expiresAt: number;     // createdAt + 48h TTL
}

export type ChatMessageType =
  | 'text'
  | 'photo'
  | 'safety_ping'
  | 'location_share'
  | 'sector_share'
  | 'sos_distress'
  | 'sos_resolved';

export interface SosDistressBeacon {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  coordinates?: Coordinates;
  sectorGeohash?: string;
  status: 'active' | 'resolved';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: ChatMessageType;
  mediaUrl?: string;
  incidentId?: string;
  latitude?: number;
  longitude?: number;
  liveUntil?: number;
  isLiveActive?: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantInitials: string;
  participantStatus: FriendStatus;
  lastMessageText: string;
  lastMessageTimestamp: number;
  unreadCount: number;
}

