import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, View, Dimensions, Pressable, ScrollView, Modal, FlatList, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  SlideInDown,
  BounceIn,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { SwipeCard } from "@/components/SwipeCard";
import { CompatibilityCard } from "@/components/CompatibilityCard";
import { getApiUrl } from "@/lib/query-client";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { AppColors, Spacing, BorderRadius, Shadows, GradientPresets } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HEADER_HEIGHT = 50;
const ACTION_ROW_HEIGHT = 80;

function MatchTitle() {
  const glowScale = useSharedValue(1);
  const matchScale = useSharedValue(0);
  const itsAOpacity = useSharedValue(0);
  const itsAScale = useSharedValue(0.6);

  useEffect(() => {
    itsAOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    itsAScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 120 }));
    matchScale.value = withDelay(600, withSpring(1, { damping: 8, stiffness: 100, mass: 0.8 }));
    glowScale.value = withDelay(800, withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.98, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ), -1, true
    ));
  }, []);

  const itsAStyle = useAnimatedStyle(() => ({
    opacity: itsAOpacity.value,
    transform: [{ scale: itsAScale.value }],
  }));

  const matchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: matchScale.value * glowScale.value }],
  }));

  return (
    <View style={styles.matchHeader}>
      <Animated.Text style={[styles.matchTitleSmall, itsAStyle]}>
        It's a
      </Animated.Text>
      <Animated.Text style={[styles.matchTitleBig, matchStyle]}>
        MATCH!
      </Animated.Text>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { profiles, swipeRight, swipeLeft, matches, likedProfiles, refreshData } = useData();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [showMatch, setShowMatch] = useState(false);
  const [matchedName, setMatchedName] = useState("");
  const [matchedPhoto, setMatchedPhoto] = useState("");
  const [matchedId, setMatchedId] = useState("");
  const [showLikedModal, setShowLikedModal] = useState(false);
  const [matchedUserData, setMatchedUserData] = useState<any>(null);
  const [showCompatibility, setShowCompatibility] = useState(false);

  const handleSendMessage = useCallback(() => {
    setShowMatch(false);
    setShowCompatibility(false);
    navigation.navigate("Chat", { matchId: matchedId, matchName: matchedName, matchPhoto: matchedPhoto });
  }, [matchedId, matchedName, navigation]);

  const handleSwipeRight = useCallback(
    async (userId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const match = await swipeRight(userId);
      if (match) {
        setMatchedName(match.matchedUser.name);
        setMatchedPhoto(match.matchedUser?.photos?.[0] || "");
        setMatchedId(match.id);
        setMatchedUserData(match.matchedUser);
        setShowMatch(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [swipeRight]
  );

  const handleSwipeLeft = useCallback(
    (userId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      swipeLeft(userId);
    },
    [swipeLeft]
  );

  const currentProfile = profiles[0];

  const renderEmptyState = () => (
    <ScrollView 
      style={styles.emptyContainer}
      contentContainerStyle={[
        styles.emptyContent,
        { paddingTop: insets.top + HEADER_HEIGHT + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.emptyHero}>
          <LinearGradient
            colors={[AppColors.primary, AppColors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIconContainer}
          >
            <Icon name="users" size={48} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="h2" style={styles.emptyTitle}>
            All Caught Up!
          </ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            You've seen everyone nearby. New nomads are joining every day!
          </ThemedText>
          <Pressable
            onPress={async () => {
              try {
                const baseUrl = getApiUrl();
                await fetch(new URL(`/api/swipes/reset/${user?.id}`, baseUrl).toString(), { method: "POST" });
                await refreshData();
              } catch {}
            }}
            style={[styles.refreshButton, { backgroundColor: AppColors.primary }]}
          >
            <Icon name="refresh-cw" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: 8, fontWeight: "600" as const }}>
              Refresh Profiles
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.statsSection}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Your Journey So Far
        </ThemedText>
        <View style={styles.statsGrid}>
          <Pressable 
            style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.navigate("ConnectionsTab")}
          >
            <View style={[styles.statIcon, { backgroundColor: `${AppColors.success}20` }]}>
              <Icon name="heart" size={20} color={AppColors.success} />
            </View>
            <ThemedText type="h2" style={styles.statNumber}>
              {matches?.length || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Connections
            </ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.navigate("ActivitiesTab")}
          >
            <View style={[styles.statIcon, { backgroundColor: `${AppColors.primary}20` }]}>
              <Icon name="map-pin" size={20} color={AppColors.primary} />
            </View>
            <ThemedText type="h2" style={styles.statNumber}>
              {user?.location || "Exploring"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Explore Area
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.tipsSection}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          While You Wait
        </ThemedText>
        
        <Pressable 
          style={[styles.tipCard, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate("ActivitiesTab")}
        >
          <View style={[styles.tipIconBg, { backgroundColor: `${AppColors.accent}20` }]}>
            <Icon name="calendar" size={22} color={AppColors.accent} />
          </View>
          <View style={styles.tipContent}>
            <ThemedText type="body" style={styles.tipTitle}>
              Join an Activity
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Meet nomads at hiking trips, campfire hangouts, and more
            </ThemedText>
          </View>
          <Icon name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <Pressable 
          style={[styles.tipCard, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate("ProfileTab")}
        >
          <View style={[styles.tipIconBg, { backgroundColor: `${AppColors.success}20` }]}>
            <Icon name="edit-3" size={22} color={AppColors.success} />
          </View>
          <View style={styles.tipContent}>
            <ThemedText type="body" style={styles.tipTitle}>
              Update Your Profile
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Add more photos and details to stand out
            </ThemedText>
          </View>
          <Icon name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <Pressable 
          style={[styles.tipCard, { backgroundColor: theme.cardBackground }]}
          onPress={() => navigation.navigate("ConnectionsTab")}
        >
          <View style={[styles.tipIconBg, { backgroundColor: `${AppColors.primary}20` }]}>
            <Icon name="message-circle" size={22} color={AppColors.primary} />
          </View>
          <View style={styles.tipContent}>
            <ThemedText type="body" style={styles.tipTitle}>
              Chat with Matches
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Start conversations with your connections
            </ThemedText>
          </View>
          <Icon name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.quoteSection}>
        <View style={[styles.quoteCard, { backgroundColor: theme.cardBackground }]}>
          <View style={{ marginBottom: Spacing.md }}>
            <Icon name="compass" size={32} color={AppColors.primary} />
          </View>
          <ThemedText type="body" style={[styles.quoteText, { color: theme.text }]}>
            "The journey of a thousand miles begins with a single step."
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Keep exploring, new nomads are on their way!
          </ThemedText>
        </View>
      </Animated.View>
    </ScrollView>
  );

  const TinderButton = ({
    icon,
    color,
    size,
    iconSize,
    onPress,
    testID,
  }: {
    icon: string;
    color: string;
    size: number;
    iconSize: number;
    onPress: () => void;
    testID: string;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.85, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    };

    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          testID={testID}
          style={[
            styles.tinderBtn,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        >
          <Icon name={icon} size={iconSize} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    );
  };

  const topBarTop = Platform.OS === "web" ? 67 : insets.top;
  const cardTop = topBarTop + HEADER_HEIGHT + 8;
  const cardBottom = tabBarHeight + ACTION_ROW_HEIGHT - 10;
  const availableCardHeight = SCREEN_HEIGHT - cardTop - cardBottom;
  const cardWidth = SCREEN_WIDTH - 20;

  const renderProfilesView = () => (
    <>
      <View style={[styles.headerInfo, { top: topBarTop }]}>
        <View style={styles.brandRowCenter}>
          <Image
            source={require("../../attached_assets/icon_1770366574583.png")}
            style={styles.brandLogoIcon}
            contentFit="cover"
          />
          <View style={styles.brandTextWrap}>
            <ThemedText style={styles.brandTextTop}>NOMAD</ThemedText>
            <ThemedText style={styles.brandTextBottom}>CONNECT</ThemedText>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.cardContainer,
          {
            top: cardTop,
            bottom: cardBottom,
          },
        ]}
      >
        {profiles
          .slice(0, 3)
          .reverse()
          .map((profile, index) => (
            <SwipeCard
              key={profile.user.id}
              user={profile.user}
              distance={profile.distance}
              isFirst={index === profiles.slice(0, 3).length - 1}
              onSwipeLeft={() => handleSwipeLeft(profile.user.id)}
              onSwipeRight={() => handleSwipeRight(profile.user.id)}
              cardWidth={cardWidth}
              cardHeight={availableCardHeight}
            />
          ))}
      </View>

      <View style={[styles.actions, { bottom: tabBarHeight + 10 }]}>
        <TinderButton
          icon="x"
          color={AppColors.sunsetRose}
          size={60}
          iconSize={28}
          onPress={() => {
            if (currentProfile) handleSwipeLeft(currentProfile.user.id);
          }}
          testID="button-pass"
        />
        <TinderButton
          icon="star"
          color={AppColors.sunsetGold}
          size={46}
          iconSize={20}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowLikedModal(true);
          }}
          testID="button-star"
        />
        <TinderButton
          icon="heart"
          color={AppColors.sunsetCoral}
          size={60}
          iconSize={28}
          onPress={() => {
            if (currentProfile) handleSwipeRight(currentProfile.user.id);
          }}
          testID="button-connect"
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.discoverDark : GradientPresets.discoverLight)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {profiles.length > 0 ? renderProfilesView() : renderEmptyState()}

      {showMatch ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.matchOverlay}
        >
          <LinearGradient
            colors={["#C2413A", "#E8744F", "#F4A261", "#E8744F", "#C2413A"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.matchBgHeart}>
            <Icon name="heart-filled" size={280} color="rgba(244,162,97,0.25)" />
          </View>

          <View style={styles.matchSparkles}>
            {[...Array(12)].map((_, i) => {
              const size = 8 + Math.random() * 16;
              const isHeart = i % 3 === 0;
              return (
                <Animated.View
                  key={i}
                  entering={FadeIn.delay(200 + i * 100).duration(600)}
                  style={[
                    styles.sparkle,
                    {
                      top: `${5 + Math.random() * 70}%`,
                      left: `${5 + Math.random() * 85}%`,
                    },
                  ]}
                >
                  {isHeart ? (
                    <Ionicons name="heart" size={size} color="rgba(255,255,255,0.5)" />
                  ) : (
                    <Icon name="star" size={size} color="rgba(255,255,255,0.6)" />
                  )}
                </Animated.View>
              );
            })}
          </View>

          <ScrollView 
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={[styles.matchContent, { flexGrow: 1, justifyContent: "center" }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View 
              entering={BounceIn.delay(200).duration(800)}
              style={styles.matchPhotos}
            >
              <View style={styles.matchPhotoGlow} />
              <View style={[styles.matchPhotoWrapper, { marginRight: -20, zIndex: 2, backgroundColor: "#FFFFFF", borderRadius: 60 }]}>
                <Image
                  source={user?.photos?.[0] ? { uri: user.photos[0] } : require("../../assets/images/default-avatar.png")}
                  style={styles.matchPhoto}
                  contentFit="cover"
                />
                <View style={styles.matchPhotoBorder} />
              </View>

              <Animated.View entering={BounceIn.delay(600).duration(600)} style={styles.matchHeartBetween}>
                <Ionicons name="heart" size={32} color="#FFFFFF" />
              </Animated.View>
              
              <View style={[styles.matchPhotoWrapper, { marginLeft: -20, zIndex: 1, backgroundColor: "#FFFFFF", borderRadius: 60 }]}>
                <Image
                  source={matchedPhoto ? { uri: matchedPhoto } : require("../../assets/images/default-avatar.png")}
                  style={styles.matchPhoto}
                  contentFit="cover"
                />
                <View style={styles.matchPhotoBorder} />
              </View>
            </Animated.View>

            <MatchTitle />

            <Animated.View entering={FadeInDown.delay(700).springify()}>
              <ThemedText style={styles.matchSubtitle}>
                You and {matchedName} liked each other
              </ThemedText>
            </Animated.View>

            <Animated.View 
              entering={FadeInDown.delay(900).springify()}
              style={styles.matchActions}
            >
              <Pressable 
                style={styles.matchButton}
                onPress={handleSendMessage}
              >
                <Ionicons name="chatbubble-outline" size={20} color={AppColors.sunsetCoral} />
                <ThemedText style={styles.matchButtonText}>Send Message</ThemedText>
              </Pressable>

              <Pressable 
                style={styles.matchCompatBtn}
                onPress={() => setShowCompatibility(!showCompatibility)}
              >
                <Ionicons name="heart-half-outline" size={18} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.matchCompatBtnText}>
                  {showCompatibility ? "Hide" : "Check"} Compatibility
                </ThemedText>
              </Pressable>
              
              <Pressable 
                style={styles.matchButtonSecondary}
                onPress={() => { setShowMatch(false); setShowCompatibility(false); }}
              >
                <ThemedText style={styles.matchButtonSecondaryText}>Keep Swiping</ThemedText>
              </Pressable>
            </Animated.View>

            {showCompatibility && matchedUserData && (
              <Animated.View entering={FadeInDown.delay(200).springify()} style={{ marginTop: 16, width: "100%", paddingHorizontal: 4 }}>
                <CompatibilityCard
                  matchedUserId={matchedUserData.id || matchedId}
                  matchedUserProfile={{
                    name: matchedUserData.name || matchedName,
                    age: matchedUserData.age,
                    bio: matchedUserData.bio,
                    interests: matchedUserData.interests,
                    location: matchedUserData.location,
                    photos: matchedUserData.photos,
                  }}
                  compact
                  onClose={() => setShowCompatibility(false)}
                />
              </Animated.View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      ) : null}

      <Modal
        visible={showLikedModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLikedModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Liked Profiles</ThemedText>
            <Pressable onPress={() => setShowLikedModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          
          <FlatList
            data={likedProfiles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.likedList}
            ListEmptyComponent={
              <View style={styles.likedEmpty}>
                <Icon name="star" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  No liked profiles yet
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
                  Swipe right on profiles to see them here
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.likedCard, { backgroundColor: theme.cardBackground }]}>
                <Image
                  source={item?.photos?.[0] ? { uri: item.photos[0] } : require("../../assets/images/default-avatar.png")}
                  style={styles.likedPhoto}
                  contentFit="cover"
                />
                <View style={styles.likedInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {item.name}, {item.age}
                  </ThemedText>
                  <View style={styles.likedLocation}>
                    <Icon name="map-pin" size={12} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                      {item.location}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.likedStatus}>
                  <Icon name="clock" size={16} color={AppColors.accent} />
                  <ThemedText type="small" style={{ color: AppColors.accent, marginLeft: 4 }}>
                    Pending
                  </ThemedText>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  brandRowCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandLogoIcon: {
    height: 36,
    width: 36,
    borderRadius: 8,
  },
  brandTextWrap: {
    flexDirection: "column",
  },
  brandTextTop: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#E8744F",
    letterSpacing: 1.5,
    lineHeight: 15,
  },
  brandTextBottom: {
    fontSize: 16,
    fontWeight: "900" as const,
    color: "#F4A261",
    letterSpacing: 1,
    lineHeight: 18,
  },
  upgradeButton: {
    borderRadius: 22,
    overflow: "visible",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  upgradeGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 26,
    backgroundColor: "rgba(255, 215, 0, 0.25)",
  },
  upgradeGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 5,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tinderBtn: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  cardContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  likedBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: AppColors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  likedBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700" as const,
  },
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  matchBgHeart: {
    position: "absolute",
    top: "15%",
    alignSelf: "center",
    opacity: 0.6,
  },
  matchSparkles: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    position: "absolute",
  },
  matchContent: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: 0,
    paddingBottom: Spacing.xl,
    width: "100%",
  },
  matchHeader: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: Spacing.md,
  },
  matchPhotos: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    position: "relative",
  },
  matchPhotoGlow: {
    position: "absolute",
    width: 280,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignSelf: "center",
  },
  matchHeartBetween: {
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.sunsetCoral,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    marginHorizontal: -22,
  },
  matchPhotoWrapper: {
    position: "relative",
  },
  matchPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  matchPhotoBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
  matchTitleSmall: {
    fontWeight: "900" as const,
    fontSize: 24,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 3,
    textTransform: "uppercase" as const,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  matchTitleBig: {
    fontWeight: "900" as const,
    fontSize: 72,
    color: "#FFFFFF",
    marginTop: -4,
    letterSpacing: 6,
    textTransform: "uppercase" as const,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  matchSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  matchActions: {
    width: "100%",
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  matchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  matchButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: AppColors.sunsetCoral,
  },
  matchCompatBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  matchCompatBtnText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  matchButtonSecondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  matchButtonSecondaryText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "rgba(255,255,255,0.8)",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyHero: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  tipsSection: {
    marginBottom: Spacing.xl,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  tipIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  tipTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  quoteSection: {
    marginBottom: Spacing.lg,
  },
  quoteCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  quoteText: {
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 24,
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
  },
  likedList: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  likedEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  likedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  likedPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  likedInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  likedLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  likedStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
});
