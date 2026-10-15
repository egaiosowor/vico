import * as Location from 'expo-location';

export interface PlaceSearchResult {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
}

/**
 * Searches places and addresses using Photon geocoding with native Expo Location fallback.
 */
export const searchPlaces = async (
  query: string,
  userCoords?: { latitude: number; longitude: number } | null
): Promise<PlaceSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // 1. Try Photon Geocoding API with proximity bias towards userCoords
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`;
    if (userCoords) {
      url += `&lat=${userCoords.latitude}&lon=${userCoords.longitude}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.features) && data.features.length > 0) {
        const results: PlaceSearchResult[] = data.features.map(
          (feature: any, index: number) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [0, 0];
            const title =
              props.name || props.street || props.city || trimmed;

            const subtitleParts = [
              props.street && props.name !== props.street ? props.street : null,
              props.city && props.name !== props.city ? props.city : null,
              props.state,
              props.country,
            ].filter(Boolean);

            return {
              id: `photon-${index}-${props.osm_id || 'pos'}-${coords[1]}-${coords[0]}`,
              title,
              subtitle: subtitleParts.join(', ') || 'Location',
              latitude: coords[1],
              longitude: coords[0],
            };
          }
        );
        return results;
      }
    }
  } catch (error) {
    // Network error or timeout; fall through to native geocoding
  }

  // 2. Fallback to native Expo Location geocodeAsync
  try {
    const geoResults = await Location.geocodeAsync(trimmed);
    if (geoResults && geoResults.length > 0) {
      return geoResults.slice(0, 5).map((res, idx) => ({
        id: `native-${idx}-${res.latitude}-${res.longitude}`,
        title: trimmed,
        subtitle: `${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}`,
        latitude: res.latitude,
        longitude: res.longitude,
      }));
    }
  } catch (geoError) {
    // Native geocoding error or offline
  }

  return [];
};
