import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

export default function AIPhotoAnalysisScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setAnalysis(null);

      if (result.assets[0].base64) {
        analyzeImage(result.assets[0].base64);
      }
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setAnalysis(null);

      if (result.assets[0].base64) {
        analyzeImage(result.assets[0].base64);
      }
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsLoading(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const response = await fetch(
        new URL("/api/ai/analyze-photo", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType: "image/jpeg",
          }),
        }
      );

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysis("Sorry, I couldn't analyze this image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setAnalysis(null);
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
        {selectedImage ? (
          <>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.selectedImage}
                contentFit="cover"
              />
              <Pressable
                style={styles.clearButton}
                onPress={clearImage}
              >
                <Icon name="x" size={20} color="#FFF" />
              </Pressable>
            </View>

            {isLoading ? (
              <View
                style={[
                  styles.analysisContainer,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <ActivityIndicator size="large" color={AppColors.primary} />
                <ThemedText style={styles.loadingText}>
                  Analyzing your van build...
                </ThemedText>
              </View>
            ) : analysis ? (
              <View
                style={[
                  styles.analysisContainer,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <View style={styles.analysisHeader}>
                  <Icon name="cpu" size={20} color={AppColors.primary} />
                  <ThemedText style={styles.analysisTitle}>
                    AI Analysis
                  </ThemedText>
                </View>
                <ThemedText style={styles.analysisText}>{analysis}</ThemedText>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconContainer,
                { backgroundColor: theme.cardBackground },
              ]}
            >
              <Icon name="camera" size={48} color={AppColors.primary} />
            </View>
            <ThemedText style={styles.emptyTitle}>
              Analyze Your Van Build
            </ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Upload a photo of your van conversion and get AI-powered feedback
              on your work, safety suggestions, and improvement tips.
            </ThemedText>

            <View style={styles.buttonsContainer}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: AppColors.primary }]}
                onPress={takePhoto}
              >
                <Icon name="camera" size={22} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>
                  Take Photo
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.cardBackground },
                ]}
                onPress={pickImage}
              >
                <Icon name="image" size={22} color={AppColors.primary} />
                <ThemedText
                  style={[styles.actionButtonText, { color: theme.text }]}
                >
                  Choose from Gallery
                </ThemedText>
              </Pressable>
            </View>

            <View
              style={[styles.tipCard, { backgroundColor: theme.cardBackground }]}
            >
              <View style={styles.tipHeader}>
                <Icon name="info" size={16} color={AppColors.primary} />
                <ThemedText style={styles.tipTitle}>Tips for best results</ThemedText>
              </View>
              <ThemedText style={styles.tipText}>
                {"\u2022"} Take clear, well-lit photos{"\n"}
                {"\u2022"} Include the area you want analyzed{"\n"}
                {"\u2022"} Multiple angles help for complex areas{"\n"}
                {"\u2022"} Close-ups work best for electrical/wiring
              </ThemedText>
            </View>
          </View>
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
  emptyContainer: {
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  buttonsContainer: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  selectedImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  clearButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  analysisContainer: {
    padding: Spacing.lg,
    borderRadius: 16,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: AppColors.primary,
  },
  analysisText: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.9,
  },
  loadingText: {
    fontSize: 16,
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  tipCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: 16,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: AppColors.primary,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.7,
  },
});
