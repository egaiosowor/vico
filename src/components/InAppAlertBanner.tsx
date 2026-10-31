import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInAppNotificationStore, InAppAlert } from '../stores/inAppNotificationStore';
import { spacing, borderRadius, typography } from '../theme/theme';

interface InAppAlertBannerProps {
  onPressAlert?: (alert: InAppAlert) => void;
}

export const InAppAlertBanner: React.FC<InAppAlertBannerProps> = ({ onPressAlert }) => {
  const insets = useSafeAreaInsets();
  const { currentAlert, dismissAlert } = useInAppNotificationStore();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<any>(null);

  useEffect(() => {
    if (currentAlert) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      // Slide and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 4.5 seconds
      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 4500);
    } else {
      handleDismiss();
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [currentAlert]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissAlert();
    });
  };

  const handlePress = () => {
    if (currentAlert) {
      const alertToHandle = currentAlert;
      handleDismiss();
      if (onPressAlert && alertToHandle.incidentId) {
        onPressAlert(alertToHandle);
      }
    }
  };

  if (!currentAlert) return null;

  // Category styling
  const getCategoryConfig = () => {
    switch (currentAlert.category) {
      case 'critical':
        return {
          icon: 'flame' as const,
          color: '#FF453A',
          bgBadge: 'rgba(255, 69, 58, 0.16)',
        };
      case 'community':
        return {
          icon: 'people' as const,
          color: '#0A84FF',
          bgBadge: 'rgba(10, 132, 255, 0.16)',
        };
      case 'civic':
        return {
          icon: 'warning' as const,
          color: '#FF9F0A',
          bgBadge: 'rgba(255, 159, 10, 0.16)',
        };
      case 'broadcast_success':
        return {
          icon: 'checkmark-circle' as const,
          color: '#30D158',
          bgBadge: 'rgba(48, 209, 88, 0.16)',
        };
      case 'reward':
        return {
          icon: 'trophy' as const,
          color: '#FF9F0A',
          bgBadge: 'rgba(255, 159, 10, 0.16)',
        };
      case 'watch_alert':
        return {
          icon: 'location' as const,
          color: '#64D2FF',
          bgBadge: 'rgba(100, 210, 255, 0.16)',
        };
      case 'system':
      default:
        return {
          icon: 'checkmark-circle' as const,
          color: '#30D158',
          bgBadge: 'rgba(48, 209, 88, 0.16)',
        };
    }
  };

  const config = getCategoryConfig();
  const hasDetailsLink = Boolean(currentAlert.incidentId);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 24),
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.card}
        onPress={hasDetailsLink ? handlePress : undefined}
        activeOpacity={hasDetailsLink ? 0.85 : 1}
      >
        {/* Left Category Icon */}
        <View style={[styles.iconBox, { backgroundColor: config.bgBadge }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>

        {/* Center Details */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {currentAlert.title}
            </Text>
            {currentAlert.distanceText && (
              <View style={styles.distancePill}>
                <Ionicons name="location-outline" size={10} color="rgba(255, 255, 255, 0.5)" />
                <Text style={styles.distanceText}>{currentAlert.distanceText}</Text>
              </View>
            )}
          </View>

          {currentAlert.message ? (
            <Text style={styles.message} numberOfLines={2}>
              {currentAlert.message}
            </Text>
          ) : null}

          {hasDetailsLink && (
            <View style={styles.actionRow}>
              <Text style={styles.actionHint}>Tap to view details</Text>
              <Ionicons name="chevron-forward" size={12} color="#0A84FF" />
            </View>
          )}
        </View>

        {/* Right Dismiss Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.5)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 12,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  distanceText: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: typography.fontWeights.semibold,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: typography.fontWeights.bold,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 5,
  },
  actionHint: {
    color: '#FFD600',
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
