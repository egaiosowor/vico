import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  Platform,
  Share,
  Switch,
  Animated,
} from "react-native";
import * as Linking from "expo-linking";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} from "../theme/theme";
import { useSocialStore } from "../stores/socialStore";
import { useAuthStore } from "../stores/authStore";
import { useLocationStore } from "../stores/locationStore";
import { Friend, Conversation, WatchInvite } from "../types";
import { formatTimeAgo } from "../utils/formatting";
import { BottomNavBar } from "../components/BottomNavBar";
import {
  createInvite,
  acceptInvite,
  declineInvite,
  cancelInvite,
  subscribeToOutgoingInvites,
  lookupUserByPhone,
} from "../services/watchService";
import Svg, { Line, Polygon } from "react-native-svg";

interface RotatedPaperPlaneIconProps {
  size?: number;
  color?: string;
  style?: any;
}

/**
 * Dynamic, unconventional paper-airplane share icon matching Instagram/DM aesthetic
 */
const RotatedPaperPlaneIcon: React.FC<RotatedPaperPlaneIconProps> = ({
  size = 18,
  color = "#000000",
  style,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Line
      x1="22"
      y1="3"
      x2="9.218"
      y2="10.083"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Polygon
      points="11.698 20.334 13.094 15.698 22 3 2 8.784 8.452 11.162"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

interface CirclesScreenProps {
  navigation: any;
}

const AVATAR_PALETTES = [
  "#2C2C2E",
  "#1C3144",
  "#003566",
  "#2D3142",
  "#3D3A45",
  "#353535",
  "#283618",
  "#3F2E56",
];

const formatChatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return "";
  const now = new Date();
  const date = new Date(timestamp);
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return formatTimeAgo(timestamp);
};

export const CirclesScreen: React.FC<CirclesScreenProps> = ({ navigation }) => {
  const user = useAuthStore((state) => state.user);
  const currentCoords = useLocationStore((state) => state.currentCoords);

  const {
    friends,
    conversations,
    activeSos,
    pendingInvites,
    outgoingInvites,
    isLocationSharing,
    locationSharingScope,
    allowedLocationMemberIds,
    addFriend,
    sendSafetyPing,
    triggerSos,
    cancelSos,
    getOrCreateConversation,
    markConversationRead,
    toggleLocationSharing,
    setLocationSharingScope,
    toggleMemberLocationPermission,
    setPendingInvites,
    setOutgoingInvites,
    seedDemoData,
  } = useSocialStore();

  const insets = useSafeAreaInsets();
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
  const [sheetView, setSheetView] = useState<"main" | "location_privacy">(
    "main",
  );
  const [invitePhone, setInvitePhone] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [circleFilter, setCircleFilter] = useState<"inbox" | "requests">(
    "inbox",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const totalUnreadMessages = useMemo(() => {
    return Object.values(conversations).reduce(
      (sum, c) => sum + (c.unreadCount || 0),
      0,
    );
  }, [conversations]);

  const requestsCount = pendingInvites.length;

  // Auto-seed mock Circle data if store has no members and no invites
  useEffect(() => {
    if (
      friends.length === 0 &&
      outgoingInvites.length === 0 &&
      pendingInvites.length === 0
    ) {
      seedDemoData();
    }
  }, []);

  // Option B: In-App Success Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(3200),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  // Option C: Real-time listener for outgoing invites
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToOutgoingInvites(user.uid, (invites) => {
      setOutgoingInvites(invites);
    });
    return () => unsub();
  }, [user?.uid]);

  const conversationByParticipant = useMemo(() => {
    const map: Record<string, Conversation> = {};
    Object.values(conversations).forEach((c) => {
      map[c.participantId] = c;
    });
    return map;
  }, [conversations]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase().trim();
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.phoneNumber.includes(q) ||
        (f.avatarInitials && f.avatarInitials.toLowerCase().includes(q)),
    );
  }, [friends, searchQuery]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return pendingInvites;
    const q = searchQuery.toLowerCase().trim();
    return pendingInvites.filter(
      (inv) =>
        inv.fromName.toLowerCase().includes(q) || inv.fromPhone.includes(q),
    );
  }, [pendingInvites, searchQuery]);

  const handleOpenChat = (friend: Friend) => {
    const conv = getOrCreateConversation(friend);
    markConversationRead(conv.id);
    navigation.navigate("ChatRoom", {
      conversationId: conv.id,
      participantId: friend.id,
      participantName: friend.name,
      participantStatus: friend.status,
      participantPhone: friend.phoneNumber,
    });
  };

  const handlePing = (friend: Friend) => {
    const senderId = user?.uid || "usr_local";
    const senderName = user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : "You";

    sendSafetyPing(
      friend,
      senderId,
      senderName,
      user?.safeZoneGeohash || "dr5re",
    );
    Alert.alert(
      "Safety Ping Dispatched",
      `Sent a check-in alert to ${friend.name}. A message thread has been opened.`,
    );
  };

  const handleTriggerSos = () => {
    Alert.alert(
      "🚨 TRANSMIT CIRCLE SOS?",
      `This will instantly transmit an emergency distress beacon to all ${friends.length} members of your Circle with your live coordinates.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "BROADCAST SOS",
          style: "destructive",
          onPress: () => {
            const senderId = user?.uid || "usr_local";
            const senderName = user?.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : "You";

            triggerSos(
              senderId,
              senderName,
              currentCoords || undefined,
              user?.safeZoneGeohash || "dr5re",
            );

            Alert.alert(
              "🚨 SOS Beacon Broadcasted",
              `Distress signal and coordinates transmitted to all ${friends.length} Circle members.`,
            );
          },
        },
      ],
    );
  };

  const handleCancelSos = () => {
    Alert.alert(
      "Cancel Distress Beacon?",
      "This will inform all Circle members that you are now safe and resolve the emergency alert.",
      [
        { text: "Keep Active", style: "cancel" },
        {
          text: "I Am Safe (Cancel)",
          onPress: () => {
            const senderId = user?.uid || "usr_local";
            const senderName = user?.firstName
              ? `${user.firstName} ${user.lastName || ""}`.trim()
              : "You";

            cancelSos(senderId, senderName);
            Alert.alert(
              "Beacon Resolved",
              "Circle members have been notified that you are safe.",
            );
          },
        },
      ],
    );
  };

  const handleCallEmergency = () => {
    Linking.openURL("tel:911").catch(() => {
      Alert.alert("Emergency Call", "Dial 911 from your phone app.");
    });
  };

  const handleInvite = async () => {
    const targetPhone = invitePhone.trim();
    if (!targetPhone) {
      Alert.alert("Missing Info", "Please enter a phone number to invite.");
      return;
    }
    const currentUid = user?.uid || "usr_" + Date.now();
    const currentName = user?.fullName || user?.firstName || "Vico User";
    const currentPhone = user?.phoneNumber || "";

    // Check if user is trying to invite themselves
    if (
      currentPhone &&
      targetPhone.replace(/\D/g, "") === currentPhone.replace(/\D/g, "")
    ) {
      Alert.alert(
        "Invalid Contact",
        "You cannot invite your own phone number.",
      );
      return;
    }

    // Check if contact is already in active Circle friends
    const alreadyFriend = friends.find(
      (f) =>
        f.phoneNumber.replace(/\D/g, "") === targetPhone.replace(/\D/g, ""),
    );
    if (alreadyFriend) {
      Alert.alert(
        "Already in Circle",
        `${alreadyFriend.name} is already a member of your Circle.`,
      );
      return;
    }

    setIsInviting(true);
    try {
      // 1. Ascertain whether the phone belongs to an existing user (WhatsApp model)
      const lookup = await lookupUserByPhone(targetPhone);
      const isMember = lookup.isMember;
      const memberInfo = lookup.user;

      // 2. Create the invite with determined delivery method
      const link = await createInvite(
        currentUid,
        currentName,
        currentPhone,
        targetPhone,
        memberInfo?.uid,
        memberInfo?.name,
        isMember ? "in_app" : "sms",
      );
      setInvitePhone("");
      setIsInviteModalVisible(false);

      if (isMember) {
        // Delivered in-app directly! No SMS / Share sheet needed.
        showToast(`Invite sent in-app to ${memberInfo?.name || targetPhone}`);
      } else {
        // Not on Vico: trigger SMS / native share sheet
        try {
          await Share.share({
            message: `${user?.firstName ?? "Someone"} has invited you to join their safety Circle on Vico. Download & accept here: ${link}`,
            url: link,
          });
        } catch (_) {
          // Share sheet dismissed
        }
        showToast(`SMS invite ready for ${targetPhone}`);
      }
    } catch (e: any) {
      console.error("[CirclesScreen] handleInvite error:", e);
      Alert.alert(
        "Error",
        e?.message || "Could not create invite. Please try again.",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleReshareInvite = async (inv: WatchInvite) => {
    try {
      if (inv.deliveryMethod === "in_app") {
        showToast(`In-app ping resent to ${inv.toName || inv.toPhone}`);
        return;
      }
      const link = Linking.createURL(`invite/${inv.id}`);
      await Share.share({
        message: `${user?.firstName ?? "Someone"} has invited you to join their safety Circle on Vico. Accept here: ${link}`,
        url: link,
      });
      showToast(`Reshared invite link for ${inv.toPhone}`);
    } catch (_) {}
  };

  const handleCancelOutgoing = (inviteId: string) => {
    Alert.alert(
      "Revoke Invite?",
      "Are you sure you want to cancel this pending invitation?",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelInvite(inviteId);
              showToast("Invite revoked");
            } catch (e) {
              Alert.alert("Error", "Could not cancel invite.");
            }
          },
        },
      ],
    );
  };

  const handleAcceptInvite = async (inviteId: string, fromName: string) => {
    if (!user?.uid) return;
    try {
      await acceptInvite(
        inviteId,
        user.uid,
        user.fullName ?? user.firstName ?? "Vico User",
        user.phoneNumber,
      );
      Alert.alert(
        "Connected!",
        `You and ${fromName} are now in each other's Circle.`,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not accept invite.");
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineInvite(inviteId);
    } catch (_) {}
  };

  const handleLocateMember = (friend: Friend) => {
    if (!friend.liveLocation) {
      Alert.alert(
        "Location unavailable",
        `${friend.name} is not sharing their location.`,
      );
      return;
    }
    navigation.navigate("MainMap", {
      activeTab: "map",
      focusCoords: friend.liveLocation,
    });
  };

  const renderFriendCard = ({ item }: { item: Friend }) => {
    const isSafe = item.status === "safe";
    const isSos = item.status === "sos";
    const conv = conversationByParticipant[item.id];
    const unreadCount = conv?.unreadCount || 0;
    const hasUnread = unreadCount > 0;
    const avatarBg =
      AVATAR_PALETTES[
        (item.name.length +
          (item.phoneNumber
            ? item.phoneNumber.charCodeAt(item.phoneNumber.length - 1)
            : 0)) %
          AVATAR_PALETTES.length
      ];
    const timestampStr = formatChatTimestamp(
      conv?.lastMessageTimestamp || item.locationUpdatedAt,
    );

    return (
      <TouchableOpacity
        style={styles.chatRow}
        onPress={() => handleOpenChat(item)}
        activeOpacity={0.65}
      >
        {/* Left: Avatar with status indicator dot */}
        <View style={styles.chatAvatarWrapper}>
          <View style={[styles.chatAvatarInner, { backgroundColor: avatarBg }]}>
            <Text style={styles.chatAvatarInitials}>{item.avatarInitials}</Text>
          </View>
          <View
            style={[
              styles.chatAvatarStatusDot,
              {
                backgroundColor:
                  item.status === "sos"
                    ? "#FF3B30"
                    : item.status === "offline"
                      ? "#636366"
                      : "#30D158",
              },
            ]}
          />
        </View>

        {/* Center & Right Details */}
        <View style={styles.chatContentWrapper}>
          {/* Top Row: Name and Time */}
          <View style={styles.chatTopRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.name}
            </Text>
            {timestampStr ? (
              <Text
                style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}
              >
                {timestampStr}
              </Text>
            ) : null}
          </View>

          {/* Bottom Row: Last message and Unread Badge */}
          <View style={styles.chatBottomRow}>
            <View style={styles.chatSnippetContainer}>
              {Boolean(conv?.lastMessageText) && (
                <Ionicons
                  name="checkmark-done"
                  size={15}
                  color={hasUnread ? "#8E8E93" : "#30D158"}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.chatSnippetText,
                  hasUnread && styles.chatSnippetTextUnread,
                  Boolean(conv?.lastMessageText?.includes("SOS")) &&
                    styles.chatSnippetTextSos,
                ]}
                numberOfLines={1}
              >
                {conv?.lastMessageText || `Tap to message ${item.name}`}
              </Text>
            </View>

            {hasUnread && (
              <View style={styles.chatUnreadBadge}>
                <Text style={styles.chatUnreadBadgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Option B: In-App Confirmation Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toastCheckmarkCircle}>
            <Ionicons name="checkmark" size={13} color="#000000" />
          </View>
          <Text style={styles.toastText} numberOfLines={2}>
            {toastMessage}
          </Text>
          <TouchableOpacity
            onPress={() => setToastMessage(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Top Header Actions */}
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.headerCircleBtn}
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : setIsOptionsMenuVisible(true)
          }
          activeOpacity={0.75}
        >
          <Ionicons
            name={
              navigation.canGoBack() ? "chevron-back" : "ellipsis-horizontal"
            }
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => setIsInviteModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={24} color="#000000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerCircleBtn,
              isLocationSharing && styles.headerCircleBtnActive,
            ]}
            onPress={() => {
              setSheetView("main");
              setIsOptionsMenuVisible(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={
                isLocationSharing ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)"
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={17}
            color="#8E8E93"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active Circle SOS Beacon Card */}
      {activeSos && (
        <View style={styles.sosActiveBanner}>
          <View style={styles.sosActiveHeader}>
            <View style={styles.sosPulsingDot}>
              <Ionicons name="warning" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.sosActiveTextGroup}>
              <Text style={styles.sosActiveTitle}>CIRCLE SOS BROADCASTING</Text>
              <Text style={styles.sosActiveSubtitle}>
                Live distress signal active across all {friends.length} Circle
                members
              </Text>
            </View>
          </View>

          <View style={styles.sosActiveActions}>
            <TouchableOpacity
              style={styles.sosCancelButton}
              onPress={handleCancelSos}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark" size={15} color="#000000" />
              <Text style={styles.sosCancelText}>I AM SAFE (CANCEL)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sosCallButton}
              onPress={handleCallEmergency}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={15} color="#FFFFFF" />
              <Text style={styles.sosCallText}>CALL 911</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Pills: Inbox (with count) & Requests (with count) */}
      <View style={styles.pillsWrapper}>
        <View style={styles.pillsRow}>
          {/* Pill 1: Inbox */}
          <TouchableOpacity
            style={[styles.pill, circleFilter === "inbox" && styles.pillActive]}
            onPress={() => setCircleFilter("inbox")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                circleFilter === "inbox" && styles.pillTextActive,
              ]}
            >
              Inbox{totalUnreadMessages > 0 ? ` ${totalUnreadMessages}` : ""}
            </Text>
          </TouchableOpacity>

          {/* Pill 2: Requests */}
          <TouchableOpacity
            style={[
              styles.pill,
              circleFilter === "requests" && styles.pillActive,
            ]}
            onPress={() => setCircleFilter("requests")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.pillText,
                circleFilter === "requests" && styles.pillTextActive,
              ]}
            >
              Requests{requestsCount > 0 ? ` ${requestsCount}` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content: Members List or Requests */}
      {circleFilter === "inbox" ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendCard}
          ItemSeparatorComponent={() => <View style={styles.chatSeparator} />}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="people-outline"
                  size={34}
                  color="rgba(255, 255, 255, 0.5)"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim()
                  ? `No members matching "${searchQuery}"`
                  : "No Members in Your Circle"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? "Try searching with a different name or phone number."
                  : "Invite trusted family and neighbors. Accept each other's invites to share live locations and emergency pings."}
              </Text>
              {!searchQuery.trim() && (
                <TouchableOpacity
                  style={styles.emptyInviteButton}
                  onPress={() => setIsInviteModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="person-add"
                    size={16}
                    color="#000000"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.emptyInviteButtonText}>
                    Invite Members
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      ) : (
        /* Requests View: Incoming requests only, sent invites removed */
        <ScrollView
          contentContainerStyle={styles.pendingTabScroll}
          showsVerticalScrollIndicator={false}
        >
          {filteredRequests.length > 0 ? (
            <View style={styles.pendingGroup}>
              <Text style={styles.pendingGroupTitle}>
                INCOMING REQUESTS ({filteredRequests.length})
              </Text>
              {filteredRequests.map((inv) => (
                <View key={inv.id} style={styles.pendingCard}>
                  <View style={styles.pendingInfo}>
                    <Ionicons
                      name="person-add"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.pendingText} numberOfLines={1}>
                      <Text style={{ color: "#FFF", fontWeight: "600" }}>
                        {inv.fromName}
                      </Text>
                      {" wants to join your Circle"}
                    </Text>
                  </View>
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.pendingAccept}
                      onPress={() => handleAcceptInvite(inv.id, inv.fromName)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pendingAcceptText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pendingDecline}
                      onPress={() => handleDeclineInvite(inv.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pendingDeclineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="mail-open-outline"
                  size={34}
                  color="rgba(255, 255, 255, 0.5)"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim()
                  ? `No requests matching "${searchQuery}"`
                  : "No Requests"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim()
                  ? "Check the spelling or clear the search query."
                  : "When someone invites you to their Circle, their request will appear here."}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <Modal
        visible={isInviteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite to Circle</Text>
              <TouchableOpacity
                onPress={() => setIsInviteModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="rgba(255, 255, 255, 0.6)"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter their phone number. If they are on Vico, the invite arrives
              in-app immediately. Otherwise, an SMS invite is prepared.
            </Text>

            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              keyboardType="phone-pad"
              value={invitePhone}
              onChangeText={setInvitePhone}
              selectionColor="#FFFFFF"
            />

            <TouchableOpacity
              style={[styles.modalSubmitButton, isInviting && { opacity: 0.6 }]}
              onPress={handleInvite}
              activeOpacity={0.85}
              disabled={isInviting}
            >
              <Text style={styles.modalSubmitText}>
                {isInviting ? "Creating link…" : "Send Invite"}
              </Text>
              <RotatedPaperPlaneIcon
                size={17}
                color="#000000"
                style={styles.sendIconOffset}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Circle Settings Bottom Sheet (WhatsApp style with drill-down) */}
      <Modal
        visible={isOptionsMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsOptionsMenuVisible(false);
          setSheetView("main");
        }}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setIsOptionsMenuVisible(false);
            setSheetView("main");
          }}
        >
          <View style={styles.sheetBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.optionsSheetContainer,
                  { paddingBottom: Math.max(insets.bottom, 20) + 12 },
                ]}
              >
                {sheetView === "main" ? (
                  <>
                    {/* Pull Handle */}
                    <View style={styles.sheetHandleBar} />

                    {/* Sheet Header */}
                    <View style={styles.sheetHeader}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.sheetTitle}>Circle Settings</Text>
                        <Text style={styles.sheetHeaderSubtitle}>
                          Manage privacy and Circle preferences
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setIsOptionsMenuVisible(false);
                          setSheetView("main");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.sheetCloseButton}
                      >
                        <Ionicons
                          name="close"
                          size={20}
                          color="rgba(255, 255, 255, 0.6)"
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Main Settings Menu Items */}
                    <View style={styles.sheetMenuList}>
                      {/* Location Privacy Row */}
                      <TouchableOpacity
                        style={styles.sheetMenuItem}
                        onPress={() => setSheetView("location_privacy")}
                        activeOpacity={0.75}
                      >
                        <View style={styles.sheetMenuIconWrap}>
                          <Ionicons
                            name="location-outline"
                            size={20}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={styles.sheetMenuTextGroup}>
                          <Text style={styles.sheetMenuTitle}>
                            Location Privacy
                          </Text>
                          <Text style={styles.sheetMenuSubtitle}>
                            {locationSharingScope === "all"
                              ? `Sharing with all ${friends.length} members`
                              : locationSharingScope === "custom"
                                ? `Sharing with ${allowedLocationMemberIds.length} of ${friends.length} members`
                                : "Ghost Mode (Nobody)"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="rgba(255, 255, 255, 0.4)"
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Pull Handle */}
                    <View style={styles.sheetHandleBar} />

                    {/* Sub-Header with Back Button */}
                    <View style={styles.sheetHeader}>
                      <TouchableOpacity
                        onPress={() => setSheetView("main")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.sheetBackButton}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={20}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1, marginHorizontal: 8 }}>
                        <Text style={styles.sheetTitle}>Location Privacy</Text>
                        <Text style={styles.sheetHeaderSubtitle}>
                          Who can see your live whereabouts on the map
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setIsOptionsMenuVisible(false);
                          setSheetView("main");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.sheetCloseButton}
                      >
                        <Ionicons
                          name="close"
                          size={20}
                          color="rgba(255, 255, 255, 0.6)"
                        />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      style={styles.privacyScrollArea}
                      showsVerticalScrollIndicator={false}
                      bounces={false}
                    >
                      {/* Option 1: All Circle Members */}
                      <TouchableOpacity
                        style={[
                          styles.privacyOptionCard,
                          locationSharingScope === "all" &&
                            styles.privacyOptionCardSelected,
                        ]}
                        onPress={() =>
                          setLocationSharingScope("all", user?.uid)
                        }
                        activeOpacity={0.75}
                      >
                        <View style={styles.privacyOptionLeft}>
                          <Ionicons
                            name={
                              locationSharingScope === "all"
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={20}
                            color={
                              locationSharingScope === "all"
                                ? "#FFFFFF"
                                : "rgba(255, 255, 255, 0.4)"
                            }
                          />
                          <View style={styles.privacyOptionTextGroup}>
                            <Text style={styles.privacyOptionTitle}>
                              All Circle Members
                            </Text>
                            <Text style={styles.privacyOptionSubtitle}>
                              All {friends.length} trusted members can track
                              your location
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Option 2: Only Share With... */}
                      <TouchableOpacity
                        style={[
                          styles.privacyOptionCard,
                          locationSharingScope === "custom" &&
                            styles.privacyOptionCardSelected,
                        ]}
                        onPress={() =>
                          setLocationSharingScope("custom", user?.uid)
                        }
                        activeOpacity={0.75}
                      >
                        <View style={styles.privacyOptionLeft}>
                          <Ionicons
                            name={
                              locationSharingScope === "custom"
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={20}
                            color={
                              locationSharingScope === "custom"
                                ? "#FFFFFF"
                                : "rgba(255, 255, 255, 0.4)"
                            }
                          />
                          <View style={styles.privacyOptionTextGroup}>
                            <Text style={styles.privacyOptionTitle}>
                              Only Share With…
                            </Text>
                            <Text style={styles.privacyOptionSubtitle}>
                              {allowedLocationMemberIds.length} of{" "}
                              {friends.length} members selected
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Selective Members Checkbox List (shown when custom is selected) */}
                      {locationSharingScope === "custom" && (
                        <View style={styles.customMembersBox}>
                          <Text style={styles.customMembersSectionHeader}>
                            SELECT MEMBERS ({allowedLocationMemberIds.length}/
                            {friends.length})
                          </Text>
                          {friends.length === 0 ? (
                            <Text style={styles.customMembersEmptyText}>
                              No members in your Circle yet. Use the + button to
                              invite contacts.
                            </Text>
                          ) : (
                            friends.map((friend) => {
                              const isAllowed =
                                allowedLocationMemberIds.includes(friend.id);
                              return (
                                <TouchableOpacity
                                  key={friend.id}
                                  style={styles.customMemberRow}
                                  onPress={() =>
                                    toggleMemberLocationPermission(
                                      friend.id,
                                      user?.uid,
                                    )
                                  }
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.customMemberLeft}>
                                    <View style={styles.customMemberAvatar}>
                                      <Text
                                        style={styles.customMemberAvatarText}
                                      >
                                        {friend.avatarInitials}
                                      </Text>
                                    </View>
                                    <View>
                                      <Text style={styles.customMemberName}>
                                        {friend.name}
                                      </Text>
                                      <Text style={styles.customMemberPhone}>
                                        {friend.phoneNumber}
                                      </Text>
                                    </View>
                                  </View>
                                  <Ionicons
                                    name={
                                      isAllowed
                                        ? "checkmark-circle"
                                        : "ellipse-outline"
                                    }
                                    size={22}
                                    color={
                                      isAllowed
                                        ? "#FFFFFF"
                                        : "rgba(255, 255, 255, 0.3)"
                                    }
                                  />
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      )}

                      {/* Option 3: Nobody (Ghost Mode) */}
                      <TouchableOpacity
                        style={[
                          styles.privacyOptionCard,
                          locationSharingScope === "none" &&
                            styles.privacyOptionCardSelected,
                        ]}
                        onPress={() =>
                          setLocationSharingScope("none", user?.uid)
                        }
                        activeOpacity={0.75}
                      >
                        <View style={styles.privacyOptionLeft}>
                          <Ionicons
                            name={
                              locationSharingScope === "none"
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={20}
                            color={
                              locationSharingScope === "none"
                                ? "#FFFFFF"
                                : "rgba(255, 255, 255, 0.4)"
                            }
                          />
                          <View style={styles.privacyOptionTextGroup}>
                            <Text style={styles.privacyOptionTitle}>
                              Nobody (Ghost Mode)
                            </Text>
                            <Text style={styles.privacyOptionSubtitle}>
                              Your whereabouts are completely private and hidden
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </ScrollView>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Floating SOS Action Button */}
      <TouchableOpacity
        style={[
          styles.floatingSosButton,
          activeSos && styles.floatingSosButtonActive,
        ]}
        onPress={activeSos ? handleCancelSos : handleTriggerSos}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          activeSos ? "Cancel SOS Broadcast" : "Emergency SOS"
        }
      >
        <Text style={styles.floatingSosText}>SOS</Text>
      </TouchableOpacity>

      {/* Unified Lower Navigation Bar */}
      <BottomNavBar
        activeTab="watch"
        onFeedPress={() =>
          navigation.navigate("MainMap", { activeTab: "home" })
        }
        onMapPress={() => navigation.navigate("MainMap", { activeTab: "map" })}
        onCameraPress={() => navigation.navigate("CameraCapture")}
        onCirclesPress={() => {}}
        onProfilePress={() => navigation.navigate("Profile")}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  headerCircleBtnActive: {
    borderColor: "#FFFFFF",
    backgroundColor: "#2C2C2E",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    height: 38,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  pillsWrapper: {
    marginBottom: 10,
  },
  pillsRow: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pill: {
    position: "relative",
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#33363D",
  },
  pillActive: {
    backgroundColor: "#282A2F",
    borderColor: "#282A2F",
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  pillRedBadge: {
    position: "absolute",
    top: -4,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF1744",
    borderWidth: 1.8,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    zIndex: 10,
  },
  pillRedBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
  pillPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  floatingSosButton: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 104 : 96,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 25,
  },
  floatingSosButtonActive: {
    backgroundColor: "#D70015",
    borderColor: "#FFFFFF",
    borderWidth: 2,
  },
  floatingSosText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sosActiveBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FF3B30",
  },
  sosActiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sosPulsingDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  sosActiveTextGroup: {
    flex: 1,
  },
  sosActiveTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  sosActiveSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 2,
  },
  sosActiveActions: {
    flexDirection: "row",
    gap: 10,
  },
  sosCancelButton: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    height: 44,
    borderRadius: 8,
  },
  sosCancelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: 0.3,
  },
  sosCallButton: {
    flex: 0.8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FF3B30",
    height: 44,
    borderRadius: 8,
  },
  sosCallText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  pendingSection: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 6,
    gap: 8,
  },
  pendingCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 12,
  },
  pendingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  pendingText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.65)",
    flex: 1,
  },
  pendingActions: {
    flexDirection: "row",
    gap: 10,
  },
  pendingAccept: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingAcceptText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  pendingDecline: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  pendingDeclineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)",
  },

  listPadding: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 130,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#000000",
  },
  chatAvatarWrapper: {
    position: "relative",
    marginRight: 12,
    width: 50,
    height: 50,
  },
  chatAvatarInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  chatAvatarStatusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: "#000000",
  },
  chatAvatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  chatContentWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  chatTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16.5,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 10,
  },
  chatTime: {
    fontSize: 12.5,
    fontWeight: "400",
    color: "#8E8E93",
  },
  chatTimeUnread: {
    color: "#25D366",
    fontWeight: "600",
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatSnippetContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  chatSnippetText: {
    fontSize: 14,
    color: "#8E8E93",
    flex: 1,
  },
  chatSnippetTextUnread: {
    color: "rgba(255, 255, 255, 0.88)",
    fontWeight: "500",
  },
  chatSnippetTextSos: {
    color: "#FF3B30",
    fontWeight: "600",
  },
  chatUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#25D366",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  chatUnreadBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#000000",
  },
  chatSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: 86,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 8,
  },
  emptyInviteButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInviteButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 20,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#121214",
    borderRadius: 8,
    height: 52,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    color: "#FFFFFF",
    fontSize: 16,
    paddingHorizontal: 16,
  },
  modalSubmitButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalSubmitText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "700",
  },
  sendIconOffset: {
    transform: [{ rotate: "4deg" }],
    marginLeft: 8,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  optionsSheetContainer: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  sheetHeaderSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 2,
  },
  sheetBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetMenuList: {
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  sheetMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetMenuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sheetMenuTextGroup: {
    flex: 1,
    marginRight: 8,
  },
  sheetMenuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sheetMenuSubtitle: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.55)",
    marginTop: 2,
  },
  privacyScrollArea: {
    maxHeight: 460,
  },
  privacyOptionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    marginBottom: 10,
  },
  privacyOptionCardSelected: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  privacyOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privacyOptionTextGroup: {
    flex: 1,
  },
  privacyOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  privacyOptionSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
  },
  customMembersBox: {
    backgroundColor: "#121214",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  customMembersSectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  customMembersEmptyText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.45)",
    fontStyle: "italic",
    paddingVertical: 4,
  },
  customMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  customMemberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  customMemberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  customMemberAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  customMemberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  customMemberPhone: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
  },

  // Toast styles (Option B)
  toastContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 50,
    left: 20,
    right: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  toastCheckmarkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  // Outgoing Invites (Option C)
  outgoingSection: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  outgoingSectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  outgoingCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 12,
  },
  outgoingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  outgoingIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  outgoingIconCircleInApp: {
    backgroundColor: "rgba(48, 209, 88, 0.15)",
    borderColor: "rgba(48, 209, 88, 0.3)",
  },
  outgoingTextGroup: {
    flex: 1,
  },
  outgoingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  outgoingPhoneText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  deliveryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deliveryBadgeInApp: {
    backgroundColor: "rgba(48, 209, 88, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(48, 209, 88, 0.35)",
  },
  deliveryBadgeSms: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  deliveryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.6,
  },
  deliveryBadgeTextInApp: {
    color: "#30D158",
  },
  outgoingSubtext: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 2,
  },
  outgoingActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  outgoingReshareBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outgoingReshareText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  outgoingCancelBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  outgoingCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)",
  },
  // Requests Tab Scroll & Grouping
  pendingTabScroll: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 20,
  },
  pendingGroup: {
    gap: 8,
  },
  pendingGroupTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
  },
});
