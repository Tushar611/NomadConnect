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
import { ForumPost } from "@/types";
import { BorderRadius, Spacing, AppColors, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface ForumPostCardProps {
  post: ForumPost;
  onPress: () => void;
  onUpvote: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_COLORS: Record<ForumPost["category"], string> = {
  builds: "#4CAF50",
  electrical: "#FFC107",
  plumbing: "#2196F3",
  insulation: "#9C27B0",
  tips: "#FF9800",
  general: "#607D8B",
};

const CATEGORY_LABELS: Record<ForumPost["category"], string> = {
  builds: "Builds",
  electrical: "Electrical",
  plumbing: "Plumbing",
  insulation: "Insulation",
  tips: "Tips",
  general: "General",
};

export function ForumPostCard({ post, onPress, onUpvote }: ForumPostCardProps) {
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const authorPhotoUrl = post.author.photos?.[0] || null;

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
      testID={`forum-post-${post.id}`}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: CATEGORY_COLORS[post.category] },
          ]}
        >
          <ThemedText style={styles.categoryText}>
            {CATEGORY_LABELS[post.category]}
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatDate(post.createdAt)}
        </ThemedText>
      </View>

      <ThemedText type="h4" style={styles.title} numberOfLines={2}>
        {post.title}
      </ThemedText>

      <ThemedText
        type="body"
        style={[styles.preview, { color: theme.textSecondary }]}
        numberOfLines={2}
      >
        {post.content}
      </ThemedText>

      <View style={styles.footer}>
        <View style={styles.authorInfo}>
          <Image
            source={authorPhotoUrl ? { uri: authorPhotoUrl } : require("../../assets/images/default-avatar.png")}
            style={styles.authorAvatar}
            contentFit="cover"
          />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {post.author.name}
          </ThemedText>
        </View>

        <View style={styles.stats}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onUpvote();
            }}
            style={styles.statItem}
            testID={`upvote-${post.id}`}
          >
            <Icon name="arrow-up" size={16} color={AppColors.primary} />
            <ThemedText
              type="small"
              style={[styles.statText, { color: AppColors.primary }]}
            >
              {post.upvotes}
            </ThemedText>
          </Pressable>

          <View style={styles.statItem}>
            <Icon name="message-circle" size={16} color={theme.textSecondary} />
            <ThemedText
              type="small"
              style={[styles.statText, { color: theme.textSecondary }]}
            >
              {post.commentCount}
            </ThemedText>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 17,
    marginBottom: Spacing.xs,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.xs,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.lg,
  },
  statText: {
    marginLeft: 4,
    fontWeight: "500",
  },
});
