import { encodeGeohash, decodeGeohash, getSurroundingGeohashes } from '../utils/geohash';
import { GEOHASH_INCIDENT_PRECISION, GEOHASH_NOTIFICATION_PRECISION } from '../config/constants';

export const geohashService = {
  getIncidentGeohash: (lat: number, lon: number): string => {
    return encodeGeohash(lat, lon, GEOHASH_INCIDENT_PRECISION);
  },

  getAreaGeohash: (lat: number, lon: number): string => {
    return encodeGeohash(lat, lon, GEOHASH_NOTIFICATION_PRECISION);
  },

  getQueryPrefixes: (lat: number, lon: number): string[] => {
    const centerArea = encodeGeohash(lat, lon, GEOHASH_NOTIFICATION_PRECISION);
    return getSurroundingGeohashes(centerArea);
  },

  decode: (hash: string) => {
    return decodeGeohash(hash);
  },
};
