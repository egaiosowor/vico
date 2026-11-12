import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/theme';
import { useIncidentStore } from '../stores/incidentStore';
import { Incident, IncidentCategory, Coordinates } from '../types';
import { calculateDistanceKm, formatDistance } from '../utils/formatting';
import { searchPlaces, PlaceSearchResult } from '../services/mapSearchService';

interface MapSearchModalProps {
  visible: boolean;
  onClose: () => void;
  userCoords?: Coordinates | null;
  onSelectPlace: (place: PlaceSearchResult) => void;
  onSelectIncident: (incident: Incident) => void;
}

export const MapSearchModal: React.FC<MapSearchModalProps> = ({
  visible,
  onClose,
  userCoords,
  onSelectPlace,
  onSelectIncident,
}) => {
  const [query, setQuery] = useState('');
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const inputRef = useRef<TextInput>(null);

  const incidentsMap = useIncidentStore((state) => state.incidents);

  // Clear query on modal open/close
  useEffect(() => {
    if (visible) {
      setQuery('');
      setPlaceResults([]);
      setIsSearchingPlaces(false);
    }
  }, [visible]);

  // Debounced Place Search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPlaceResults([]);
      setIsSearchingPlaces(false);
      return;
    }

    setIsSearchingPlaces(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(trimmed, userCoords);
        setPlaceResults(results);
      } catch (e) {
        setPlaceResults([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query, userCoords]);

  // Matching incidents in memory
  const matchingIncidents = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const activeList = Object.values(incidentsMap).filter((inc) => inc.active);

    const filtered = activeList.filter((inc) => {
      const desc = (inc.description || '').toLowerCase();
      const cat = (inc.category || '').toLowerCase();
      const id = (inc.id || '').toLowerCase();
      return desc.includes(trimmed) || cat.includes(trimmed) || id.includes(trimmed);
    });

    if (userCoords) {
      return filtered.sort((a, b) => {
        const distA = calculateDistanceKm(userCoords, a.location);
        const distB = calculateDistanceKm(userCoords, b.location);
        return distA - distB;
      });
    }

    return filtered;
  }, [query, incidentsMap, userCoords]);

  const getCategoryColor = (cat: IncidentCategory) => {
    if (cat === 'critical') return '#FF334B';
    return '#FFD600';
  };

  const handleClear = () => {
    setQuery('');
    setPlaceResults([]);
    inputRef.current?.focus();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Search Header Bar */}
          <View style={styles.searchHeader}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color="rgba(255, 255, 255, 0.45)"
                style={styles.searchIcon}
              />
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Search places, addresses, alerts..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={query}
                onChangeText={setQuery}
                autoFocus={true}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.45)" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelButton}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Results Content */}
          <ScrollView
            style={styles.resultsContainer}
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {/* 1. Active Incidents Section */}
            {matchingIncidents.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeader}>
                  MATCHING ALERTS ({matchingIncidents.length})
                </Text>

                {matchingIncidents.map((incident, index) => {
                  const catColor = getCategoryColor(incident.category);
                  const distKm = userCoords
                    ? calculateDistanceKm(userCoords, incident.location)
                    : null;
                  const distText = distKm !== null ? formatDistance(distKm) : null;

                  return (
                    <TouchableOpacity
                      key={`incident-${incident.id}-${index}`}
                      style={styles.incidentResultRow}
                      onPress={() => {
                        onClose();
                        onSelectIncident(incident);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.incidentIconContainer, { backgroundColor: `${catColor}22` }]}>
                        <MaterialCommunityIcons
                          name="alert-decagram"
                          size={20}
                          color={catColor}
                        />
                      </View>

                      <View style={styles.resultTextContainer}>
                        <View style={styles.incidentTitleRow}>
                          <Text style={[styles.incidentCategoryBadge, { color: catColor }]}>
                            {incident.category.toUpperCase()}
                          </Text>
                          {distText && (
                            <Text style={styles.distanceBadgeText}>{distText}</Text>
                          )}
                        </View>
                        <Text
                          style={styles.incidentDescription}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {incident.description}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="rgba(255, 255, 255, 0.3)"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 3. Places & Addresses Section */}
            {query.trim().length >= 2 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>PLACES & ADDRESSES</Text>
                  {isSearchingPlaces && (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  )}
                </View>

                {placeResults.map((place, index) => (
                  <TouchableOpacity
                    key={`place-${place.id}-${index}`}
                    style={styles.placeResultRow}
                    onPress={() => {
                      onClose();
                      onSelectPlace(place);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.placeIconContainer}>
                      <Ionicons name="location-sharp" size={19} color="#FFFFFF" />
                    </View>

                    <View style={styles.resultTextContainer}>
                      <Text style={styles.placeTitle} numberOfLines={1}>
                        {place.title}
                      </Text>
                      <Text
                        style={styles.placeSubtitle}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {place.subtitle}
                      </Text>
                    </View>

                    <Ionicons
                      name="arrow-forward-circle-outline"
                      size={20}
                      color="rgba(255, 255, 255, 0.35)"
                    />
                  </TouchableOpacity>
                ))}

                {/* Empty State */}
                {!isSearchingPlaces &&
                  placeResults.length === 0 &&
                  matchingIncidents.length === 0 && (
                    <View style={styles.emptyStateContainer}>
                      <Ionicons
                        name="search-outline"
                        size={38}
                        color="rgba(255, 255, 255, 0.2)"
                      />
                      <Text style={styles.emptyTitle}>No matching locations</Text>
                      <Text style={styles.emptySubtitle}>
                        Try searching by city, street, or alert keyword
                      </Text>
                    </View>
                  )}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    height: '82%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 4,
  },
  sectionHeader: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.8,
    marginBottom: spacing.xs + 4,
  },
  incidentResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xs + 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  incidentIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  resultTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  incidentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  incidentCategoryBadge: {
    fontSize: 11,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.5,
  },
  distanceBadgeText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  incidentDescription: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  placeResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xs + 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  placeIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  placeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  placeSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    textAlign: 'center',
  },
});
