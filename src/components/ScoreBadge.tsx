import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, typography } from '../theme/theme';
import { UserTier } from '../types';

interface ScoreBadgeProps {
  tier: UserTier;
  score?: number;
}

const TIER_CONFIG: Record<
  UserTier,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  'New Watch': {
    icon: 'shield-outline',
    color: colors.textSecondary,
    bg: 'rgba(148, 163, 184, 0.1)',
  },
  Patrol: {
    icon: 'shield-half-outline',
    color: colors.community,
    bg: 'rgba(64, 196, 255, 0.12)',
  },
  Guardian: {
    icon: 'shield',
    color: colors.civic,
    bg: 'rgba(105, 240, 174, 0.15)',
  },
  Sentinel: {
    icon: 'shield-checkmark',
    color: colors.critical,
    bg: 'rgba(255, 171, 64, 0.2)',
  },
};

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ tier, score }) => {
  const config = TIER_CONFIG[tier] || TIER_CONFIG['New Watch'];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color }]}>
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.label, { color: config.color }]}>{tier}</Text>
      {score !== undefined && <Text style={styles.scoreText}>• {score} pts</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.5,
  },
  scoreText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
});
