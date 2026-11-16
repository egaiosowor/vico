import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme/theme';
import { Incident, Coordinates, VoteType } from '../types';
import { calculateDistanceKm, formatDistance, formatTimeAgo } from '../utils/formatting';
import { votingService } from '../services/votingService';
import { IncidentActionSheet } from './IncidentActionSheet';
import { ShareIncidentModal } from './ShareIncidentModal';
import { FlagReason } from '../services/moderationService';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';
import { useAuthStore } from '../stores/authStore';
import { useIncidentStore } from '../stores/incidentStore';

interface IncidentFeedCardProps {
  incident: Incident;
  userCoords: Coordinates | null;
  onPress: (incidentId: string) => void;
  onLocateOnMap: (incident: Incident) => void;
}

export const IncidentFeedCard: React.FC<IncidentFeedCardProps> = ({
  incident,
  userCoords,
  onPress,
  onLocateOnMap,
}) => {
  const user = useAuthStore((state) => state.user);
  const updateIncidentVotes = useIncidentStore((state) => state.updateIncidentVotes);
  const flagIncident = useIncidentStore((state) => state.flagIncident);
  const showAlert = useInAppNotificationStore((state) => state.showAlert);

  const [hasVotedUp, setHasVotedUp] = useState(false);
  const [upvotes, setUpvotes] = useState(incident.upvotes || 0);
  const [imageError, setImageError] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Compute proximity distance
  const distanceText = userCoords
    ? formatDistance(calculateDistanceKm(userCoords, incident.location))
    : null;

  // Category visual mapping
  const categoryColor =
    incident.category === 'critical'
      ? colors.critical
      : incident.category === 'community'
      ? colors.community
      : colors.civic;

  // Calculate TTL remaining
  const hoursRemaining = Math.max(
    0,
    Math.round((incident.expiresAt - Date.now()) / (1000 * 60 * 60))
  );

  const handleQuickConfirm = async () => {
    if (!user?.uid) return;

    const nextVoted = !hasVotedUp;
    const delta = nextVoted ? 1 : -1;
    const nextUpvotes = Math.max(0, upvotes + delta);

    setHasVotedUp(nextVoted);
    setUpvotes(nextUpvotes);
    updateIncidentVotes(incident.id, nextUpvotes, incident.downvotes || 0);

    try {
      await votingService.castVote(incident.id, user.uid, 'up');
    } catch (e) {
      console.warn('[IncidentFeedCard] Quick confirm failed:', e);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleFlag = async (id: string, reason: FlagReason) => {
    try {
      await flagIncident(id, user?.uid || 'anonymous', reason);
      showAlert({
        category: 'system',
        title: 'Report Submitted',
        message: 'Thank you. This post has been removed from your feed.',
      });
    } catch (e) {
      console.warn('Flagging failed:', e);
    }
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      activeOpacity={0.92}
      onPress={() => onPress(incident.id)}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {/* Category Pill */}
          <View style={[styles.categoryBadge, { borderColor: categoryColor }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {incident.category.toUpperCase()}
            </Text>
          </View>

          {/* Proximity Distance */}
          {distanceText && (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.distanceText}>{distanceText}</Text>
            </View>
          )}
        </View>

        {/* Relative Timestamp */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.timeText}>{formatTimeAgo(incident.timestamp)}</Text>
        </View>
      </View>

      {/* Media Preview Box */}
      {incident.mediaUrl && !imageError ? (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: incident.mediaUrl }}
            style={styles.mediaImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />

          {/* Video Indicator Overlay */}
          {incident.mediaType === 'video' && (
            <View style={styles.videoOverlayBadge}>
              <View style={styles.playCircle}>
                <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
              <Text style={styles.videoLabel}>VIDEO</Text>
            </View>
          )}

          {/* TTL Badge floating on bottom-right of media */}
          <View style={styles.ttlBadge}>
            <Ionicons name="hourglass-outline" size={10} color="#FFD600" />
            <Text style={styles.ttlText}>
              {hoursRemaining > 0 ? `${hoursRemaining}h left` : 'Expiring soon'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Ionicons
            name={incident.category === 'critical' ? 'alert-circle' : 'shield-checkmark'}
            size={36}
            color={categoryColor}
          />
          <Text style={styles.mediaPlaceholderText}>Broadcast Media Verified</Text>
        </View>
      )}

      {/* Incident Description */}
      <View style={styles.bodySection}>
        <Text style={styles.descriptionText} numberOfLines={3} ellipsizeMode="tail">
          {incident.description || 'Citizen reported activity at this location. Tap for details.'}
        </Text>

        {/* Location / Geohash Tag */}
        <View style={styles.tagRow}>
          <Ionicons name="location-sharp" size={12} color={colors.textMuted} />
          <Text style={styles.geohashTag}>
            Sector #{incident.geohashArea || incident.geohash.substring(0, 5)}
          </Text>
        </View>
      </View>

      {/* Tactical Action Bar */}
      <View style={styles.actionBar}>
        {/* Quick Confirm / Witness Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.confirmButton,
            hasVotedUp && styles.confirmButtonActive,
          ]}
          onPress={handleQuickConfirm}
          activeOpacity={0.75}
        >
          <Ionicons
            name={hasVotedUp ? 'shield-checkmark' : 'shield-outline'}
            size={14}
            color={hasVotedUp ? '#000000' : colors.textPrimary}
          />
          <Text
            style={[
              styles.actionButtonText,
              hasVotedUp && styles.confirmButtonTextActive,
            ]}
          >
            {upvotes > 0 ? `${upvotes} Confirmed` : 'Confirm'}
          </Text>
        </TouchableOpacity>

        {/* Right side buttons */}
        <View style={styles.actionRightButtons}>
          {/* Locate on Map */}
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={() => onLocateOnMap(incident)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="map-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.actionIconLabel}>Map</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={handleShare}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-social-outline" size={15} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* More */}
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={() => setShowActionSheet(true)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Slide-up Action Sheet */}
      <IncidentActionSheet
        visible={showActionSheet}
        incident={incident}
        onClose={() => setShowActionSheet(false)}
        onFlag={handleFlag}
      />

      {/* Instagram-Style Share Modal */}
      <ShareIncidentModal
        visible={showShareModal}
        incident={incident}
        onClose={() => setShowShareModal(false)}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(21, 25, 41, 0.95)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    gap: 5,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.5,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    gap: 4,
  },
  distanceText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  mediaContainer: {
    width: '100%',
    height: 190,
    backgroundColor: '#000000',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlayBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: borderRadius.pill,
    paddingRight: 10,
    paddingLeft: 4,
    paddingVertical: 3,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  playCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.critical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeights.heavy,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ttlBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.3)',
  },
  ttlText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: '#FFD600',
  },
  mediaPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(10, 14, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  mediaPlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  bodySection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    fontWeight: typography.fontWeights.medium,
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  geohashTag: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(10, 14, 26, 0.4)',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmButtonActive: {
    backgroundColor: '#FFD600',
    borderColor: '#FFD600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  confirmButtonTextActive: {
    color: '#000000',
  },
  actionRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: borderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  actionIconLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.semibold,
  },
});
