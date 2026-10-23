import { useState, useCallback } from 'react';
import ngeohash from 'ngeohash';
import { GEOHASH_NOTIFICATION_PRECISION } from '../config/constants';
import { getSurroundingGeohashes } from '../utils/geohash';

export const useViewportIncidents = () => {
  const [viewportPrefixes, setViewportPrefixes] = useState<string[]>([]);

  const onRegionDidChange = useCallback((feature: any) => {
    if (!feature?.geometry?.coordinates) return;
    const [lon, lat] = feature.geometry.coordinates;
    const centerArea = ngeohash.encode(lat, lon, GEOHASH_NOTIFICATION_PRECISION);
    const prefixes = getSurroundingGeohashes(centerArea);
    setViewportPrefixes(prefixes);
  }, []);

  return {
    viewportPrefixes,
    onRegionDidChange,
  };
};
