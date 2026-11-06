import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, colors } from '../theme/theme';
import { useAuthStore } from '../stores/authStore';

export const NameSetupScreen: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [focusedNameField, setFocusedNameField] = useState<'first' | 'last' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const firstNameInputRef = useRef<TextInput | null>(null);
  const lastNameInputRef = useRef<TextInput | null>(null);

  const { updateName } = useAuthStore();
  const isNameValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  const handleNameSubmit = async () => {
    if (firstName.trim().length < 2) {
      Alert.alert('First Name Required', 'Please enter your first name.');
      return;
    }
    if (lastName.trim().length < 2) {
      Alert.alert('Last Name Required', 'Please enter your last name.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateName(firstName, lastName);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update profile.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to complete profile.');
    } finally {
      setIsLoading(false);
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
          <View style={styles.uberNameContainer}>
            <Text style={styles.uberTitle}>What's your name?</Text>
            <Text style={styles.uberNameSubtitle}>Let us know what to call you</Text>

            <View style={styles.uberNameInputGroup}>
              <TextInput
                ref={firstNameInputRef}
                style={[
                  styles.uberNameInput,
                  focusedNameField === 'first' && styles.uberNameInputFocused,
                ]}
                placeholder="First name"
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => lastNameInputRef.current?.focus()}
                onFocus={() => setFocusedNameField('first')}
                onBlur={() => setFocusedNameField(null)}
                selectionColor="#FFFFFF"
              />

              <TextInput
                ref={lastNameInputRef}
                style={[
                  styles.uberNameInput,
                  focusedNameField === 'last' && styles.uberNameInputFocused,
                ]}
                placeholder="Last name"
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (isNameValid) {
                    handleNameSubmit();
                  }
                }}
                onFocus={() => setFocusedNameField('last')}
                onBlur={() => setFocusedNameField(null)}
                selectionColor="#FFFFFF"
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Bar: Next Button (Right-aligned) */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.uberNextBtn,
              isNameValid ? styles.uberNextBtnActive : styles.uberNextBtnDisabled,
            ]}
            disabled={!isNameValid || isLoading}
            onPress={handleNameSubmit}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={isNameValid ? '#000000' : '#FFFFFF'} />
            ) : (
              <>
                <Text
                  style={[
                    styles.uberNextBtnText,
                    isNameValid
                      ? styles.uberNextBtnTextActive
                      : styles.uberNextBtnTextDisabled,
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={isNameValid ? '#000000' : 'rgba(255, 255, 255, 0.35)'}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
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
  uberNameContainer: {
    paddingTop: spacing.xl,
  },
  uberTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  uberNameSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 22,
    marginBottom: 24,
  },
  uberNameInputGroup: {
    gap: 12,
  },
  uberNameInput: {
    height: 52,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  uberNameInputFocused: {
    borderColor: '#FFFFFF',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.lg,
    paddingTop: spacing.sm,
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
});
