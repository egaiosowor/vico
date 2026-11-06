import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme/theme';
import { useAuthStore, getDeterministicUid } from '../stores/authStore';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const COUNTRY_CODES = [
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
];

type AuthStep = 'phone' | 'otp';

interface AuthScreenProps {
  route?: any;
  navigation?: any;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const [authStep, setAuthStep] = useState<AuthStep>('phone');

  // Form Fields
  const [countryCode, setCountryCode] = useState('+234');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(30);

  // UI States
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const otpInputRef = useRef<TextInput | null>(null);
  const { setUser, setFirebaseUid, createAccountFromOtp } = useAuthStore();

  const currentCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];
  const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

  // Focus OTP box and start resend countdown when entering OTP step
  useEffect(() => {
    if (authStep === 'otp') {
      setIsOtpFocused(true);
      setResendCountdown(30);
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 300);

      const interval = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [authStep]);

  // Step 1: Submit Phone Number -> Advance to OTP
  const handlePhoneSubmit = async () => {
    Keyboard.dismiss();
    const cleanNum = phoneNumber.replace(/\D/g, '');
    if (cleanNum.length < 7) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number.');
      return;
    }

    setOtpValue('');
    setAuthStep('otp');
  };

  // Step 2: Handle OTP input changes (6 digits)
  const handleOtpChange = (text: string) => {
    const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpValue(cleanDigits);

    // Auto submit on 6th digit
    if (cleanDigits.length === 6) {
      handleOtpVerify(cleanDigits);
    }
  };

  // Step 2: Verify OTP
  const handleOtpVerify = async (code: string) => {
    Keyboard.dismiss();
    setIsLoading(true);
    try {
      const uid = getDeterministicUid(fullPhoneNumber);
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef).catch(() => null);

      if (userSnap && userSnap.exists()) {
        // Returning user exists -> Log straight in
        const existingData = userSnap.data() as any;
        setFirebaseUid(uid);
        setUser(existingData);
      } else {
        const localUser = useAuthStore.getState().user;
        if (localUser && localUser.phoneNumber === fullPhoneNumber) {
          setFirebaseUid(uid);
          setUser(localUser);
        } else {
          // New user -> Immediately create account with isProfileComplete: false
          const createRes = await createAccountFromOtp(fullPhoneNumber);
          if (!createRes.success) {
            Alert.alert('Registration Error', createRes.error || 'Failed to initialize account.');
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Verification Error', e?.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Back Button in Navigation Bar
  const handleBack = () => {
    Keyboard.dismiss();
    if (authStep === 'otp') {
      setAuthStep('phone');
    } else if (authStep === 'phone') {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ==================== STEP 1: PHONE NUMBER (UBER EATS STYLE) ==================== */}
          {authStep === 'phone' && (
            <View style={styles.uberContainer}>
              {/* Top Back Button to Return to Landing/Choice Screen */}
              <View style={styles.uberTopBar}>
                <TouchableOpacity
                  style={styles.circleBackButton}
                  onPress={handleBack}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.uberTitle}>Enter your mobile number</Text>
              <Text style={styles.uberSubtitle}>
                We'll send a 6-digit code to log you in or create your account
              </Text>

              {/* Input Row */}
              <View style={styles.uberInputRow}>
                {/* Country Picker Button */}
                <TouchableOpacity
                  style={styles.uberCountryPicker}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.uberFlagText}>{currentCountry.flag}</Text>
                  <Ionicons name="caret-down" size={10} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>

                {/* Phone Number Input Box */}
                <View style={styles.uberPhoneBox}>
                  <Text style={styles.uberDialCode}>{countryCode}</Text>
                  <TextInput
                    style={styles.uberPhoneInput}
                    placeholder="Mobile number"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    selectionColor="#FFFFFF"
                  />
                  <Ionicons name="person" size={18} color="rgba(255, 255, 255, 0.5)" />
                </View>
              </View>

              {/* Primary Continue Button (Solid White with Black Text) */}
              <TouchableOpacity
                style={styles.uberPrimaryBtn}
                onPress={handlePhoneSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.uberPrimaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>

              {/* Legal / Consent Disclaimer */}
              <Text style={styles.uberDisclaimer}>
                By proceeding, you consent to get calls, WhatsApp or SMS messages, including by automated means, from Vico and its affiliates to the number provided.
              </Text>
            </View>
          )}

          {/* ==================== STEP 2: OTP VERIFICATION (UBER EATS STYLE) ==================== */}
          {authStep === 'otp' && (
            <View style={styles.uberOtpContainer}>
              <Text style={styles.uberOtpTitle}>
                Enter the 6-digit code sent to you at {fullPhoneNumber}.
              </Text>

              <TouchableOpacity
                style={styles.uberChangedNumberLink}
                onPress={() => setAuthStep('phone')}
                activeOpacity={0.7}
              >
                <Text style={styles.uberChangedNumberText}>Changed your mobile number?</Text>
              </TouchableOpacity>

              {/* 6-digit sequential input row */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => otpInputRef.current?.focus()}
                style={styles.uberOtpRowContainer}
              >
                <TextInput
                  ref={otpInputRef}
                  value={otpValue}
                  onChangeText={handleOtpChange}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  style={styles.hiddenOtpInput}
                  onFocus={() => setIsOtpFocused(true)}
                  onBlur={() => setIsOtpFocused(false)}
                  caretHidden
                />
                <View style={styles.uberOtpRow} pointerEvents="none">
                  {[0, 1, 2, 3, 4, 5].map((idx) => {
                    const isFilled = idx < otpValue.length;
                    const isFocused =
                      isOtpFocused &&
                      (otpValue.length === idx || (otpValue.length === 6 && idx === 5));

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.uberOtpBox,
                          isFocused && styles.uberOtpBoxFocused,
                          isFilled && !isFocused && styles.uberOtpBoxFilled,
                        ]}
                      >
                        {isFilled && <Text style={styles.uberOtpBullet}>●</Text>}
                      </View>
                    );
                  })}
                </View>
              </TouchableOpacity>

              {/* Resend pill */}
              <TouchableOpacity
                style={styles.uberResendPill}
                disabled={resendCountdown > 0}
                onPress={() => {
                  setResendCountdown(30);
                  Alert.alert('Code Sent', `A new verification code was sent to ${fullPhoneNumber}`);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.uberResendText}>
                  {resendCountdown > 0
                    ? `Resend code via SMS (0:${resendCountdown < 10 ? '0' : ''}${resendCountdown})`
                    : 'Resend code via SMS'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar: OTP Step (Uber layout: Circular Back + Next Button) */}
        {authStep === 'otp' && (
          <View style={styles.uberOtpBottomBar}>
            <TouchableOpacity
              style={styles.circleBackButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uberNextBtn,
                otpValue.length === 6
                  ? styles.uberNextBtnActive
                  : styles.uberNextBtnDisabled,
              ]}
              disabled={otpValue.length < 6 || isLoading}
              onPress={() => handleOtpVerify(otpValue)}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={otpValue.length === 6 ? '#000000' : '#FFFFFF'} />
              ) : (
                <>
                  <Text
                    style={[
                      styles.uberNextBtnText,
                      otpValue.length === 6
                        ? styles.uberNextBtnTextActive
                        : styles.uberNextBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={otpValue.length === 6 ? '#000000' : 'rgba(255, 255, 255, 0.35)'}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Country Code Modal */}
        <Modal visible={showCountryPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCountryPicker(false)}
          >
            <View style={styles.countryModalContent}>
              <Text style={styles.countryModalTitle}>Select Country</Text>
              {COUNTRY_CODES.map((item) => {
                const isSelected = item.code === countryCode;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.countryItem, isSelected && styles.countryItemSelected]}
                    onPress={() => {
                      setCountryCode(item.code);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={[styles.countryName, isSelected && styles.countryTextSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.countryCodeValue, isSelected && styles.countryTextSelected]}>
                      {item.code}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  uberContainer: {
    paddingTop: spacing.xs,
  },
  uberTopBar: {
    marginBottom: spacing.md,
  },
  uberTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  uberSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 22,
    marginBottom: 20,
  },
  uberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  uberCountryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 12,
    gap: 6,
  },
  uberFlagText: {
    fontSize: 22,
  },
  uberPhoneBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 14,
    marginLeft: 10,
  },
  uberDialCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginRight: 6,
  },
  uberPhoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  uberPrimaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  uberPrimaryBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  uberDisclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 18,
    marginTop: 20,
    paddingBottom: 16,
  },
  // Uber OTP Styles
  uberOtpContainer: {
    paddingTop: spacing.lg,
  },
  uberOtpTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },
  uberChangedNumberLink: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  uberChangedNumberText: {
    fontSize: 14,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  uberOtpRowContainer: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  hiddenOtpInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  uberOtpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  uberOtpBox: {
    width: 48,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberOtpBullet: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  uberOtpBoxFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1C1C1E',
  },
  uberOtpBoxFilled: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#1C1C1E',
  },
  uberResendPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C1E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: spacing.xs,
  },
  uberResendText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
  },
  uberOtpBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.lg,
    paddingTop: spacing.sm,
  },
  circleBackButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    gap: 6,
  },
  uberNextBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  uberNextBtnDisabled: {
    backgroundColor: '#1C1C1E',
  },
  uberNextBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uberNextBtnTextActive: {
    color: '#000000',
  },
  uberNextBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayBlack,
    justifyContent: 'flex-end',
  },
  countryModalContent: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  countryModalTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  countryItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  countryTextSelected: {
    color: '#FFFFFF',
    fontWeight: typography.fontWeights.bold,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  countryName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.fontSizes.sm,
  },
  countryCodeValue: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.semibold,
    fontSize: typography.fontSizes.sm,
  },
});
