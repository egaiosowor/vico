import ngeohash from 'ngeohash';

export const encodeGeohash = (latitude: number, longitude: number, precision = 7): string => {
  return ngeohash.encode(latitude, longitude, precision);
};

export const decodeGeohash = (hash: string): { latitude: number; longitude: number } => {
  const decoded = ngeohash.decode(hash);
  return {
    latitude: decoded.latitude,
    longitude: decoded.longitude,
  };
};

/**
 * Returns the 8 adjacent neighbor geohash strings for a given geohash.
 */
export const getGeohashNeighbors = (hash: string): string[] => {
  return ngeohash.neighbors(hash);
};

/**
 * Returns 9 query prefixes (center + 8 neighbors) to solve GeoHash boundary edge blind spots.
 */
export const getSurroundingGeohashes = (centerHash: string): string[] => {
  return [centerHash, ...getGeohashNeighbors(centerHash)];
};
