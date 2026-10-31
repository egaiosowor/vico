import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeartSlidersIconProps {
  size?: number;
  color?: string;
  maskColor?: string;
}

/**
 * Custom Adjustments-Heart filter icon:
 * Two horizontal slider tracks with heart-outline thumbs (top-left and bottom-right),
 * matching the user's provided specification without requiring external SVG packages.
 */
export const HeartSlidersIcon: React.FC<HeartSlidersIconProps> = ({
  size = 28,
  color = '#FFFFFF',
  maskColor = 'rgba(21, 25, 41, 0.95)',
}) => {
  const scale = size / 28;
  const width = 30 * scale;
  const trackHeight = 2.5 * scale;
  const heartSize = 14 * scale;
  const maskWidth = 16 * scale;
  const maskHeight = 16 * scale;

  return (
    <View style={[styles.container, { width, height: 24 * scale }]}>
      {/* Top Track & Heart */}
      <View style={[styles.trackRow, { height: 11 * scale }]}>
        <View
          style={[
            styles.trackLine,
            { height: trackHeight, backgroundColor: color, borderRadius: trackHeight / 2 },
          ]}
        />
        <View
          style={[
            styles.heartMask,
            {
              left: 2 * scale,
              width: maskWidth,
              height: maskHeight,
              borderRadius: maskHeight / 2,
              backgroundColor: maskColor,
            },
          ]}
        >
          <Ionicons name="heart-outline" size={heartSize} color={color} />
        </View>
      </View>

      {/* Bottom Track & Heart */}
      <View style={[styles.trackRow, { height: 11 * scale }]}>
        <View
          style={[
            styles.trackLine,
            { height: trackHeight, backgroundColor: color, borderRadius: trackHeight / 2 },
          ]}
        />
        <View
          style={[
            styles.heartMask,
            {
              right: 2 * scale,
              width: maskWidth,
              height: maskHeight,
              borderRadius: maskHeight / 2,
              backgroundColor: maskColor,
            },
          ]}
        >
          <Ionicons name="heart-outline" size={heartSize} color={color} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackRow: {
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  trackLine: {
    width: '100%',
  },
  heartMask: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
