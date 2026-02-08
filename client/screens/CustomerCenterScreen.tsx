import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/context/SubscriptionContext";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { getCustomerInfo } from "@/services/revenuecat";

export default function CustomerCenterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const {
    tier,
    customerInfo,
    restorePurchases,
    refreshSubscriptionStatus,
    isConfigured,
  } = useSubscription();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tierName =
    tier === "free"
      ? "Starter (Free)"
      : tier === "pro"
        ? "Explorer ($6.99/mo)"
        : tier === "expert"
          ? "Legend ($14.99/mo)"
          : "Lifetime";

  const tierGradient: [string, string] =
    tier === "free"
      ? ["#9CA3AF", "#607D8B"]
      : tier === "pro"
        ? ["#FF8C42", "#EA580C"]
        : tier === "expert"
          ? ["#A78BFA", "#7C3AED"]
          : ["#F59E0B", "#B45309"];

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (error) {
      Alert.alert("Error", "Could not restore purchases.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSubscriptionStatus();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log("Refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManageSubscription = () => {
    if (customerInfo?.managementURL) {
      Linking.openURL(customerInfo.managementURL);
    } else if (Platform.OS === "ios") {
      Linking.openURL("https://apps.apple.com/account/subscriptions");
    } else if (Platform.OS === "android") {
      Linking.openURL(
        "https://play.google.com/store/account/subscriptions",
      );
    } else {
      Alert.alert(
        "Manage Subscription",
        "Open your app store to manage your subscription.",
      );
    }
  };

  const activeEntitlements = customerInfo
    ? Object.entries(customerInfo.entitlements.active).map(([key, val]) => ({
        name: key,
        productId: val.productIdentifier,
        expiresDate: val.expirationDate,
        isActive: val.isActive,
        willRenew: val.willRenew,
      }))
    : [];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0F0D0B" : "#FFF9F5" },
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ["#1A1510", "#0F0D0B", "#0F0D0B"]
            : ["#FFF3E8", "#FFF9F5", "#FFF9F5"]
        }
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 30,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50)} style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
            hitSlop={20}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Subscription
          </ThemedText>
          <View style={{ width: 38 }} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)}>
          <View
            style={[
              styles.planCard,
              {
                backgroundColor: isDark ? "#1C1814" : "#FFFFFF",
                borderColor: tierGradient[0] + "30",
              },
            ]}
          >
            <LinearGradient
              colors={tierGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planIconBg}
            >
              <Ionicons
                name={
                  tier === "free"
                    ? "compass-outline"
                    : tier === "pro"
                      ? "flame-outline"
                      : tier === "expert"
                        ? "diamond-outline"
                        : "infinite-outline"
                }
                size={28}
                color="#FFF"
              />
            </LinearGradient>
            <ThemedText style={[styles.planName, { color: theme.text }]}>
              {tierName}
            </ThemedText>
            <ThemedText
              style={[styles.planStatus, { color: theme.textSecondary }]}
            >
              {tier === "free"
                ? "No active subscription"
                : "Active subscription"}
            </ThemedText>
          </View>
        </Animated.View>

        {activeEntitlements.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150)}>
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark ? "#1C1814" : "#FFFFFF",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Active Entitlements
              </ThemedText>
              {activeEntitlements.map((ent, i) => (
                <View key={i} style={styles.entitlementRow}>
                  <View style={styles.entitlementLeft}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={AppColors.success}
                    />
                    <View>
                      <ThemedText
                        style={[
                          styles.entitlementName,
                          { color: theme.text },
                        ]}
                      >
                        {ent.name}
                      </ThemedText>
                      {ent.expiresDate && (
                        <ThemedText
                          style={{
                            color: theme.textSecondary,
                            fontSize: 12,
                          }}
                        >
                          {ent.willRenew ? "Renews" : "Expires"}:{" "}
                          {new Date(ent.expiresDate).toLocaleDateString()}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200)}>
          <View
            style={[
              styles.section,
              {
                backgroundColor: isDark ? "#1C1814" : "#FFFFFF",
                borderColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Actions
            </ThemedText>

            {tier === "free" && (
              <Pressable
                style={styles.actionRow}
                onPress={() => navigation.navigate("Subscription" as never)}
              >
                <View style={styles.actionLeft}>
                  <Ionicons
                    name="rocket-outline"
                    size={20}
                    color={AppColors.primary}
                  />
                  <ThemedText style={{ color: theme.text }}>
                    Upgrade Plan
                  </ThemedText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            )}

            {tier !== "free" && (
              <Pressable
                style={styles.actionRow}
                onPress={handleManageSubscription}
              >
                <View style={styles.actionLeft}>
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={theme.text}
                  />
                  <ThemedText style={{ color: theme.text }}>
                    Manage in App Store
                  </ThemedText>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            )}

            <Pressable
              style={styles.actionRow}
              onPress={handleRestore}
              disabled={isRestoring}
            >
              <View style={styles.actionLeft}>
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={theme.text}
                />
                <ThemedText style={{ color: theme.text }}>
                  {isRestoring ? "Restoring..." : "Restore Purchases"}
                </ThemedText>
              </View>
              {isRestoring && (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              )}
            </Pressable>

            <Pressable
              style={styles.actionRow}
              onPress={handleRefresh}
              disabled={isRefreshing}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="sync-outline" size={20} color={theme.text} />
                <ThemedText style={{ color: theme.text }}>
                  {isRefreshing ? "Refreshing..." : "Refresh Status"}
                </ThemedText>
              </View>
              {isRefreshing && (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              )}
            </Pressable>
          </View>
        </Animated.View>

        {customerInfo && (
          <Animated.View entering={FadeInDown.delay(250)}>
            <View
              style={[
                styles.section,
                {
                  backgroundColor: isDark ? "#1C1814" : "#FFFFFF",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Account Info
              </ThemedText>
              <View style={styles.infoRow}>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                  First Seen
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 13 }}>
                  {customerInfo.firstSeen
                    ? new Date(customerInfo.firstSeen).toLocaleDateString()
                    : "N/A"}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300)}>
          <ThemedText
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Need help? Contact support at support@nomadconnect.app
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  planCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 20,
  },
  planIconBg: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  planName: {
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  planStatus: {
    fontSize: 14,
  },
  section: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 14,
  },
  entitlementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  entitlementLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  entitlementName: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  footerText: {
    textAlign: "center" as const,
    fontSize: 13,
    marginTop: 10,
    opacity: 0.6,
  },
});
