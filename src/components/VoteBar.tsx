import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, typography } from '../theme/theme';
import { VoteType } from '../types';

interface VoteBarProps {
  upvotes: number;
  downvotes: number;
  userVote: VoteType | null;
  onVote: (type: VoteType) => void;
}

export const VoteBar: React.FC<VoteBarProps> = ({
  upvotes,
  downvotes,
  userVote,
  onVote,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.voteButton, userVote === 'up' && styles.voteButtonUpActive]}
        onPress={() => onVote('up')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-up"
          size={18}
          color={userVote === 'up' ? colors.critical : colors.textSecondary}
        />
        <Text
          style={[
            styles.voteCount,
            userVote === 'up' && { color: colors.critical, fontWeight: typography.fontWeights.bold },
          ]}
        >
          {upvotes}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.voteButton, userVote === 'down' && styles.voteButtonDownActive]}
        onPress={() => onVote('down')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-down"
          size={18}
          color={userVote === 'down' ? colors.danger : colors.textSecondary}
        />
        <Text
          style={[
            styles.voteCount,
            userVote === 'down' && { color: colors.danger, fontWeight: typography.fontWeights.bold },
          ]}
        >
          {downvotes}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  voteButtonUpActive: {
    backgroundColor: 'rgba(255, 171, 64, 0.15)',
  },
  voteButtonDownActive: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.surfaceBorder,
  },
  voteCount: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
});
