import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  Linking,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { AppColors, BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { apiRequest } from "@/lib/query-client";

const SHAKE_THRESHOLD = 2.5;
const SHAKE_COUNT_REQUIRED = 3;
const SHAKE_RESET_TIME = 1500;

export type SOSAction = "whatsapp_only" | "whatsapp_and_call_contact" | "whatsapp_and_call_police" | "call_police_only";

interface SOSButtonProps {
  visible?: boolean;
}

export function SOSButton({ visible = true }: SOSButtonProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const lastTapRef = useRef<number>(0);
  const shakeCountRef = useRef<number>(0);
  const lastShakeTimeRef = useRef<number>(0);

  const pulseScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS === "web") return;

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (now - lastShakeTimeRef.current > SHAKE_RESET_TIME) {
        shakeCountRef.current = 0;
      }

      if (acceleration > SHAKE_THRESHOLD) {
        if (now - lastShakeTimeRef.current > 300) {
          shakeCountRef.current += 1;
          lastShakeTimeRef.current = now;

          if (shakeCountRef.current >= SHAKE_COUNT_REQUIRED) {
            shakeCountRef.current = 0;
            handleSOSPress();
          }
        }
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => subscription.remove();
  }, [visible]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 2 - pulseScale.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.9);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  const handleSOSPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowConfirmModal(true);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(status === "granted");

        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation(location);
        }
      } catch (error) {
        console.log("Could not get location:", error);
        setLocationPermission(false);
      }
    })();
  };

  const generateMapLink = useCallback((lat: number, lng: number) => {
    return `https://maps.google.com/maps?q=${lat},${lng}`;
  }, []);

  const logIncident = async (location: Location.LocationObject | null, message?: string) => {
    try {
      await apiRequest("POST", "/api/sos/log", {
        userId: user?.id,
        userName: user?.name,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        } : null,
        timestamp: new Date().toISOString(),
        emergencyContact: user?.emergencyContact,
        message,
      });
    } catch (error) {
      console.log("Failed to log incident:", error);
    }
  };

  const getPoliceHelpline = () => {
    const contact = user?.emergencyContact as { name?: string; phone?: string; policeHelpline?: string } | undefined;
    return contact?.policeHelpline || "911";
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    return phone.replace(/[^0-9]/g, "");
  };

  const openWhatsApp = async (phone: string, message: string) => {
    const cleanPhone = formatPhoneForWhatsApp(phone);
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    const webWhatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return true;
      } else {
        await Linking.openURL(webWhatsappUrl);
        return true;
      }
    } catch {
      try {
        await Linking.openURL(webWhatsappUrl);
        return true;
      } catch {
        return false;
      }
    }
  };

  const executeSOSAction = async (action: SOSAction) => {
    if (action !== "call_police_only" && !user?.emergencyContact?.phone) {
      showAlert({
        type: "warning",
        title: "No Emergency Contact",
        message: "Please add an emergency contact in your profile settings first.",
      });
      setShowConfirmModal(false);
      return;
    }

    setIsSending(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setShowConfirmModal(false);

    try {
      const policeHelpline = getPoliceHelpline();

      let message = `EMERGENCY! ${user?.name || "Someone"} needs help!`;

      if (currentLocation) {
        const mapLink = generateMapLink(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        message += `\n\nLocation: ${mapLink}`;
        message += `\n\nCoordinates: ${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`;
      } else {
        message += "\n\nLocation: Unable to determine";
      }

      message += `\n\nSent via Nomad Connect SOS`;

      logIncident(currentLocation, message);

      if (action !== "call_police_only" && user?.emergencyContact?.phone) {
        const sent = await openWhatsApp(user.emergencyContact.phone, message);
        if (!sent) {
          showAlert({
            type: "warning",
            title: "WhatsApp Not Available",
            message: "Could not open WhatsApp. Please make sure it's installed.",
          });
        }
      }

      if (action === "whatsapp_and_call_contact" && user?.emergencyContact?.phone) {
        setTimeout(() => {
          Linking.openURL(`tel:${user?.emergencyContact?.phone}`);
        }, 1500);
      } else if (action === "whatsapp_and_call_police" || action === "call_police_only") {
        const delay = action === "call_police_only" ? 0 : 1500;
        setTimeout(() => {
          Linking.openURL(`tel:${policeHelpline}`);
        }, delay);
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (action === "whatsapp_only") {
        showAlert({
          type: "success",
          title: "Alert Sent",
          message: "WhatsApp message opened for your emergency contact.",
        });
      }
    } catch (error) {
      console.error("SOS Error:", error);
      showAlert({
        type: "error",
        title: "Error",
        message: "Failed to send emergency alert. Please try calling emergency services directly.",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <View style={[styles.container, { bottom: insets.bottom + 70 }]} pointerEvents="box-none">
        <Animated.View style={[styles.pulse, pulseStyle]} pointerEvents="none" />
        <Animated.View style={buttonAnimatedStyle}>
          <Pressable
            style={styles.button}
            onPress={() => {
              const now = Date.now();
              if (now - lastTapRef.current < 300) {
                handleSOSPress();
              }
              lastTapRef.current = now;
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            testID="button-sos"
            accessibilityRole="button"
            accessibilityLabel="SOS Emergency Button - Double tap to activate"
            accessibilityHint="Double tap to send emergency alert"
          >
            <Icon name="alert-triangle" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.emergencyIcon}>
                <Icon name="alert-triangle" size={28} color="#FFFFFF" />
              </View>
              <ThemedText type="h3" style={styles.modalTitle}>
                Emergency SOS
              </ThemedText>
            </View>

            {currentLocation ? (
              <View style={[styles.locationChip, { backgroundColor: "rgba(76,175,80,0.12)" }]}>
                <Icon name="map-pin" size={14} color={AppColors.success} />
                <ThemedText type="small" style={{ color: AppColors.success, marginLeft: 6 }}>
                  Location locked
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.locationChip, { backgroundColor: "rgba(255,59,48,0.12)" }]}>
                <Icon name="map-pin" size={14} color={AppColors.danger} />
                <ThemedText type="small" style={{ color: AppColors.danger, marginLeft: 6 }}>
                  {locationPermission === false ? "No location access" : "Locating..."}
                </ThemedText>
              </View>
            )}

            <View style={styles.actionList}>
              <Pressable
                style={[styles.actionRow, { backgroundColor: "#25D366" }]}
                onPress={() => executeSOSAction("whatsapp_and_call_contact")}
                disabled={isSending}
                testID="button-alert-and-call-contact"
              >
                <Icon name="phone" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={styles.actionText}>
                  {isSending ? "Sending..." : "WhatsApp + Call Contact"}
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionRow, { backgroundColor: AppColors.danger }]}
                onPress={() => executeSOSAction("whatsapp_and_call_police")}
                disabled={isSending}
                testID="button-alert-and-call-police"
              >
                <Icon name="phone" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={styles.actionText}>
                  WhatsApp + Call {getPoliceHelpline()}
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionRow, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => executeSOSAction("whatsapp_only")}
                disabled={isSending}
                testID="button-send-alert"
              >
                <Icon name="message-circle" size={18} color={theme.text} />
                <ThemedText type="body" style={[styles.actionText, { color: theme.text }]}>
                  WhatsApp Only
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowConfirmModal(false)}
              testID="button-cancel-sos"
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 20,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.danger,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.danger,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.large,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emergencyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    textAlign: "center",
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: Spacing.lg,
  },
  actionList: {
    gap: 10,
    marginBottom: Spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
