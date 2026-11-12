import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Friend, FriendStatus } from '../types';

interface WatchMemberMarkersProps {
  friends: Friend[];
  onMessageMember: (friend: Friend) => void;
}

const STALE_THRESHOLD_MS = 60_000; // 60 seconds

const getStatusColor = (status: FriendStatus): string => {
  switch (status) {
    case 'safe':   return '#30D158';
    case 'sos':    return '#FF453A';
    case 'offline':
    default:       return '#636366';
  }
};

interface MemberPinProps {
  friend: Friend;
  isStale: boolean;
}

const MemberPin: React.FC<MemberPinProps> = ({ friend, isStale }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (friend.status === 'sos') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [friend.status]);

  const ringColor = getStatusColor(friend.status);

  return (
    <View style={styles.pinWrapper}>
      {/* SOS pulse ring */}
      {friend.status === 'sos' && (
        <Animated.View
          style={[
            styles.sosRing,
            { borderColor: ringColor, transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}
      {/* Avatar ring */}
      <View style={[styles.avatarRing, { borderColor: ringColor, opacity: isStale ? 0.45 : 1 }]}>
        <View style={[styles.avatar, { backgroundColor: '#2C2C2E' }]}>
          <Text style={styles.initials}>{friend.avatarInitials}</Text>
        </View>
      </View>
      {/* Status dot */}
      <View style={[styles.statusDot, { backgroundColor: ringColor }]} />
    </View>
  );
};

export const WatchMemberMarkers: React.FC<WatchMemberMarkersProps> = ({
  friends,
  onMessageMember,
}) => {
  return (
    <>
      {friends.map((friend) => {
        if (!friend.liveLocation) return null;
        const { latitude, longitude } = friend.liveLocation;
        const isStale =
          friend.locationUpdatedAt != null &&
          Date.now() - friend.locationUpdatedAt > STALE_THRESHOLD_MS;

        const seenText = isStale && friend.locationUpdatedAt
          ? `Last seen ${Math.round((Date.now() - friend.locationUpdatedAt) / 60000)}m ago`
          : 'Live';

        return (
          <Marker
            key={`watch-member-${friend.id}`}
            coordinate={{ latitude, longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <MemberPin friend={friend} isStale={isStale} />
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{friend.name}</Text>
                <Text style={styles.calloutSub}>{seenText}</Text>
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => onMessageMember(friend)}
                >
                  <Ionicons name="chatbubble" size={12} color="#0A84FF" />
                  <Text style={styles.messageBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  sosRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
  },
  avatar: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  statusDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  callout: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  calloutSub: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 8,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,132,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  messageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A84FF',
  },
});
