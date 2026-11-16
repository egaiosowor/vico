import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { Incident, IncidentCategory, Coordinates } from '../types';
import { calculateDistanceKm } from '../utils/formatting';
import { IncidentReelItem } from './IncidentReelItem';

interface TacticalIncidentFeedProps {
  incidents: Incident[];
  selectedCategory: IncidentCategory | 'all';
  userCoords: Coordinates | null;
  onSelectIncident: (id: string) => void;
  onLocateOnMap: (incident: Incident) => void;
  onReportPress: () => void;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export const TacticalIncidentFeed: React.FC<TacticalIncidentFeedProps> = ({
  incidents,
  selectedCategory,
  userCoords,
  onSelectIncident,
  onLocateOnMap,
  onReportPress,
}) => {
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const [activeIndex, setActiveIndex] = useState(0);

  // 1. Filter incidents based on selectedCategory from the map screen dropdown
  const filteredIncidents = useMemo(() => {
    let list = incidents.filter((inc) => inc.active !== false);

    // Apply category filter (all | critical | advisory)
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'critical') {
        list = list.filter((inc) => inc.category === 'critical');
      } else {
        list = list.filter((inc) => inc.category !== 'critical');
      }
    }

    // Sort by proximity if user coordinates available, otherwise chronological
    if (userCoords) {
      return [...list].sort((a, b) => {
        const distA = calculateDistanceKm(userCoords, a.location);
        const distB = calculateDistanceKm(userCoords, b.location);
        return distA - distB;
      });
    }

    // Default: newest first
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [incidents, selectedCategory, userCoords]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const renderEmptyState = () => (
    <View style={[styles.emptyContainer, { height: SCREEN_HEIGHT }]}>
      <View style={styles.radarPulseOuter} />
      <View style={styles.radarPulseInner} />
      <View style={styles.emptyIconCircle}>
        <Ionicons name="radio" size={38} color={colors.critical} />
      </View>

      <Text style={styles.emptyTitle}>No Active Broadcasts</Text>
      <Text style={styles.emptySubtitle}>
        {selectedCategory !== 'all'
          ? `No active ${selectedCategory.toUpperCase()} alerts in your sector.`
          : 'Your sector is quiet. Verified reports and community broadcasts stream here live.'}
      </Text>

      <TouchableOpacity
        style={styles.emptyReportButton}
        onPress={onReportPress}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={17} color="#000000" />
        <Text style={styles.emptyReportButtonText}>Broadcast Report</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Vertical Paging Feed (TikTok / Reels) */}
      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <IncidentReelItem
            incident={item}
            userCoords={userCoords}
            isActive={index === activeIndex}
            onLocateOnMap={onLocateOnMap}
            onSelectIncident={onSelectIncident}
          />
        )}
        ListEmptyComponent={renderEmptyState}
        pagingEnabled={true}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    backgroundColor: '#000000',
  },
  radarPulseOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  radarPulseInner: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 59, 48, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeights.heavy,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
  },
  emptyReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyReportButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: typography.fontWeights.heavy,
  },
});
