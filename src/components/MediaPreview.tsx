import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius } from '../theme/theme';
import { MediaType } from '../types';

interface MediaPreviewProps {
  uri: string;
  mediaType: MediaType;
  contentFit?: 'cover' | 'contain' | 'fill';
  shouldPlay?: boolean;
  isLooping?: boolean;
  showControls?: boolean;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  uri,
  mediaType,
  contentFit = 'cover',
  shouldPlay = true,
  isLooping = true,
  showControls = true,
}) => {
  const [photoLoading, setPhotoLoading] = useState(true);

  if (mediaType === 'photo') {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri }}
          style={styles.media}
          resizeMode="cover"
          onLoadEnd={() => setPhotoLoading(false)}
        />
        {photoLoading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.critical} />
          </View>
        )}
      </View>
    );
  }

  return (
    <VideoPreviewComponent
      uri={uri}
      contentFit={contentFit}
      shouldPlay={shouldPlay}
      isLooping={isLooping}
      showControls={showControls}
    />
  );
};

interface VideoPreviewComponentProps {
  uri: string;
  contentFit: 'cover' | 'contain' | 'fill';
  shouldPlay: boolean;
  isLooping: boolean;
  showControls: boolean;
}

const VideoPreviewComponent: React.FC<VideoPreviewComponentProps> = ({
  uri,
  contentFit,
  shouldPlay,
  isLooping,
  showControls,
}) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = isLooping;
    if (shouldPlay) {
      p.play();
    }
  });

  // Play only while this item is the active one; pause (and rewind) when scrolled away
  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [shouldPlay, player]);

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const { muted = false } = useEvent(player, 'mutedChange', {
    muted: player.muted,
  });

  const isLoading = status === 'loading';

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const toggleMute = () => {
    player.muted = !player.muted;
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.media}
        contentFit={contentFit}
        nativeControls={false}
      />

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.critical} />
        </View>
      )}

      {showControls && !isLoading && (
        <View style={styles.controlsOverlay}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleMute}
            activeOpacity={0.8}
          >
            <Ionicons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={togglePlay}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.round,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
