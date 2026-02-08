import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";

import { ThemedText } from "@/components/ThemedText";
import { TravelBadgeDisplay } from "@/components/TravelBadge";
import { Match } from "@/types";
import { BorderRadius, Spacing, AppColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface MatchCardProps {
  match: Match;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MatchCard({ match, onPress }: MatchCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const photoUrl = match.matchedUser.photos?.[0] || null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        { backgroundColor: theme.cardBackground },
        animatedStyle,
      ]}
      testID={`match-card-${match.id}`}
    >
      <Image source={photoUrl ? { uri: photoUrl } : require("../../assets/images/default-avatar.png")} style={styles.avatar} contentFit="cover" />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ThemedText type="h4" style={styles.name}>
              {match.matchedUser.name}
            </ThemedText>
            {(match.matchedUser as any).travelBadge && (match.matchedUser as any).travelBadge !== "none" && (
              <TravelBadgeDisplay badge={(match.matchedUser as any).travelBadge} size="small" showLabel={false} />
            )}
          </View>
          <ThemedText
            type="small"
            style={[styles.time, { color: theme.textSecondary }]}
          >
            {match.lastMessage
              ? formatTime(match.lastMessage.createdAt)
              : formatTime(match.createdAt)}
          </ThemedText>
        </View>
        <ThemedText
          type="body"
          style={[styles.preview, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {match.lastMessage
            ? match.lastMessage.content
            : `You matched with ${match.matchedUser.name}!`}
        </ThemedText>
      </View>
      <View style={styles.rightSection}>
        {match.isFavourite ? (
          <View style={styles.favouriteIcon}>
            <Icon name="star" size={16} color={AppColors.sunsetGold} />
          </View>
        ) : null}
        {!match.lastMessage ? (
          <View style={[styles.newBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.newText}>NEW</ThemedText>
          </View>
        ) : match.unreadCount && match.unreadCount > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.unreadText}>{match.unreadCount}</ThemedText>
          </View>
        ) : (
          <Icon
            name="message-circle"
            size={20}
            color={theme.textSecondary}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.primary,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  name: {
    fontSize: 17,
  },
  time: {
    fontSize: 12,
  },
  preview: {
    fontSize: 14,
  },
  rightSection: {
    marginLeft: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  newBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  newText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  favouriteIcon: {
    marginBottom: Spacing.xs,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
