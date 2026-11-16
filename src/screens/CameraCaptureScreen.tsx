import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Platform,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { MAX_VIDEO_DURATION_SEC } from '../config/constants';
import { MediaType } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEMO_SIMULATED_VIDEO_URI =
  'https://pub-be3209bdbe454fbc9a415f7c57b72fe6.r2.dev/GoPro%20_%20A%20Firefighter\'s%20POV%20%F0%9F%8E%AC%20Erik%20Fernandez%20%23Shorts%20%23Firefighting.mp4';

interface CapturedItem {
  uri: string;
  mediaType: MediaType;
}

interface CameraCaptureScreenProps {
  navigation: any;
}

export const CameraCaptureScreen: React.FC<CameraCaptureScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topControlsPaddingTop = (insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : 16)) + 10;
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mediaMode, setMediaMode] = useState<MediaType>('photo');
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const baseZoomRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(MAX_VIDEO_DURATION_SEC);
  const [capturedMedia, setCapturedMedia] = useState<CapturedItem[]>([]);

  // Simulated live viewfinder video for demo
  const [showSimulatedFeed, setShowSimulatedFeed] = useState(false);
  const simulatedPlayer = useVideoPlayer(DEMO_SIMULATED_VIDEO_URI, (player) => {
    player.loop = true;
    player.muted = false;
  });

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // Pinch-to-zoom gesture handler
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      baseZoomRef.current = zoomLevel;
    })
    .onUpdate((event) => {
      const delta = (event.scale - 1) * 0.35;
      const nextZoom = Math.max(0, Math.min(1, baseZoomRef.current + delta));
      setZoomLevel(nextZoom);
    })
    .onEnd(() => {
      baseZoomRef.current = zoomLevel;
    });

  useEffect(() => {
    let timer: any = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsRecording(false);
            try {
              simulatedPlayer.pause();
            } catch (e) {}
            setCapturedMedia((current) => [
              ...current,
              {
                uri: DEMO_SIMULATED_VIDEO_URI,
                mediaType: 'video',
              },
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setRecordSecondsLeft(MAX_VIDEO_DURATION_SEC);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const toggleFacing = () => {
    setIsCameraReady(false);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const switchMediaMode = (mode: MediaType) => {
    if (mode === mediaMode || isRecording) return;
    setIsCameraReady(false);
    setMediaMode(mode);
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // Capture Photo and append to capturedMedia array (allowing multiple media)
  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !isCameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setCapturedMedia((prev) => [...prev, { uri: photo.uri, mediaType: 'photo' }]);
      }
    } catch (e: any) {
      console.warn('Capture photo error:', e);
      if (!e?.message?.includes('CameraOutputNotReadyException')) {
        Alert.alert('Capture Error', e?.message || 'Failed to capture photo');
      }
    }
  };

  // Record Video and append to capturedMedia array
  const handleStartRecording = async () => {
    if (!cameraRef.current || !isCameraReady) return;
    setIsRecording(true);
    setRecordSecondsLeft(MAX_VIDEO_DURATION_SEC);
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_DURATION_SEC,
      });

      if (video?.uri) {
        setCapturedMedia((prev) => [...prev, { uri: video.uri, mediaType: 'video' }]);
      }
    } catch (e: any) {
      console.warn('Record video error:', e);
      if (!e?.message?.includes('CameraOutputNotReadyException')) {
        Alert.alert('Recording Error', e?.message || 'Failed to record video');
      }
    } finally {
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handleShutterPress = () => {
    // Simulator Demo Mode: Tapping capture populates the screen with the live incident video!
    if (!showSimulatedFeed) {
      setShowSimulatedFeed(true);
      try {
        simulatedPlayer.currentTime = 0;
        simulatedPlayer.play();
      } catch (e) {
        console.warn('Simulated play error:', e);
      }
      setIsRecording(true);
      setRecordSecondsLeft(MAX_VIDEO_DURATION_SEC);
      return;
    }

    if (isRecording) {
      // User tapped shutter to stop recording
      setIsRecording(false);
      try {
        simulatedPlayer.pause();
      } catch (e) {}
      setCapturedMedia((prev) => [
        ...prev,
        {
          uri: DEMO_SIMULATED_VIDEO_URI,
          mediaType: 'video',
        },
      ]);
    } else {
      // Tapped again to start another recording
      try {
        simulatedPlayer.currentTime = 0;
        simulatedPlayer.play();
      } catch (e) {}
      setIsRecording(true);
      setRecordSecondsLeft(MAX_VIDEO_DURATION_SEC);
    }
  };

  // Proceed to review and confirm all captured media items
  const handleProceedToConfirmation = () => {
    if (capturedMedia.length === 0) {
      Alert.alert('No Media Captured', 'Capture at least one photo or video before proceeding.');
      return;
    }
    navigation.navigate('Confirmation', {
      mediaItems: capturedMedia,
      uri: capturedMedia[0].uri,
      mediaType: capturedMedia[0].mediaType,
    });
  };

  const handleRequestOrOpenSettings = async () => {
    if (permission && !permission.canAskAgain) {
      await Linking.openSettings();
    } else {
      const camRes = await requestPermission();
      if (camRes.granted && requestMicPermission) {
        await requestMicPermission();
      }
    }
  };

  if (permission && !permission.granted) {
    return (
      <View style={[styles.container, styles.instaPermissionContainer]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* Top Header with Close 'X' Button */}
        <View style={[styles.instaHeader, { paddingTop: topControlsPaddingTop, paddingBottom: 12 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.instaCloseBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Center Content: Typography and Action Link */}
        <View style={styles.instaCenterContent}>
          {/* Heading */}
          <Text style={styles.instaTitle}>
            Allow Vico to access your camera and microphone
          </Text>

          {/* Subtitle */}
          <Text style={styles.instaSubtitle}>
            This lets you share photos, record emergency videos and capture incident evidence.
          </Text>

          {/* Action Link */}
          <TouchableOpacity
            onPress={handleRequestOrOpenSettings}
            activeOpacity={0.7}
            style={styles.instaActionBtn}
          >
            <Text style={styles.instaActionText}>
              {permission && !permission.canAskAgain ? 'Open Settings' : 'Enable Camera'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Viewfinder Chrome (Matching Inactive Camera View) */}
        <View style={[styles.instaBottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Centered Inactive Shutter Circle */}
          <View style={styles.instaShutterRing}>
            <View style={styles.instaShutterCore} />
          </View>

          {/* Bottom Bar: Left Gallery Thumbnail & Mode Selector */}
          <View style={styles.instaBottomRow}>
            {/* Gallery placeholder preview in bottom left */}
            <View style={styles.instaGalleryPreview}>
              <Ionicons name="images-outline" size={16} color="#6B7280" />
            </View>

            {/* Mode selection row */}
            <View style={styles.instaModesContainer}>
              <Text style={styles.instaModeActive}>PHOTO</Text>
              <Text style={styles.instaModeInactive}>VIDEO</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Camera Viewport with Pinch-to-Zoom Gesture */}
      <GestureDetector gesture={pinchGesture}>
        <View style={StyleSheet.absoluteFill}>
          {showSimulatedFeed ? (
            <VideoView
              player={simulatedPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              zoom={zoomLevel}
              mode={mediaMode === 'photo' ? 'picture' : 'video'}
              onCameraReady={() => setIsCameraReady(true)}
              onMountError={(error) => {
                console.warn('Camera mount error:', error);
                setIsCameraReady(true);
              }}
            />
          )}

          {/* 2. Rule-of-Thirds Grid Lines (matches user screenshot) */}
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridRowH} />
            <View style={[styles.gridRowH, { top: '66.6%' }]} />
            <View style={styles.gridColV} />
            <View style={[styles.gridColV, { left: '66.6%' }]} />
          </View>
        </View>
      </GestureDetector>

      {/* 3. Bottom Background Scrim */}
      <View style={styles.bottomScrim} pointerEvents="none" />

      {/* 4. Top Controls (Even spacing above and below buttons, respecting device safe area) */}
      <View style={[styles.topControls, { paddingTop: topControlsPaddingTop }]}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Center: Recording Timer if active */}
        {isRecording ? (
          <View style={styles.recordingTimerBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimerText}>REC {recordSecondsLeft}s</Text>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}

        {/* Right: Review Button if captured, otherwise Flash Toggle */}
        {capturedMedia.length > 0 ? (
          <TouchableOpacity
            style={styles.reviewBadgeButton}
            onPress={handleProceedToConfirmation}
            activeOpacity={0.8}
          >
            <Text style={styles.reviewBadgeText}>Review</Text>
            <Ionicons name="arrow-forward" size={14} color="#000000" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.circleButton}
            onPress={toggleFlash}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={20}
              color={flash === 'on' ? '#FFD600' : '#FFFFFF'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* 5. Bottom Control Section */}
      <SafeAreaView
        style={styles.bottomOverlaySafe}
        pointerEvents="box-none"
        edges={['bottom']}
      >
        <View style={styles.bottomSection}>

          {/* Big iOS Center Shutter Button */}
          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={[
                styles.shutterOuter,
                styles.shutterOuterVideo,
                isRecording && styles.shutterOuterRecording,
              ]}
              onPress={handleShutterPress}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.shutterInner,
                  styles.shutterInnerVideo,
                  isRecording && styles.shutterInnerRecording,
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Bar: [Thumbnail Gallery] | [VIDEO PHOTO Pill] | [Flip Camera] */}
          <View style={styles.modeBarRow}>
            {/* Left: Thumbnail Preview of Captured Media (or Review Button) */}
            <TouchableOpacity
              style={styles.thumbnailButton}
              onPress={handleProceedToConfirmation}
              activeOpacity={0.7}
              disabled={capturedMedia.length === 0}
            >
              {capturedMedia.length > 0 ? (
                <View style={styles.thumbnailContainer}>
                  <View style={styles.thumbnailWrapper}>
                    <Image
                      source={{ uri: capturedMedia[capturedMedia.length - 1].uri }}
                      style={styles.thumbnailImage}
                    />
                  </View>
                  {capturedMedia.length > 1 && (
                    <View style={styles.thumbnailCounterBadge}>
                      <Text style={styles.thumbnailCounterText}>{capturedMedia.length}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyThumbnailPlaceholder}>
                  <Ionicons name="images-outline" size={20} color="rgba(255, 255, 255, 0.4)" />
                </View>
              )}
            </TouchableOpacity>

            {/* Center: VIDEO / PHOTO Toggle Pill (Exact styling from user screenshot) */}
            <View style={styles.photoVideoPill}>
              <TouchableOpacity
                style={[styles.modeTab, mediaMode === 'video' && styles.modeTabActive]}
                onPress={() => switchMediaMode('video')}
                activeOpacity={0.8}
                disabled={isRecording}
              >
                <Text style={[styles.modeTabText, mediaMode === 'video' && styles.modeTabTextActive]}>
                  VIDEO
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, mediaMode === 'photo' && styles.modeTabActive]}
                onPress={() => switchMediaMode('photo')}
                activeOpacity={0.8}
                disabled={isRecording}
              >
                <Text style={[styles.modeTabText, mediaMode === 'photo' && styles.modeTabTextActive]}>
                  PHOTO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Right: Flip Camera Button */}
            <TouchableOpacity
              style={styles.circleButton}
              onPress={toggleFacing}
              activeOpacity={0.7}
              disabled={isRecording}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="sync-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
  },
  gridRowH: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridColV: {
    position: 'absolute',
    left: '33.3%',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
    paddingBottom: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 25,
  },
  bottomOverlaySafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.md,
    zIndex: 20,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 25, 28, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 20, 25, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.25)',
  },
  evidenceBadgeText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.heavy,
    color: '#FFD600',
    letterSpacing: 0.8,
  },
  recordingTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 23, 68, 0.35)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#FF1744',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF1744',
  },
  recordingTimerText: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.heavy,
    fontSize: typography.fontSizes.sm,
    letterSpacing: 0.5,
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 10,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  shutterOuterVideo: {
    borderColor: '#FF1744',
  },
  shutterOuterRecording: {
    borderColor: '#FF1744',
    transform: [{ scale: 1.08 }],
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  shutterInnerVideo: {
    backgroundColor: '#FF1744',
  },
  shutterInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FF1744',
  },
  modeBarRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  thumbnailButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailContainer: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD600',
    backgroundColor: '#000000',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailCounterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#FFD600',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#000000',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  thumbnailCounterText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.heavy,
    color: '#000000',
  },
  emptyThumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 25, 28, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoVideoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 28, 0.95)',
    borderRadius: 26,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeTabActive: {
    backgroundColor: 'rgba(45, 45, 52, 0.95)',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.heavy,
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  modeTabTextActive: {
    color: '#FFD600', // Matches gold/amber active color in user screenshot
  },
  instaPermissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  instaHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  instaCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  instaCenterContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -20,
  },
  graphicWrapper: {
    width: 140,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  phoneBody: {
    width: 72,
    height: 112,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  phoneSpeaker: {
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#8E8E93',
  },
  phoneIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  phoneToggle: {
    width: 34,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 2.5,
  },
  phoneToggleKnob: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  phoneHomeBar: {
    width: 20,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#8E8E93',
  },
  phoneBaseline: {
    width: 32,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#48484A',
    marginTop: 10,
  },
  sparkRay: {
    position: 'absolute',
    width: 8,
    height: 2.5,
    borderRadius: 1.5,
  },
  sparkTopLeft: {
    left: 18,
    top: 40,
    backgroundColor: '#FFD60A',
    transform: [{ rotate: '-35deg' }],
  },
  sparkMidLeft: {
    left: 16,
    top: 62,
    backgroundColor: '#FF9F0A',
    transform: [{ rotate: '15deg' }],
  },
  sparkTopRight: {
    right: 18,
    top: 40,
    backgroundColor: '#AF52DE',
    transform: [{ rotate: '35deg' }],
  },
  sparkMidRight: {
    right: 16,
    top: 62,
    backgroundColor: '#5AC8FA',
    transform: [{ rotate: '-15deg' }],
  },
  instaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 24,
    maxWidth: 320,
  },
  instaSubtitle: {
    fontSize: 14.5,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 12,
    maxWidth: 300,
  },
  instaActionBtn: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  instaActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  instaBottomBar: {
    alignItems: 'center',
    width: '100%',
  },
  instaShutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  instaShutterCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C1C1E',
  },
  instaBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  instaGalleryPreview: {
    position: 'absolute',
    left: 24,
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instaModesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  instaModeActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  instaModeInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    letterSpacing: 1.2,
  },
  reviewBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  reviewBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
});
