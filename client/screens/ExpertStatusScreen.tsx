import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { AppColors, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={scoreStyles.container}>
      <View style={scoreStyles.labelRow}>
        <ThemedText style={[scoreStyles.label, { color: theme.text }]}>{label}</ThemedText>
        <ThemedText style={[scoreStyles.value, { color }]}>{score}/100</ThemedText>
      </View>
      <View style={[scoreStyles.track, { backgroundColor: theme.border }]}>
        <View style={[scoreStyles.fill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "500" },
  value: { fontSize: 13, fontWeight: "700" },
  track: { height: 6, borderRadius: 3 },
  fill: { height: 6, borderRadius: 3 },
});

export default function ExpertStatusScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/expert/status", user?.id],
    queryFn: async () => {
      const res = await fetch(new URL(`/api/expert/status/${user?.id}`, getApiUrl()).toString());
      return res.json();
    },
    enabled: !!user?.id,
  });

  const app = data?.application;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#10B981";
      case "pending": return "#F59E0B";
      case "manual_review": return "#3B82F6";
      case "rejected": return AppColors.danger;
      default: return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: string): any => {
    switch (status) {
      case "approved": return "check";
      case "pending": return "clock";
      case "manual_review": return "eye";
      case "rejected": return "x-circle";
      default: return "help-circle";
    }
  };

  const getBadgeInfo = (badge: string) => {
    if (badge === "pro_expert") return { label: "Pro Expert", colors: ["#FFD700", "#FFA500"] as const, icon: "star" as const };
    if (badge === "expert") return { label: "Expert", colors: ["#FF8C42", "#FF6432"] as const, icon: "tool" as const };
    return { label: "None", colors: [theme.border, theme.border] as readonly [string, string], icon: "help-circle" as const };
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </ThemedView>
    );
  }

  if (!app) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Icon name="file" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Application Found</ThemedText>
          <ThemedText style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            You haven't submitted an expert application yet.
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("ApplyAsExpert")} style={styles.applyBtn}>
            <LinearGradient
              colors={[AppColors.primary, AppColors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyGradient}
            >
              <ThemedText style={styles.applyText}>Apply Now</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const statusColor = getStatusColor(app.status);
  const statusIcon = getStatusIcon(app.status);
  const badgeInfo = getBadgeInfo(app.expert_badge);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Application Status</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.statusCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.statusIconBg, { backgroundColor: statusColor + "20" }]}>
              <Icon name={statusIcon} size={28} color={statusColor} />
            </View>
            <ThemedText style={[styles.statusLabel, { color: statusColor }]}>
              {app.status === "approved" ? "Approved" :
               app.status === "pending" ? "Pending Review" :
               app.status === "manual_review" ? "Under Manual Review" : "Rejected"}
            </ThemedText>
            {app.expert_badge && app.expert_badge !== "none" && (
              <LinearGradient
                colors={badgeInfo.colors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgePill}
              >
                <Icon name={badgeInfo.icon} size={14} color="#FFF" />
                <ThemedText style={styles.badgeText}>{badgeInfo.label}</ThemedText>
              </LinearGradient>
            )}
          </View>
        </Animated.View>

        {app.ai_score != null && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={[styles.scoreCard, { backgroundColor: theme.cardBackground }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>AI Verification Scores</ThemedText>
              <View style={styles.overallScore}>
                <ThemedText style={[styles.overallNumber, { color: AppColors.primary }]}>{app.ai_score}</ThemedText>
                <ThemedText style={[styles.overallLabel, { color: theme.textSecondary }]}>/100 Overall</ThemedText>
              </View>
              <ScoreBar label="Portfolio" score={app.portfolio_score || 0} color="#10B981" />
              <ScoreBar label="Resume" score={app.resume_score || 0} color="#3B82F6" />
              <ScoreBar label="Skill Alignment" score={app.skill_alignment_score || 0} color="#8B5CF6" />
              <ScoreBar label="Experience" score={app.experience_score || 0} color="#F59E0B" />
            </View>
          </Animated.View>
        )}

        {app.reasons && (app.reasons as string[]).length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={[styles.reasonsCard, { backgroundColor: theme.cardBackground }]}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Feedback</ThemedText>
              {(app.reasons as string[]).map((reason: string, i: number) => (
                <View key={i} style={styles.reasonRow}>
                  <Icon name="info" size={14} color={AppColors.primary} />
                  <ThemedText style={[styles.reasonText, { color: theme.text }]}>{reason}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {app.advice && (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <View style={[styles.adviceCard, { backgroundColor: theme.cardBackground }]}>
              <Icon name="sparkles" size={20} color={AppColors.primary} />
              <ThemedText style={[styles.adviceText, { color: theme.text }]}>{app.advice}</ThemedText>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <View style={[styles.detailsCard, { backgroundColor: theme.cardBackground }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Application Details</ThemedText>
            <DetailRow label="Specialization" value={app.specialization} theme={theme} />
            <DetailRow label="Experience" value={`${app.experience_years} years`} theme={theme} />
            <DetailRow label="Hourly Rate" value={`$${app.hourly_rate}/hr`} theme={theme} />
            <DetailRow label="Skills" value={(app.skills as string[])?.join(", ") || ""} theme={theme} />
            <DetailRow label="Portfolio" value={`${(app.portfolio_urls as string[])?.length || 0} photos`} theme={theme} />
            <DetailRow label="Submitted" value={new Date(app.created_at).toLocaleDateString()} theme={theme} />
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[styles.detailValue, { color: theme.text }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  statusCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statusIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  statusLabel: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  scoreCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.md },
  overallScore: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.lg,
  },
  overallNumber: { fontSize: 42, fontWeight: "800" },
  overallLabel: { fontSize: 16, fontWeight: "500", marginLeft: 6 },
  reasonsCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  reasonRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reasonText: { fontSize: 14, lineHeight: 20, flex: 1 },
  adviceCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  adviceText: { fontSize: 14, lineHeight: 20, flex: 1 },
  detailsCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  detailLabel: { fontSize: 13, fontWeight: "500" },
  detailValue: { fontSize: 13, fontWeight: "600", maxWidth: "60%" as any, textAlign: "right" as const },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: Spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  applyBtn: { borderRadius: 14, overflow: "hidden", marginTop: Spacing.md },
  applyGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  applyText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
