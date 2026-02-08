import React, { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { Icon } from "@/components/Icon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { Match } from "@/types";
import { Spacing, BorderRadius, AppColors, Shadows, GradientPresets } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

function PendingCircle({ match, onPress }: { match: Match; onPress: () => void }) {
  const photoUrl = match.matchedUser.photos?.[0] || null;
  
  return (
    <Pressable onPress={onPress} style={styles.pendingItem}>
      <View style={styles.pendingRing}>
        <LinearGradient
          colors={[AppColors.sunsetGold, AppColors.sunsetCoral, AppColors.sunsetRose]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pendingGradientRing}
        >
          <View style={styles.pendingInnerRing}>
            <Image source={photoUrl ? { uri: photoUrl } : DEFAULT_AVATAR} style={styles.pendingPhoto} contentFit="cover" />
          </View>
        </LinearGradient>
      </View>
      <ThemedText style={styles.pendingName} numberOfLines={1}>
        {match.matchedUser.name.split(" ")[0]}
      </ThemedText>
    </Pressable>
  );
}

function ChatRow({ match, onPress, theme }: { match: Match; onPress: () => void; theme: any }) {
  const photoUrl = match.matchedUser.photos?.[0] || null;
  const hasUnread = (match.unreadCount ?? 0) > 0;
  
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chatRow, { backgroundColor: theme.cardBackground }]}
      testID={`match-card-${match.id}`}
    >
      <View style={styles.chatAvatarContainer}>
        <Image source={photoUrl ? { uri: photoUrl } : DEFAULT_AVATAR} style={styles.chatAvatar} contentFit="cover" />
        {hasUnread && <View style={[styles.onlineDot, { borderColor: theme.cardBackground }]} />}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatTopRow}>
          <ThemedText style={[styles.chatName, hasUnread && styles.chatNameBold]}>
            {match.matchedUser.name}
          </ThemedText>
          <ThemedText style={[styles.chatTime, { color: hasUnread ? AppColors.sunsetCoral : theme.textSecondary }]}>
            {formatTime(match.lastMessage?.createdAt || match.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.chatBottomRow}>
          <ThemedText
            style={[
              styles.chatPreview,
              { color: hasUnread ? theme.text : theme.textSecondary },
              hasUnread && { fontWeight: "600" as const },
            ]}
            numberOfLines={1}
          >
            {match.lastMessage?.content || "Start the conversation..."}
          </ThemedText>
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: AppColors.sunsetCoral }]}>
              <ThemedText style={styles.unreadText}>{match.unreadCount}</ThemedText>
            </View>
          )}
          {match.isFavourite && !hasUnread && (
            <Icon name="star" size={14} color={AppColors.sunsetGold} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { matches, isLoading, refreshData, toggleFavourite, deleteMatch, markMatchAsRead } = useData();
  const navigation = useNavigation<NavigationProp>();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const pendingMatches = useMemo(() => 
    matches.filter(m => !m.lastMessage),
    [matches]
  );

  const activeChats = useMemo(() => 
    matches
      .filter(m => m.lastMessage)
      .sort((a, b) => {
        if (a.isFavourite && !b.isFavourite) return -1;
        if (!a.isFavourite && b.isFavourite) return 1;
        return new Date(b.lastMessage!.createdAt).getTime() - new Date(a.lastMessage!.createdAt).getTime();
      }),
    [matches]
  );

  const handleMatchPress = (match: Match) => {
    if (match.unreadCount && match.unreadCount > 0) {
      markMatchAsRead(match.id);
    }
    navigation.navigate("Chat", { matchId: match.id, matchName: match.matchedUser.name, matchPhoto: match.matchedUser.photos?.[0] });
  };

  const handleToggleFavourite = useCallback((matchId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavourite(matchId);
    swipeableRefs.current.get(matchId)?.close();
  }, [toggleFavourite]);

  const handleDelete = useCallback((matchId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteMatch(matchId);
    swipeableRefs.current.get(matchId)?.close();
  }, [deleteMatch]);

  const renderLeftActions = useCallback((match: Match) => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.swipeAction}>
      <Pressable
        style={[styles.swipeButton, { backgroundColor: match.isFavourite ? theme.textSecondary : AppColors.sunsetGold }]}
        onPress={() => handleToggleFavourite(match.id)}
      >
        <Icon name="star" size={20} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  ), [theme, handleToggleFavourite]);

  const renderRightActions = useCallback((matchId: string) => (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.swipeAction}>
      <Pressable
        style={[styles.swipeButton, { backgroundColor: AppColors.sunsetRose }]}
        onPress={() => handleDelete(matchId)}
      >
        <Icon name="trash-2" size={20} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  ), [handleDelete]);

  const renderChatItem = ({ item }: { item: Match }) => (
    <Swipeable
      ref={(ref) => {
        if (ref) swipeableRefs.current.set(item.id, ref);
        else swipeableRefs.current.delete(item.id);
      }}
      renderLeftActions={() => renderLeftActions(item)}
      renderRightActions={() => renderRightActions(item.id)}
      leftThreshold={60}
      rightThreshold={60}
      friction={2}
      overshootFriction={8}
    >
      <ChatRow match={item} onPress={() => handleMatchPress(item)} theme={theme} />
    </Swipeable>
  );

  const renderHeader = () => (
    <View>
      {pendingMatches.length > 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.pendingSection}>
          <View style={styles.pendingSectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              New Connections
            </ThemedText>
            <View style={[styles.countBadge, { backgroundColor: AppColors.sunsetCoral }]}>
              <ThemedText style={styles.countText}>{pendingMatches.length}</ThemedText>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pendingScroll}
          >
            {pendingMatches.map((match) => (
              <PendingCircle
                key={match.id}
                match={match}
                onPress={() => handleMatchPress(match)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {activeChats.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.chatSectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Messages
          </ThemedText>
          <ThemedText style={[styles.chatCount, { color: theme.textSecondary }]}>
            {activeChats.length}
          </ThemedText>
        </Animated.View>
      )}
    </View>
  );

  if (matches.length === 0 && !isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[...(isDark ? GradientPresets.connectDark : GradientPresets.connectLight)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentContainerStyle={[
            styles.emptyContainer,
            { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.lg },
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={theme.text} />
          }
        >
          <View style={styles.emptyContent}>
            <View style={[styles.emptyIconWrap, { backgroundColor: AppColors.sunsetCoral + "15" }]}>
              <Icon name="heart" size={48} color={AppColors.sunsetCoral} />
            </View>
            <ThemedText type="h3" style={[styles.emptyTitle, { color: theme.text }]}>
              No Connections Yet
            </ThemedText>
            <ThemedText style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Start swiping to find fellow nomads. When you both connect, you'll see them here.
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.connectDark : GradientPresets.connectLight)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={activeChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.lg },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshData} tintColor={theme.text} />
        }
        ListEmptyComponent={
          pendingMatches.length > 0 ? (
            <View style={styles.noChatYet}>
              <Icon name="message-circle" size={32} color={theme.textSecondary} />
              <ThemedText style={[styles.noChatText, { color: theme.textSecondary }]}>
                No messages yet. Tap a connection above to start chatting!
              </ThemedText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },

  pendingSection: {
    marginBottom: Spacing.xl,
  },
  pendingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  pendingScroll: {
    paddingRight: Spacing.lg,
    gap: Spacing.lg,
  },
  pendingItem: {
    alignItems: "center",
    width: 72,
  },
  pendingRing: {
    width: 68,
    height: 68,
    marginBottom: 6,
  },
  pendingGradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingInnerRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPhoto: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  pendingName: {
    fontSize: 12,
    fontWeight: "500" as const,
    textAlign: "center",
  },

  chatSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  chatCount: {
    fontSize: 14,
    fontWeight: "500" as const,
  },

  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  chatAvatarContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: AppColors.sunsetCoral,
    borderWidth: 2,
  },
  chatContent: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "500" as const,
    flex: 1,
    marginRight: Spacing.sm,
  },
  chatNameBold: {
    fontWeight: "700" as const,
  },
  chatTime: {
    fontSize: 12,
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatPreview: {
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.sm,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },

  swipeAction: {
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  swipeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  noChatYet: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  noChatText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
