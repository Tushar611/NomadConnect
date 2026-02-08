import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { AppColors } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");


interface SplashScreenProps {
  onAnimationComplete: () => void;
}

function VanIcon({ color = "#FFFFFF", size = 80 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 100 60">
      <Rect x="5" y="15" width="75" height="35" rx="8" fill={color} />
      <Rect x="70" y="20" width="25" height="30" rx="5" fill={color} />
      <Rect x="75" y="25" width="15" height="12" rx="2" fill="rgba(0,0,0,0.3)" />
      <Rect x="12" y="22" width="18" height="14" rx="3" fill="rgba(0,0,0,0.2)" />
      <Rect x="35" y="22" width="18" height="14" rx="3" fill="rgba(0,0,0,0.2)" />
      <Rect x="58" y="22" width="10" height="14" rx="3" fill="rgba(0,0,0,0.2)" />
      <Circle cx="25" cy="50" r="10" fill="#333" />
      <Circle cx="25" cy="50" r="6" fill="#666" />
      <Circle cx="25" cy="50" r="3" fill="#999" />
      <Circle cx="70" cy="50" r="10" fill="#333" />
      <Circle cx="70" cy="50" r="6" fill="#666" />
      <Circle cx="70" cy="50" r="3" fill="#999" />
      <Rect x="0" y="35" width="8" height="6" rx="2" fill={color} />
    </Svg>
  );
}

export default function SplashScreen({ onAnimationComplete }: SplashScreenProps) {
  const hasCompleted = useRef(false);
  
  const handleComplete = () => {
    if (!hasCompleted.current) {
      hasCompleted.current = true;
      onAnimationComplete();
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      handleComplete();
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const vanTranslateX = useSharedValue(-SCREEN_WIDTH);
  const vanBounce = useSharedValue(0);
  const wheelRotation = useSharedValue(0);
  const dustOpacity = useSharedValue(0);
  const dust2Opacity = useSharedValue(0);
  const dust3Opacity = useSharedValue(0);

  useEffect(() => {
    vanTranslateX.value = withDelay(
      200,
      withTiming(0, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      })
    );

    vanBounce.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 150 }),
          withTiming(0, { duration: 150 })
        ),
        12,
        true
      )
    );

    wheelRotation.value = withDelay(
      200,
      withTiming(720, {
        duration: 1800,
        easing: Easing.out(Easing.cubic),
      })
    );

    dustOpacity.value = withDelay(
      400,
      withSequence(
        withTiming(0.6, { duration: 300 }),
        withTiming(0, { duration: 800 })
      )
    );

    dust2Opacity.value = withDelay(
      600,
      withSequence(
        withTiming(0.5, { duration: 300 }),
        withTiming(0, { duration: 700 })
      )
    );

    dust3Opacity.value = withDelay(
      800,
      withSequence(
        withTiming(0.4, { duration: 300 }),
        withTiming(0, { duration: 600 })
      )
    );

    logoOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    logoScale.value = withDelay(
      1200,
      withSpring(1, {
        damping: 12,
        stiffness: 100,
        mass: 0.8,
      })
    );

    taglineOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    taglineTranslateY.value = withDelay(
      1800,
      withSpring(0, {
        damping: 15,
        stiffness: 120,
      })
    );

    subtitleOpacity.value = withDelay(
      2200,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    const timeout = setTimeout(() => {
      logoOpacity.value = withTiming(0, { duration: 400 });
      taglineOpacity.value = withTiming(0, { duration: 300 });
      subtitleOpacity.value = withTiming(0, { duration: 300 });
      vanTranslateX.value = withTiming(SCREEN_WIDTH, { duration: 500 }, () => {
        runOnJS(handleComplete)();
      });
    }, 2200);

    return () => clearTimeout(timeout);
  }, []);

  const vanAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: vanTranslateX.value },
      { translateY: vanBounce.value },
    ],
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const taglineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const dustStyle1 = useAnimatedStyle(() => ({
    opacity: dustOpacity.value,
    transform: [{ translateX: vanTranslateX.value - 60 }],
  }));

  const dustStyle2 = useAnimatedStyle(() => ({
    opacity: dust2Opacity.value,
    transform: [{ translateX: vanTranslateX.value - 90 }],
  }));

  const dustStyle3 = useAnimatedStyle(() => ({
    opacity: dust3Opacity.value,
    transform: [{ translateX: vanTranslateX.value - 120 }],
  }));

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/images/welcome-hero.png")}
        style={styles.backgroundContainer}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            "rgba(28,28,30,0.3)",
            "rgba(28,28,30,0.5)",
            "rgba(28,28,30,0.8)",
          ]}
          style={styles.overlay}
        />
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.vanContainer}>
          <Animated.View style={[styles.dust, dustStyle3]}>
            <View style={[styles.dustCloud, { width: 20, height: 20 }]} />
          </Animated.View>
          <Animated.View style={[styles.dust, dustStyle2]}>
            <View style={[styles.dustCloud, { width: 25, height: 25 }]} />
          </Animated.View>
          <Animated.View style={[styles.dust, dustStyle1]}>
            <View style={[styles.dustCloud, { width: 30, height: 30 }]} />
          </Animated.View>
          
          <Animated.View style={[styles.van, vanAnimatedStyle]}>
            <VanIcon color={AppColors.primary} size={100} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Animated.Text style={styles.logoText}>nomad</Animated.Text>
          <Animated.Text style={styles.logoTextAccent}>connect</Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.taglineContainer, taglineAnimatedStyle]}>
          <Animated.Text style={styles.tagline}>
            Find your tribe on the road
          </Animated.Text>
        </Animated.View>

        <Animated.View style={[styles.subtitleContainer, subtitleAnimatedStyle]}>
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Animated.Text style={styles.subtitle}>van life community</Animated.Text>
            <View style={styles.divider} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.bottomGradient}>
        <LinearGradient
          colors={["rgba(232,116,79,0)", "rgba(232,116,79,0.15)"]}
          style={styles.bottomGradientInner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  vanContainer: {
    height: 80,
    width: SCREEN_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  van: {
    alignItems: "center",
    justifyContent: "center",
  },
  dust: {
    position: "absolute",
    bottom: 10,
  },
  dustCloud: {
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 50,
  },
  logoContainer: {
    alignItems: "center",
  },
  logoText: {
    fontSize: 48,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 8,
    textTransform: "lowercase",
  },
  logoTextAccent: {
    fontSize: 48,
    fontWeight: "700",
    color: AppColors.primary,
    letterSpacing: 4,
    textTransform: "lowercase",
    marginTop: -8,
    textShadowColor: "rgba(232,116,79,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  taglineContainer: {
    marginTop: 32,
  },
  tagline: {
    fontSize: 18,
    fontWeight: "400",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 1,
    textAlign: "center",
  },
  subtitleContainer: {
    marginTop: 24,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  bottomGradientInner: {
    flex: 1,
  },
});
