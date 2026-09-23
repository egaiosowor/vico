export const APP_NAME = 'Vico';

// Media constraints
export const MAX_VIDEO_DURATION_SEC = 45;
export const MAX_MEDIA_SIZE_MB = 50;
export const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;
export const IMAGE_COMPRESSION_QUALITY = 0.7;
export const IMAGE_MAX_DIMENSION = 1920;

// Geohash precision
export const GEOHASH_INCIDENT_PRECISION = 7; // ~153m x ~153m box
export const GEOHASH_NOTIFICATION_PRECISION = 5; // ~4.9km x ~4.9km box

// Safe Zone & Geofence
export const DEFAULT_SAFE_ZONE_RADIUS_KM = 2.4;
export const MIN_SAFE_ZONE_RADIUS_KM = 0.5;
export const MAX_SAFE_ZONE_RADIUS_KM = 10.0;

// Incident lifecycle
export const INCIDENT_TTL_HOURS = 24;
export const MAX_DESCRIPTION_LENGTH = 280;

// Map settings
export const MAP_CLUSTER_RADIUS = 50;
export const MAP_DEFAULT_ZOOM = 13;
export const MAP_MAX_PINS_PER_PREFIX = 100;

// Score system
export const SCORE_VALUES = {
  REPORT_CREATED: 5,
  UPVOTE_RECEIVED: 2,
  HIGH_VIEWS_BONUS: 3,
  DOWNVOTE_RECEIVED: -1,
} as const;

// Watchdog Score Tiers
export const USER_TIERS = {
  NEW_WATCH: { min: 0, max: 49, label: 'New Watch', icon: 'shield-outline' },
  PATROL: { min: 50, max: 199, label: 'Patrol', icon: 'shield-half-full' },
  GUARDIAN: { min: 200, max: 499, label: 'Guardian', icon: 'shield' },
  SENTINEL: { min: 500, max: Infinity, label: 'Sentinel', icon: 'shield-star' },
} as const;

// Offline Sync & Retry
export const SYNC_MAX_RETRIES = 5;
export const SYNC_BASE_BACKOFF_MS = 1000;
export const SYNC_MAX_BACKOFF_MS = 16000;
