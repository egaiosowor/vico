import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { useAuthStore } from '../stores/authStore';
import { NotificationPreference } from '../types';
import { BottomNavBar } from '../components/BottomNavBar';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateNotificationPref, updateEmail, updateName, updatePin, logout } = useAuthStore();

  const notifPref = user?.notificationPref || 'all';
  const safeZoneRadius = user?.safeZoneRadiusKm || 2.4;

  // Edit Profile Modal States
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // PIN Modal States
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  const openEditModal = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditEmail(user?.email || '');
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (editFirstName.trim().length < 2) {
      Alert.alert('Invalid Name', 'First name must be at least 2 characters.');
      return;
    }
    if (editLastName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Last name must be at least 2 characters.');
      return;
    }
    if (editEmail.trim() && (!editEmail.includes('@') || !editEmail.includes('.'))) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateName(editFirstName.trim(), editLastName.trim());
      if (editEmail.trim()) {
        await updateEmail(editEmail.trim().toLowerCase());
      }
      setIsEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePin = async () => {
    if (pinValue.length !== 4) {
      Alert.alert('Invalid PIN', 'Security PIN must be exactly 4 digits.');
      return;
    }

    setIsSavingPin(true);
    try {
      await updatePin(pinValue);
      setIsPinModalVisible(false);
      setPinValue('');
      Alert.alert('Security PIN Updated', 'Your 4-digit security PIN has been set.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update security PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleToggleNotification = async (pref: NotificationPreference) => {
    try {
      await updateNotificationPref(pref);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update preferences');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Vico?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const displayName =
    user?.fullName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    'Watchdog Member';

  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Top Header */}
      <View style={[styles.headerTop, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              style={styles.headerCircleBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerLogoPill}>
              <View style={styles.headerLogoDot} />
              <Text style={styles.headerLogoText}>VICO SECURE</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerEditBtn}
          onPress={openEditModal}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={16} color={colors.community} />
          <Text style={styles.headerEditBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Title */}
      <View style={styles.titleSection}>
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenSubtitle}>Perimeter Defense & Identity</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 95 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Tactical Card */}
        <View style={styles.tacticalCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
              <TouchableOpacity
                style={styles.avatarEditBadge}
                onPress={openEditModal}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={11} color="#0A0E1A" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroInfo}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>

              <View style={styles.badgeRow}>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.civic} />
                  <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                </View>
                <View style={styles.zkBadge}>
                  <Ionicons name="finger-print" size={12} color={colors.community} />
                  <Text style={styles.zkBadgeText}>ZERO-KNOWLEDGE</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Details List */}
          <View style={styles.heroContactGroup}>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <Ionicons name="call" size={14} color={colors.community} />
              </View>
              <View style={styles.contactTextWrapper}>
                <Text style={styles.contactLabel}>VERIFIED DEVICE PHONE</Text>
                <Text style={styles.contactValue}>
                  {user?.phoneNumber || 'Device Linked'}
                </Text>
              </View>
              <View style={styles.phoneLockIndicator}>
                <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              </View>
            </View>

            <View style={styles.contactDivider} />

            <TouchableOpacity
              style={styles.contactItem}
              onPress={openEditModal}
              activeOpacity={0.7}
            >
              <View style={styles.contactIconWrapper}>
                <Ionicons name="mail" size={14} color={colors.accentYellow} />
              </View>
              <View style={styles.contactTextWrapper}>
                <Text style={styles.contactLabel}>RECOVERY EMAIL</Text>
                <Text
                  style={[
                    styles.contactValue,
                    !user?.email && styles.contactValuePlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {user?.email || 'Tap to add recovery email'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 1: Perimeter Defense */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>PERIMETER & RADAR</Text>
            <View style={styles.activeRadarDot} />
          </View>

          <View style={styles.tacticalCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconTitleGroup}>
                <View style={[styles.cardIconWrapper, { backgroundColor: 'rgba(64, 196, 255, 0.12)', borderColor: 'rgba(64, 196, 255, 0.25)' }]}>
                  <Ionicons name="navigate" size={18} color={colors.community} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Safe Zone Geofence</Text>
                  <Text style={styles.cardMetaText}>
                    Active Radius: <Text style={styles.boldAccent}>{safeZoneRadius.toFixed(1)} km</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.pillActionButton}
                onPress={() => navigation.navigate('GeofenceSetup')}
                activeOpacity={0.8}
              >
                <Text style={styles.pillActionButtonText}>Reconfigure</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.community} />
              </TouchableOpacity>
            </View>

            <Text style={styles.cardDescription}>
              Autonomous security perimeter monitoring nearby hazards and broadcasting instant priority alerts when incidents breach your boundary.
            </Text>
          </View>
        </View>

        {/* Section 2: Push Notifications Priority */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>THREAT BROADCASTS</Text>

          <View style={styles.tacticalCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconTitleGroup}>
                <View style={[styles.cardIconWrapper, { backgroundColor: 'rgba(255, 214, 0, 0.12)', borderColor: 'rgba(255, 214, 0, 0.25)' }]}>
                  <Ionicons name="notifications" size={18} color={colors.accentYellow} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Notification Sensitivity</Text>
                  <Text style={styles.cardMetaText}>
                    {notifPref === 'all' ? 'All Verified Incidents' : 'Critical Emergencies Only'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Choose the severity threshold required to trigger device vibrations and lock-screen broadcast alerts within your perimeter.
            </Text>

            {/* Tactical Segmented Selector */}
            <View style={styles.segmentedToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentedOption,
                  notifPref === 'all' && styles.segmentedOptionActiveCommunity,
                ]}
                onPress={() => handleToggleNotification('all')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={notifPref === 'all' ? '#0A0E1A' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentedOptionText,
                    notifPref === 'all' && styles.segmentedOptionTextActiveDark,
                  ]}
                >
                  All Alerts
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentedOption,
                  notifPref === 'critical_only' && styles.segmentedOptionActiveDanger,
                ]}
                onPress={() => handleToggleNotification('critical_only')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="flame"
                  size={16}
                  color={notifPref === 'critical_only' ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentedOptionText,
                    notifPref === 'critical_only' && styles.segmentedOptionTextActiveLight,
                  ]}
                >
                  Critical Only
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 3: Security & Encryption */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeaderTitle}>SECURITY & PRIVACY</Text>

          {/* Quick-Access PIN */}
          <TouchableOpacity
            style={styles.menuRowCard}
            onPress={() => setIsPinModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.cardIconWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
              <Ionicons name="key-outline" size={18} color={colors.textPrimary} />
            </View>
            <View style={styles.menuRowContent}>
              <Text style={styles.menuRowTitle}>Quick-Access Security PIN</Text>
              <Text style={styles.menuRowSub}>
                {user?.pinHash ? '4-Digit PIN is active & configured' : 'Set a 4-digit PIN for rapid authentication'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Zero-Knowledge Privacy Card */}
          <View style={styles.privacyShieldCard}>
            <View style={styles.shieldHeaderRow}>
              <View style={[styles.cardIconWrapper, { backgroundColor: 'rgba(105, 240, 174, 0.12)', borderColor: 'rgba(105, 240, 174, 0.25)' }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.civic} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shieldTitle}>Zero-Knowledge Anonymity</Text>
                <View style={styles.shieldStatusRow}>
                  <View style={styles.statusDotGreen} />
                  <Text style={styles.statusTextGreen}>SHIELD ACTIVE • CIPHER VERIFIED</Text>
                </View>
              </View>
            </View>
            <Text style={styles.shieldBodyText}>
              Your phone number is cryptographically hashed to prevent spam while protecting your identity. All your live incident feeds and patrol reports remain completely anonymous.
            </Text>
          </View>
        </View>

        {/* Section 4: Log Out */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutButtonText}>Log Out of Vico</Text>
          </TouchableOpacity>
        </View>

        {/* Tactical Footer */}
        <View style={styles.appFooter}>
          <Text style={styles.appFooterBrand}>VICO PATROL NETWORK • v1.0.0</Text>
          <Text style={styles.appFooterSub}>Autonomous Perimeter Safety Infrastructure</Text>
        </View>
      </ScrollView>

      {/* Persistent Floating Bottom Nav Bar */}
      <BottomNavBar
        activeTab="profile"
        onMapPress={() => navigation.navigate('MainMap', { activeTab: 'map' })}
        onFeedPress={() => navigation.navigate('MainMap', { activeTab: 'home' })}
        onCirclesPress={() => navigation.navigate('Circles')}
        onCameraPress={() => navigation.navigate('CameraCapture')}
        onProfilePress={() => {}}
      />

      {/* Edit Profile Tactical Bottom Sheet Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setIsEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[
                  styles.sheetContainer,
                  { paddingBottom: Math.max(insets.bottom, 20) + 12 },
                ]}
              >
                <View style={styles.sheetHandleBar} />

                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Edit Profile</Text>
                    <Text style={styles.sheetSubtitle}>Update your tactical identity & recovery</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsEditModalVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.sheetCloseButton}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.modalInputLabel}>FIRST NAME</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    autoCapitalize="words"
                    selectionColor={colors.community}
                  />

                  <Text style={styles.modalInputLabel}>LAST NAME</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    autoCapitalize="words"
                    selectionColor={colors.community}
                  />

                  <Text style={styles.modalInputLabel}>RECOVERY EMAIL</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    selectionColor={colors.community}
                  />
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setIsEditModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveButton}
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalSaveButtonText}>
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Security PIN Tactical Bottom Sheet Modal */}
      <Modal
        visible={isPinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPinModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setIsPinModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[
                  styles.sheetContainer,
                  { paddingBottom: Math.max(insets.bottom, 20) + 12 },
                ]}
              >
                <View style={styles.sheetHandleBar} />

                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Security PIN</Text>
                    <Text style={styles.sheetSubtitle}>
                      Rapid hardware authentication for sensitive actions
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsPinModalVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.sheetCloseButton}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.modalInputLabel}>ENTER 4-DIGIT PIN</Text>
                  <TextInput
                    style={[styles.modalInput, styles.pinInput]}
                    placeholder="••••"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    value={pinValue}
                    onChangeText={setPinValue}
                    selectionColor={colors.accentYellow}
                    autoFocus
                  />
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setIsPinModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSaveButton,
                      pinValue.length !== 4 && styles.modalButtonDisabled,
                    ]}
                    onPress={handleSavePin}
                    disabled={isSavingPin || pinValue.length !== 4}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalSaveButtonText}>
                      {isSavingPin ? 'Saving...' : 'Set PIN'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  headerLogoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(64, 196, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(64, 196, 255, 0.2)',
  },
  headerLogoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.civic,
  },
  headerLogoText: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: colors.community,
    letterSpacing: 0.8,
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  headerEditBtnText: {
    fontSize: 12,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textPrimary,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 18,
  },
  tacticalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(64, 196, 255, 0.1)',
    borderWidth: 2,
    borderColor: colors.community,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: typography.fontWeights.bold,
    color: colors.community,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.civic,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  heroInfo: {
    flex: 1,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(105, 240, 174, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(105, 240, 174, 0.3)',
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.civic,
    letterSpacing: 0.5,
  },
  zkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(64, 196, 255, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 196, 255, 0.3)',
  },
  zkBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.community,
    letterSpacing: 0.5,
  },
  heroContactGroup: {
    backgroundColor: 'rgba(10, 14, 26, 0.7)',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  contactDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  contactIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTextWrapper: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: typography.fontWeights.medium,
    color: colors.textPrimary,
  },
  contactValuePlaceholder: {
    color: colors.accentYellow,
  },
  phoneLockIndicator: {
    paddingRight: 4,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: typography.fontWeights.bold,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  activeRadarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.civic,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIconTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textPrimary,
  },
  cardMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  boldAccent: {
    color: colors.community,
    fontWeight: typography.fontWeights.bold,
  },
  pillActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(64, 196, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 196, 255, 0.25)',
  },
  pillActionButtonText: {
    color: colors.community,
    fontSize: 12,
    fontWeight: typography.fontWeights.semibold,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  segmentedToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
    backgroundColor: 'rgba(10, 14, 26, 0.8)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  segmentedOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  segmentedOptionActiveCommunity: {
    backgroundColor: colors.textPrimary,
  },
  segmentedOptionActiveDanger: {
    backgroundColor: colors.danger,
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textSecondary,
  },
  segmentedOptionTextActiveDark: {
    color: '#0A0E1A',
    fontWeight: typography.fontWeights.bold,
  },
  segmentedOptionTextActiveLight: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
  },
  menuRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  menuRowContent: {
    flex: 1,
  },
  menuRowTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textPrimary,
  },
  menuRowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  privacyShieldCard: {
    backgroundColor: 'rgba(21, 25, 41, 0.6)',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(105, 240, 174, 0.2)',
  },
  shieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  shieldTitle: {
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textPrimary,
  },
  shieldStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.civic,
  },
  statusTextGreen: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.civic,
    letterSpacing: 0.5,
  },
  shieldBodyText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.25)',
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: typography.fontWeights.bold,
  },
  appFooter: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 4,
  },
  appFooterBrand: {
    fontSize: 11,
    fontWeight: typography.fontWeights.semibold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  appFooterSub: {
    fontSize: 10,
    color: 'rgba(148, 163, 184, 0.4)',
  },
  // Bottom Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  sheetContainer: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  inputGroup: {
    gap: 6,
  },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeights.bold,
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  modalInput: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pinInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 12,
    fontWeight: typography.fontWeights.bold,
    color: colors.accentYellow,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: typography.fontWeights.semibold,
  },
  modalSaveButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.community,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
  modalSaveButtonText: {
    color: '#0A0E1A',
    fontSize: 14,
    fontWeight: typography.fontWeights.bold,
  },
});
