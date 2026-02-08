import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { getApiUrl } from "@/lib/query-client";
import { uploadPhoto } from "@/lib/upload";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import type { TravelVerificationResult, TravelBadge } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BADGE_CONFIG: Record<string, { color: string; gradient: [string, string]; label: string; icon: string }> = {
  nomad: { color: "#FF8C42", gradient: ["#FF8C42", "#E87330"], label: "Nomad", icon: "compass-outline" },
  adventurer: { color: "#F9A826", gradient: ["#F9A826", "#E89820"], label: "Adventurer", icon: "trail-sign-outline" },
  explorer: { color: "#FFD700", gradient: ["#FF8C42", "#FFD700"], label: "Explorer", icon: "earth" },
  vanlifer: { color: "#888", gradient: ["#666", "#888"], label: "Vanlifer", icon: "car-outline" },
};

type Step = "welcome" | "photos" | "questions" | "processing" | "result";

interface Props {
  onVerified: (badge?: string) => void;
  onExit?: () => void;
}

export default function TravelVerificationScreen({ onVerified, onExit }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("welcome");
  const [primaryPhoto, setPrimaryPhoto] = useState<string | null>(null);
  const [secondaryPhoto, setSecondaryPhoto] = useState<string | null>(null);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<TravelVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sunRotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (step === "processing") {
      sunRotation.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(0.9, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [step]);

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sunRotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const pickImage = async (isSecondary: boolean) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert({ type: "warning", title: "Permission Required", message: "Please allow access to your photos to continue." });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (isSecondary) {
        setSecondaryPhoto(result.assets[0].uri);
      } else {
        setPrimaryPhoto(result.assets[0].uri);
      }
    }
  };

  const handleSubmit = async () => {
    if (!primaryPhoto || !answer1.trim() || !answer2.trim()) {
      showAlert({ type: "warning", title: "Missing Info", message: "Please upload at least one photo and answer the first two questions." });
      return;
    }

    setStep("processing");
    setError(null);

    try {
      setIsUploading(true);
      let primaryUrl = primaryPhoto;
      let secondaryUrl = secondaryPhoto;

      try {
        const uploadResult = await uploadPhoto(primaryPhoto);
        primaryUrl = uploadResult.url;
      } catch {
        primaryUrl = `local_photo_${Date.now()}`;
      }

      if (secondaryPhoto) {
        try {
          const uploadResult2 = await uploadPhoto(secondaryPhoto);
          secondaryUrl = uploadResult2.url;
        } catch {
          secondaryUrl = `local_photo_secondary_${Date.now()}`;
        }
      }

      setIsUploading(false);

      const baseUrl = getApiUrl();
      const url = new URL("/api/verification/verify-travel", baseUrl);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          photoUrl: primaryUrl,
          secondaryPhotoUrl: secondaryUrl,
          answer1: answer1.trim(),
          answer2: answer2.trim(),
          answer3: answer3.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setResult(data);
      setStep("result");
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setStep("questions");
    }
  };

  const handleTryAgain = () => {
    setPrimaryPhoto(null);
    setSecondaryPhoto(null);
    setAnswer1("");
    setAnswer2("");
    setAnswer3("");
    setResult(null);
    setError(null);
    setStep("photos");
  };

  const renderWelcome = () => (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.stepContainer}>
      <View style={styles.welcomeIconWrap}>
        <LinearGradient
          colors={["#E8744F", "#F4A261"]}
          style={styles.welcomeIconBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="shield-checkmark" size={48} color="#FFF" />
        </LinearGradient>
      </View>
      <ThemedText style={[styles.welcomeTitle, { color: "#3D2213" }]}>
        Verify Your Travel Lifestyle
      </ThemedText>
      <ThemedText style={[styles.welcomeSubtitle, { color: "#6B4930" }]}>
        To keep Nomad Connect safe, please complete travel verification first.
      </ThemedText>

      <View style={styles.welcomeSteps}>
        {[
          { icon: "camera-outline", text: "Upload a travel photo" },
          { icon: "chatbubble-outline", text: "Answer 2-3 quick questions" },
          { icon: "sparkles", text: "AI verifies your lifestyle" },
        ].map((item, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(200 + i * 150).duration(400)}
            style={[styles.welcomeStepRow, { backgroundColor: "rgba(255,255,255,0.55)" }]}
          >
            <View style={[styles.stepNumberBg, { backgroundColor: "rgba(232,116,79,0.15)" }]}>
              <Ionicons name={item.icon as any} size={20} color={AppColors.primary} />
            </View>
            <ThemedText style={[styles.stepText, { color: "#3D2213" }]}>{item.text}</ThemedText>
          </Animated.View>
        ))}
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => setStep("photos")}
      >
        <LinearGradient
          colors={[AppColors.primary, "#F4A261"]}
          style={styles.primaryBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <ThemedText style={styles.primaryBtnText}>Start Verification</ThemedText>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </LinearGradient>
      </Pressable>

      {onExit && (
        <Pressable onPress={onExit} style={styles.exitBtn}>
          <ThemedText style={[styles.exitBtnText, { color: "#6B4930" }]}>Exit App</ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );

  const renderPhotos = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: "#3D2213" }]}>Upload Travel Photos</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: "#6B4930" }]}>
        Share photos from your travels - nature, monuments, adventures, or cultural sites
      </ThemedText>

      <Pressable
        style={[styles.photoCard, { borderColor: primaryPhoto ? AppColors.primary : "rgba(93,58,30,0.25)", backgroundColor: "rgba(255,255,255,0.5)" }]}
        onPress={() => pickImage(false)}
      >
        {primaryPhoto ? (
          <Image source={{ uri: primaryPhoto }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={36} color={AppColors.primary} />
            <ThemedText style={[styles.photoLabel, { color: "#3D2213" }]}>Upload a Travel Photo</ThemedText>
            <ThemedText style={[styles.photoHint, { color: "#6B4930" }]}>
              Nature, monuments, historic sites, outdoors
            </ThemedText>
          </View>
        )}
        {primaryPhoto && (
          <View style={styles.photoCheckmark}>
            <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
          </View>
        )}
      </Pressable>

      <Pressable
        style={[styles.photoCard, styles.photoCardSmall, { borderColor: secondaryPhoto ? AppColors.primary : "rgba(93,58,30,0.25)", backgroundColor: "rgba(255,255,255,0.5)" }]}
        onPress={() => pickImage(true)}
      >
        {secondaryPhoto ? (
          <Image source={{ uri: secondaryPhoto }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="add-circle-outline" size={28} color="#6B4930" />
            <ThemedText style={[styles.photoLabel, { color: "#6B4930", fontSize: 14 }]}>
              Add a Secondary Photo (Optional)
            </ThemedText>
          </View>
        )}
        {secondaryPhoto && (
          <View style={styles.photoCheckmark}>
            <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
          </View>
        )}
      </Pressable>

      <View style={styles.navRow}>
        <Pressable onPress={() => setStep("welcome")} style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
          <Ionicons name="arrow-back" size={20} color="#3D2213" />
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { flex: 1, marginLeft: 12, opacity: primaryPhoto ? 1 : 0.5 }]}
          onPress={() => primaryPhoto && setStep("questions")}
          disabled={!primaryPhoto}
        >
          <LinearGradient
            colors={[AppColors.primary, "#F4A261"]}
            style={styles.primaryBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <ThemedText style={styles.primaryBtnText}>Continue</ThemedText>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderQuestions = () => (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: "#3D2213" }]}>Travel Questions</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: "#6B4930" }]}>
        Tell us about your travel experiences
      </ThemedText>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning" size={18} color="#FF4444" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      <View style={styles.questionGroup}>
        <ThemedText style={[styles.questionLabel, { color: "#3D2213" }]}>
          What kind of places do you enjoy traveling to? *
        </ThemedText>
        <TextInput
          style={[styles.textArea, { backgroundColor: "rgba(255,255,255,0.6)", color: "#3D2213", borderColor: "rgba(93,58,30,0.2)" }]}
          placeholder="Mountains, forests, beaches, forts, temples, ancient places..."
          placeholderTextColor="#8B6543"
          value={answer1}
          onChangeText={setAnswer1}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.questionGroup}>
        <ThemedText style={[styles.questionLabel, { color: "#3D2213" }]}>
          Describe your most recent travel experience *
        </ThemedText>
        <TextInput
          style={[styles.textArea, { backgroundColor: "rgba(255,255,255,0.6)", color: "#3D2213", borderColor: "rgba(93,58,30,0.2)" }]}
          placeholder="Share details about a memorable trip..."
          placeholderTextColor="#8B6543"
          value={answer2}
          onChangeText={setAnswer2}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.questionGroup}>
        <ThemedText style={[styles.questionLabel, { color: "#6B4930" }]}>
          What do you usually carry when you travel? (Optional)
        </ThemedText>
        <TextInput
          style={[styles.textArea, { backgroundColor: "rgba(255,255,255,0.6)", color: "#3D2213", borderColor: "rgba(93,58,30,0.2)" }]}
          placeholder="Backpack, tent, camera, hiking boots..."
          placeholderTextColor="#8B6543"
          value={answer3}
          onChangeText={setAnswer3}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.navRow}>
        <Pressable onPress={() => setStep("photos")} style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
          <Ionicons name="arrow-back" size={20} color="#3D2213" />
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { flex: 1, marginLeft: 12, opacity: answer1.trim() && answer2.trim() ? 1 : 0.5 }]}
          onPress={handleSubmit}
          disabled={!answer1.trim() || !answer2.trim()}
        >
          <LinearGradient
            colors={[AppColors.primary, "#F4A261"]}
            style={styles.primaryBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <ThemedText style={styles.primaryBtnText}>Verify My Lifestyle</ThemedText>
            <Ionicons name="shield-checkmark" size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <Animated.View style={[styles.sunWrap, sunStyle]}>
        <LinearGradient
          colors={["#E8744F", "#F4A261", "#FFD700"]}
          style={styles.sunCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      <Animated.View style={pulseStyle}>
        <ThemedText style={[styles.processingText, { color: "#5C3A1E" }]}>
          {isUploading ? "Uploading your photos..." : "Analyzing your travel lifestyle..."}
        </ThemedText>
      </Animated.View>

      <ActivityIndicator size="large" color="#E8744F" style={{ marginTop: 24 }} />

      <ThemedText style={[styles.processingHint, { color: "#8B6543" }]}>
        Our AI is reviewing your travel experience
      </ThemedText>
    </View>
  );

  const renderResult = () => {
    if (!result) return null;

    const isVerified = result.verdict === "verified";
    const badgeInfo = BADGE_CONFIG[result.badge] || BADGE_CONFIG.nomad;

    return (
      <Animated.View entering={FadeInUp.duration(600)} style={styles.stepContainer}>
        {isVerified ? (
          <>
            <View style={styles.resultBadgeWrap}>
              <LinearGradient
                colors={badgeInfo.gradient}
                style={styles.resultBadgeBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={badgeInfo.icon as any} size={48} color="#FFF" />
              </LinearGradient>
            </View>

            <ThemedText style={[styles.resultTitle, { color: "#3D2213" }]}>
              Travel Verified!
            </ThemedText>
            <ThemedText style={[styles.resultBadgeLabel, { color: badgeInfo.color }]}>
              {badgeInfo.label} Badge Earned
            </ThemedText>

            <View style={styles.scoreRow}>
              <ScoreCircle label="Photo" score={result.photo_score} color="#D4764E" />
              <ScoreCircle label="Experience" score={result.travel_experience_score} color="#E8944F" />
              <ScoreCircle label="Overall" score={result.final_travel_score} color={badgeInfo.color} />
            </View>

            <View style={[styles.reasonsBox, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
              {result.reasons.map((reason, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <ThemedText style={[styles.reasonText, { color: "#3D2213" }]}>{reason}</ThemedText>
                </View>
              ))}
            </View>

            {result.advice && (
              <View style={[styles.adviceBox, { backgroundColor: "rgba(232,116,79,0.1)" }]}>
                <Ionicons name="bulb-outline" size={18} color={AppColors.primary} />
                <ThemedText style={[styles.adviceText, { color: "#3D2213" }]}>{result.advice}</ThemedText>
              </View>
            )}

            <View style={[styles.comingSoonBox, { backgroundColor: "rgba(255,255,255,0.45)" }]}>
              <Ionicons name="car-outline" size={20} color="#6B4930" />
              <ThemedText style={[styles.comingSoonText, { color: "#6B4930" }]}>
                Advanced Nomad + Vanlifer Verification Coming Soon
              </ThemedText>
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => onVerified(result.badge)}>
              <LinearGradient
                colors={[AppColors.primary, "#F4A261"]}
                style={styles.primaryBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <ThemedText style={styles.primaryBtnText}>Enter Nomad Connect</ThemedText>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </LinearGradient>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.resultBadgeWrap}>
              <View style={[styles.resultBadgeBg, { backgroundColor: "#EF5350" }]}>
                <Ionicons name="close-circle" size={48} color="#FFF" />
              </View>
            </View>

            <ThemedText style={[styles.resultTitle, { color: "#3D2213" }]}>
              Not Verified Yet
            </ThemedText>
            <ThemedText style={[styles.resultSubtitle, { color: "#6B4930" }]}>
              Your answers didn't meet the verification threshold
            </ThemedText>

            <View style={[styles.reasonsBox, { backgroundColor: "rgba(255,255,255,0.55)" }]}>
              {result.reasons.map((reason, i) => (
                <View key={i} style={styles.reasonRow}>
                  <Ionicons name="information-circle" size={16} color="#FF9800" />
                  <ThemedText style={[styles.reasonText, { color: "#3D2213" }]}>{reason}</ThemedText>
                </View>
              ))}
            </View>

            {result.advice && (
              <View style={[styles.adviceBox, { backgroundColor: "rgba(255,152,0,0.1)" }]}>
                <Ionicons name="bulb-outline" size={18} color="#FF9800" />
                <ThemedText style={[styles.adviceText, { color: "#3D2213" }]}>{result.advice}</ThemedText>
              </View>
            )}

            <Pressable style={styles.primaryBtn} onPress={handleTryAgain}>
              <LinearGradient
                colors={[AppColors.primary, "#F4A261"]}
                style={styles.primaryBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <ThemedText style={styles.primaryBtnText}>Try Again</ThemedText>
                <Ionicons name="refresh" size={20} color="#FFF" />
              </LinearGradient>
            </Pressable>

            <View style={[styles.comingSoonBox, { backgroundColor: "rgba(255,255,255,0.45)" }]}>
              <Ionicons name="car-outline" size={20} color="#6B4930" />
              <ThemedText style={[styles.comingSoonText, { color: "#6B4930" }]}>
                Advanced Nomad + Vanlifer Verification Coming Soon
              </ThemedText>
            </View>
          </>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#E8A87C", "#F5CBAD", "#F9E4D4", "#FFF5EE"]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <View style={[styles.topBar, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Ionicons name="shield-checkmark" size={22} color="#5C3A1E" />
        <ThemedText style={[styles.topBarTitle, { color: "#3D2213" }]}>Travel Verification</ThemedText>
        {step !== "processing" && step !== "welcome" && (
          <View style={[styles.stepIndicator, { backgroundColor: "rgba(93,58,30,0.15)" }]}>
            <ThemedText style={[styles.stepIndicatorText, { color: "#5C3A1E" }]}>
              {step === "photos" ? "1/3" : step === "questions" ? "2/3" : step === "result" ? "3/3" : ""}
            </ThemedText>
          </View>
        )}
      </View>

      {step === "processing" ? (
        renderProcessing()
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "welcome" && renderWelcome()}
          {step === "photos" && renderPhotos()}
          {step === "questions" && renderQuestions()}
          {step === "result" && renderResult()}
        </ScrollView>
      )}
    </View>
  );
}

function ScoreCircle({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <View style={styles.scoreCircleWrap}>
      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <ThemedText style={[styles.scoreValue, { color }]}>{score}</ThemedText>
      </View>
      <ThemedText style={styles.scoreLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
    overflow: "hidden",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#FFF",
    flex: 1,
  },
  stepIndicator: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepIndicatorText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  stepContainer: {
    flex: 1,
  },
  welcomeIconWrap: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  welcomeIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  welcomeSteps: {
    gap: 12,
    marginBottom: 32,
  },
  welcomeStepRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  stepNumberBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    fontSize: 15,
    fontWeight: "500" as const,
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  photoCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    height: 200,
  },
  photoCardSmall: {
    height: 120,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoLabel: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  photoHint: {
    fontSize: 12,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoCheckmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  exitBtn: {
    alignItems: "center",
    marginTop: 16,
    padding: 12,
  },
  exitBtnText: {
    fontSize: 14,
  },
  questionGroup: {
    marginBottom: 18,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
    flex: 1,
  },
  processingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  sunWrap: {
    marginBottom: 32,
  },
  sunCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  processingText: {
    color: "#F9A826",
    fontSize: 18,
    fontWeight: "600" as const,
    textAlign: "center",
  },
  processingHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
  },
  resultBadgeWrap: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 12,
  },
  resultBadgeBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    textAlign: "center",
    marginBottom: 4,
  },
  resultBadgeLabel: {
    fontSize: 17,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 20,
  },
  resultSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  scoreCircleWrap: {
    alignItems: "center",
    gap: 6,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: "800" as const,
  },
  scoreLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500" as const,
  },
  reasonsBox: {
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  adviceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  adviceText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  comingSoonBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  comingSoonText: {
    fontSize: 12,
    flex: 1,
  },
});
