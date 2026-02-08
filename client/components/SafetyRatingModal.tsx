import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { GradientButton } from "@/components/GradientButton";
import { useTheme } from "@/hooks/useTheme";
import { Activity, SafetyRating } from "@/types";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: Omit<SafetyRating, "id" | "createdAt" | "ratedByUserId">) => void;
  activity: Activity | null;
}

export default function SafetyRatingModal({
  visible,
  onClose,
  onSubmit,
  activity,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [safetyScore, setSafetyScore] = useState(0);
  const [wasLocationPublic, setWasLocationPublic] = useState(false);
  const [hostWasTrustworthy, setHostWasTrustworthy] = useState(false);

  const handleSubmit = () => {
    if (safetyScore === 0 || !activity) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({
      activityId: activity.id,
      safetyScore,
      wasLocationPublic,
      hostWasTrustworthy,
    });
    
    setSafetyScore(0);
    setWasLocationPublic(false);
    setHostWasTrustworthy(false);
    onClose();
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSafetyScore(star);
            }}
            style={styles.starButton}
            testID={`button-star-${star}`}
          >
            <Icon
              name="star"
              size={36}
              color={star <= safetyScore ? AppColors.sunsetGold : theme.border}
              
            />
          </Pressable>
        ))}
      </View>
    );
  };

  const renderCheckbox = (
    label: string,
    checked: boolean,
    onToggle: () => void,
    testId: string
  ) => (
    <Pressable
      style={[
        styles.checkboxRow,
        { backgroundColor: checked ? `${AppColors.success}15` : theme.cardBackground },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      testID={testId}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? AppColors.success : "transparent",
            borderColor: checked ? AppColors.success : theme.border,
          },
        ]}
      >
        {checked ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
      </View>
      <ThemedText type="body" style={styles.checkboxLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: `${AppColors.primary}20` }]}>
              <Icon name="shield" size={28} color={AppColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.title}>
              Rate Your Safety Experience
            </ThemedText>
            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Help keep our community safe
            </ThemedText>
          </View>

          <View style={styles.content}>
            <ThemedText type="body" style={[styles.questionLabel, { color: theme.text }]}>
              Did you feel safe?
            </ThemedText>
            {renderStars()}

            <View style={styles.checkboxSection}>
              {renderCheckbox(
                "Was the location public?",
                wasLocationPublic,
                () => setWasLocationPublic(!wasLocationPublic),
                "checkbox-location-public"
              )}
              {renderCheckbox(
                "Host was trustworthy?",
                hostWasTrustworthy,
                () => setHostWasTrustworthy(!hostWasTrustworthy),
                "checkbox-host-trustworthy"
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <GradientButton
              onPress={handleSubmit}
              disabled={safetyScore === 0}
              style={styles.submitButton}
            >
              Submit Rating
            </GradientButton>
            <Pressable onPress={onClose} style={styles.skipButton}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Skip for now
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
  },
  content: {
    marginBottom: Spacing.lg,
  },
  questionLabel: {
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  starButton: {
    padding: Spacing.xs,
  },
  checkboxSection: {
    gap: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    flex: 1,
  },
  footer: {
    alignItems: "center",
    gap: Spacing.md,
  },
  submitButton: {
    width: "100%",
  },
  skipButton: {
    padding: Spacing.sm,
  },
});
