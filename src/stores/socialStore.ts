import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Friend,
  ChatMessage,
  Conversation,
  ChatMessageType,
  Coordinates,
  SosDistressBeacon,
  FriendStatus,
  WatchInvite,
} from '../types';
import {
  toggleLocationSharing as toggleSharingInFirestore,
  updateLocationSharingPreferences,
} from '../services/watchService';

interface SocialState {
  friends: Friend[];
  conversations: Record<string, Conversation>;
  messages: Record<string, ChatMessage[]>; // Keyed by conversationId
  totalUnreadMessages: number;
  activeSos: SosDistressBeacon | null;
  // Mutual Watch
  pendingInvites: WatchInvite[];
  outgoingInvites: WatchInvite[];
  isLocationSharing: boolean;
  locationSharingScope: 'all' | 'custom' | 'none';
  allowedLocationMemberIds: string[];

  // Actions
  seedDemoData: () => void;
  addFriend: (data: { name: string; phoneNumber: string; sectorGeohash?: string }) => Friend;
  removeFriend: (friendId: string) => void;
  updateFriendStatus: (friendId: string, status: FriendStatus) => void;
  // Mutual Watch actions
  setFriends: (friends: Friend[]) => void;
  setMemberLocation: (uid: string, coords: Coordinates, updatedAt: number, isSharing: boolean) => void;
  setPendingInvites: (invites: WatchInvite[]) => void;
  setOutgoingInvites: (invites: WatchInvite[]) => void;
  toggleLocationSharing: (myUid: string) => Promise<void>;
  setLocationSharingScope: (scope: 'all' | 'custom' | 'none', myUid?: string) => Promise<void>;
  toggleMemberLocationPermission: (memberId: string, myUid?: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    type?: ChatMessageType,
    mediaUrl?: string,
    incidentId?: string,
    locationMeta?: {
      latitude: number;
      longitude: number;
      liveUntil: number;
      isLiveActive: boolean;
    }
  ) => ChatMessage;
  stopLiveLocationShare: (conversationId: string, messageId: string) => void;
  sendSafetyPing: (
    friend: Friend,
    senderId: string,
    senderName: string,
    mySector?: string
  ) => void;
  triggerSos: (
    senderId: string,
    senderName: string,
    coords?: Coordinates,
    sectorGeohash?: string
  ) => SosDistressBeacon;
  cancelSos: (senderId: string, senderName: string) => void;
  markConversationRead: (conversationId: string) => void;
  getOrCreateConversation: (friend: Friend) => Conversation;
  syncMockFriendsLocation: (center: Coordinates) => void;
  clearAllChats: () => void;
}

export const INITIAL_MOCK_FRIENDS: Friend[] = [
  {
    id: 'usr_sarah_connor',
    name: 'Sarah Connor',
    phoneNumber: '+1 (555) 234-5678',
    avatarInitials: 'SC',
    status: 'safe',
    lastActiveTimestamp: Date.now() - 4 * 60 * 1000,
    isLocationSharing: true,
    distanceKm: 0.4,
    sectorGeohash: 'dr5re9',
    liveLocation: { latitude: 40.7128 + 0.003, longitude: -74.006 + 0.002 },
    locationUpdatedAt: Date.now() - 2 * 60 * 1000,
  },
  {
    id: 'usr_marcus_vance',
    name: 'Marcus Vance',
    phoneNumber: '+1 (555) 876-5432',
    avatarInitials: 'MV',
    status: 'safe',
    lastActiveTimestamp: Date.now() - 11 * 60 * 1000,
    isLocationSharing: true,
    distanceKm: 1.2,
    sectorGeohash: 'dr5re5',
    liveLocation: { latitude: 40.7128 - 0.005, longitude: -74.006 - 0.004 },
    locationUpdatedAt: Date.now() - 5 * 60 * 1000,
  },
  {
    id: 'usr_elena_rostova',
    name: 'Elena Rostova',
    phoneNumber: '+1 (555) 349-1102',
    avatarInitials: 'ER',
    status: 'safe',
    lastActiveTimestamp: Date.now() - 28 * 60 * 1000,
    isLocationSharing: false,
    distanceKm: 2.8,
    sectorGeohash: 'dr5ref',
  },
];

export const INITIAL_MOCK_PENDING_INVITES: WatchInvite[] = [
  {
    id: 'inv_in_david_miller',
    fromUid: 'usr_david_miller',
    fromName: 'David Miller',
    fromPhone: '+1 (555) 312-7740',
    toPhone: '+1 (555) 000-0000',
    status: 'pending',
    deliveryMethod: 'in_app',
    createdAt: Date.now() - 25 * 60 * 1000,
    expiresAt: Date.now() + 47 * 3600 * 1000,
  },
  {
    id: 'inv_in_ray_chen',
    fromUid: 'usr_ray_chen',
    fromName: 'Officer Ray Chen',
    fromPhone: '+1 (555) 628-9901',
    toPhone: '+1 (555) 000-0000',
    status: 'pending',
    deliveryMethod: 'in_app',
    createdAt: Date.now() - 3 * 3600 * 1000,
    expiresAt: Date.now() + 45 * 3600 * 1000,
  },
];

export const INITIAL_MOCK_OUTGOING_INVITES: WatchInvite[] = [
  {
    id: 'inv_out_maya_lin',
    fromUid: 'usr_me',
    fromName: 'You',
    fromPhone: '+1 (555) 000-0000',
    toPhone: '+1 (555) 432-9088',
    toUid: 'usr_maya_lin',
    toName: 'Maya Lin',
    deliveryMethod: 'in_app',
    status: 'pending',
    createdAt: Date.now() - 1 * 3600 * 1000,
    expiresAt: Date.now() + 47 * 3600 * 1000,
  },
  {
    id: 'inv_out_james_sms',
    fromUid: 'usr_me',
    fromName: 'You',
    fromPhone: '+1 (555) 000-0000',
    toPhone: '+1 (555) 910-3342',
    deliveryMethod: 'sms',
    status: 'pending',
    createdAt: Date.now() - 4 * 3600 * 1000,
    expiresAt: Date.now() + 44 * 3600 * 1000,
  },
];

// Chats start empty so conversations can be recorded live in the demo
export const INITIAL_MOCK_CONVERSATIONS: Record<string, Conversation> = {};

export const INITIAL_MOCK_MESSAGES: Record<string, ChatMessage[]> = {};

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      friends: INITIAL_MOCK_FRIENDS,
      conversations: INITIAL_MOCK_CONVERSATIONS,
      messages: INITIAL_MOCK_MESSAGES,
      totalUnreadMessages: 0,
      activeSos: null,
      pendingInvites: INITIAL_MOCK_PENDING_INVITES,
      outgoingInvites: INITIAL_MOCK_OUTGOING_INVITES,
      isLocationSharing: false,
      locationSharingScope: 'none',
      allowedLocationMemberIds: [],

      clearAllChats: () => {
        set({
          conversations: {},
          messages: {},
          totalUnreadMessages: 0,
        });
      },

      seedDemoData: () => {
        set({
          friends: INITIAL_MOCK_FRIENDS,
          conversations: {},
          messages: {},
          pendingInvites: INITIAL_MOCK_PENDING_INVITES,
          outgoingInvites: INITIAL_MOCK_OUTGOING_INVITES,
          totalUnreadMessages: 0,
        });
      },

      syncMockFriendsLocation: (center: Coordinates) => {
        set((state) => ({
          friends: state.friends.map((f) => {
            if (f.id === 'usr_sarah_connor') {
              return {
                ...f,
                liveLocation: { latitude: center.latitude + 0.0028, longitude: center.longitude + 0.0022 },
                distanceKm: 0.35,
                locationUpdatedAt: Date.now() - 2 * 60 * 1000,
              };
            }
            if (f.id === 'usr_marcus_vance') {
              return {
                ...f,
                liveLocation: { latitude: center.latitude - 0.0036, longitude: center.longitude - 0.0031 },
                distanceKm: 0.52,
                locationUpdatedAt: Date.now() - 5 * 60 * 1000,
              };
            }
            return f;
          }),
        }));
      },

      // ── Mutual Watch actions ─────────────────────────────────────
      setFriends: (friends) => set({ friends }),

      setMemberLocation: (uid, coords, updatedAt, isSharing) => {
        set((state) => ({
          friends: state.friends.map((f) =>
            f.id === uid
              ? { ...f, liveLocation: coords, locationUpdatedAt: updatedAt, isLocationSharing: isSharing }
              : f
          ),
        }));
      },

      setPendingInvites: (invites) => set({ pendingInvites: invites }),
      setOutgoingInvites: (invites) => set({ outgoingInvites: invites }),

      toggleLocationSharing: async (myUid) => {
        const next = !get().isLocationSharing;
        const nextScope = next
          ? (get().locationSharingScope === 'none' ? 'all' : get().locationSharingScope)
          : 'none';
        set({ isLocationSharing: next, locationSharingScope: nextScope });
        try {
          await updateLocationSharingPreferences(
            myUid,
            next,
            nextScope,
            get().allowedLocationMemberIds
          );
        } catch (err) {
          // Revert on error
          set({ isLocationSharing: !next });
          console.warn('[socialStore] toggleLocationSharing failed:', err);
        }
      },

      setLocationSharingScope: async (scope, myUid) => {
        const isSharing = scope !== 'none';
        set({
          locationSharingScope: scope,
          isLocationSharing: isSharing,
        });
        if (myUid) {
          try {
            await updateLocationSharingPreferences(
              myUid,
              isSharing,
              scope,
              get().allowedLocationMemberIds
            );
          } catch (e) {
            console.warn('[socialStore] setLocationSharingScope failed:', e);
          }
        }
      },

      toggleMemberLocationPermission: async (memberId, myUid) => {
        const current = get().allowedLocationMemberIds;
        const next = current.includes(memberId)
          ? current.filter((id) => id !== memberId)
          : [...current, memberId];
        set({ allowedLocationMemberIds: next });
        if (myUid && get().locationSharingScope === 'custom') {
          try {
            await updateLocationSharingPreferences(
              myUid,
              get().isLocationSharing,
              'custom',
              next
            );
          } catch (e) {
            console.warn('[socialStore] toggleMemberLocationPermission failed:', e);
          }
        }
      },

      addFriend: ({ name, phoneNumber, sectorGeohash }) => {
        const parts = name.trim().split(' ');
        const initials =
          parts.length > 1
            ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

        const newFriend: Friend = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          avatarInitials: initials,
          status: 'safe',
          lastActiveTimestamp: Date.now(),
          sectorGeohash: sectorGeohash || 'dr5re',
          distanceKm: 0.5,
        };

        const updatedFriends = [newFriend, ...get().friends];
        set({ friends: updatedFriends });
        return newFriend;
      },

      removeFriend: (friendId) => {
        set({ friends: get().friends.filter((f) => f.id !== friendId) });
      },

      updateFriendStatus: (friendId, status) => {
        const friends = get().friends.map((f) =>
          f.id === friendId ? { ...f, status, lastActiveTimestamp: Date.now() } : f
        );
        set({ friends });
      },

      sendMessage: (
        conversationId,
        senderId,
        senderName,
        text,
        type = 'text',
        mediaUrl,
        incidentId,
        locationMeta
      ) => {
        const newMsg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          conversationId,
          senderId,
          senderName,
          text: text.trim(),
          timestamp: Date.now(),
          type,
          mediaUrl,
          incidentId,
          latitude: locationMeta?.latitude,
          longitude: locationMeta?.longitude,
          liveUntil: locationMeta?.liveUntil,
          isLiveActive: locationMeta !== undefined ? locationMeta.isLiveActive : undefined,
        };

        const existingMessages = get().messages[conversationId] || [];
        const updatedMessages = {
          ...get().messages,
          [conversationId]: [...existingMessages, newMsg],
        };

        const existingConv = get().conversations[conversationId];
        let updatedConv: Record<string, Conversation> = { ...get().conversations };

        if (existingConv) {
          updatedConv[conversationId] = {
            ...existingConv,
            lastMessageText:
              type === 'photo'
                ? text.trim() ? `📷 ${text.trim()}` : '📷 Photo'
                : type === 'safety_ping'
                ? '🛡️ Safety Ping'
                : type === 'sos_distress'
                ? '🚨 SOS DISTRESS BEACON'
                : type === 'sos_resolved'
                ? '🟢 SOS Resolved'
                : type === 'location_share'
                ? '📍 Live Location'
                : text.trim(),
            lastMessageTimestamp: Date.now(),
          };
        }

        set({
          messages: updatedMessages,
          conversations: updatedConv,
        });

        return newMsg;
      },

      stopLiveLocationShare: (conversationId: string, messageId: string) => {
        const convMsgs = get().messages[conversationId];
        if (!convMsgs) return;
        const updated = convMsgs.map((msg) =>
          msg.id === messageId ? { ...msg, isLiveActive: false } : msg
        );
        set({
          messages: {
            ...get().messages,
            [conversationId]: updated,
          },
        });
      },

      sendSafetyPing: (friend, senderId, senderName, mySector = 'dr5re') => {
        const conv = get().getOrCreateConversation(friend);
        get().sendMessage(
          conv.id,
          senderId,
          senderName,
          `⚠️ Safety Check: Are you safe? I am active in Sector #${mySector}.`,
          'safety_ping'
        );
      },

      triggerSos: (senderId, senderName, coords, sectorGeohash = 'dr5re') => {
        const beacon: SosDistressBeacon = {
          id: `sos_${Date.now()}`,
          senderId,
          senderName,
          timestamp: Date.now(),
          coordinates: coords,
          sectorGeohash,
          status: 'active',
        };

        const currentFriends = get().friends;
        const currentMessages = { ...get().messages };
        const currentConvs = { ...get().conversations };

        const locString = coords
          ? `at Coordinates (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
          : `in Sector #${sectorGeohash}`;

        const sosText = `🚨 SOS EMERGENCY: I need immediate assistance ${locString}! Please check on me or dispatch support.`;

        currentFriends.forEach((friend) => {
          let conv = Object.values(currentConvs).find((c) => c.participantId === friend.id);
          if (!conv) {
            const newId = `conv_${friend.id}`;
            conv = {
              id: newId,
              participantId: friend.id,
              participantName: friend.name,
              participantInitials: friend.avatarInitials,
              participantStatus: friend.status,
              lastMessageText: sosText,
              lastMessageTimestamp: Date.now(),
              unreadCount: 0,
            };
            currentConvs[newId] = conv;
            currentMessages[newId] = [];
          } else {
            currentConvs[conv.id] = {
              ...conv,
              lastMessageText: '🚨 SOS DISTRESS BEACON ACTIVE',
              lastMessageTimestamp: Date.now(),
            };
          }

          const newMsg: ChatMessage = {
            id: `msg_sos_${Date.now()}_${friend.id}`,
            conversationId: conv.id,
            senderId,
            senderName,
            text: sosText,
            timestamp: Date.now(),
            type: 'sos_distress',
          };
          currentMessages[conv.id] = [...(currentMessages[conv.id] || []), newMsg];
        });

        set({
          activeSos: beacon,
          conversations: currentConvs,
          messages: currentMessages,
        });

        return beacon;
      },

      cancelSos: (senderId, senderName) => {
        const currentFriends = get().friends;
        const currentMessages = { ...get().messages };
        const currentConvs = { ...get().conversations };

        const cancelText = `🟢 SOS RESOLVED: I am safe and secure now. Thank you for standing watch.`;

        currentFriends.forEach((friend) => {
          const conv = Object.values(currentConvs).find((c) => c.participantId === friend.id);
          if (conv) {
            currentConvs[conv.id] = {
              ...conv,
              lastMessageText: '🟢 SOS Resolved - Safe',
              lastMessageTimestamp: Date.now(),
            };

            const newMsg: ChatMessage = {
              id: `msg_cancel_${Date.now()}_${friend.id}`,
              conversationId: conv.id,
              senderId,
              senderName,
              text: cancelText,
              timestamp: Date.now(),
              type: 'sos_resolved',
            };
            currentMessages[conv.id] = [...(currentMessages[conv.id] || []), newMsg];
          }
        });

        set({
          activeSos: null,
          conversations: currentConvs,
          messages: currentMessages,
        });
      },

      getOrCreateConversation: (friend) => {
        const currentConvs = get().conversations;
        const found = Object.values(currentConvs).find(
          (c) => c.participantId === friend.id
        );

        if (found) return found;

        const newId = `conv_${friend.id}`;
        const newConv: Conversation = {
          id: newId,
          participantId: friend.id,
          participantName: friend.name,
          participantInitials: friend.avatarInitials,
          participantStatus: friend.status,
          lastMessageText: 'Conversation started',
          lastMessageTimestamp: Date.now(),
          unreadCount: 0,
        };

        set({
          conversations: { ...currentConvs, [newId]: newConv },
          messages: { ...get().messages, [newId]: [] },
        });

        return newConv;
      },

      markConversationRead: (conversationId) => {
        const currentConv = get().conversations[conversationId];
        if (!currentConv || currentConv.unreadCount === 0) return;

        const updated = {
          ...get().conversations,
          [conversationId]: {
            ...currentConv,
            unreadCount: 0,
          },
        };

        const totalUnread = Object.values(updated).reduce(
          (sum, c) => sum + c.unreadCount,
          0
        );

        set({
          conversations: updated,
          totalUnreadMessages: totalUnread,
        });
      },
    }),
    {
      name: 'nightwatch_social_storage',
      version: 5,
      migrate: (persistedState: any) => ({
        ...persistedState,
        conversations: {},
        messages: {},
        totalUnreadMessages: 0,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
