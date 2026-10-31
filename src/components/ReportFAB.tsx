import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, borderRadius, typography } from '../theme/theme';
import { useQueueStore } from '../stores/queueStore';

interface ReportFABProps {
  onPress: () => void;
}

export const ReportFAB: React.FC<ReportFABProps> = ({ onPress }) => {
  const pendingCount = useQueueStore((state) => state.pendingCount);

  return (
    <TouchableOpacity
      style={[styles.fab, shadows.fab]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.innerGlow}>
        <Ionicons name="camera" size={30} color={colors.background} />
      </View>

      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: borderRadius.round,
    backgroundColor: colors.critical,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerGlow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    minWidth: 22,
    height: 22,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.fontWeights.heavy,
  },
});
