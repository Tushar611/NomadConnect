import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ForumPostCard } from "@/components/ForumPostCard";
import { EmptyState } from "@/components/EmptyState";
import { GradientButton } from "@/components/GradientButton";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { ForumPost } from "@/types";
import { AppColors, Spacing, BorderRadius, GradientPresets } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

const CATEGORIES: { category: ForumPost["category"]; label: string; color: string; icon: string }[] = [
  { category: "builds", label: "Builds", color: "#4CAF50", icon: "truck" },
  { category: "electrical", label: "Electrical", color: "#FFC107", icon: "zap" },
  { category: "plumbing", label: "Plumbing", color: "#2196F3", icon: "droplet" },
  { category: "insulation", label: "Insulation", color: "#9C27B0", icon: "wind" },
  { category: "tips", label: "Tips", color: "#FF9800", icon: "star" },
  { category: "general", label: "General", color: "#607D8B", icon: "message-circle" },
];

type SortOption = "recent" | "popular" | "trending";

export default function ForumScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { forumPosts, isLoading, refreshData, createForumPost, upvotePost } = useData();
  const { isAuthenticated } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ForumPost["category"] | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    category: "general" as ForumPost["category"],
  });

  const handlePostPress = (post: ForumPost) => {
    setSelectedPost(post);
    setShowDetailModal(true);
  };

  const handleUpvote = async (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await upvotePost(postId);
  };

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;

    try {
      await createForumPost(newPost);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      setNewPost({ title: "", content: "", category: "general" });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const renderItem = ({ item, index }: { item: ForumPost; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <ForumPostCard
        post={item}
        onPress={() => handlePostPress(item)}
        onUpvote={() => handleUpvote(item.id)}
      />
    </Animated.View>
  );

  const filteredPosts =
    selectedFilter === "all"
      ? forumPosts
      : forumPosts.filter((p) => p.category === selectedFilter);

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === "popular") {
      return b.upvotes - a.upvotes;
    }
    if (sortBy === "trending") {
      const aScore = a.upvotes + a.commentCount * 2;
      const bScore = b.upvotes + b.commentCount * 2;
      const aAge = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
      const bAge = (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
      return (bScore / Math.max(bAge, 1)) - (aScore / Math.max(aAge, 1));
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalPosts = forumPosts.length;
  const totalUpvotes = forumPosts.reduce((sum, p) => sum + p.upvotes, 0);
  const totalComments = forumPosts.reduce((sum, p) => sum + p.commentCount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const FilterChip = ({
    label,
    isSelected,
    onPress,
    color,
    icon,
  }: {
    label: string;
    isSelected: boolean;
    onPress: () => void;
    color?: string;
    icon?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: isSelected ? color || AppColors.primary : theme.cardBackground,
        },
      ]}
    >
      {icon ? (
        <View style={{ marginRight: 4 }}>
          <Icon name={icon} size={14} color={isSelected ? "#FFFFFF" : theme.text} />
        </View>
      ) : null}
      <ThemedText
        type="small"
        style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: "600" }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const SortChip = ({
    label,
    sortOption,
    icon,
  }: {
    label: string;
    sortOption: SortOption;
    icon: string;
  }) => (
    <Pressable
      onPress={() => setSortBy(sortOption)}
      style={[
        styles.sortChip,
        {
          backgroundColor: sortBy === sortOption ? theme.primary + "20" : "transparent",
          borderColor: sortBy === sortOption ? theme.primary : theme.textSecondary + "30",
        },
      ]}
    >
      <Icon name={icon} size={14} color={sortBy === sortOption ? theme.primary : theme.textSecondary} />
      <ThemedText
        type="small"
        style={{
          color: sortBy === sortOption ? theme.primary : theme.textSecondary,
          fontWeight: "500",
          marginLeft: 4,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.forumDark : GradientPresets.forumLight)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.filterContainer, { paddingTop: headerHeight + Spacing.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <FilterChip
            label="All"
            isSelected={selectedFilter === "all"}
            onPress={() => setSelectedFilter("all")}
          />
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat.category}
              label={cat.label}
              isSelected={selectedFilter === cat.category}
              onPress={() => setSelectedFilter(cat.category)}
              color={cat.color}
              icon={cat.icon}
            />
          ))}
        </ScrollView>

        <View style={styles.sortContainer}>
          <SortChip label="Recent" sortOption="recent" icon="clock" />
          <SortChip label="Popular" sortOption="popular" icon="trending-up" />
          <SortChip label="Trending" sortOption="trending" icon="zap" />
        </View>
      </View>

      <FlatList
        data={sortedPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: tabBarHeight + Spacing.lg,
          },
          forumPosts.length === 0 && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <EmptyState
            image={require("../../assets/images/empty-forum.png")}
            title="No Posts Yet"
            description="Start a conversation! Share your van build progress, ask questions, or give tips to the community."
            actionLabel={isAuthenticated ? "Create Post" : undefined}
            onAction={isAuthenticated ? () => setShowCreateModal(true) : undefined}
          />
        }
      />

      {isAuthenticated && forumPosts.length > 0 ? (
        <Pressable
          style={[styles.fab, { backgroundColor: AppColors.primary, bottom: tabBarHeight + Spacing.lg }]}
          onPress={() => setShowCreateModal(true)}
          testID="button-create-post"
        >
          <Icon name="edit-3" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">New Post</ThemedText>
            <Pressable onPress={() => setShowCreateModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <ThemedText type="small" style={styles.label}>
              Category
            </ThemedText>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.category}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor:
                        newPost.category === cat.category ? cat.color : theme.cardBackground,
                    },
                  ]}
                  onPress={() => setNewPost({ ...newPost, category: cat.category })}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: newPost.category === cat.category ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {cat.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Input
              label="Title"
              placeholder="What's your post about?"
              value={newPost.title}
              onChangeText={(text) => setNewPost({ ...newPost, title: text })}
              containerStyle={styles.modalInput}
              testID="input-post-title"
            />

            <Input
              label="Content"
              placeholder="Share your thoughts, questions, or tips..."
              value={newPost.content}
              onChangeText={(text) => setNewPost({ ...newPost, content: text })}
              multiline
              numberOfLines={6}
              containerStyle={styles.modalInput}
              testID="input-post-content"
            />

            <GradientButton
              onPress={handleCreatePost}
              disabled={!newPost.title.trim() || !newPost.content.trim()}
              style={styles.createButton}
            >
              Post
            </GradientButton>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedPost ? (
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.detailCategoryBadge,
                  {
                    backgroundColor:
                      CATEGORIES.find((c) => c.category === selectedPost.category)?.color ||
                      "#607D8B",
                  },
                ]}
              >
                <ThemedText style={styles.detailCategoryText}>
                  {CATEGORIES.find((c) => c.category === selectedPost.category)?.label}
                </ThemedText>
              </View>
              <Pressable onPress={() => setShowDetailModal(false)}>
                <Icon name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
            >
              <ThemedText type="h3" style={styles.postTitle}>
                {selectedPost.title}
              </ThemedText>

              <View style={styles.postMeta}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Posted by {selectedPost.author.name} on {formatDate(selectedPost.createdAt)}
                </ThemedText>
              </View>

              <ThemedText type="body" style={styles.postContent}>
                {selectedPost.content}
              </ThemedText>

              <View style={styles.postStats}>
                <Pressable
                  onPress={() => handleUpvote(selectedPost.id)}
                  style={styles.statButton}
                >
                  <Icon name="arrow-up" size={20} color={AppColors.primary} />
                  <ThemedText style={[styles.statValue, { color: AppColors.primary }]}>
                    {selectedPost.upvotes} upvotes
                  </ThemedText>
                </Pressable>

                <View style={styles.statButton}>
                  <Icon name="message-circle" size={20} color={theme.textSecondary} />
                  <ThemedText style={[styles.statValue, { color: theme.textSecondary }]}>
                    {selectedPost.commentCount} comments
                  </ThemedText>
                </View>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  sortContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  modalInput: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  createButton: {
    marginTop: Spacing.lg,
  },
  detailCategoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  postTitle: {
    marginBottom: Spacing.md,
  },
  postMeta: {
    marginBottom: Spacing.xl,
  },
  postContent: {
    lineHeight: 26,
  },
  postStats: {
    flexDirection: "row",
    marginTop: Spacing["2xl"],
    gap: Spacing["2xl"],
  },
  statButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  statValue: {
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
});
