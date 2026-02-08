import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const VAN_TYPES = [
  "Sprinter",
  "Transit",
  "ProMaster",
  "Econoline",
  "Skoolie",
  "Other",
];

const BUILD_LEVELS = [
  { id: "basic", label: "Basic", description: "Bed, basic electrical" },
  { id: "standard", label: "Standard", description: "Kitchen, solar, storage" },
  { id: "full", label: "Full Build", description: "Bathroom, A/C, premium finishes" },
];

const FEATURES = [
  { id: "solar", label: "Solar System", icon: "sun" as const },
  { id: "shore", label: "Shore Power", icon: "zap" as const },
  { id: "water", label: "Fresh Water Tank", icon: "droplet" as const },
  { id: "shower", label: "Shower", icon: "cloud-rain" as const },
  { id: "toilet", label: "Toilet", icon: "home" as const },
  { id: "heater", label: "Diesel Heater", icon: "thermometer" as const },
  { id: "ac", label: "Air Conditioning", icon: "wind" as const },
  { id: "fridge", label: "12V Fridge", icon: "box" as const },
];

export default function AICostEstimatorScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [vanType, setVanType] = useState("");
  const [buildLevel, setBuildLevel] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [estimate, setEstimate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureId)
        ? prev.filter((f) => f !== featureId)
        : [...prev, featureId]
    );
  };

  const getEstimate = async () => {
    if (!vanType || !buildLevel) return;

    setIsLoading(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const featureNames = selectedFeatures
      .map((id) => FEATURES.find((f) => f.id === id)?.label)
      .filter(Boolean);

    const vanDetails = `
Van Type: ${vanType}
Build Level: ${BUILD_LEVELS.find((b) => b.id === buildLevel)?.label} (${BUILD_LEVELS.find((b) => b.id === buildLevel)?.description})
Selected Features: ${featureNames.length > 0 ? featureNames.join(", ") : "None specified"}
Additional Notes: ${additionalNotes || "None"}
    `.trim();

    try {
      const response = await fetch(
        new URL("/api/ai/estimate-cost", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vanDetails }),
        }
      );

      if (!response.ok) throw new Error("Estimation failed");

      const data = await response.json();
      setEstimate(data.estimate);
    } catch (error) {
      console.error("Estimation error:", error);
      setEstimate("Sorry, I couldn't generate an estimate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setVanType("");
    setBuildLevel("");
    setSelectedFeatures([]);
    setAdditionalNotes("");
    setEstimate(null);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {estimate ? (
          <>
            <View
              style={[
                styles.estimateContainer,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <View style={styles.estimateHeader}>
                <View style={styles.estimateIconBg}>
                  <Icon name="dollar-sign" size={24} color="#FFF" />
                </View>
                <ThemedText style={styles.estimateTitle}>
                  Your Build Estimate
                </ThemedText>
              </View>
              <ThemedText style={styles.estimateText}>{estimate}</ThemedText>
            </View>

            <Pressable
              style={[styles.resetButton, { backgroundColor: theme.cardBackground }]}
              onPress={resetForm}
            >
              <Icon name="refresh-cw" size={18} color={AppColors.primary} />
              <ThemedText style={styles.resetButtonText}>
                Start New Estimate
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerIconBg}>
                <Icon name="dollar-sign" size={28} color="#FFF" />
              </View>
              <ThemedText style={styles.subtitle}>
                Get a detailed breakdown of what your van conversion might cost
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Van Type</ThemedText>
              <View style={styles.optionsRow}>
                {VAN_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor:
                          vanType === type
                            ? AppColors.primary
                            : theme.cardBackground,
                      },
                    ]}
                    onPress={() => setVanType(type)}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        { color: vanType === type ? "#FFF" : theme.text },
                      ]}
                    >
                      {type}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Build Level</ThemedText>
              {BUILD_LEVELS.map((level) => (
                <Pressable
                  key={level.id}
                  style={[
                    styles.buildLevelCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor:
                        buildLevel === level.id
                          ? AppColors.primary
                          : "transparent",
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setBuildLevel(level.id)}
                >
                  <View style={styles.radioContainer}>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor:
                            buildLevel === level.id
                              ? AppColors.primary
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {buildLevel === level.id && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                  </View>
                  <View style={styles.buildLevelContent}>
                    <ThemedText style={styles.buildLevelLabel}>
                      {level.label}
                    </ThemedText>
                    <ThemedText style={styles.buildLevelDesc}>
                      {level.description}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Features</ThemedText>
              <View style={styles.featuresGrid}>
                {FEATURES.map((feature) => (
                  <Pressable
                    key={feature.id}
                    style={[
                      styles.featureChip,
                      {
                        backgroundColor: selectedFeatures.includes(feature.id)
                          ? AppColors.primary
                          : theme.cardBackground,
                      },
                    ]}
                    onPress={() => toggleFeature(feature.id)}
                  >
                    <Icon
                      name={feature.icon}
                      size={16}
                      color={
                        selectedFeatures.includes(feature.id)
                          ? "#FFF"
                          : AppColors.primary
                      }
                    />
                    <ThemedText
                      style={[
                        styles.featureText,
                        {
                          color: selectedFeatures.includes(feature.id)
                            ? "#FFF"
                            : theme.text,
                        },
                      ]}
                    >
                      {feature.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Additional Notes (optional)
              </ThemedText>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: theme.cardBackground,
                    color: theme.text,
                  },
                ]}
                placeholder="E.g., I want a queen bed, need workspace for laptop..."
                placeholderTextColor={theme.textSecondary}
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={[
                styles.estimateButton,
                {
                  backgroundColor:
                    vanType && buildLevel
                      ? AppColors.primary
                      : theme.textSecondary,
                },
              ]}
              onPress={getEstimate}
              disabled={!vanType || !buildLevel || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Icon name="cpu" size={20} color="#FFF" />
                  <ThemedText style={styles.estimateButtonText}>
                    Get AI Estimate
                  </ThemedText>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  buildLevelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  radioContainer: {
    width: 24,
    alignItems: "center",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.primary,
  },
  buildLevelContent: {
    flex: 1,
  },
  buildLevelLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  buildLevelDesc: {
    fontSize: 13,
    opacity: 0.7,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    gap: Spacing.xs,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "500",
  },
  notesInput: {
    padding: Spacing.md,
    borderRadius: 12,
    fontSize: 15,
    minHeight: 100,
  },
  estimateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  estimateButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFF",
  },
  estimateContainer: {
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.lg,
  },
  estimateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  estimateIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  estimateTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  estimateText: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.9,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.primary,
  },
});
