import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { useSocialStore } from '../stores/socialStore';
import { AppleHomeIcon } from './AppleHomeIcon';
import { AppleMarkerIcon } from './AppleMarkerIcon';

interface BottomNavBarProps {
  activeTab: 'map' | 'home' | 'watch' | 'profile';
  onTabChange?: (tab: 'map' | 'home') => void;
  onFeedPress?: () => void;
  onMapPress?: () => void;
  onCameraPress: () => void;
  onCirclesPress: () => void;
  onProfilePress: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onFeedPress,
  onMapPress,
  onCameraPress,
  onCirclesPress,
  onProfilePress,
}) => {
  const totalUnreadMessages = useSocialStore((state) => state.totalUnreadMessages);
  const activeSos = useSocialStore((state) => state.activeSos);

  const handleHomePress = () => {
    if (onFeedPress) {
      onFeedPress();
    } else if (onTabChange) {
      onTabChange('home');
    }
  };

  const handleMapPress = () => {
    if (onMapPress) {
      onMapPress();
    } else if (onTabChange) {
      onTabChange('map');
    }
  };

  return (
    <View style={styles.navContainer}>
      {/* 1. Home Tab */}
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'home' && styles.tabButtonActive]}
        onPress={handleHomePress}
        activeOpacity={0.75}
      >
        <AppleHomeIcon size={25} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 2. Map Tab */}
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'map' && styles.tabButtonActive]}
        onPress={handleMapPress}
        activeOpacity={0.75}
      >
        <AppleMarkerIcon size={25} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 3. Camera Report Action Button */}
      <TouchableOpacity
        style={styles.tabButton}
        onPress={onCameraPress}
        activeOpacity={0.75}
      >
        <Ionicons name="camera" size={25} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 4. Watch Tab */}
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'watch' && styles.tabButtonActive,
          activeSos ? styles.tabButtonSos : null,
        ]}
        onPress={onCirclesPress}
        activeOpacity={0.75}
      >
        <View style={styles.iconWithBadgeWrapper}>
          <MaterialCommunityIcons
            name="account-group"
            size={26}
            color="#FFFFFF"
          />
          {activeSos ? (
            <View style={styles.sosBadge}>
              <Text style={styles.sosBadgeText}>SOS</Text>
            </View>
          ) : totalUnreadMessages > 0 ? (
            <View style={styles.circlesBadge}>
              <Text style={styles.circlesBadgeText}>
                {totalUnreadMessages > 9 ? '9+' : totalUnreadMessages}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* 5. Settings Tab */}
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
        onPress={onProfilePress}
        activeOpacity={0.75}
      >
        <Ionicons
          name={activeTab === 'profile' ? 'settings' : 'settings-outline'}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 64,
    gap: 12,
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  tabButton: {
    height: 50,
    minWidth: 48,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  tabButtonActive: {
    minWidth: 64,
    paddingHorizontal: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 25,
  },
  iconWithBadgeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlesBadge: {
    position: 'absolute',
    top: -4,
    right: -9,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
  },
  circlesBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: typography.fontWeights.heavy,
  },
  tabButtonSos: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  sosBadge: {
    position: 'absolute',
    top: -5,
    right: -12,
    backgroundColor: '#FF3B30',
    minWidth: 22,
    height: 15,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1C1C1E',
  },
  sosBadgeText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: typography.fontWeights.heavy,
    letterSpacing: 0.2,
  },
});
