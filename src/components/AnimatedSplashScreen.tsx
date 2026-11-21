import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Animated,
  Image,
} from 'react-native';

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
  isReady: boolean;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationComplete,
  isReady,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;

  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  useEffect(() => {
    // Smoothly animate logo from less visible (0.7) to fully visible (1.0)
    Animated.timing(opacityAnim, {
      toValue: 1.0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Safety timeout: Ensure splash screen never indefinitely blocks the app
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onCompleteRef.current?.();
      });
    }, 1500);

    return () => clearTimeout(safetyTimer);
  }, []);

  // When parent signals ready, hold fully visible for a moment then smoothly transition to app
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        Animated.timing(exitAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          onCompleteRef.current?.();
        });
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isReady]);

  return (
    <Animated.View style={[styles.container, { opacity: exitAnim }]}>
      <Animated.View
        style={[
          styles.centerContent,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: 165,
    height: 66,
  },
});


