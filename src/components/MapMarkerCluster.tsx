import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { IncidentGeoJsonCollection } from '../types';

interface MapMarkerClusterProps {
  geoJson: IncidentGeoJsonCollection;
  onSelectIncident: (id: string) => void;
}

export const MapMarkerCluster: React.FC<MapMarkerClusterProps> = ({
  geoJson,
  onSelectIncident,
}) => {
  // Allow custom thumbnail views to finish bitmap caching before locking updates
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [geoJson.features.length]);

  return (
    <>
      {geoJson.features.map((feature, idx) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const category = feature.properties.category;
        const { mediaType, thumbnailUrl } = feature.properties;
        // Videos can't be drawn by <Image>; use a poster frame instead
        const mediaUrl = thumbnailUrl || (mediaType === 'photo' ? feature.properties.mediaUrl : '');
        const isCritical = category === 'critical';
        const color = isCritical ? '#FF334B' : '#FFD600';

        return (
          <Marker
            key={`snap-thumb-marker-${feature.properties.id || idx}-${idx}`}
            coordinate={{ latitude, longitude }}
            onPress={() => onSelectIncident(feature.properties.id)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges}
          >
            {/* Circular Story Thumbnail */}
            <View style={styles.thumbnailWrapper}>
              {/* Glowing pulse ring for critical incidents */}
              {isCritical && <View style={styles.criticalPulse} />}

              <View style={[styles.thumbnailRing, { borderColor: color }]}>
                {mediaUrl ? (
                  <Image
                    source={{ uri: mediaUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fallbackAvatar, { backgroundColor: color }]}>
                    {category === 'critical' ? (
                      <MaterialCommunityIcons name="alert-octagon" size={18} color="#FFFFFF" />
                    ) : category === 'civic' ? (
                      <Ionicons name="construct" size={16} color="#FFFFFF" />
                    ) : (
                      <MaterialCommunityIcons name="shield-check" size={18} color="#FFFFFF" />
                    )}
                  </View>
                )}
              </View>

              {/* Mini category status badge */}
              <View style={[styles.miniBadge, { backgroundColor: color }]} />
            </View>
          </Marker>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  thumbnailWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criticalPulse: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 59, 48, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.55)',
    zIndex: -1,
  },
  thumbnailRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    backgroundColor: '#1C1C1E',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 8,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  fallbackAvatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
});
