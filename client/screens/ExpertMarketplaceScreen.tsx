import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { AppColors, Spacing } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { purchaseConsultation } from "@/services/revenuecat";

interface Expert {
  id: string;
  user_id: string;
  name: string;
  photos: string[];
  location: string;
  specialization: string;
  skills: string[];
  experience_years: number;
  hourly_rate: number;
  expert_badge: string;
  ai_score: number;
  expert_rating: number;
  reviews_count: number;
}

const FALLBACK_EXPERTS: Expert[] = [
  {
    id: "1",
    user_id: "1",
    name: "Jake Morrison",
    photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200"],
    location: "Denver, CO",
    specialization: "Sprinter Van Builds",
    skills: ["Electrical", "Solar", "Sprinter Vans"],
    experience_years: 8,
    hourly_rate: 75,
    expert_badge: "pro_expert",
    ai_score: 92,
    expert_rating: 4.9,
    reviews_count: 127,
  },
  {
    id: "2",
    user_id: "2",
    name: "Sarah Chen",
    photos: ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200"],
    location: "Portland, OR",
    specialization: "Skoolie Conversions",
    skills: ["Skoolies", "Layout Design", "Plumbing"],
    experience_years: 5,
    hourly_rate: 60,
    expert_badge: "expert",
    ai_score: 78,
    expert_rating: 4.8,
    reviews_count: 89,
  },
  {
    id: "3",
    user_id: "3",
    name: "Mike Thompson",
    photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200"],
    location: "Austin, TX",
    specialization: "Off-Grid Systems",
    skills: ["Solar", "Lithium Batteries", "Inverters"],
    experience_years: 12,
    hourly_rate: 100,
    expert_badge: "pro_expert",
    ai_score: 95,
    expert_rating: 5.0,
    reviews_count: 203,
  },
];

const DURATION_OPTIONS = [30, 60, 90, 120];\nconst ALLOWED_HOURLY_RATES = [50, 75, 100];\nconst normalizeHourlyRate = (rate: number) => {\n  if (!Number.isFinite(rate)) return ALLOWED_HOURLY_RATES[0];\n  return ALLOWED_HOURLY_RATES.reduce((prev, curr) =>\n    Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev\n  , ALLOWED_HOURLY_RATES[0]);\n};

function getBadgeColor(badge: string) {
  if (badge === "pro_expert") return "#F59E0B";
  if (badge === "expert") return "#F97316";
  return "#10B981";
}

function getBadgeLabel(badge: string) {
  if (badge === "pro_expert") return "PRO";
  if (badge === "expert") return "EXPERT";
  return "VERIFIED";
}

function ExpertCard({
  expert,
  onBook,
}: {
  expert: Expert;
  onBook: () => void;
}) {
  const { theme } = useTheme();
  const badgeColor = getBadgeColor(expert.expert_badge);
  const avatar = expert.photos?.[0] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200";\n  const hourlyRate = normalizeHourlyRate(expert.hourly_rate);

  return (
    <View style={[styles.expertCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.expertHeader}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={[styles.verifiedBadge, { backgroundColor: badgeColor }]}>
            <Icon name="check" size={10} color="#FFF" />
          </View>
        </View>
        <View style={styles.expertInfo}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.expertName}>{expert.name}</ThemedText>
            <View style={[styles.badgePill, { backgroundColor: badgeColor + "20" }]}>
              <ThemedText style={[styles.badgePillText, { color: badgeColor }]}>
                {getBadgeLabel(expert.expert_badge)}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.expertTitle}>{expert.specialization}</ThemedText>
          <View style={styles.ratingRow}>
            <Icon name="star" size={14} color="#FBBF24" />
            <ThemedText style={styles.ratingText}>
              {expert.expert_rating?.toFixed(1) || "5.0"} ({expert.reviews_count || 0} reviews)
            </ThemedText>
            <ThemedText style={[styles.experienceText, { color: theme.textSecondary }]}>
              {expert.experience_years}y exp
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.specialtiesContainer}>
        {(expert.skills || []).slice(0, 4).map((skill, index) => (
          <View
            key={index}
            style={[styles.specialtyChip, { backgroundColor: theme.backgroundRoot }]}
          >
            <ThemedText style={styles.specialtyText}>{skill}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.expertFooter}>
        <View style={styles.priceContainer}>
          <ThemedText style={styles.priceLabel}>Consultation</ThemedText>
          <ThemedText style={styles.priceValue}>${hourlyRate}/hr</ThemedText>
        </View>
        {expert.location ? (
          <View style={styles.locationContainer}>
            <Icon name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.locationText}>{expert.location}</ThemedText>
          </View>
        ) : null}
      </View>

      <Pressable style={styles.bookButton} onPress={onBook}>
        <LinearGradient
          colors={[AppColors.primary, AppColors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bookButtonGradient}
        >
          <Icon name="calendar" size={18} color="#FFF" />
          <ThemedText style={styles.bookButtonText}>Book Consultation</ThemedText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function BookingModal({
  visible,
  expert,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  expert: Expert | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"details" | "confirm" | "success">("details");

  if (!expert) return null;

  const totalAmount = (expert.hourly_rate / 60) * selectedDuration;
  const platformFee = totalAmount * 0.3;
  const expertPayout = totalAmount - platformFee;

  const handlePayment = async () => {
    if (!user?.id) return;
    setProcessing(true);

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const result = await purchaseConsultation(expert.name, totalAmount, hourlyRate);

      if (!result.success) {
        if (result.error === "cancelled") {
          setProcessing(false);
          return;
        }
        showAlert({ type: "error", title: "Payment Failed", message: "There was an issue processing your payment. Please try again." });
        setProcessing(false);
        return;
      }

      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/consultations/book", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          expertId: expert.user_id,
          expertApplicationId: expert.id,
          hourlyRate,
          durationMinutes: selectedDuration,
          notes: notes.trim() || undefined,
          transactionId: result.transactionId,
        }),
      });

      const data = await response.json();

      if (data.booking) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setStep("success");
      } else {
        showAlert({ type: "error", title: "Booking Error", message: "Payment was processed but booking failed. Please contact support." });
      }
    } catch (error) {
      showAlert({ type: "error", title: "Error", message: "Something went wrong. Please try again." });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setStep("details");
    setSelectedDuration(60);
    setNotes("");
    onClose();
  };

  const handleDone = () => {
    setStep("details");
    setSelectedDuration(60);
    setNotes("");
    onSuccess();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <Animated.View
          entering={SlideInDown.springify().damping(28).stiffness(120)}
          style={[styles.modalContent, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg }]}
        >
          <View style={styles.modalHandle} />

          <Pressable style={styles.modalCloseBtn} onPress={step === "success" ? handleDone : handleClose}>
            <Icon name="x" size={20} color={theme.text} />
          </Pressable>

          {step === "details" && (
            <Animated.View entering={FadeIn}>
              <View style={styles.modalExpertRow}>
                <Image
                  source={{ uri: expert.photos?.[0] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200" }}
                  style={styles.modalAvatar}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.modalExpertName}>{expert.name}</ThemedText>
                  <ThemedText style={[styles.modalExpertSpec, { color: theme.textSecondary }]}>
                    {expert.specialization}
                  </ThemedText>
                </View>
                <View style={[styles.modalBadge, { backgroundColor: getBadgeColor(expert.expert_badge) + "20" }]}>
                  <ThemedText style={[styles.modalBadgeText, { color: getBadgeColor(expert.expert_badge) }]}>
                    {getBadgeLabel(expert.expert_badge)}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={[styles.modalSectionTitle, { marginTop: Spacing.lg }]}>Session Duration</ThemedText>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((mins) => (
                  <Pressable
                    key={mins}
                    style={[
                      styles.durationChip,
                      { backgroundColor: selectedDuration === mins ? AppColors.primary : theme.cardBackground },
                    ]}
                    onPress={() => {
                      setSelectedDuration(mins);
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                  >
                    <ThemedText style={[styles.durationText, { color: selectedDuration === mins ? "#FFF" : theme.text }]}>
                      {mins} min
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={[styles.modalSectionTitle, { marginTop: Spacing.lg }]}>
                Notes for the expert (optional)
              </ThemedText>
              <TextInput
                style={[styles.notesInput, { backgroundColor: theme.cardBackground, color: theme.text }]}
                placeholder="Describe what you need help with..."
                placeholderTextColor={theme.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={[styles.priceSummary, { backgroundColor: theme.cardBackground }]}>
                <View style={styles.priceRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>Rate</ThemedText>
                  <ThemedText style={{ fontWeight: "600" as const }}>${hourlyRate}/hr</ThemedText>
                </View>
                <View style={styles.priceRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>Duration</ThemedText>
                  <ThemedText style={{ fontWeight: "600" as const }}>{selectedDuration} minutes</ThemedText>
                </View>
                <View style={[styles.priceRow, styles.priceDivider, { borderTopColor: theme.backgroundRoot }]}>
                  <ThemedText style={{ fontWeight: "700" as const, fontSize: 16 }}>Total</ThemedText>
                  <ThemedText style={{ fontWeight: "700" as const, fontSize: 18, color: AppColors.primary }}>
                    ${totalAmount.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              <Pressable onPress={() => setStep("confirm")}>
                <LinearGradient
                  colors={[AppColors.primary, AppColors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payButton}
                >
                  <Icon name="credit-card" size={20} color="#FFF" />
                  <ThemedText style={styles.payButtonText}>Continue to Payment</ThemedText>
                </LinearGradient>
              </Pressable>

              <ThemedText style={[styles.secureText, { color: theme.textSecondary }]}>
                Secured by RevenueCat. 30% platform fee applies.
              </ThemedText>
            </Animated.View>
          )}

          {step === "confirm" && (
            <Animated.View entering={FadeInDown}>
              <View style={styles.confirmIcon}>
                <Icon name="shield" size={40} color="#10B981" />
              </View>
              <ThemedText style={[styles.confirmTitle, { textAlign: "center" as const }]}>Confirm Payment</ThemedText>
              <ThemedText style={[styles.confirmSubtitle, { color: theme.textSecondary, textAlign: "center" as const }]}>
                You're about to book a {selectedDuration}-minute consultation with {expert.name}
              </ThemedText>

              <View style={[styles.confirmCard, { backgroundColor: theme.cardBackground }]}>
                <View style={styles.confirmRow}>
                  <Icon name="user" size={16} color={theme.textSecondary} />
                  <ThemedText style={{ flex: 1 }}>{expert.name} - {expert.specialization}</ThemedText>
                </View>
                <View style={styles.confirmRow}>
                  <Icon name="clock" size={16} color={theme.textSecondary} />
                  <ThemedText style={{ flex: 1 }}>{selectedDuration} minute session</ThemedText>
                </View>
                <View style={styles.confirmRow}>
                  <Icon name="dollar-sign" size={16} color={theme.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: "700" as const, color: AppColors.primary }}>
                    ${totalAmount.toFixed(2)}
                  </ThemedText>
                </View>
                {notes.trim() ? (
                  <View style={styles.confirmRow}>
                    <Icon name="file-text" size={16} color={theme.textSecondary} />
                    <ThemedText style={{ flex: 1, opacity: 0.7 }} numberOfLines={2}>{notes}</ThemedText>
                  </View>
                ) : null}
              </View>

              <Pressable onPress={handlePayment} disabled={processing}>
                <LinearGradient
                  colors={processing ? ["#9CA3AF", "#9CA3AF"] : ["#10B981", "#059669"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payButton}
                >
                  {processing ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Icon name="lock" size={18} color="#FFF" />
                      <ThemedText style={styles.payButtonText}>Pay ${totalAmount.toFixed(2)}</ThemedText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => setStep("details")} style={styles.backBtn}>
                <ThemedText style={[styles.backBtnText, { color: theme.textSecondary }]}>Go Back</ThemedText>
              </Pressable>
            </Animated.View>
          )}

          {step === "success" && (
            <Animated.View entering={FadeInDown} style={{ alignItems: "center" as const }}>
              <View style={styles.successIcon}>
                <Icon name="check" size={48} color="#FFF" />
              </View>
              <ThemedText style={styles.successTitle}>Booking Confirmed!</ThemedText>
              <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
                Your consultation with {expert.name} has been booked. They'll reach out to schedule your session.
              </ThemedText>

              <View style={[styles.receiptCard, { backgroundColor: theme.cardBackground }]}>
                <ThemedText style={styles.receiptLabel}>Payment Receipt</ThemedText>
                <View style={styles.receiptRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>Expert</ThemedText>
                  <ThemedText style={{ fontWeight: "600" as const }}>{expert.name}</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>Duration</ThemedText>
                  <ThemedText style={{ fontWeight: "600" as const }}>{selectedDuration} min</ThemedText>
                </View>
                <View style={styles.receiptRow}>
                  <ThemedText style={{ color: theme.textSecondary }}>Amount Paid</ThemedText>
                  <ThemedText style={{ fontWeight: "700" as const, color: "#10B981" }}>
                    ${totalAmount.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              <Pressable onPress={handleDone}>
                <LinearGradient
                  colors={[AppColors.primary, AppColors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payButton}
                >
                  <ThemedText style={styles.payButtonText}>Done</ThemedText>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function ExpertMarketplaceScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert: showAlertMain } = useAlert();
  const navigation = useNavigation<any>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApplication, setHasApplication] = useState(false);
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    loadExperts();
    checkExistingApplication();
  }, []);

  const loadExperts = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/experts", baseUrl).toString());
      const data = await response.json();
      if (data.experts && data.experts.length > 0) {
        setExperts(data.experts);
      } else {
        setExperts(FALLBACK_EXPERTS);
      }
    } catch {
      setExperts(FALLBACK_EXPERTS);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingApplication = async () => {
    if (!user?.id) return;
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL(`/api/expert/status/${user.id}`, baseUrl).toString());
      const data = await response.json();
      if (data.application) {
        setHasApplication(true);
      }
    } catch {}
  };

  const handleBookExpert = (expert: Expert) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelectedExpert(expert);
    setShowBooking(true);
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
        <View style={styles.header}>
          <View style={styles.headerIconBg}>
            <Icon name="users" size={28} color="#FFF" />
          </View>
          <ThemedText style={styles.subtitle}>
            Connect with verified van builders for personalized consultations.
            All experts are vetted professionals with proven experience.
          </ThemedText>
        </View>

        <View
          style={[styles.infoCard, { backgroundColor: theme.cardBackground }]}
        >
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Icon name="shield" size={20} color="#10B981" />
              <ThemedText style={styles.infoLabel}>AI Verified</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Icon name="video" size={20} color="#3B82F6" />
              <ThemedText style={styles.infoLabel}>Video Calls</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Icon name="lock" size={20} color="#8B5CF6" />
              <ThemedText style={styles.infoLabel}>Secure Payment</ThemedText>
            </View>
          </View>
        </View>

        <ThemedText style={styles.sectionTitle}>Available Experts</ThemedText>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : (
          <View style={styles.expertsList}>
            {experts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                onBook={() => handleBookExpert(expert)}
              />
            ))}
          </View>
        )}

        <View style={[styles.becomeExpertCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.becomeExpertContent}>
            <ThemedText style={styles.becomeExpertTitle}>
              Are you a van build expert?
            </ThemedText>
            <ThemedText style={[styles.becomeExpertText, { color: theme.textSecondary }]}>
              Share your knowledge and earn money by helping fellow nomads with their van builds. Our AI verifies your expertise.
            </ThemedText>
          </View>
          <Pressable
            style={[styles.applyButton, { backgroundColor: theme.backgroundRoot }]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              if (hasApplication) {
                navigation.navigate("ExpertStatus");
              } else {
                navigation.navigate("ApplyAsExpert");
              }
            }}
          >
            <Icon name={hasApplication ? "eye" : "award"} size={18} color={AppColors.primary} />
            <ThemedText style={styles.applyButtonText}>
              {hasApplication ? "View Application Status" : "Apply as Expert"}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      <BookingModal
        visible={showBooking}
        expert={selectedExpert}
        onClose={() => setShowBooking(false)}
        onSuccess={() => {
          setShowBooking(false);
          showAlertMain({ type: "success", title: "Consultation Booked", message: "Check your messages for next steps from the expert." });
        }}
      />
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
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: "center",
    lineHeight: 22,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  infoItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing.xl * 2,
    alignItems: "center",
  },
  expertsList: {
    gap: Spacing.lg,
  },
  expertCard: {
    padding: Spacing.lg,
    borderRadius: 16,
  },
  expertHeader: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  avatarContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  expertInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  expertName: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  expertTitle: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  experienceText: {
    fontSize: 12,
    marginLeft: 6,
  },
  specialtiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  specialtyChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  expertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  priceContainer: {},
  priceLabel: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: "uppercase",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: AppColors.primary,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    opacity: 0.7,
  },
  bookButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  bookButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFF",
  },
  becomeExpertCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: 16,
  },
  becomeExpertContent: {
    marginBottom: Spacing.md,
  },
  becomeExpertTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    marginBottom: Spacing.xs,
  },
  becomeExpertText: {
    fontSize: 14,
    lineHeight: 20,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: AppColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  modalCloseBtn: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg,
    zIndex: 10,
    padding: 4,
  },
  modalExpertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  modalExpertName: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  modalExpertSpec: {
    fontSize: 13,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: Spacing.sm,
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  durationChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    alignItems: "center",
  },
  durationText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  notesInput: {
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  priceSummary: {
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceDivider: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    borderRadius: 14,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFF",
  },
  secureText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  confirmIcon: {
    alignSelf: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: Spacing.sm,
  },
  confirmSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  confirmCard: {
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backBtn: {
    alignSelf: "center",
    paddingVertical: Spacing.md,
  },
  backBtnText: {
    fontSize: 15,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  receiptCard: {
    borderRadius: 12,
    padding: Spacing.md,
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  receiptLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    opacity: 0.6,
    marginBottom: Spacing.xs,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

