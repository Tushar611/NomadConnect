import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import Animated, { FadeInDown, FadeInUp, SlideInRight, SlideOutLeft } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { AppColors, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const SPECIALIZATIONS = [
  "Electrical",
  "Carpentry",
  "Plumbing",
  "Layout Design",
  "Interior Build",
  "General Consultant",
];

const ALL_SKILLS = [
  "Solar Setup",
  "Battery Wiring",
  "DC-DC Charger Install",
  "Furniture Build",
  "Insulation",
  "Plumbing Installation",
  "Design Planning",
];

const TOTAL_STEPS = 5;

export default function ApplyAsExpertScreen({ navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [project1, setProject1] = useState("");
  const [project2, setProject2] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [videoUri, setVideoUri] = useState("");

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return resumeText.trim().length > 20 || resumeFileName.length > 0;
      case 2: return portfolioPhotos.length >= 3;
      case 3:
        return specialization.length > 0 &&
          parseInt(experienceYears) > 0 &&
          selectedSkills.length > 0 &&
          project1.trim().length > 20 &&
          project2.trim().length > 20 &&
          parseFloat(hourlyRate) > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handlePickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (!result.canceled && result.assets?.[0]) {
        setResumeFileName(result.assets[0].name);
        setResumeText(`[PDF uploaded: ${result.assets[0].name}]`);
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick document");
    }
  };

  const handlePickPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });
      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map((a) => a.uri);
        setPortfolioPhotos((prev) => [...prev, ...newPhotos].slice(0, 10));
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick images");
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Error", "Could not pick video");
    }
  };

  const toggleSkill = (skill: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const body = {
        userId: user.id,
        resumeText,
        resumeUrl: resumeFileName || null,
        portfolioUrls: portfolioPhotos,
        specialization,
        experienceYears: parseInt(experienceYears),
        skills: selectedSkills,
        projectDescriptions: [project1, project2].filter(Boolean),
        introVideoUrl: videoUri || null,
        hourlyRate: parseFloat(hourlyRate),
      };

      const response = await fetch(new URL("/api/expert/apply", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Failed to submit");
        setSubmitting(false);
        return;
      }

      const verifyRes = await fetch(
        new URL(`/api/expert/verify/${data.application.id}`, getApiUrl()).toString(),
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      await verifyRes.json();

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("ExpertStatus");
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s + 1);
  };
  const prevStep = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s - 1);
  };

  const renderIntro = () => (
    <Animated.View entering={FadeInDown.springify()}>
      <LinearGradient
        colors={["#FF8C42", "#FF6432"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Icon name="award" size={48} color="#FFF" />
        <ThemedText style={styles.heroTitle}>Become a Van Build Expert</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Help others. Earn money. Get verified.
        </ThemedText>

        <View style={styles.benefitsRow}>
          <View style={styles.benefitItem}>
            <Icon name="eye" size={20} color="#FFF" />
            <ThemedText style={styles.benefitText}>Visibility</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Icon name="dollar-sign" size={20} color="#FFF" />
            <ThemedText style={styles.benefitText}>Income</ThemedText>
          </View>
          <View style={styles.benefitItem}>
            <Icon name="shield" size={20} color="#FFF" />
            <ThemedText style={styles.benefitText}>Verified</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <Pressable style={styles.applyNowBtn} onPress={nextStep}>
        <LinearGradient
          colors={[AppColors.primary, AppColors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.applyNowGradient}
        >
          <ThemedText style={styles.applyNowText}>Apply Now</ThemedText>
          <Icon name="arrow-right" size={20} color="#FFF" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  const renderStep1Resume = () => (
    <Animated.View entering={FadeInDown.springify()} key="step1">
      <ThemedText style={[styles.stepTitle, { color: theme.text }]}>Resume / Experience</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Upload a PDF or describe your van building experience below.
      </ThemedText>

      <Pressable
        style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
        onPress={handlePickResume}
      >
        <Icon name="upload" size={28} color={AppColors.primary} />
        <ThemedText style={[styles.uploadLabel, { color: theme.text }]}>
          {resumeFileName || "Upload PDF Resume"}
        </ThemedText>
        {resumeFileName ? (
          <View style={styles.filePreview}>
            <Icon name="file" size={16} color={AppColors.primary} />
            <ThemedText style={{ color: AppColors.primary, fontSize: 13 }}>{resumeFileName}</ThemedText>
          </View>
        ) : null}
      </Pressable>

      <ThemedText style={[styles.orText, { color: theme.textSecondary }]}>or type your experience</ThemedText>

      <TextInput
        style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
        placeholder="Describe your van building background, years of experience, notable projects..."
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        value={resumeText}
        onChangeText={setResumeText}
      />
    </Animated.View>
  );

  const renderStep2Portfolio = () => (
    <Animated.View entering={FadeInDown.springify()} key="step2">
      <ThemedText style={[styles.stepTitle, { color: theme.text }]}>Portfolio Photos</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Upload at least 3 photos of your van builds, carpentry, electrical setups, or workspace.
      </ThemedText>

      <View style={styles.photoGrid}>
        {portfolioPhotos.map((uri, i) => (
          <View key={i} style={styles.photoItem}>
            <Image source={{ uri }} style={styles.photoImage} />
            <Pressable
              style={styles.photoRemove}
              onPress={() => setPortfolioPhotos((prev) => prev.filter((_, idx) => idx !== i))}
            >
              <Icon name="x" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
        {portfolioPhotos.length < 10 && (
          <Pressable
            style={[styles.addPhotoBox, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
            onPress={handlePickPhotos}
          >
            <Icon name="plus" size={28} color={AppColors.primary} />
            <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>Add</ThemedText>
          </Pressable>
        )}
      </View>
      <ThemedText style={[styles.photoCount, { color: portfolioPhotos.length >= 3 ? AppColors.success : AppColors.danger }]}>
        {portfolioPhotos.length}/3 minimum ({portfolioPhotos.length}/10 max)
      </ThemedText>
    </Animated.View>
  );

  const renderStep3Experience = () => (
    <Animated.View entering={FadeInDown.springify()} key="step3">
      <ThemedText style={[styles.stepTitle, { color: theme.text }]}>Experience & Skills</ThemedText>

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Specialization</ThemedText>
      <View style={styles.specGrid}>
        {SPECIALIZATIONS.map((spec) => (
          <Pressable
            key={spec}
            style={[
              styles.specChip,
              { borderColor: specialization === spec ? AppColors.primary : theme.border,
                backgroundColor: specialization === spec ? AppColors.primary + "20" : theme.cardBackground },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              setSpecialization(spec);
            }}
          >
            <ThemedText style={[styles.specChipText, { color: specialization === spec ? AppColors.primary : theme.text }]}>
              {spec}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Years of Experience</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
        placeholder="e.g. 5"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
        value={experienceYears}
        onChangeText={setExperienceYears}
      />

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Skills</ThemedText>
      <View style={styles.skillsGrid}>
        {ALL_SKILLS.map((skill) => (
          <Pressable
            key={skill}
            style={[
              styles.skillPill,
              { borderColor: selectedSkills.includes(skill) ? AppColors.primary : theme.border,
                backgroundColor: selectedSkills.includes(skill) ? AppColors.primary + "20" : theme.cardBackground },
            ]}
            onPress={() => toggleSkill(skill)}
          >
            {selectedSkills.includes(skill) && <Icon name="check" size={12} color={AppColors.primary} />}
            <ThemedText style={[styles.skillPillText, { color: selectedSkills.includes(skill) ? AppColors.primary : theme.text }]}>
              {skill}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Past Project 1</ThemedText>
      <TextInput
        style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground, minHeight: 80 }]}
        placeholder="Describe a van build project in detail..."
        placeholderTextColor={theme.textSecondary}
        multiline
        textAlignVertical="top"
        value={project1}
        onChangeText={setProject1}
      />

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Past Project 2</ThemedText>
      <TextInput
        style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground, minHeight: 80 }]}
        placeholder="Describe another project..."
        placeholderTextColor={theme.textSecondary}
        multiline
        textAlignVertical="top"
        value={project2}
        onChangeText={setProject2}
      />

      <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Hourly Rate ($)</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.cardBackground }]}
        placeholder="e.g. 75"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
    </Animated.View>
  );

  const renderStep4Video = () => (
    <Animated.View entering={FadeInDown.springify()} key="step4">
      <ThemedText style={[styles.stepTitle, { color: theme.text }]}>Video Introduction</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Optional: Upload a 30-60 second video introducing yourself. This helps build trust with potential clients.
      </ThemedText>

      <Pressable
        style={[styles.uploadBox, { borderColor: theme.border, backgroundColor: theme.cardBackground, minHeight: 140 }]}
        onPress={handlePickVideo}
      >
        {videoUri ? (
          <View style={styles.videoPreviewContainer}>
            <Icon name="video" size={36} color={AppColors.primary} />
            <ThemedText style={[styles.uploadLabel, { color: AppColors.primary }]}>
              Video selected
            </ThemedText>
            <Pressable onPress={() => setVideoUri("")} style={styles.removeVideoBtn}>
              <Icon name="x" size={16} color={AppColors.danger} />
              <ThemedText style={{ color: AppColors.danger, fontSize: 13 }}>Remove</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <Icon name="video" size={36} color={theme.textSecondary} />
            <ThemedText style={[styles.uploadLabel, { color: theme.textSecondary }]}>
              Tap to upload video
            </ThemedText>
          </>
        )}
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={nextStep}>
        <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip this step</ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderStep5Review = () => (
    <Animated.View entering={FadeInDown.springify()} key="step5">
      <ThemedText style={[styles.stepTitle, { color: theme.text }]}>Review & Submit</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>
        Review your application before submitting for AI verification.
      </ThemedText>

      <View style={[styles.reviewCard, { backgroundColor: theme.cardBackground }]}>
        <ReviewRow icon="file" label="Resume" value={resumeFileName || (resumeText.length > 0 ? `${resumeText.substring(0, 50)}...` : "Not provided")} theme={theme} />
        <ReviewRow icon="image" label="Portfolio" value={`${portfolioPhotos.length} photos`} theme={theme} />
        <ReviewRow icon="tool" label="Specialization" value={specialization} theme={theme} />
        <ReviewRow icon="clock" label="Experience" value={`${experienceYears} years`} theme={theme} />
        <ReviewRow icon="zap" label="Skills" value={selectedSkills.join(", ")} theme={theme} />
        <ReviewRow icon="dollar-sign" label="Hourly Rate" value={`$${hourlyRate}/hr`} theme={theme} />
        <ReviewRow icon="video" label="Intro Video" value={videoUri ? "Uploaded" : "Skipped"} theme={theme} />
      </View>

      {portfolioPhotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewPhotoScroll}>
          {portfolioPhotos.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.reviewPhoto} />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderIntro();
      case 1: return renderStep1Resume();
      case 2: return renderStep2Portfolio();
      case 3: return renderStep3Experience();
      case 4: return renderStep4Video();
      case 5: return renderStep5Review();
      default: return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => step > 0 ? prevStep() : navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          {step > 0 && (
            <View style={styles.progressContainer}>
              {[1, 2, 3, 4, 5].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    { backgroundColor: step >= s ? AppColors.primary : theme.border },
                  ]}
                />
              ))}
            </View>
          )}
          {step > 0 && (
            <ThemedText style={[styles.stepCounter, { color: theme.textSecondary }]}>
              {step}/{TOTAL_STEPS}
            </ThemedText>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>

        {step > 0 && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.background }]}>
            {step === 5 ? (
              <Pressable
                style={[styles.submitBtn, !canProceed() && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting || !canProceed()}
              >
                <LinearGradient
                  colors={["#FF8C42", "#FF6432"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Icon name="shield" size={20} color="#FFF" />
                      <ThemedText style={styles.submitText}>Submit for Verification</ThemedText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            ) : step !== 4 ? (
              <Pressable
                style={[styles.nextBtn, !canProceed() && styles.btnDisabled]}
                onPress={nextStep}
                disabled={!canProceed()}
              >
                <LinearGradient
                  colors={canProceed() ? [AppColors.primary, AppColors.accent] : [theme.border, theme.border]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextGradient}
                >
                  <ThemedText style={styles.nextText}>Continue</ThemedText>
                  <Icon name="arrow-right" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable style={styles.nextBtn} onPress={nextStep}>
                <LinearGradient
                  colors={[AppColors.primary, AppColors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextGradient}
                >
                  <ThemedText style={styles.nextText}>
                    {videoUri ? "Continue" : "Skip & Continue"}
                  </ThemedText>
                  <Icon name="arrow-right" size={18} color="#FFF" />
                </LinearGradient>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function ReviewRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={styles.reviewRow}>
      <Icon name={icon as any} size={18} color={AppColors.primary} />
      <View style={styles.reviewRowContent}>
        <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        <ThemedText style={[styles.reviewValue, { color: theme.text }]} numberOfLines={2}>{value}</ThemedText>
      </View>
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
  },
  backBtn: { padding: 4 },
  progressContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: Spacing.md,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepCounter: { fontSize: 13, fontWeight: "600" },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  heroCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFF",
    marginTop: Spacing.md,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  benefitsRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  benefitItem: { alignItems: "center", gap: 4 },
  benefitText: { fontSize: 12, color: "#FFF", fontWeight: "600" },
  applyNowBtn: { borderRadius: 16, overflow: "hidden", marginTop: Spacing.md },
  applyNowGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: Spacing.sm,
  },
  applyNowText: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  stepTitle: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  stepDesc: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  uploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    gap: 8,
  },
  uploadLabel: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  filePreview: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  orText: { textAlign: "center", marginVertical: Spacing.md, fontSize: 13 },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photoImage: { width: "100%", height: "100%", borderRadius: 12 },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCount: { fontSize: 13, fontWeight: "600", marginTop: Spacing.sm },
  fieldLabel: { fontSize: 14, fontWeight: "600", marginTop: Spacing.md, marginBottom: 8 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  specChipText: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 15,
    height: 48,
  },
  skillsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 4,
  },
  skillPillText: { fontSize: 13, fontWeight: "500" },
  videoPreviewContainer: { alignItems: "center", gap: 8 },
  removeVideoBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  skipBtn: { alignSelf: "center", marginTop: Spacing.lg, padding: Spacing.md },
  skipText: { fontSize: 14, fontWeight: "500" },
  reviewCard: { borderRadius: 16, padding: Spacing.lg, gap: 14 },
  reviewRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  reviewRowContent: { flex: 1 },
  reviewLabel: { fontSize: 12, fontWeight: "500", marginBottom: 2 },
  reviewValue: { fontSize: 14, fontWeight: "600" },
  reviewPhotoScroll: { marginTop: Spacing.md },
  reviewPhoto: { width: 80, height: 80, borderRadius: 10, marginRight: 8 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  nextBtn: { borderRadius: 14, overflow: "hidden" },
  nextGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  nextText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  submitText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  btnDisabled: { opacity: 0.5 },
});
