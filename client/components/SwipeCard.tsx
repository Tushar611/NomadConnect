import React from "react";
import {
  StyleSheet,
  View,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Icon } from "@/components/Icon";

import { ThemedText } from "@/components/ThemedText";
import { TravelBadgeDisplay } from "@/components/TravelBadge";
import { User } from "@/types";
import { BorderRadius, Spacing, AppColors, Shadows } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

const PILL_SUNSET = { bg: "rgba(232, 116, 79, 0.85)", text: "#FFFFFF" };
const PILL_GOLD = { bg: "rgba(255, 179, 71, 0.85)", text: "#FFFFFF" };

interface SwipeCardProps {
  user: User;
  distance?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isFirst: boolean;
  cardWidth?: number;
  cardHeight?: number;
}

export function SwipeCard({
  user,
  distance,
  onSwipeLeft,
  onSwipeRight,
  isFirst,
  cardWidth,
  cardHeight,
}: SwipeCardProps) {
  const CARD_WIDTH = cardWidth || SCREEN_WIDTH - Spacing.lg * 2;
  const CARD_HEIGHT = cardHeight || SCREEN_HEIGHT * 0.55;
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(isFirst ? 1 : 0.95);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (isFirst) {
      scale.value = withSpring(1);
    } else {
      scale.value = withSpring(0.95);
    }
  }, [isFirst]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (!isFirst) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.5;
      rotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (!isFirst) return;

      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(onSwipeRight)();
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(onSwipeLeft)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotation.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const photoUrl = user.photos?.[0] || null;

  const pills: Array<{ label: string; icon?: string; type: "location" | "hobby" }> = [];
  if (user.location) pills.push({ label: user.location, icon: "map-pin", type: "location" });
  if (distance) pills.push({ label: `${distance} mi away`, icon: "navigation", type: "location" });
  if (user.vanType) pills.push({ label: user.vanType, icon: "truck", type: "hobby" });
  user.interests?.slice(0, 4).forEach((interest) => {
    pills.push({ label: interest, type: "hobby" });
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, { width: CARD_WIDTH, height: CARD_HEIGHT }, cardStyle, Shadows.large]}>
        <Image
          source={photoUrl ? { uri: photoUrl } : require("../../assets/images/default-avatar.png")}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.75)"]}
          style={styles.gradient}
        />
        
        <Animated.View style={[styles.likeStamp, likeOpacity]}>
          <ThemedText style={[styles.stampText, { color: AppColors.sunsetCoral }]}>LIKE</ThemedText>
        </Animated.View>
        
        <Animated.View style={[styles.nopeStamp, nopeOpacity]}>
          <ThemedText style={[styles.stampText, { color: AppColors.sunsetRose }]}>NOPE</ThemedText>
        </Animated.View>

        <View style={styles.content}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>
              {user.name}
            </ThemedText>
            <ThemedText style={styles.age}>{user.age}</ThemedText>
            {user.travelBadge && user.travelBadge !== "none" && (
              <TravelBadgeDisplay badge={user.travelBadge} size="small" showLabel={false} />
            )}
          </View>

          {user.bio ? (
            <ThemedText style={styles.bio} numberOfLines={2}>
              {user.bio}
            </ThemedText>
          ) : null}

          <View style={styles.pillsRow}>
            {pills.map((pill, index) => {
              const colorSet = pill.type === "location" ? PILL_SUNSET : PILL_GOLD;
              return (
                <View key={index} style={[styles.pill, { backgroundColor: colorSet.bg }]}>
                  {pill.icon ? (
                    <Icon name={pill.icon} size={11} color={colorSet.text} />
                  ) : null}
                  <ThemedText style={[styles.pillText, { color: colorSet.text }]}>
                    {pill.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: BorderRadius["2xl"],
    overflow: "hidden",
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  likeStamp: {
    position: "absolute",
    top: 50,
    left: 20,
    borderWidth: 4,
    borderColor: AppColors.sunsetCoral,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    transform: [{ rotate: "-20deg" }],
  },
  nopeStamp: {
    position: "absolute",
    top: 50,
    right: 20,
    borderWidth: 4,
    borderColor: AppColors.sunsetRose,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    transform: [{ rotate: "20deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 2,
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  name: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  age: {
    fontSize: 26,
    fontWeight: "400" as const,
    color: "#FFFFFF",
    marginLeft: 8,
  },
  bio: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 4,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
});
