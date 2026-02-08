import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Activity } from "@/types";
import { BorderRadius, Spacing, AppColors, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ACTIVITY_ICONS: Record<Activity["type"], string> = {
  hiking: "map",
  climbing: "trending-up",
  skiing: "wind",
  camping: "home",
  surfing: "droplet",
  other: "star",
};

export function ActivityCard({ activity, onPress }: ActivityCardProps) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const hostPhotoUrl = activity.host.photos?.[0] || null;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        { backgroundColor: theme.cardBackground },
        Shadows.small,
        animatedStyle,
      ]}
      testID={`activity-card-${activity.id}`}
    >
      <View style={styles.iconContainer}>
        <View style={[styles.iconBadge, { backgroundColor: AppColors.primary }]}>
          <Icon
            name={ACTIVITY_ICONS[activity.type]}
            size={24}
            color="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.content}>
        <ThemedText type="h4" style={styles.title} numberOfLines={1}>
          {activity.title}
        </ThemedText>

        <View style={styles.infoRow}>
          <Icon name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={[styles.infoText, { color: theme.textSecondary }]}
          >
            {formatDate(activity.date)}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <Icon name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={[styles.infoText, { color: theme.textSecondary }]}
          >
            {activity.location}
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <View style={styles.hostInfo}>
            <Image
              source={hostPhotoUrl ? { uri: hostPhotoUrl } : require("../../assets/images/default-avatar.png")}
              style={styles.hostAvatar}
              contentFit="cover"
            />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Hosted by {activity.host.name.split(" ")[0]}
            </ThemedText>
          </View>

          <View style={styles.attendeesInfo}>
            <Icon name="users" size={14} color={AppColors.primary} />
            <ThemedText
              type="small"
              style={[styles.attendeesText, { color: AppColors.primary }]}
            >
              {activity.attendees.length}
              {activity.maxAttendees ? `/${activity.maxAttendees}` : ""}
            </ThemedText>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    marginRight: Spacing.lg,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  infoText: {
    marginLeft: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  hostInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.xs,
  },
  attendeesInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeesText: {
    marginLeft: 4,
    fontWeight: "600",
  },
});
