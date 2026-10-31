import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../theme/theme';
import { IncidentCategory } from '../types';

interface CategoryPillProps {
  category: IncidentCategory;
  isSelected: boolean;
  onSelect: (category: IncidentCategory) => void;
}

const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; desc: string }
> = {
  critical: {
    label: 'Critical',
    icon: 'alert-circle',
    color: colors.critical,
    desc: 'Fire, crime, urgent danger',
  },
  advisory: {
    label: 'Advisory',
    icon: 'warning',
    color: '#FFD600',
    desc: 'Traffic, hazards, notices',
  },
  community: {
    label: 'Community',
    icon: 'people',
    color: colors.community,
    desc: 'Gatherings, alerts, noise',
  },
  civic: {
    label: 'Civic',
    icon: 'construct',
    color: colors.civic,
    desc: 'Infrastructure, hazards, roads',
  },
};

export const CategoryPill: React.FC<CategoryPillProps> = ({
  category,
  isSelected,
  onSelect,
}) => {
  const meta = CATEGORY_META[category];

  return (
    <TouchableOpacity
      style={[
        styles.pill,
        isSelected && {
          borderColor: meta.color,
          backgroundColor: `${meta.color}22`,
        },
      ]}
      onPress={() => onSelect(category)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${meta.color}33` }]}>
        <Ionicons name={meta.icon} size={16} color={meta.color} />
      </View>
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.label,
            isSelected && { color: meta.color, fontWeight: typography.fontWeights.bold },
          ]}
        >
          {meta.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    gap: spacing.xs,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
});
