import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { useIncidentStore } from '../stores/incidentStore';
import { useLocationStore } from '../stores/locationStore';
import { votingService } from '../services/votingService';
import { IncidentReelItem } from '../components/IncidentReelItem';

interface IncidentPlaybackScreenProps {
  route: {
    params: {
      incidentId: string;
    };
  };
  navigation: any;
}

export const IncidentPlaybackScreen: React.FC<IncidentPlaybackScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { incidentId } = route.params || {};
  const currentCoords = useLocationStore((state) => state.currentCoords);
  const incidents = useIncidentStore((state) => state.incidents);

  const incident = useMemo(() => {
    if (incidentId && incidents[incidentId]) {
      return incidents[incidentId];
    }
    const all = Object.values(incidents);
    if (all.length > 0) return all[0];
    return null;
  }, [incidentId, incidents]);

  useEffect(() => {
    if (incident?.id) {
      votingService.incrementViewCount(incident.id);
    }
  }, [incident?.id]);

  if (!incident) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Incident not found or expired.</Text>
        <TouchableOpacity
          style={styles.closeButtonCenter}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>Back to Map</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topOffset = Platform.OS === 'ios'
    ? Math.max(insets.top - 8, 12)
    : Math.max(insets.top, 14);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Identical TikTok / Reels Full-Screen Canvas */}
      <IncidentReelItem
        incident={incident}
        userCoords={currentCoords}
        isActive={true}
        onLocateOnMap={() => {
          navigation.goBack();
        }}
        onSelectIncident={() => {}}
      />

      {/* Floating Top-Left Back / Close Button (Clean, no circle background) */}
      <View
        style={[
          styles.floatingHeader,
          { top: insets.top > 0 ? insets.top + 4 : 16 },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  floatingHeader: {
    position: 'absolute',
    left: 10,
    zIndex: 50,
  },
  backButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeButtonCenter: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
  },
});
