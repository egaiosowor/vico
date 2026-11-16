import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { Incident, Coordinates, VoteType } from '../types';
import { calculateDistanceKm, formatDistance } from '../utils/formatting';
import { MediaPreview } from './MediaPreview';
import { IncidentActionSheet } from './IncidentActionSheet';
import { ShareIncidentModal } from './ShareIncidentModal';
import { votingService } from '../services/votingService';
import { FlagReason } from '../services/moderationService';
import { useAuthStore } from '../stores/authStore';
import { useIncidentStore } from '../stores/incidentStore';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';

interface IncidentReelItemProps {
  incident: Incident;
  userCoords: Coordinates | null;
  isActive: boolean;
  onLocateOnMap: (incident: Incident) => void;
  onSelectIncident: (id: string) => void;
}

const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const IncidentReelItem: React.FC<IncidentReelItemProps> = ({
  incident,
  userCoords,
  isActive,
  onLocateOnMap,
  onSelectIncident,
}) => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
  const user = useAuthStore((state) => state.user);
  const updateIncidentVotes = useIncidentStore((state) => state.updateIncidentVotes);
  const flagIncident = useIncidentStore((state) => state.flagIncident);
  const showAlert = useInAppNotificationStore((state) => state.showAlert);

  const [hasVoted, setHasVoted] = useState(false);
  const [upvotes, setUpvotes] = useState(incident.upvotes || 0);
  const [shares, setShares] = useState(
    incident.shareCount ?? Math.max(1, Math.floor((incident.upvotes || 5) * 0.45))
  );
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Double-tap heart/shield pop animation
  const popAnim = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);

  const category = incident.category;
  const isCritical = category === 'critical';
  const categoryColor = isCritical ? '#FF334B' : '#FFD600';
  const categoryLabel = isCritical ? 'URGENT DANGER' : 'ADVISORY ALERT';

  // Calculate distance
  const distanceStr = userCoords && incident.location
    ? formatDistance(calculateDistanceKm(userCoords, incident.location))
    : null;

  const triggerPopAnimation = () => {
    popAnim.setValue(0);
    Animated.sequence([
      Animated.spring(popAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }),
      Animated.timing(popAnim, {
        toValue: 0,
        duration: 300,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleVote = async () => {
    if (!user?.uid) return;

    if (hasVoted) {
      setHasVoted(false);
      setUpvotes((v) => Math.max(0, v - 1));
      updateIncidentVotes(incident.id, Math.max(0, upvotes - 1), incident.downvotes);
      try {
        await votingService.castVote(incident.id, user.uid, 'up');
      } catch (e) {
        console.warn('Vote toggle failed:', e);
      }
    } else {
      setHasVoted(true);
      setUpvotes((v) => v + 1);
      updateIncidentVotes(incident.id, upvotes + 1, incident.downvotes);
      triggerPopAnimation();
      try {
        await votingService.castVote(incident.id, user.uid, 'up');
      } catch (e) {
        console.warn('Vote cast failed:', e);
      }
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!hasVoted) {
        handleVote();
      } else {
        triggerPopAnimation();
      }
    }
    lastTapRef.current = now;
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleFlag = async (incidentId: string, reason: FlagReason) => {
    try {
      await flagIncident(incidentId, user?.uid || 'anonymous', reason);
      showAlert({
        category: 'system',
        title: 'Report Submitted',
        message: 'Thank you. This post has been removed from your feed.',
      });
    } catch (e) {
      console.warn('Flagging incident failed:', e);
    }
  };

  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Full-Screen Media Canvas */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.mediaContainer}
        onPress={handleDoubleTap}
      >
        {incident.mediaUrl ? (
          <MediaPreview
            uri={incident.mediaUrl}
            mediaType={incident.mediaType || 'photo'}
            contentFit="cover"
            shouldPlay={isActive}
            isLooping={true}
            showControls={false}
          />
        ) : (
          /* Tactical Radar Canvas Fallback */
          <View style={styles.radarFallback}>
            <View style={[styles.fallbackPulse, { borderColor: `${categoryColor}40` }]} />
            <View style={[styles.fallbackPulseInner, { borderColor: `${categoryColor}70` }]} />
            <View style={[styles.fallbackCore, { backgroundColor: categoryColor }]}>
              {category === 'critical' ? (
                <MaterialCommunityIcons name="alert-octagon" size={36} color="#FFFFFF" />
              ) : category === 'civic' ? (
                <Ionicons name="construct" size={32} color="#FFFFFF" />
              ) : (
                <Ionicons name="eye" size={32} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.fallbackText}>TACTICAL BROADCAST</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Top Gradient Vignette */}
      <View style={styles.topVignette} pointerEvents="none">
        <Svg height="140" width="100%">
          <Defs>
            <LinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.75" />
              <Stop offset="0.6" stopColor="#000000" stopOpacity="0.3" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="140" fill="url(#topFade)" />
        </Svg>
      </View>

      {/* Bottom Gradient Vignette */}
      <View style={styles.bottomVignette} pointerEvents="none">
        <Svg height="280" width="100%">
          <Defs>
            <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="0.4" stopColor="#000000" stopOpacity="0.45" />
              <Stop offset="0.8" stopColor="#000000" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="280" fill="url(#bottomFade)" />
        </Svg>
      </View>

      {/* Double Tap Heart / Shield Pop Animation */}
      {/* Double Tap Stylish Filled Up-Arrow Pop Animation */}
      <Animated.View
        style={[
          styles.popIconContainer,
          {
            opacity: popAnim,
            transform: [
              {
                scale: popAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1.3],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Svg width={90} height={90} viewBox="0 0 24 24" fill="#30D158">
          <Path d="M12 2.8 L2.5 12.2 C1.8 12.9 2.3 14 3.3 14 H7.2 V19.5 C7.2 20.3 7.8 21 8.6 21 H15.4 C16.2 21 16.8 20.3 16.8 19.5 V14 H20.7 C21.7 14 22.2 12.9 21.5 12.2 L12 2.8 Z" />
        </Svg>
      </Animated.View>

      {/* Right Action Rail (TikTok / Reels Style) */}
      <View style={styles.rightActionRail}>
        {/* 1. Like / Verify Button (Stylish Shorter Filled Up-Arrow) */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleVote}
          activeOpacity={0.75}
        >
          <View style={styles.actionIconWrapper}>
            <Svg width={30} height={30} viewBox="0 0 24 24" fill={hasVoted ? '#30D158' : '#FFFFFF'}>
              <Path d="M12 2.8 L2.5 12.2 C1.8 12.9 2.3 14 3.3 14 H7.2 V19.5 C7.2 20.3 7.8 21 8.6 21 H15.4 C16.2 21 16.8 20.3 16.8 19.5 V14 H20.7 C21.7 14 22.2 12.9 21.5 12.2 L12 2.8 Z" />
            </Svg>
          </View>
          <Text style={[styles.actionLabel, hasVoted && { color: '#30D158' }]}>
            {upvotes > 0 ? upvotes : 'Verify'}
          </Text>
        </TouchableOpacity>

        {/* 2. Share Button (Dynamic Curved Share Arrow with Character) */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleShare}
          activeOpacity={0.75}
        >
          <View style={styles.actionIconWrapper}>
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M14 4.5 V1.5 L22.5 9.5 L14 17.5 V13.5 C7 13.5 3.5 17.5 1.5 22 C2.8 15 6.5 8.2 14 4.5 Z" />
            </Svg>
          </View>
          <Text style={styles.actionLabel}>{shares}</Text>
        </TouchableOpacity>

        {/* 3. More Options Button */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => setShowActionSheet(true)}
          activeOpacity={0.75}
        >
          <View style={styles.actionIconWrapper}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom Left Information Overlay */}
      <View style={styles.bottomMetaContainer}>
        {/* Category Pill & Time Badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.categoryPill, { borderColor: `${categoryColor}60` }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {categoryLabel}
            </Text>
          </View>
          <Text style={styles.timeAgoText}>{formatTimeAgo(incident.timestamp)}</Text>
        </View>

        {/* Incident Description */}
        <Text style={styles.descriptionText} numberOfLines={3}>
          {incident.description}
        </Text>

        {/* Actual Location / Address Bar (No distance metrics) */}
        <TouchableOpacity
          style={styles.sectorChip}
          onPress={() => onLocateOnMap(incident)}
          activeOpacity={0.8}
        >
          <Ionicons name="location-sharp" size={13} color="#FFFFFF" />
          <Text style={styles.sectorText} numberOfLines={1}>
            {incident.address || incident.locationName || 'Sector Alert'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slide-up Action Sheet */}
      <IncidentActionSheet
        visible={showActionSheet}
        incident={incident}
        onClose={() => setShowActionSheet(false)}
        onFlag={handleFlag}
      />

      <ShareIncidentModal
        visible={showShareModal}
        incident={incident}
        onClose={() => setShowShareModal(false)}
        onShareComplete={() => setShares((s) => s + 1)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  mediaContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#05070D',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 5,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 5,
  },
  popIconContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#30D158',
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
  radarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F19',
  },
  fallbackPulse: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
  },
  fallbackPulseInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
  },
  fallbackCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fallbackText: {
    marginTop: 24,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 2,
  },
  rightActionRail: {
    position: 'absolute',
    right: 14,
    bottom: Platform.OS === 'ios' ? 116 : 106,
    alignItems: 'center',
    gap: 16,
    zIndex: 25,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  bottomMetaContainer: {
    position: 'absolute',
    left: 16,
    right: 76,
    bottom: Platform.OS === 'ios' ? 104 : 96,
    zIndex: 25,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  categoryText: {
    fontSize: 10.5,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.5,
  },
  timeAgoText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  descriptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 21,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28, 28, 30, 0.78)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginTop: 6,
  },
  sectorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
