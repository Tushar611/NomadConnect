import React from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription, SubscriptionTier } from "@/context/SubscriptionContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PremiumGateProps {
  requiredTier: "pro" | "expert";
  featureName: string;
  featureDescription?: string;
  children: React.ReactNode;
}

export function PremiumGate({
  requiredTier,
  featureName,
  featureDescription,
  children,
}: PremiumGateProps) {
  const { isPro, isPremium, tier } = useSubscription();

  const hasAccess =
    requiredTier === "pro" ? isPro : isPremium;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <PremiumGateOverlay
      requiredTier={requiredTier}
      featureName={featureName}
      featureDescription={featureDescription}
    />
  );
}

interface PremiumGateOverlayProps {
  requiredTier: "pro" | "expert";
  featureName: string;
  featureDescription?: string;
}

function PremiumGateOverlay({
  requiredTier,
  featureName,
  featureDescription,
}: PremiumGateOverlayProps) {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { presentPaywall, isConfigured } = useSubscription();

  const tierLabel = requiredTier === "pro" ? "Pro" : "Premium";
  const gradient: [string, string, string] =
    requiredTier === "pro"
      ? ["#FF8C42", "#F97316", "#EA580C"]
      : ["#A78BFA", "#8B5CF6", "#7C3AED"];

  const handleUpgrade = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("Subscription");
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0F0D0B" : "#FFF9F5" }]}>
      <LinearGradient
        colors={isDark ? ["#1A1510", "#0F0D0B"] : ["#FFF3E8", "#FFF9F5"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBg}
          >
            <Ionicons name="lock-closed" size={36} color="#FFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {tierLabel} Feature
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <ThemedText style={[styles.featureName, { color: gradient[1] }]}>
            {featureName}
          </ThemedText>
        </Animated.View>

        {featureDescription && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              {featureDescription}
            </ThemedText>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.buttonContainer}>
          <Pressable onPress={handleUpgrade}>
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeButton}
            >
              <Ionicons name="rocket" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <ThemedText style={styles.upgradeText}>
                Upgrade to {tierLabel}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

interface PremiumBadgeProps {
  requiredTier?: "pro" | "expert";
  small?: boolean;
}

export function PremiumBadge({ requiredTier = "pro", small = false }: PremiumBadgeProps) {
  const gradient: [string, string] =
    requiredTier === "pro" ? ["#FF8C42", "#EA580C"] : ["#A78BFA", "#7C3AED"];

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.badge, small && styles.badgeSmall]}
    >
      <Ionicons
        name="lock-closed"
        size={small ? 8 : 10}
        color="#FFF"
        style={{ marginRight: small ? 2 : 4 }}
      />
      <ThemedText style={[styles.badgeText, small && styles.badgeTextSmall]}>
        {requiredTier === "pro" ? "PRO" : "PREMIUM"}
      </ThemedText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    marginBottom: 8,
  },
  featureName: {
    fontSize: 18,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center" as const,
    marginBottom: 28,
  },
  buttonContainer: {
    marginTop: 8,
    width: SCREEN_WIDTH - 80,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#E8744F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  upgradeButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#FFF",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  badgeTextSmall: {
    fontSize: 8,
  },
});
