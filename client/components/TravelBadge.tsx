import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import type { TravelBadge as TravelBadgeType } from "@/types";

const BADGE_CONFIG: Record<string, { color: string; gradient: string[]; label: string; icon: string }> = {
  nomad: { color: "#E85D2A", gradient: ["#FF7B3A", "#E85D2A"], label: "Nomad", icon: "compass-outline" },
  adventurer: { color: "#E09000", gradient: ["#FFB020", "#E09000"], label: "Adventurer", icon: "trail-sign-outline" },
  explorer: { color: "#1A8FE3", gradient: ["#36A3F7", "#1478CC"], label: "Explorer", icon: "earth" },
};

interface Props {
  badge?: TravelBadgeType | string | null;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
  verified?: boolean;
}

export function TravelBadgeDisplay({ badge, size = "medium", showLabel = true, verified }: Props) {
  if (!badge || badge === "none") return null;

  const config = BADGE_CONFIG[badge];
  if (!config) return null;

  const sizes = {
    small: { icon: 12, badge: 22, font: 10, gap: 3 },
    medium: { icon: 16, badge: 28, font: 12, gap: 5 },
    large: { icon: 22, badge: 36, font: 14, gap: 6 },
  };

  const s = sizes[size];

  return (
    <View style={[styles.container, size === "small" && styles.containerSmall]}>
      <LinearGradient
        colors={config.gradient as [string, string]}
        style={[styles.badgeCircle, { width: s.badge, height: s.badge, borderRadius: s.badge / 2 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={config.icon as any} size={s.icon} color="#FFF" />
      </LinearGradient>
      {showLabel && (
        <ThemedText style={[styles.label, { fontSize: s.font, color: config.color }]}>
          {config.label}
        </ThemedText>
      )}
      {verified && (
        <Ionicons name="checkmark-circle" size={s.icon} color="#4CAF50" style={{ marginLeft: -2 }} />
      )}
    </View>
  );
}

export function TravelBadgeInline({ badge }: { badge?: TravelBadgeType | string | null }) {
  if (!badge || badge === "none") return null;

  const config = BADGE_CONFIG[badge];
  if (!config) return null;

  return (
    <View style={styles.inlineContainer}>
      <View style={[styles.inlineDot, { backgroundColor: config.color }]} />
      <ThemedText style={[styles.inlineText, { color: config.color }]}>
        {config.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  containerSmall: {
    gap: 3,
  },
  badgeCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "700" as const,
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inlineText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
});
