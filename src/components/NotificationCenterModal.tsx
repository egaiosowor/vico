import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInAppNotificationStore, InAppAlert } from '../stores/inAppNotificationStore';
import { colors, spacing, typography } from '../theme/theme';
import { formatTimeAgo } from '../utils/formatting';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

type TabFilter = 'all' | 'alerts' | 'updates';

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
  onSelectIncident,
}) => {
  const insets = useSafeAreaInsets();
  const { alertHistory, unreadCount, markAllAsRead } = useInAppNotificationStore();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const filteredNotifications = alertHistory.filter((item) => {
    if (activeTab === 'alerts') {
      return item.category === 'critical' || item.category === 'community' || item.category === 'civic';
    }
    if (activeTab === 'updates') {
      return (
        item.category === 'reward' ||
        item.category === 'system' ||
        item.category === 'broadcast_success' ||
        item.category === 'watch_alert'
      );
    }
    return true;
  });

  const getCategoryConfig = (category: InAppAlert['category']) => {
    switch (category) {
      case 'critical':
        return { icon: 'flame' as const, color: '#FF453A', bg: 'rgba(255, 69, 58, 0.15)' };
      case 'community':
      case 'civic':
        return { icon: 'warning' as const, color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)' };
      case 'watch_alert':
        return { icon: 'shield-checkmark' as const, color: '#0A84FF', bg: 'rgba(10, 132, 255, 0.15)' };
      case 'broadcast_success':
        return { icon: 'radio' as const, color: '#30D158', bg: 'rgba(48, 209, 88, 0.15)' };
      case 'reward':
        return { icon: 'trophy' as const, color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.15)' };
      case 'system':
      default:
        return { icon: 'notifications' as const, color: '#8E8E93', bg: 'rgba(255, 255, 255, 0.08)' };
    }
  };

  const handlePressItem = (item: InAppAlert) => {
    if (item.incidentId && onSelectIncident) {
      onClose();
      onSelectIncident(item.incidentId);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.innerContainer, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
            {/* iOS Drag Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>

              <View style={styles.headerActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={markAllAsRead}
                    style={styles.markReadBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.markReadText}>Mark read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.75)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.tabRow}>
              {(['all', 'alerts', 'updates'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const labels: Record<TabFilter, string> = {
                  all: 'All',
                  alerts: 'Alerts',
                  updates: 'Updates',
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {labels[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notifications List */}
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={44} color="#8E8E93" />
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptySubtitle}>You are all caught up for your area.</Text>
                </View>
              ) : (
                filteredNotifications.map((item) => {
                  const config = getCategoryConfig(item.category);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.notifItem, !item.read && styles.notifItemUnread]}
                      onPress={() => handlePressItem(item)}
                      activeOpacity={item.incidentId ? 0.75 : 1}
                    >
                      <View style={[styles.itemIconBox, { backgroundColor: config.bg }]}>
                        <Ionicons name={config.icon} size={20} color={config.color} />
                      </View>

                      <View style={styles.itemBody}>
                        <View style={styles.itemTopRow}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.itemTime}>{formatTimeAgo(item.timestamp)}</Text>
                        </View>

                        <Text style={styles.itemMessage} numberOfLines={2}>
                          {item.message}
                        </Text>

                        <View style={styles.itemBottomRow}>
                          {item.distanceText ? (
                            <View style={styles.distanceBadge}>
                              <Ionicons name="location-outline" size={11} color="#8E8E93" />
                              <Text style={styles.distanceText}>{item.distanceText}</Text>
                            </View>
                          ) : null}
                          {item.incidentId && (
                            <View style={styles.viewActionWrap}>
                              <Text style={styles.viewActionText}>View incident</Text>
                              <Ionicons name="chevron-forward" size={13} color="#0A84FF" />
                            </View>
                          )}
                        </View>
                      </View>

                      {!item.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    minHeight: '50%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  markReadText: {
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  tabPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 6,
    gap: 10,
    paddingBottom: 24,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
    position: 'relative',
  },
  notifItemUnread: {
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: '#323236',
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  itemTime: {
    color: '#8E8E93',
    fontSize: 11,
  },
  itemMessage: {
    color: '#AEAEB2',
    fontSize: 13,
    lineHeight: 18,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  viewActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  viewActionText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF3B30',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 13,
  },
});
