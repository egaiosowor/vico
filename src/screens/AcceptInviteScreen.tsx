import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { getInvite, acceptInvite } from '../services/watchService';
import { WatchInvite } from '../types';
import { colors, spacing, borderRadius, typography } from '../theme/theme';

const DEFERRED_INVITE_KEY = 'nightwatch_deferred_invite_id';

interface AcceptInviteScreenProps {
  navigation: any;
  route: {
    params?: {
      inviteId?: string;
    };
  };
}

export const AcceptInviteScreen: React.FC<AcceptInviteScreenProps> = ({
  navigation,
  route,
}) => {
  const user = useAuthStore((state) => state.user);
  const inviteId = route.params?.inviteId;

  const [invite, setInvite] = useState<WatchInvite | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'revoked' | 'invalid' | 'accepting' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!inviteId) {
      setStatus('invalid');
      return;
    }

    // If user is not yet authenticated, defer and redirect to onboarding
    if (!user) {
      AsyncStorage.setItem(DEFERRED_INVITE_KEY, inviteId).then(() => {
        navigation.replace('Onboarding');
      });
      return;
    }

    getInvite(inviteId)
      .then((inv) => {
        if (!inv) { setStatus('invalid'); return; }
        if (inv.status === 'accepted') { setStatus('done'); return; }
        if (inv.status === 'cancelled') { setStatus('revoked'); return; }
        if (Date.now() > inv.expiresAt) { setStatus('expired'); return; }
        setInvite(inv);
        setStatus('ready');
      })
      .catch(() => setStatus('invalid'));
  }, [inviteId, user?.uid]);

  const handleAccept = async () => {
    if (!invite || !user) return;
    setStatus('accepting');
    try {
      await acceptInvite(
        invite.id,
        user.uid,
        user.fullName ?? user.firstName ?? 'Vico User',
        user.phoneNumber
      );
      await AsyncStorage.removeItem(DEFERRED_INVITE_KEY);
      setStatus('done');
      setTimeout(() => navigation.replace('Circles'), 1200);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const handleDecline = () => {
    AsyncStorage.removeItem(DEFERRED_INVITE_KEY);
    navigation.goBack();
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return <ActivityIndicator color={colors.critical} size="large" />;

      case 'revoked':
        return (
          <>
            <Ionicons name="close-circle-outline" size={52} color="#FF3B30" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Invite Revoked</Text>
            <Text style={styles.subtitle}>This invitation was cancelled by the sender.</Text>
          </>
        );

      case 'invalid':
        return (
          <>
            <Ionicons name="link-outline" size={52} color="#636366" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Invalid Invite</Text>
            <Text style={styles.subtitle}>This invite link doesn't exist or has already been used.</Text>
          </>
        );

      case 'expired':
        return (
          <>
            <Ionicons name="time-outline" size={52} color="#FF9F0A" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Invite Expired</Text>
            <Text style={styles.subtitle}>This invite link has expired. Ask your contact to send a new one.</Text>
          </>
        );

      case 'done':
        return (
          <>
            <Ionicons name="checkmark-circle" size={60} color="#30D158" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>You're connected!</Text>
            <Text style={styles.subtitle}>
              {invite ? `You and ${invite.fromName} are now in each other's Circle.` : 'Invite accepted.'}
            </Text>
          </>
        );

      case 'error':
        return (
          <>
            <Ionicons name="alert-circle-outline" size={52} color={colors.critical} style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>{errorMsg}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStatus('ready')}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </>
        );

      case 'accepting':
        return (
          <>
            <ActivityIndicator color="#30D158" size="large" style={{ marginBottom: 16 }} />
            <Text style={styles.title}>Connecting…</Text>
          </>
        );

      case 'ready':
      default:
        return (
          <>
            {/* Sender avatar */}
            <View style={styles.senderAvatar}>
              <Text style={styles.senderInitials}>
                {invite?.fromName.substring(0, 2).toUpperCase() ?? '??'}
              </Text>
            </View>
            <Text style={styles.inviteFrom}>{invite?.fromName}</Text>
            <Text style={styles.title}>wants to join your Circle</Text>
            <Text style={styles.subtitle}>
              You'll appear in each other's Circle list and can share live location when you choose to.
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleAccept}>
              <Ionicons name="checkmark-circle" size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleDecline}>
              <Text style={styles.secondaryBtnText}>Decline</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={22} color="#8E8E93" />
      </TouchableOpacity>
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {renderContent()}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  senderAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2C2C2E',
    borderWidth: 2.5,
    borderColor: '#30D158',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  senderInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inviteFrom: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EBEBF5CC',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#30D158',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
});
