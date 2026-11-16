import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  Linking,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Incident, Friend } from '../types';
import { useSocialStore } from '../stores/socialStore';
import { useAuthStore } from '../stores/authStore';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareIncidentModalProps {
  visible: boolean;
  onClose: () => void;
  incident: Incident;
  onShareComplete?: () => void;
}

// Stylized gradient-like background colors for avatars
const AVATAR_PALETTES = [
  '#E1306C',
  '#405DE6',
  '#F56040',
  '#5851DB',
  '#30D158',
  '#FF9500',
  '#007AFF',
  '#AF52DE',
];

const formatActiveTime = (timestamp?: number): string | null => {
  if (!timestamp) return null;
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 3) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const ShareIncidentModal: React.FC<ShareIncidentModalProps> = ({
  visible,
  onClose,
  incident,
  onShareComplete,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { friends, getOrCreateConversation, sendMessage } = useSocialStore();
  const { showAlert } = useInAppNotificationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [sentMemberIds, setSentMemberIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Purely dynamic list of real circle members from store
  const displayMembers = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase().trim();
    return friends.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.phoneNumber.includes(query) ||
        (m.avatarInitials && m.avatarInitials.toLowerCase().includes(query))
    );
  }, [friends, searchQuery]);

  const showInternalToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const getSharePayload = () => {
    const category = incident.category.toUpperCase();
    const loc = incident.address || incident.locationName || 'Nearby location';
    const mapsLink = `https://maps.google.com/?q=${incident.location.latitude},${incident.location.longitude}`;
    const text = `🚨 [VICO ${category} ALERT]: ${incident.description}\n📍 Location: ${loc}\n🗺️ Map: ${mapsLink}\nStay safe on Vico.`;
    return { category, loc, mapsLink, text };
  };

  // Toggle member selection
  const handleToggleMember = (memberId: string) => {
    if (sentMemberIds.includes(memberId)) return;
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Direct send to selected circle members
  const handleSendToSelectedMembers = () => {
    if (selectedMemberIds.length === 0) return;

    const { text } = getSharePayload();
    const senderId = user?.uid || 'me';
    const senderName =
      user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You';

    selectedMemberIds.forEach((memberId) => {
      const targetFriend = friends.find((m) => m.id === memberId);
      if (targetFriend) {
        const conv = getOrCreateConversation(targetFriend);
        sendMessage(
          conv.id,
          senderId,
          senderName,
          text,
          'text',
          incident.mediaUrl,
          incident.id
        );
      }
    });

    setSentMemberIds((prev) => [...prev, ...selectedMemberIds]);
    showInternalToast(
      `Sent to ${selectedMemberIds.length} member${selectedMemberIds.length > 1 ? 's' : ''}!`
    );
    setSelectedMemberIds([]);
    onShareComplete?.();

    setTimeout(() => {
      onClose();
    }, 800);
  };

  // Navigate to Circles to invite members
  const handleNavigateToCircles = () => {
    onClose();
    try {
      navigation.navigate('Circles');
    } catch (e) {
      console.warn('Navigation error:', e);
    }
  };

  // 1. External App: WhatsApp
  const handleWhatsAppShare = async () => {
    const { text } = getSharePayload();
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
      }
      onShareComplete?.();
      onClose();
    } catch {
      handleNativeShare();
    }
  };

  // 2. External App: Native OS Share Sheet (fallback)
  const handleNativeShare = async () => {
    const { category, text } = getSharePayload();
    try {
      const res = await Share.share({
        title: `${category} Alert - Vico`,
        message: text,
      });
      if (res.action === Share.sharedAction) {
        onShareComplete?.();
      }
      onClose();
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  // 3. External App: SMS / Messages
  const handleSmsShare = async () => {
    const { text } = getSharePayload();
    const url = `sms:&body=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
      onShareComplete?.();
      onClose();
    } catch {
      handleNativeShare();
    }
  };

  // 4. Broadcast to Circle
  const handleBroadcastToWatch = () => {
    showAlert({
      category: incident.category,
      title: `Broadcasted to Circle`,
      message: `Alert broadcast sent to all members in your sector.`,
    });
    showInternalToast('Broadcasted to all Circle members');
    onShareComplete?.();
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 12 },
          ]}
        >
          {/* Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Search Bar Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={17} color="#8E8E93" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search circle members"
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Members Section (Fully Dynamic) */}
          {friends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={26} color="rgba(255, 255, 255, 0.45)" />
              </View>
              <Text style={styles.emptyTitle}>No Circle Members Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add trusted family and neighbors to your Circle to share alerts directly.
              </Text>
              <TouchableOpacity
                style={styles.emptyInviteBtn}
                onPress={handleNavigateToCircles}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={14} color="#000000" style={{ marginRight: 6 }} />
                <Text style={styles.emptyInviteBtnText}>Invite Members</Text>
              </TouchableOpacity>
            </View>
          ) : displayMembers.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No members matching "{searchQuery}"</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.membersScrollView}
              contentContainerStyle={styles.membersGrid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {displayMembers.map((member, index) => {
                const isSelected = selectedMemberIds.includes(member.id);
                const isSent = sentMemberIds.includes(member.id);
                const avatarBg = AVATAR_PALETTES[index % AVATAR_PALETTES.length];
                const activeLabel = formatActiveTime(member.lastActiveTimestamp);

                return (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberItem}
                    onPress={() => handleToggleMember(member.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                        <Text style={styles.avatarInitials}>
                          {member.avatarInitials || member.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>

                      {/* Live Active pill or status */}
                      {!isSelected && !isSent && activeLabel && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>{activeLabel}</Text>
                        </View>
                      )}

                      {/* Checkmark or Sent Badge */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      )}
                      {isSent && (
                        <View style={styles.sentBadge}>
                          <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {isSent && <Text style={styles.memberSentSubtext}>Sent</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Toast Notification Banner inside Modal */}
          {toastMessage && (
            <View style={styles.inlineToast}>
              <Text style={styles.inlineToastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Bottom Dock: Either prominent "Send" button OR Instagram-style external apps dock */}
          {selectedMemberIds.length > 0 ? (
            <View style={styles.sendActionBar}>
              <TouchableOpacity
                style={styles.sendPrimaryBtn}
                onPress={handleSendToSelectedMembers}
                activeOpacity={0.85}
              >
                <Text style={styles.sendPrimaryBtnText}>
                  Send {selectedMemberIds.length > 1 ? `(${selectedMemberIds.length})` : ''}
                </Text>
                <Ionicons name="paper-plane" size={16} color="#000000" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.externalDockWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.externalDock}
              >
                {/* 1. Broadcast to Circle */}
                <TouchableOpacity
                  style={styles.dockItem}
                  onPress={handleBroadcastToWatch}
                  activeOpacity={0.75}
                >
                  <View style={styles.dockIconCircle}>
                    <Ionicons name="radio-outline" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.dockLabel} numberOfLines={1}>Broadcast</Text>
                </TouchableOpacity>

                {/* 2. WhatsApp */}
                <TouchableOpacity
                  style={styles.dockItem}
                  onPress={handleWhatsAppShare}
                  activeOpacity={0.75}
                >
                  <View style={[styles.dockIconCircle, styles.dockIconWhatsApp]}>
                    <Ionicons name="logo-whatsapp" size={25} color="#FFFFFF" />
                  </View>
                  <Text style={styles.dockLabel} numberOfLines={1}>WhatsApp</Text>
                </TouchableOpacity>

                {/* 3. SMS / Messages */}
                <TouchableOpacity
                  style={styles.dockItem}
                  onPress={handleSmsShare}
                  activeOpacity={0.75}
                >
                  <View style={styles.dockIconCircle}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.dockLabel} numberOfLines={1}>Messages</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingTop: 10,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  grabHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '400',
    paddingVertical: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  emptyInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
  },
  emptyInviteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  noResultsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  membersScrollView: {
    maxHeight: 280,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 16,
  },
  memberItem: {
    width: (SCREEN_WIDTH - 32) / 3,
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 6,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  activePill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#30D158',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  sentBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#30D158',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  memberName: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#F2F2F7',
    textAlign: 'center',
    width: '100%',
  },
  memberSentSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#30D158',
    marginTop: 2,
  },
  inlineToast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inlineToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sendActionBar: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  sendPrimaryBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.2,
  },
  externalDockWrapper: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
    marginTop: 4,
  },
  externalDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 16,
  },
  dockItem: {
    alignItems: 'center',
    width: 64,
  },
  dockIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dockIconWhatsApp: {
    backgroundColor: '#25D366',
  },
  dockLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});
