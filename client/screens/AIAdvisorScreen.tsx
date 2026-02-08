import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/context/SubscriptionContext";
import { PremiumBadge } from "@/components/PremiumGate";
import { AppColors, Spacing, BorderRadius, Shadows, GradientPresets } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width } = Dimensions.get("window");

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  gradient: string[];
  accentColor: string;
  tintLight: string;
  tintDark: string;
  onPress: () => void;
  isPrimary?: boolean;
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
  accentColor,
  tintLight,
  tintDark,
  onPress,
  isPrimary,
}: FeatureCardProps) {
  const { theme, isDark } = useTheme();

  return (
    <Pressable
      style={[
        styles.featureCard,
        {
          backgroundColor: isDark ? tintDark : tintLight,
          borderWidth: 1,
          borderColor: accentColor,
        },
        !isDark && (isPrimary ? styles.elevatedCard : Shadows.small),
      ]}
      onPress={onPress}
    >
      <LinearGradient
        colors={gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Icon name={icon} size={24} color="#FFF" />
      </LinearGradient>
      <View style={styles.cardContent}>
        <ThemedText style={[styles.cardTitle, isPrimary ? styles.primaryTitle : null]}>
          {title}
        </ThemedText>
        <ThemedText style={styles.cardDescription}>{description}</ThemedText>
      </View>
      <Icon name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AIAdvisorScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { isPro, isPremium, tier } = useSubscription();

  const features = [
    {
      icon: "message-circle" as const,
      title: "AI Van Build Chat",
      description: "Ask anything about van conversions, get instant expert advice",
      gradient: [AppColors.primary, AppColors.accent],
      accentColor: AppColors.primary,
      tintLight: "#FFF4EB",
      tintDark: "rgba(255,140,66,0.35)",
      screen: "AIChat" as const,
      isPrimary: true,
      requiredTier: undefined as "pro" | "expert" | undefined,
    },
    {
      icon: "dollar-sign" as const,
      title: "Cost Estimator",
      description: "Get detailed cost breakdowns for your dream van build",
      gradient: ["#10B981", "#34D399"],
      accentColor: "#10B981",
      tintLight: "#ECFDF5",
      tintDark: "rgba(16,185,129,0.35)",
      screen: "AICostEstimator" as const,
      requiredTier: undefined as "pro" | "expert" | undefined,
    },
    {
      icon: "users" as const,
      title: "Expert Marketplace",
      description: "Connect with verified van builders for paid consultations",
      gradient: ["#3B82F6", "#60A5FA"],
      accentColor: "#3B82F6",
      tintLight: "#EFF6FF",
      tintDark: "rgba(59,130,246,0.35)",
      screen: "ExpertMarketplace" as const,
      requiredTier: undefined as "pro" | "expert" | undefined,
    },
  ];

  const canAccessFeature = (requiredTier?: "pro" | "expert") => {
    if (!requiredTier) return true;
    if (requiredTier === "pro") return isPro;
    if (requiredTier === "expert") return isPremium;
    return false;
  };

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.aiDark : GradientPresets.aiLight)]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerBanner}>
          <LinearGradient
            colors={[AppColors.primary, AppColors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerGradient}
          >
            <View style={styles.bannerIconContainer}>
              <Icon name="cpu" size={28} color="#FFF" />
            </View>
            <ThemedText style={styles.bannerTitle}>AI Van Build Advisor</ThemedText>
            <ThemedText style={styles.bannerSubtitle}>
              Your personal van conversion expert powered by AI
            </ThemedText>
          </LinearGradient>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>AI Tools</ThemedText>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#E8E6E3" }]} />
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <Animated.View key={index} entering={FadeInDown.delay(100 + index * 80).springify()}>
              <View>
                {feature.requiredTier && !canAccessFeature(feature.requiredTier) && (
                  <View style={styles.lockBadgeContainer}>
                    <PremiumBadge requiredTier={feature.requiredTier} small />
                  </View>
                )}
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  gradient={feature.gradient}
                  accentColor={feature.accentColor}
                  tintLight={feature.tintLight}
                  tintDark={feature.tintDark}
                  isPrimary={feature.isPrimary}
                  onPress={() => {
                    if (feature.requiredTier && !canAccessFeature(feature.requiredTier)) {
                      navigation.navigate("Subscription" as any);
                    } else {
                      navigation.navigate(feature.screen);
                    }
                  }}
                />
              </View>
            </Animated.View>
          ))}
        </View>

        <Animated.View 
          entering={FadeInDown.delay(500).springify()}
          style={[styles.tipCard, { backgroundColor: theme.cardBackground }, Shadows.small]}
        >
          <View style={styles.tipHeader}>
            <View style={[styles.tipIconBg, { backgroundColor: `${AppColors.primary}20` }]}>
              <Icon name="zap" size={18} color={AppColors.primary} />
            </View>
            <ThemedText style={styles.tipTitle}>Pro Tip</ThemedText>
          </View>
          <ThemedText style={styles.tipText}>
            The AI advisor learns from thousands of van builds. The more details
            you provide, the better advice you&apos;ll get!
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerBanner: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  bannerGradient: {
    paddingVertical: Spacing.xl + 10,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  bannerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
    textAlign: "center" as const,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center" as const,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginBottom: Spacing.sm,
  },
  sectionDivider: {
    height: 1,
  },
  featuresContainer: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  lockBadgeContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
  },
  featureCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  elevatedCard: {
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 4,
  },
  primaryTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  cardDescription: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  tipCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: AppColors.primary,
  },
  tipText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
});
