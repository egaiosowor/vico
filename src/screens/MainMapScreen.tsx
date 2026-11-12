import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme/theme';
import { darkMapStyle } from '../theme/darkMapStyle';
import { useIncidentStore } from '../stores/incidentStore';
import { useLocationStore } from '../stores/locationStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useIncidentSubscription } from '../hooks/useIncidentSubscription';
import { useWatchSubscription } from '../hooks/useWatchSubscription';
import { useLocationBroadcast } from '../hooks/useLocationBroadcast';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';
import { MapMarkerCluster } from '../components/MapMarkerCluster';
import { WatchMemberMarkers } from '../components/WatchMemberMarkers';
import { BottomNavBar } from '../components/BottomNavBar';
import { HeartSlidersIcon } from '../components/HeartSlidersIcon';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import { TacticalIncidentFeed } from '../components/TacticalIncidentFeed';
import { MapSearchModal } from '../components/MapSearchModal';
import { PlaceSearchResult } from '../services/mapSearchService';
import { Incident, IncidentCategory } from '../types';

interface MainMapScreenProps {
  navigation: any;
  route?: any;
}

interface FilterOption {
  key: IncidentCategory | 'all';
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All Alerts' },
  { key: 'critical', label: 'Urgent Danger' },
  { key: 'advisory', label: 'Caution / Advisory' },
];

export const MainMapScreen: React.FC<MainMapScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { currentCoords, refreshLocation } = useLocationStore();
  const user = useAuthStore((state) => state.user);
  const { geoJsonFeatures, selectIncident, incidents: incidentsMap, initModeration } = useIncidentStore();

  const [activeTab, setActiveTab] = useState<'map' | 'home'>('map');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<IncidentCategory | 'all'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<PlaceSearchResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const unreadCount = useInAppNotificationStore((state) => state.unreadCount);

  // Sync active tab if navigated with specific tab params
  useEffect(() => {
    if (route?.params?.activeTab) {
      setActiveTab(route.params.activeTab);
    }
  }, [route?.params?.activeTab]);

  // Initialize moderation cache on mount
  useEffect(() => {
    initModeration();
  }, [initModeration]);

  // Auto-refresh user location on initial mount if not yet established
  useEffect(() => {
    if (!currentCoords) {
      refreshLocation();
    }
  }, [currentCoords, refreshLocation]);

  const incidentsList = useMemo(() => Object.values(incidentsMap), [incidentsMap]);

  // Social / Watch
  const friends = useSocialStore((state) => state.friends);

  // Activate Firestore realtime listener for nearby 9-prefix geohashes
  useIncidentSubscription();
  // Activate mutual Watch member + location subscriptions
  useWatchSubscription();
  // Broadcast our own live location when sharing is enabled
  useLocationBroadcast();

  // Category incident counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: geoJsonFeatures.features.length, critical: 0, advisory: 0 };
    geoJsonFeatures.features.forEach((f) => {
      const cat = f.properties.category;
      if (cat === 'critical') {
        counts.critical = (counts.critical || 0) + 1;
      } else {
        counts.advisory = (counts.advisory || 0) + 1;
      }
    });
    return counts;
  }, [geoJsonFeatures]);

  const filteredGeoJson = useMemo(() => {
    if (selectedCategoryFilter === 'all') return geoJsonFeatures;
    return {
      type: 'FeatureCollection' as const,
      features: geoJsonFeatures.features.filter((f) => {
        const cat = f.properties.category;
        if (selectedCategoryFilter === 'critical') return cat === 'critical';
        return cat !== 'critical';
      }),
    };
  }, [geoJsonFeatures, selectedCategoryFilter]);

  const handleRecenter = async () => {
    let coords = currentCoords;
    if (!coords) {
      coords = await refreshLocation();
    }
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        1000
      );
    }
  };

  const handleSelectIncident = (id: string) => {
    selectIncident(id);
    navigation.navigate('IncidentPlayback', { incidentId: id });
  };

  const handleSelectFilter = (category: IncidentCategory | 'all') => {
    setSelectedCategoryFilter(category);
    setIsDropdownOpen(false);
  };

  const handleLocateOnMap = (incident: Incident) => {
    setActiveTab('map');
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: incident.location.latitude,
          longitude: incident.location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    }, 200);
  };

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    try {
      await refreshLocation();
    } catch (e) {
      console.warn('Feed refresh error:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectPlace = (place: PlaceSearchResult) => {
    setActiveTab('map');
    setSearchedLocation(place);
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      900
    );
  };

  const handleSelectIncidentFromSearch = (incident: Incident) => {
    setActiveTab('map');
    mapRef.current?.animateToRegion(
      {
        latitude: incident.location.latitude,
        longitude: incident.location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      800
    );
    setTimeout(() => {
      handleSelectIncident(incident.id);
    }, 350);
  };

  const initialRegion = {
    latitude: currentCoords?.latitude || 40.73061,
    longitude: currentCoords?.longitude || -73.935242,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };


  const getCategoryColor = (cat: IncidentCategory | 'all') => {
    if (cat === 'critical') return '#FF334B';
    if (cat === 'advisory') return '#FFD600';
    return '#FFD600';
  };

  const activeOption = FILTER_OPTIONS.find((opt) => opt.key === selectedCategoryFilter);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
        showsUserLocation={true}
        showsCompass={false}
      >
        <MapMarkerCluster
          geoJson={filteredGeoJson}
          onSelectIncident={handleSelectIncident}
        />

        {/* Live Watch member location pins */}
        <WatchMemberMarkers
          friends={friends.filter((f) => f.isLocationSharing && f.liveLocation)}
          onMessageMember={(friend) =>
            navigation.navigate('ChatRoom', {
              friendId: friend.id,
              friendName: friend.name,
            })
          }
        />

        {searchedLocation && (
          <Marker
            key={`searched-marker-${searchedLocation.id || `${searchedLocation.latitude}-${searchedLocation.longitude}`}`}
            coordinate={{
              latitude: searchedLocation.latitude,
              longitude: searchedLocation.longitude,
            }}
            title={searchedLocation.title}
            description={searchedLocation.subtitle}
          >
            <View style={styles.searchedPinContainer}>
              <View style={styles.searchedPinPulse} />
              <View style={styles.searchedPinCore}>
                <Ionicons name="location-sharp" size={18} color="#000000" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Tactical Incident Feed / Home View */}
      {activeTab === 'home' && (
        <View style={styles.feedOverlay}>
          <TacticalIncidentFeed
            incidents={incidentsList}
            selectedCategory={selectedCategoryFilter}
            userCoords={currentCoords}
            onSelectIncident={handleSelectIncident}
            onLocateOnMap={handleLocateOnMap}
            onReportPress={() => navigation.navigate('CameraCapture')}
            onRefresh={handleRefreshFeed}
            isRefreshing={isRefreshing}
          />
        </View>
      )}

      {/* Top Header Bar (Available on Map and Home Feed) */}
      {(activeTab === 'map' || activeTab === 'home') && (
        <SafeAreaView style={styles.topBarSafe} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            {/* Left Controls: Search Icon Button (Map only) + Active Category Filter Pill + Searched Location Pill */}
            <View style={styles.leftControlsRow} pointerEvents="box-none">
              {activeTab === 'map' && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setIsSearchOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="search" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              )}

              {activeTab === 'map' && searchedLocation && (
                <TouchableOpacity
                  style={styles.searchedLocationPill}
                  onPress={() => {
                    mapRef.current?.animateToRegion(
                      {
                        latitude: searchedLocation.latitude,
                        longitude: searchedLocation.longitude,
                        latitudeDelta: 0.015,
                        longitudeDelta: 0.015,
                      },
                      600
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.searchedLocationText} numberOfLines={1}>
                    📍 {searchedLocation.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSearchedLocation(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}

              {selectedCategoryFilter !== 'all' && (
                <TouchableOpacity
                  style={[
                    styles.activeFilterPill,
                    { borderColor: getCategoryColor(selectedCategoryFilter) },
                  ]}
                  onPress={() => setIsDropdownOpen(true)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.filterDot,
                      { backgroundColor: getCategoryColor(selectedCategoryFilter) },
                    ]}
                  />
                  <Text style={styles.activeFilterText}>
                    {selectedCategoryFilter.toUpperCase()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedCategoryFilter('all')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            </View>

            {/* Right Controls: Notification Center Bell + Filter Trigger */}
            <View style={styles.rightControlsRow} pointerEvents="box-none">
              {/* Notification Center Bell Button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setIsNotificationCenterOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={colors.textPrimary}
                />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Heart Sliders Category Filter Button */}
              <TouchableOpacity
                style={[
                  styles.filterTriggerButton,
                  isDropdownOpen && styles.filterTriggerButtonActive,
                  selectedCategoryFilter !== 'all' && styles.filterTriggerButtonFiltered,
                ]}
                onPress={() => setIsDropdownOpen((prev) => !prev)}
                activeOpacity={0.8}
              >
                <HeartSlidersIcon
                  size={28}
                  color={
                    selectedCategoryFilter !== 'all'
                      ? '#FFD600'
                      : isDropdownOpen
                      ? colors.critical
                      : '#FFFFFF'
                  }
                  maskColor={
                    isDropdownOpen
                      ? 'rgba(35, 40, 58, 0.98)'
                      : 'rgba(21, 25, 41, 0.9)'
                  }
                />

                {/* Active Filter Indicator Badge */}
                {selectedCategoryFilter !== 'all' && (
                  <View
                    style={[
                      styles.activeBadgeIndicator,
                      { backgroundColor: getCategoryColor(selectedCategoryFilter) },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Floating Filter Dropdown Modal */}
      <Modal
        visible={isDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setIsDropdownOpen(false)}
        >
          <View
            style={[
              styles.dropdownCard,
              {
                position: 'absolute',
                top: insets.top + (Platform.OS === 'ios' ? 0 : spacing.sm) + 50 + 8,
                right: spacing.md,
              },
            ]}
          >
            {FILTER_OPTIONS.map((opt, index) => {
              const isSelected = selectedCategoryFilter === opt.key;
              const isLast = index === FILTER_OPTIONS.length - 1;

              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.dropdownOptionItem,
                    isSelected && styles.dropdownOptionItemActive,
                    !isLast && styles.dropdownOptionDivider,
                  ]}
                  onPress={() => handleSelectFilter(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>

                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color="#FFD600" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Floating Recenter Location Button (Bottom Right - Map View Only) */}
      {activeTab === 'map' && (
        <TouchableOpacity
          style={styles.floatingRecenterButton}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={25} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Unified Lower Navigation Bar: [Map] [Feed] [Camera] [Watch] [Profile] */}
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCameraPress={() => navigation.navigate('CameraCapture')}
        onCirclesPress={() => navigation.navigate('Circles')}
        onProfilePress={() => navigation.navigate('Profile')}
      />

      {/* In-App Notification Center Modal */}
      <NotificationCenterModal
        visible={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onSelectIncident={handleSelectIncident}
      />

      {/* Map Search Modal */}
      <MapSearchModal
        visible={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        userCoords={currentCoords}
        onSelectPlace={handleSelectPlace}
        onSelectIncident={handleSelectIncidentFromSearch}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topBarSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 0 : spacing.sm,
    position: 'relative',
  },

  feedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.heavy,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  leftControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    zIndex: 2,
  },
  rightControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    zIndex: 2,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: typography.fontWeights.heavy,
  },
  floatingRecenterButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 104 : 96,
    right: spacing.md,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 15,
  },
  filterTriggerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  filterTriggerButtonActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  filterTriggerButtonFiltered: {
    borderColor: '#FFFFFF',
  },
  activeBadgeIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dropdownCard: {
    width: 175,
    backgroundColor: 'rgba(21, 25, 41, 0.98)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  dropdownOptionItemActive: {
    backgroundColor: 'rgba(255, 214, 0, 0.08)',
  },
  dropdownOptionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
  },
  optionLabelActive: {
    color: '#FFD600',
    fontWeight: typography.fontWeights.bold,
  },
  searchedPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  searchedPinPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  searchedPinCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 6,
  },
  searchedLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    maxWidth: 160,
  },
  searchedLocationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
});
