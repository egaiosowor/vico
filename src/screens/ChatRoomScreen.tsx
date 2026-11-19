import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';
import { darkMapStyle } from '../theme/darkMapStyle';
import { useSocialStore } from '../stores/socialStore';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { ChatMessage, ChatMessageType } from '../types';
import { formatTimeAgo } from '../utils/formatting';

const formatLiveUntil = (timestamp?: number) => {
  if (!timestamp) return 'Live location';
  const d = new Date(timestamp);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `Live until ${hours}:${minutes} ${ampm}`;
};

const formatMessageClock = (timestamp: number) => {
  const d = new Date(timestamp);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

interface ChatRoomScreenProps {
  route: {
    params: {
      conversationId: string;
      participantId: string;
      participantName: string;
      participantStatus?: string;
      participantPhone?: string;
    };
  };
  navigation: any;
}

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

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface QuickAction {
  id: string;
  label: string;
  actionKey: 'sos' | 'location';
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'sos', label: '🚨 Emergency SOS', actionKey: 'sos' },
  { id: 'location', label: '📍 Live Location', actionKey: 'location' },
];

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const {
    conversationId,
    participantId,
    participantName,
    participantStatus = 'safe',
    participantPhone,
  } = route.params;

  const user = useAuthStore((state) => state.user);
  const { messages, sendMessage, markConversationRead, stopLiveLocationShare } = useSocialStore();

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fullViewImage, setFullViewImage] = useState<string | null>(null);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);

  // Live Location Modal state
  const [isLiveLocationModalOpen, setIsLiveLocationModalOpen] = useState(false);
  const [liveDuration, setLiveDuration] = useState<'15m' | '1h' | '8h'>('1h');
  const [liveCaption, setLiveCaption] = useState('');
  const [modalCoords, setModalCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const liveMapRef = useRef<MapView | null>(null);

  // Staggered animation values — one per quick action pill
  const pillAnims = useRef(QUICK_ACTIONS.map(() => new Animated.Value(0))).current;
  const fabRotation = useRef(new Animated.Value(0)).current;

  const flatListRef = useRef<FlatList>(null);

  const conversationMessages = messages[conversationId] || [];

  const currentUserId = user?.uid || 'usr_local';
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : 'You';

  const avatarInitials = useMemo(() => getInitials(participantName), [participantName]);
  const avatarBg = useMemo(() => {
    const charCodeSum = participantName
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_PALETTES[charCodeSum % AVATAR_PALETTES.length];
  }, [participantName]);

  useEffect(() => {
    markConversationRead(conversationId);
  }, [conversationId]);

  const handleSend = useCallback((textToSend?: string, type: ChatMessageType = 'text') => {
    const text = textToSend !== undefined ? textToSend : inputText;
    const mediaUri = selectedImage;

    if (!text.trim() && !mediaUri) return;

    sendMessage(
      conversationId,
      currentUserId,
      currentUserName,
      text.trim(),
      mediaUri ? 'photo' : type,
      mediaUri || undefined
    );

    if (textToSend === undefined) {
      setInputText('');
    }
    setSelectedImage(null);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversationId, currentUserId, currentUserName, inputText, selectedImage, sendMessage]);

  const openLiveLocationModal = async () => {
    try {
      let coords = useLocationStore.getState().currentCoords;
      if (!coords) {
        coords = await useLocationStore.getState().refreshLocation();
      }
      if (!coords && user?.safeZoneCenter) {
        coords = user.safeZoneCenter;
      }
      if (!coords) {
        coords = { latitude: 6.5244, longitude: 3.3792 };
      }
      setModalCoords(coords);
    } catch (e) {
      setModalCoords({ latitude: 6.5244, longitude: 3.3792 });
    }
    setLiveDuration('1h');
    setLiveCaption('');
    setIsLiveLocationModalOpen(true);
  };

  const handleConfirmShareLiveLocation = () => {
    if (!modalCoords) return;

    const durationMs =
      liveDuration === '15m'
        ? 15 * 60 * 1000
        : liveDuration === '8h'
        ? 8 * 60 * 60 * 1000
        : 60 * 60 * 1000;

    const liveUntil = Date.now() + durationMs;
    const caption = liveCaption.trim();

    sendMessage(
      conversationId,
      currentUserId,
      currentUserName,
      caption || 'Live Location',
      'location_share',
      undefined,
      undefined,
      {
        latitude: modalCoords.latitude,
        longitude: modalCoords.longitude,
        liveUntil,
        isLiveActive: true,
      }
    );

    setIsLiveLocationModalOpen(false);
    setLiveCaption('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleStopSharing = (messageId: string) => {
    Alert.alert(
      'Stop sharing live location?',
      'This will stop sharing your live location in this chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Sharing',
          style: 'destructive',
          onPress: () => {
            stopLiveLocationShare(conversationId, messageId);
          },
        },
      ]
    );
  };

  const handleTriggerSos = () => {
    Alert.alert(
      '🚨 TRANSMIT SOS DISTRESS?',
      `This will instantly transmit an emergency SOS distress alert to ${participantName} with your live coordinates.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'BROADCAST SOS',
          style: 'destructive',
          onPress: () => {
            handleSend('🚨 SOS ALERT: I need immediate assistance! Please check on me.', 'sos_distress');
          },
        },
      ]
    );
  };

  const handleTriggerPing = () => {
    handleSend('⚠️ Safety Check: Are you safe? Please confirm your status.', 'safety_ping');
  };

  const toggleQuickReplies = useCallback(() => {
    const opening = !isQuickReplyOpen;
    setIsQuickReplyOpen(opening);

    // FAB icon rotation: 0→45deg on open, 45→0 on close
    Animated.spring(fabRotation, {
      toValue: opening ? 1 : 0,
      useNativeDriver: true,
      tension: 180,
      friction: 14,
    }).start();

    if (opening) {
      // Stagger pills in from bottom
      Animated.stagger(
        38,
        pillAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 14,
          })
        )
      ).start();
    } else {
      // Collapse all at once
      Animated.parallel(
        pillAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [isQuickReplyOpen, pillAnims, fabRotation]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll access is needed to attach photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is needed to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Camera launch error:', e);
    }
  };

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      toggleQuickReplies();
      if (action.actionKey === 'sos') {
        setTimeout(() => handleTriggerSos(), 100);
      } else if (action.actionKey === 'location') {
        setTimeout(() => openLiveLocationModal(), 100);
      }
    },
    [toggleQuickReplies]
  );

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;
    const isSafetyPing = item.type === 'safety_ping';

    if (item.type === 'sos_distress') {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
          <View style={[styles.sosCard, isMe ? styles.sosCardMe : styles.sosCardOther]}>
            <View style={styles.sosCardHeader}>
              <Ionicons name="warning" size={16} color="#FF3B30" />
              <Text style={styles.sosCardTitle}>EMERGENCY SOS DISTRESS</Text>
            </View>
            <Text style={styles.sosCardText}>{item.text}</Text>
            <Text style={styles.sosCardTime}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'sos_resolved') {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
          <View style={[styles.resolvedCard, isMe ? styles.resolvedCardMe : styles.resolvedCardOther]}>
            <View style={styles.resolvedCardHeader}>
              <Ionicons name="shield-checkmark" size={16} color="#34C759" />
              <Text style={styles.resolvedCardTitle}>SOS RESOLVED - SAFE</Text>
            </View>
            <Text style={styles.resolvedCardText}>{item.text}</Text>
            <Text style={styles.resolvedCardTime}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (isSafetyPing) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
          <View style={[styles.safetyPingCard, isMe ? styles.safetyPingCardMe : styles.safetyPingCardOther]}>
            <View style={styles.safetyPingHeader}>
              <Ionicons name="shield-checkmark" size={15} color="#FFD600" />
              <Text style={styles.safetyPingTitle}>SAFETY CHECK-IN</Text>
            </View>
            <Text style={styles.safetyPingText}>{item.text}</Text>
            <Text style={styles.safetyPingTime}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'location_share' || item.type === 'sector_share') {
      const lat = item.latitude || 6.5244;
      const lng = item.longitude || 3.3792;
      const isStillActive = item.isLiveActive !== false && (!item.liveUntil || Date.now() < item.liveUntil);
      const isMyMessage = isMe;
      const cardAvatarInitials = isMyMessage ? getInitials(currentUserName) : avatarInitials;
      const cardAvatarBg = isMyMessage ? '#007AFF' : avatarBg;
      const hasCustomCaption = Boolean(
        item.text &&
        item.text !== 'Live Location' &&
        !item.text.startsWith('📍') &&
        !item.text.toLowerCase().includes('sector')
      );

      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
          <View style={[styles.liveLocationCard, isMe ? styles.liveLocationCardMe : styles.liveLocationCardOther]}>
            {/* Top Map Preview */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                navigation.navigate('MainMap', { activeTab: 'map' });
              }}
              style={styles.liveMapPreviewContainer}
            >
              <MapView
                style={styles.liveMapPreview}
                customMapStyle={darkMapStyle}
                initialRegion={{
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                pointerEvents="none"
              >
                <Marker coordinate={{ latitude: lat, longitude: lng }}>
                  <View style={[styles.mapPinAvatar, { backgroundColor: cardAvatarBg }]}>
                    <Text style={styles.mapPinInitials}>{cardAvatarInitials}</Text>
                  </View>
                </Marker>
              </MapView>
            </TouchableOpacity>

            {/* Optional Caption */}
            {hasCustomCaption && (
              <Text style={styles.liveLocationCaption}>{item.text}</Text>
            )}

            {/* Live Status Bar */}
            <View style={styles.liveStatusBar}>
              <View style={styles.liveStatusLeft}>
                <Ionicons
                  name="navigate"
                  size={18}
                  color={isStillActive ? '#30D158' : '#8E8E93'}
                  style={styles.liveBeaconIcon}
                />
                <Text style={styles.liveStatusText}>
                  {isStillActive ? formatLiveUntil(item.liveUntil) : 'Live location ended'}
                </Text>
              </View>
              <View style={styles.liveStatusRight}>
                <Text style={styles.liveMessageTime}>{formatMessageClock(item.timestamp)}</Text>
                {isMe && (
                  <Ionicons name="checkmark-done" size={13} color="#53BDEB" style={styles.bubbleCheckmark} />
                )}
              </View>
            </View>

            {/* Stop Sharing Action Button */}
            {isMe && isStillActive ? (
              <TouchableOpacity
                style={styles.stopSharingBtn}
                activeOpacity={0.7}
                onPress={() => handleStopSharing(item.id)}
              >
                <Text style={styles.stopSharingText}>Stop sharing</Text>
              </TouchableOpacity>
            ) : !isStillActive ? (
              <View style={styles.endedSharingBar}>
                <Text style={styles.endedSharingText}>Ended</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    }

    // Photo message with optional caption
    if (item.mediaUrl) {
      return (
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, styles.photoBubble]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setFullViewImage(item.mediaUrl!)}
              style={styles.photoContainer}
            >
              <Image source={{ uri: item.mediaUrl }} style={styles.photoImage} resizeMode="cover" />
            </TouchableOpacity>
            {item.text.length > 0 && (
              <Text style={[styles.bubbleText, styles.photoCaption]}>
                {item.text}
              </Text>
            )}
            <View style={styles.bubbleFooter}>
              <Text style={styles.bubbleTime}>
                {formatTimeAgo(item.timestamp)}
              </Text>
              {isMe && (
                <Ionicons name="checkmark-done" size={13} color="#53BDEB" style={styles.bubbleCheckmark} />
              )}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={styles.bubbleText}>
            {item.text}
          </Text>
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleTime}>
              {formatTimeAgo(item.timestamp)}
            </Text>
            {isMe && (
              <Ionicons name="checkmark-done" size={13} color="#53BDEB" style={styles.bubbleCheckmark} />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* WhatsApp / iOS Style Flat Minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackGroup}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          <View style={styles.headerAvatarWrapper}>
            <View style={[styles.headerAvatarInner, { backgroundColor: avatarBg }]}>
              <Text style={styles.headerAvatarInitials}>{avatarInitials}</Text>
            </View>
            <View
              style={[
                styles.headerAvatarStatusDot,
                {
                  backgroundColor:
                    participantStatus === 'sos'
                      ? '#FF3B30'
                      : participantStatus === 'offline'
                      ? '#636366'
                      : '#30D158',
                },
              ]}
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>
              {participantName}
            </Text>
            {participantPhone && (
              <Text style={styles.headerPhone} numberOfLines={1}>
                {participantPhone}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={conversationMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="shield-checkmark" size={28} color="#30D158" />
              </View>
              <Text style={styles.emptyTitle}>Direct Safety Thread</Text>
              <Text style={styles.emptySubtitle}>
                Encrypted check-in channel with {participantName}. Share live sector status, photos, and safety alerts.
              </Text>
            </View>
          }
        />


        {/* Pending Attachment Preview Bar */}
        {selectedImage && (
          <View style={styles.attachmentPreviewBar}>
            <View style={styles.attachmentPreviewBox}>
              <Image source={{ uri: selectedImage }} style={styles.attachmentPreviewImage} />
              <TouchableOpacity
                style={styles.attachmentRemoveBtn}
                onPress={() => setSelectedImage(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.attachmentPreviewText}>Photo attached (add optional caption)</Text>
          </View>
        )}

        {/* ─── Quick-Reply Backdrop when speed-dial is open ─── */}
        {isQuickReplyOpen && (
          <Pressable
            style={styles.qrBackdrop}
            onPress={toggleQuickReplies}
          />
        )}

        {/* Staggered action tray — renders directly above the right-hand (+) button */}
        <View style={styles.qrTrayArea} pointerEvents="box-none">
          {[...QUICK_ACTIONS].reverse().map((qa, revIdx) => {
            const idx = QUICK_ACTIONS.length - 1 - revIdx;
            const anim = pillAnims[idx];
            return (
              <Animated.View
                key={qa.id}
                style={[
                  styles.qrPill,
                  {
                    opacity: anim,
                    transform: [
                      {
                        translateY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                    pointerEvents: isQuickReplyOpen ? 'auto' : 'none',
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleQuickAction(qa)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.qrPillText}>
                    {qa.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Bottom Input Row */}
        <View style={styles.inputContainer}>
          {/* Unified Input Capsule with Embedded Send Button */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.inputField}
              placeholder={selectedImage ? 'Add caption...' : 'Type safety message...'}
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              multiline
              textAlignVertical="center"
            />

            <TouchableOpacity
              style={[
                styles.sendButtonInside,
                (inputText.trim().length > 0 || !!selectedImage) && styles.sendButtonInsideActive,
              ]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() && !selectedImage}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={14}
                color={(inputText.trim().length > 0 || !!selectedImage) ? '#FFFFFF' : '#636366'}
              />
            </TouchableOpacity>
          </View>

          {/* Quick-Action Trigger (+) Button on the RIGHT */}
          <TouchableOpacity
            style={styles.qrTriggerButton}
            onPress={toggleQuickReplies}
            activeOpacity={0.8}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: fabRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg'],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name="add"
                size={22}
                color="#FFFFFF"
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>



      {/* ─── WhatsApp-Style "Share Live Location" Modal ─── */}
      <Modal
        visible={isLiveLocationModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsLiveLocationModalOpen(false)}
      >
        <View style={styles.liveModalContainer}>
          {/* Full-bleed Dark Map */}
          {modalCoords && (
            <MapView
              ref={liveMapRef}
              style={styles.liveModalMap}
              customMapStyle={darkMapStyle}
              initialRegion={{
                latitude: modalCoords.latitude,
                longitude: modalCoords.longitude,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              showsCompass={false}
              showsUserLocation={false}
            >
              {/* Accuracy halo circle */}
              <Circle
                center={modalCoords}
                radius={320}
                strokeColor="rgba(220, 230, 245, 0.65)"
                strokeWidth={2}
                fillColor="rgba(255, 255, 255, 0.05)"
              />

              {/* Center avatar marker with white outline & dot */}
              <Marker coordinate={modalCoords} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.modalAvatarPinWrapper}>
                  <View style={[styles.modalAvatarPin, { backgroundColor: '#007AFF' }]}>
                    <Text style={styles.modalAvatarInitials}>{getInitials(currentUserName)}</Text>
                  </View>
                  <View style={styles.modalAvatarDot} />
                </View>
              </Marker>
            </MapView>
          )}

          {/* Top Right Floating Controls (Info & Recenter) */}
          <SafeAreaView edges={['top']} style={styles.modalTopControlsSafeArea} pointerEvents="box-none">
            <View style={styles.modalTopControls}>
              <TouchableOpacity
                style={styles.modalMapFloatingBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(
                    'Live Location Sharing',
                    `Your live location will be shared in real time with ${participantName} for the selected duration.`
                  );
                }}
              >
                <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalMapFloatingBtn}
                activeOpacity={0.8}
                onPress={() => {
                  if (modalCoords && liveMapRef.current) {
                    liveMapRef.current.animateToRegion(
                      {
                        latitude: modalCoords.latitude,
                        longitude: modalCoords.longitude,
                        latitudeDelta: 0.012,
                        longitudeDelta: 0.012,
                      },
                      400
                    );
                  }
                }}
              >
                <Ionicons name="navigate" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Bottom Sheet Card */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalSheetWrapper}
          >
            <View style={[styles.modalSheetContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {/* Sheet Header */}
              <View style={styles.modalSheetHeader}>
                <Text style={styles.modalSheetTitle}>Share live location</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setIsLiveLocationModalOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              {/* Duration Options */}
              <View style={styles.durationPickerContainer}>
                {(['15m', '1h', '8h'] as const).map((dur) => {
                  const isSelected = liveDuration === dur;
                  const label = dur === '15m' ? '15 Minutes' : dur === '1h' ? '1 Hour' : '8 Hours';
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.durationOptionRow,
                        isSelected && styles.durationOptionRowSelected,
                      ]}
                      onPress={() => setLiveDuration(dur)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.durationOptionText,
                          isSelected && styles.durationOptionTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Caption Input & Send Button */}
              <View style={styles.modalInputRow}>
                <View style={styles.modalCaptionInputWrapper}>
                  <TextInput
                    style={styles.modalCaptionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="#8E8E93"
                    value={liveCaption}
                    onChangeText={setLiveCaption}
                    returnKeyType="send"
                    onSubmitEditing={handleConfirmShareLiveLocation}
                  />
                </View>

                <TouchableOpacity
                  style={styles.modalSendBtn}
                  activeOpacity={0.8}
                  onPress={handleConfirmShareLiveLocation}
                >
                  <Ionicons name="arrow-up" size={20} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* Target Recipient Indicator */}
              <View style={styles.modalRecipientRow}>
                <Ionicons name="chevron-forward" size={14} color="#8E8E93" />
                <Text style={styles.modalRecipientText}>{participantName}</Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Full-Screen Image Viewer Modal */}
      <Modal
        visible={!!fullViewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullViewImage(null)}
      >
        <View style={styles.fullImageBackdrop}>
          <TouchableOpacity
            style={styles.fullImageCloseBtn}
            onPress={() => setFullViewImage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {fullViewImage && (
            <Image
              source={{ uri: fullViewImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    backgroundColor: '#000000',
  },
  headerBackGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatarWrapper: {
    position: 'relative',
    width: 36,
    height: 36,
    marginLeft: 8,
    marginRight: 10,
  },
  headerAvatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerAvatarStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: '#000000',
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerPhone: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleMe: {
    backgroundColor: '#005C4B',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1F2228',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2D33',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20.5,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  bubbleTime: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  bubbleCheckmark: {
    marginLeft: 1,
  },
  photoBubble: {
    padding: 5,
    borderRadius: 16,
  },
  photoContainer: {
    width: 220,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCaption: {
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  sosCard: {
    width: '90%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  sosCardMe: {
    backgroundColor: 'rgba(255, 59, 48, 0.18)',
    borderColor: '#FF3B30',
  },
  sosCardOther: {
    backgroundColor: 'rgba(255, 59, 48, 0.22)',
    borderColor: '#FF453A',
  },
  sosCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sosCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF453A',
    letterSpacing: 0.8,
  },
  sosCardText: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 6,
  },
  sosCardTime: {
    fontSize: 10,
    color: '#FFBABA',
    textAlign: 'right',
  },
  resolvedCard: {
    width: '90%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  resolvedCardMe: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderColor: '#30D158',
  },
  resolvedCardOther: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
    borderColor: '#30D158',
  },
  resolvedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  resolvedCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#30D158',
    letterSpacing: 0.8,
  },
  resolvedCardText: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  resolvedCardTime: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'right',
  },
  safetyPingCard: {
    width: '88%',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  safetyPingCardMe: {
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
    borderColor: 'rgba(255, 214, 0, 0.4)',
  },
  safetyPingCardOther: {
    backgroundColor: 'rgba(255, 171, 64, 0.12)',
    borderColor: 'rgba(255, 171, 64, 0.4)',
  },
  safetyPingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  safetyPingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD600',
    letterSpacing: 0.8,
  },
  safetyPingText: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  safetyPingTime: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'right',
  },
  locationCard: {
    width: '84%',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
  },
  locationCardMe: {
    backgroundColor: 'rgba(0, 92, 75, 0.4)',
    borderColor: '#00C7BE',
  },
  locationCardOther: {
    backgroundColor: 'rgba(0, 199, 190, 0.12)',
    borderColor: 'rgba(0, 199, 190, 0.35)',
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  locationCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00C7BE',
    letterSpacing: 0.8,
  },
  locationCardAddress: {
    fontSize: 13.5,
    lineHeight: 18.5,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  locationCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 6,
  },
  locationCardAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00C7BE',
  },
  locationCardTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  // ── Quick-Reply FAB speed-dial ──────────────────────────────
  qrBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // transparent — only needed for dismiss-on-tap-outside
    zIndex: 9,
  },
  qrTrayArea: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'ios' ? 76 : 58,
    alignItems: 'flex-end',
    zIndex: 10,
    gap: 6,
  },
  qrTriggerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2D33',
  },
  qrPill: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#33363D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-end',
    // subtle glow so pills pop against the dark bg
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  qrPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  attachmentPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2D33',
  },
  attachmentPreviewBox: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentPreviewImage: {
    width: '100%',
    height: '100%',
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPreviewText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2D33',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    minHeight: 40,
    maxHeight: 120,
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
    paddingRight: 6,
    maxHeight: 110,
  },
  sendButtonInside: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 2,
  },
  sendButtonInsideActive: {
    backgroundColor: '#005C4B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2D33',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 19,
  },
  fullImageBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 25,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullImage: {
    width: '94%',
    height: '80%',
  },

  // ── WhatsApp-Style Live Location Modal ──
  liveModalContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  liveModalMap: {
    ...StyleSheet.absoluteFill,
  },
  modalTopControlsSafeArea: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 10,
  },
  modalTopControls: {
    gap: 12,
    alignItems: 'center',
  },
  modalMapFloatingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 28, 30, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalAvatarPinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarPin: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  modalAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalAvatarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginTop: 3,
  },
  modalSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalSheetContainer: {
    backgroundColor: '#111214',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalSheetHeader: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationPickerContainer: {
    marginVertical: 12,
    gap: 4,
  },
  durationOptionRow: {
    width: '100%',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  durationOptionRowSelected: {
    backgroundColor: '#2C2C2E',
  },
  durationOptionText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#8E8E93',
  },
  durationOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  modalCaptionInputWrapper: {
    flex: 1,
    backgroundColor: '#242426',
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
  },
  modalCaptionInput: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  modalSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  modalRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 2,
  },
  modalRecipientText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // ── WhatsApp-Style Live Location Card in Chat ──
  liveLocationCard: {
    width: 280,
    borderRadius: 16,
    overflow: 'hidden',
  },
  liveLocationCardMe: {
    backgroundColor: '#005C4B',
    borderBottomRightRadius: 4,
  },
  liveLocationCardOther: {
    backgroundColor: '#1F2228',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2C2D33',
  },
  liveMapPreviewContainer: {
    width: '100%',
    height: 140,
    overflow: 'hidden',
  },
  liveMapPreview: {
    width: '100%',
    height: '100%',
  },
  mapPinAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPinInitials: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  liveLocationCaption: {
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  liveStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  liveStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveBeaconIcon: {},
  liveStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  liveStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  liveMessageTime: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  stopSharingBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  stopSharingText: {
    color: '#FF453A',
    fontSize: 15,
    fontWeight: '600',
  },
  endedSharingBar: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  endedSharingText: {
    color: '#8E8E93',
    fontSize: 13,
  },
});
