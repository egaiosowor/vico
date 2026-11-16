import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { IncidentCategory, MediaType } from '../types';
import { MediaPreview } from '../components/MediaPreview';
import { compressImage, validateVideo } from '../services/mediaCompressor';
import { geohashService } from '../services/geohashService';
import { enqueue } from '../services/offlineQueue';
import { useQueueStore } from '../stores/queueStore';
import { useLocationStore } from '../stores/locationStore';
import { useAuthStore } from '../stores/authStore';
import { useInAppNotificationStore } from '../stores/inAppNotificationStore';
import { syncWorker } from '../services/syncWorker';
import { MAX_DESCRIPTION_LENGTH } from '../config/constants';

interface MediaItem {
  uri: string;
  mediaType: MediaType;
}

interface ConfirmationScreenProps {
  route: {
    params: {
      uri?: string;
      mediaType?: MediaType;
      mediaItems?: MediaItem[];
    };
  };
  navigation: any;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const initialItems: MediaItem[] =
    route.params?.mediaItems && route.params.mediaItems.length > 0
      ? route.params.mediaItems
      : route.params?.uri
      ? [{ uri: route.params.uri, mediaType: route.params.mediaType || 'photo' }]
      : [];

  const [mediaList, setMediaList] = useState<MediaItem[]>(initialItems);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [category, setCategory] = useState<IncidentCategory>('critical');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentCoords, refreshLocation } = useLocationStore();
  const user = useAuthStore((state) => state.user);
  const incrementPendingCount = useQueueStore((state) => state.incrementPendingCount);

  const currentItem = mediaList[selectedIndex] || mediaList[0];

  const handleRemoveItem = (indexToRemove: number) => {
    if (mediaList.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one media item to broadcast.');
      return;
    }

    const updated = mediaList.filter((_, i) => i !== indexToRemove);
    setMediaList(updated);
    if (selectedIndex >= updated.length) {
      setSelectedIndex(updated.length - 1);
    }
  };

  const handleSubmit = async () => {
    if (mediaList.length === 0) {
      Alert.alert('No Media', 'Please capture at least one photo or video before broadcasting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Ensure location
      let coords = currentCoords;
      if (!coords) {
        coords = await refreshLocation();
      }

      if (!coords) {
        Alert.alert('Location Required', 'Cannot tag incident without a GPS location.');
        setIsSubmitting(false);
        return;
      }

      // 2. Compute geohashes
      const geohash = geohashService.getIncidentGeohash(coords.latitude, coords.longitude);
      const geohashArea = geohashService.getAreaGeohash(coords.latitude, coords.longitude);
      const baseIncidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 3. Process & enqueue all captured media items
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        let localProcessedUri = item.uri;

        if (item.mediaType === 'photo') {
          const compressed = await compressImage(item.uri);
          localProcessedUri = compressed.compressedUri;
        } else {
          const validated = await validateVideo(item.uri);
          localProcessedUri = validated.compressedUri;
        }

        const incidentItemId = mediaList.length > 1 ? `${baseIncidentId}_${i + 1}` : baseIncidentId;

        await enqueue({
          id: incidentItemId,
          localUri: localProcessedUri,
          mediaType: item.mediaType,
          category,
          description: description.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          geohash,
          geohashArea,
          timestamp: Date.now() + i,
        });

        incrementPendingCount();
      }

      // 4. Kick off background sync
      syncWorker.processQueue(user?.uid);

      // 5. In-App Notification alert
      useInAppNotificationStore.getState().showAlert({
        category: 'broadcast_success',
        title: 'Broadcast Live',
        message: `${mediaList.length} item${mediaList.length > 1 ? 's' : ''} broadcasted to nearby sentinels.`,
      });

      // 6. Return cleanly to root map
      navigation.popToTop();
    } catch (error: any) {
      Alert.alert('Submission Error', error?.message || 'Failed to stage incident report.');
      setIsSubmitting(false);
    }
  };

  const isCritical = category === 'critical';

  return (
    <View style={styles.container}>
      {/* Background Active Media Preview */}
      {currentItem && (
        <MediaPreview
          key={currentItem.uri}
          uri={currentItem.uri}
          mediaType={currentItem.mediaType}
          shouldPlay={true}
          isLooping={true}
          showControls={false}
        />
      )}

      {/* Floating Top-Left Back Button */}
      <View
        style={[
          styles.floatingHeader,
          {
            top: Platform.OS === 'ios'
              ? Math.max(insets.top - 8, 12)
              : Math.max(insets.top, 14),
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.backCircleButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel Form (Apple Dark Sheet) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomSheetWrapper}
      >
        <View
          style={[
            styles.bottomSheet,
            { paddingBottom: Math.max(insets.bottom, 20) + 6 },
          ]}
        >
          {/* iOS Sheet Drag Handle */}
          <View style={styles.sheetHandle} />

          {/* Media Thumbnails Strip (if multiple or to add more) */}
          <View style={styles.thumbnailStripSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailScrollContent}
            >
              {mediaList.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <TouchableOpacity
                    key={`${item.uri}_${idx}`}
                    style={[
                      styles.thumbItemContainer,
                      isSelected && styles.thumbItemContainerActive,
                    ]}
                    onPress={() => setSelectedIndex(idx)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.uri }} style={styles.thumbImage} />

                    {/* Video indicator tag */}
                    {item.mediaType === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="videocam" size={10} color="#FFFFFF" />
                      </View>
                    )}

                    {/* Delete item button */}
                    {mediaList.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteThumbBtn}
                        onPress={() => handleRemoveItem(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={11} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Add More Media Button */}
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={styles.addMoreText}>+ Add</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Severity Selector Cards (Apple Dark #2C2C2E) */}
          <View style={styles.severityRow}>
            {/* Urgent Danger Card */}
            <TouchableOpacity
              style={[
                styles.severityCard,
                isCritical && styles.severityCardCriticalActive,
              ]}
              onPress={() => setCategory('critical')}
              activeOpacity={0.8}
            >
              <View style={styles.severityHeader}>
                <View style={[styles.severityDot, { backgroundColor: '#FF453A' }]} />
                <Text
                  style={[
                    styles.severityTitle,
                    isCritical && { color: '#FF453A' },
                  ]}
                >
                  Urgent Danger
                </Text>
              </View>
              <Text style={styles.severitySubtitle}>
                Threat to life, active crime, fire
              </Text>
            </TouchableOpacity>

            {/* Caution / Advisory Card */}
            <TouchableOpacity
              style={[
                styles.severityCard,
                !isCritical && styles.severityCardAdvisoryActive,
              ]}
              onPress={() => setCategory('advisory')}
              activeOpacity={0.8}
            >
              <View style={styles.severityHeader}>
                <View style={[styles.severityDot, { backgroundColor: '#FFD600' }]} />
                <Text
                  style={[
                    styles.severityTitle,
                    !isCritical && { color: '#FFD600' },
                  ]}
                >
                  Advisory
                </Text>
              </View>
              <Text style={styles.severitySubtitle}>
                Hazard, accident, warning
              </Text>
            </TouchableOpacity>
          </View>

          {/* Modern Description Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="What is happening? (Optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChangeText={setDescription}
              selectionColor={isCritical ? '#FF453A' : '#FFD600'}
            />
            <Text style={styles.charCount}>
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>

          {/* Broadcast CTA Button */}
          <TouchableOpacity
            style={[
              styles.broadcastButton,
              isCritical ? styles.broadcastButtonCritical : styles.broadcastButtonAdvisory,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={isCritical ? '#FFFFFF' : '#000000'} />
            ) : (
              <>
                <Ionicons
                  name="radio"
                  size={20}
                  color={isCritical ? '#FFFFFF' : '#000000'}
                />
                <Text
                  style={[
                    styles.broadcastButtonText,
                    { color: isCritical ? '#FFFFFF' : '#000000' },
                  ]}
                >
                  Broadcast {isCritical ? 'Urgent Alert' : 'Advisory'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    left: 16,
    zIndex: 50,
  },
  backCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  bottomSheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  thumbnailStripSection: {
    marginBottom: 12,
  },
  thumbnailScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  thumbItemContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: '#2C2C2E',
    position: 'relative',
  },
  thumbItemContainerActive: {
    borderColor: '#FFD600',
    borderWidth: 2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 69, 58, 0.9)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
    gap: 2,
  },
  addMoreText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  severityCard: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  severityCardCriticalActive: {
    borderColor: '#FF453A',
    backgroundColor: 'rgba(255, 69, 58, 0.14)',
  },
  severityCardAdvisoryActive: {
    borderColor: '#FFD600',
    backgroundColor: 'rgba(255, 214, 0, 0.14)',
  },
  severityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  severitySubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 14,
  },
  inputContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  charCount: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  broadcastButton: {
    borderRadius: 27,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  broadcastButtonCritical: {
    backgroundColor: '#FF453A',
  },
  broadcastButtonAdvisory: {
    backgroundColor: '#FFD600',
  },
  broadcastButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
