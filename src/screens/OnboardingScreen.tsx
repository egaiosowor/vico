import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../theme/theme';

interface OnboardingScreenProps {
  navigation: any;
}

const FEATURES = [
  {
    id: 'radar',
    title: 'Real-Time Radar',
    desc: 'Live community threat map with autonomous safe zones & instant perimeter breach alerts.',
    image: require('../../assets/radar-3d.jpg'),
    color: '#FFAB40',
  },
  {
    id: 'circles',
    title: 'Trusted Circles',
    desc: 'Connect with family and close neighbors for private safety check-ins, live status, and emergency SOS.',
    image: require('../../assets/circles-3d.jpg'),
    color: '#40C4FF',
  },
  {
    id: 'safe_zone',
    title: 'Autonomous Safe Zones',
    desc: 'Automated neighborhood perimeter security alerting you and your trusted circles in milliseconds.',
    image: require('../../assets/safezone-3d.jpg'),
    color: '#69F0AE',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const transitionTo = (nextIndex: number) => {
    if (nextIndex === activeIndexRef.current) return;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: -5,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveIndex(nextIndex);
      activeIndexRef.current = nextIndex;
      translateYAnim.setValue(5);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Smooth auto-play timer (3.5s per slide)
  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeIndexRef.current + 1) % FEATURES.length;
      transitionTo(nextIndex);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('Auth');
  };

  const currentFeature = FEATURES[activeIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Hero Brand Header - Logo Only */}
      <View style={styles.heroSection}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />
      </View>

      {/* Floating 3D Showcase (Frameless) */}
      <View style={styles.showcaseContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => transitionTo((activeIndex + 1) % FEATURES.length)}
          style={styles.showcaseTouchable}
        >
          <Animated.View
            style={[
              styles.showcaseContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateYAnim }],
              },
            ]}
          >
            <Image
              source={currentFeature.image}
              style={styles.floating3DArtwork}
              resizeMode="contain"
            />
            <Text style={styles.headlineText}>{currentFeature.title}</Text>
            <Text style={styles.subheadlineText}>{currentFeature.desc}</Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Minimalist Circular Pagination Indicators */}
        <View style={styles.paginationRow}>
          {FEATURES.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => transitionTo(idx)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <View
                style={[
                  styles.paginationDot,
                  activeIndex === idx ? styles.paginationDotActive : styles.paginationDotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bottom Action Section: Unified Primary Get Started Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
        >
          <Text style={styles.getStartedButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#000000" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? spacing.md : spacing.lg,
  },
  heroLogo: {
    width: 120,
    height: 48,
  },
  showcaseContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseTouchable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  floating3DArtwork: {
    width: 190,
    height: 190,
    borderRadius: 24,
    marginBottom: 28,
  },
  headlineText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subheadlineText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    maxWidth: 340,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
  },
  paginationDotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    gap: 8,
  },
  getStartedButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  getStartedButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
