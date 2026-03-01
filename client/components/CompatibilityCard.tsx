import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { getApiUrl } from "@/lib/query-client";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CompatibilityResult {
  score: number;
  strengths: string[];
  conflicts: string[];
  icebreakers: string[];
  first_message: string;
  date_idea: string;
}

interface CompatibilityCardProps {
  matchedUserId: string;
  matchedUserProfile: {
    name: string;
    age?: number;
    bio?: string;
    interests?: string[];
    location?: string;
    photos?: string[];
  };
  compact?: boolean;
  onClose?: () => void;
}

export function CompatibilityCard({
  matchedUserId,
  matchedUserProfile,
  compact = false,
  onClose,
}: CompatibilityCardProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const navigation = useNavigation<any>();
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const pulseAnim = useSharedValue(1);
  const scoreProgress = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const scoreBarStyle = useAnimatedStyle(() => ({
    width: `${scoreProgress.value}%` as any,
  }));


  const buildLocalFallbackResult = (): CompatibilityResult => {
    const aInterests = new Set((user?.interests || []).map((i) => i.toLowerCase()));
    const bInterests = (matchedUserProfile.interests || []).map((i) => i.toLowerCase());
    const common = bInterests.filter((i) => aInterests.has(i));
    const base = 55;
    const score = Math.min(95, base + common.length * 8);
    return {
      score,
      strengths: common.length > 0 ? common.slice(0, 3).map((i) => `Both enjoy ${i}`) : ["Both are open to exploring new places"],
      conflicts: ["Preferred travel pace may differ"],
      icebreakers: [
        "What kind of trip gives you the most energy?",
        "What's one destination on your must-visit list?",
      ],
      first_message: `Hey ${matchedUserProfile.name}, looks like we might vibe. Want to plan something fun?`,
      date_idea: "Coffee + sunset walk at a nearby scenic spot",
    };
  };

  const checkCompatibility = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/compatibility/check", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAId: user.id,
          userBId: matchedUserId,
          userAProfile: {
            name: user.name,
            age: user.age,
            bio: user.bio,
            interests: user.interests,
            location: user.location,
            photos: user.photos,
          },
          userBProfile: matchedUserProfile,
          tier,
        }),
      });

      if (response.status === 403) {
        const data = await response.json();
        setLimitReached(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({} as any));
        throw new Error(body?.error || "Failed to check compatibility");
      }

      const data = await response.json();
      const compatResult = data.result;

      setResult({
        score: compatResult.score,
        strengths: compatResult.strengths || [],
        conflicts: compatResult.conflicts || [],
        icebreakers: compatResult.icebreakers || [],
        first_message: compatResult.first_message || "",
        date_idea: compatResult.date_idea || "",
      });

      scoreProgress.value = withSpring(compatResult.score, {
        damping: 15,
        stiffness: 80,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const fallback = buildLocalFallbackResult();
      setResult(fallback);
      scoreProgress.value = withSpring(fallback.score, {
        damping: 15,
        stiffness: 80,
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FF8C42";
    if (score >= 40) return "#F9A826";
    return "#D4503A";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Amazing Match";
    if (score >= 70) return "Great Match";
    if (score >= 55) return "Good Match";
    if (score >= 40) return "Okay Match";
    return "Low Match";
  };

  const handleUpgrade = () => {
    navigation.navigate("Subscription");
  };

  if (limitReached) {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <LinearGradient
          colors={isDark ? ["#29231F", "#1F1B18"] : ["#FFF4EB", "#FFFFFF"]}
          style={[styles.card, compact && styles.cardCompact]}
        >
          <View style={styles.limitHeader}>
            <Ionicons name="lock-closed" size={28} color="#FF8C42" />
            <ThemedText style={[styles.limitTitle, { color: theme.text }]}>
              Daily Limit Reached
            </ThemedText>
          </View>
          <ThemedText style={[styles.limitText, { color: theme.textSecondary }]}>
            Choose your plan to get more info about plans
          </ThemedText>
          <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
            <LinearGradient
              colors={["#FF8C42", "#F9A826"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeGradient}
            >
              <ThemedText style={styles.upgradeText}>View Plans</ThemedText>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  if (!result && !loading) {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <Pressable onPress={checkCompatibility}>
          <LinearGradient
            colors={isDark ? ["#29231F", "#1F1B18"] : ["#FFF4EB", "#FFFFFF"]}
            style={[styles.card, compact && styles.cardCompact, styles.checkCard]}
          >
            <Animated.View style={pulseStyle}>
              <LinearGradient
                colors={["#FF8C42", "#F9A826"]}
                style={styles.checkIconBg}
              >
                <Ionicons name="heart-half-outline" size={24} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            <ThemedText style={[styles.checkTitle, { color: theme.text }]}>
              Check Compatibility
            </ThemedText>
            <ThemedText style={[styles.checkSubtitle, { color: theme.textSecondary }]}>
              AI-powered analysis with {matchedUserProfile.name}
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (loading) {
    return (
      <Animated.View entering={FadeIn.duration(200)}>
        <LinearGradient
          colors={isDark ? ["#29231F", "#1F1B18"] : ["#FFF4EB", "#FFFFFF"]}
          style={[styles.card, compact && styles.cardCompact, styles.loadingCard]}
        >
          <ActivityIndicator size="large" color="#FF8C42" />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Analyzing compatibility...
          </ThemedText>
        </LinearGradient>
      </Animated.View>
    );
  }

  if (error) {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <LinearGradient
          colors={isDark ? ["#29231F", "#1F1B18"] : ["#FFF4EB", "#FFFFFF"]}
          style={[styles.card, compact && styles.cardCompact]}
        >
          <ThemedText style={{ color: AppColors.danger, textAlign: "center" }}>{error}</ThemedText>
          <Pressable onPress={checkCompatibility} style={styles.retryBtn}>
            <ThemedText style={{ color: "#FF8C42" }}>Try Again</ThemedText>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  if (!result) return null;

  return (
    <Animated.View entering={FadeInDown.delay(200).springify()}>
      <LinearGradient
        colors={isDark ? ["#29231F", "#1F1B18"] : ["#FFF4EB", "#FFFFFF"]}
        style={[styles.card, compact && styles.cardCompact]}
      >
        {onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        )}

        <View style={styles.scoreSection}>
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={[styles.scoreBadge, { borderColor: getScoreColor(result.score) }]}>
              <ThemedText style={[styles.scoreNumber, { color: isDark ? "#FFFFFF" : getScoreColor(result.score) }]}>
                {result.score}%
              </ThemedText>
            </View>
          </Animated.View>
          <ThemedText style={[styles.scoreLabel, { color: isDark ? "#FFFFFF" : getScoreColor(result.score) }]}>
            {getScoreLabel(result.score)}
          </ThemedText>

          <View style={[styles.scoreBarBg, { backgroundColor: isDark ? "#3D352F" : "#E8E0D8" }]}>
            <Animated.View
              style={[
                styles.scoreBarFill,
                scoreBarStyle,
                { backgroundColor: getScoreColor(result.score) },
              ]}
            />
          </View>
        </View>

        {!compact && (
          <>
            {result.strengths.length > 0 && (
              <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={16} color="#4CAF50" />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    Strengths
                  </ThemedText>
                </View>
                {result.strengths.map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: "#4CAF50" }]} />
                    <ThemedText style={[styles.bulletText, { color: theme.textSecondary }]}>
                      {s}
                    </ThemedText>
                  </View>
                ))}
              </Animated.View>
            )}

            {result.conflicts.length > 0 && (
              <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F9A826" />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    Watch Out For
                  </ThemedText>
                </View>
                {result.conflicts.map((c, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: "#F9A826" }]} />
                    <ThemedText style={[styles.bulletText, { color: theme.textSecondary }]}>
                      {c}
                    </ThemedText>
                  </View>
                ))}
              </Animated.View>
            )}

            {result.icebreakers.length > 0 && (
              <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FF8C42" />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    Icebreakers
                  </ThemedText>
                </View>
                {result.icebreakers.map((ice, i) => (
                  <View key={i} style={[styles.iceCard, { backgroundColor: isDark ? "#3D352F" : "#FFF9F3" }]}>
                    <ThemedText style={[styles.iceText, { color: theme.text }]}>
                      "{ice}"
                    </ThemedText>
                  </View>
                ))}
              </Animated.View>
            )}

            {result.date_idea && (
              <Animated.View entering={FadeInDown.delay(700).springify()} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="compass-outline" size={16} color="#FF8C42" />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    Date Idea
                  </ThemedText>
                </View>
                <View style={[styles.ideaCard, { backgroundColor: isDark ? "#3D352F" : "#FFF9F3" }]}>
                  <ThemedText style={[styles.ideaText, { color: theme.text }]}>
                    {result.date_idea}
                  </ThemedText>
                </View>
              </Animated.View>
            )}

            {result.first_message && (
              <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="mail-outline" size={16} color="#FF8C42" />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    Suggested First Message
                  </ThemedText>
                </View>
                <View style={[styles.messageCard]}>
                  <LinearGradient
                    colors={["#FF8C42", "#F9A826"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.messageBubble}
                  >
                    <ThemedText style={styles.messageText}>
                      {result.first_message}
                    </ThemedText>
                  </LinearGradient>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: "hidden",
  },
  cardCompact: {
    padding: 14,
    marginHorizontal: 0,
    marginVertical: 4,
  },
  checkCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  checkIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  checkTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  checkSubtitle: {
    fontSize: 13,
    textAlign: "center" as const,
  },
  loadingCard: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  closeBtn: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  scoreBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: "800" as const,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 10,
  },
  scoreBarBg: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  scoreBarFill: {
    height: 6,
    borderRadius: 3,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  bulletRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  bulletText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  iceCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  iceText: {
    fontSize: 13,
    fontStyle: "italic" as const,
    lineHeight: 18,
  },
  ideaCard: {
    borderRadius: 12,
    padding: 12,
  },
  ideaText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageCard: {
    alignItems: "flex-start",
  },
  messageBubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "85%",
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    alignItems: "center",
  },
  limitHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  limitTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginTop: 8,
  },
  limitText: {
    fontSize: 13,
    textAlign: "center" as const,
    marginBottom: 16,
  },
  upgradeButton: {
    alignSelf: "center",
  },
  upgradeGradient: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700" as const,
  },
});



