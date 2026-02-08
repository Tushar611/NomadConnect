import React from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PhotoPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  onRemovePhoto?: () => void;
  hasExistingPhoto?: boolean;
}

function CameraIllustration() {
  return (
    <Svg width={120} height={100} viewBox="0 0 120 100">
      <Defs>
        <SvgGradient id="cameraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={AppColors.primary} />
          <Stop offset="100%" stopColor={AppColors.accent} />
        </SvgGradient>
        <SvgGradient id="lensGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4A4A4A" />
          <Stop offset="100%" stopColor="#2A2A2A" />
        </SvgGradient>
      </Defs>
      <Rect x="15" y="25" width="90" height="60" rx="12" fill="url(#cameraGrad)" />
      <Rect x="40" y="15" width="25" height="12" rx="4" fill="url(#cameraGrad)" />
      <Circle cx="60" cy="55" r="22" fill="url(#lensGrad)" />
      <Circle cx="60" cy="55" r="16" fill="#1a1a2e" />
      <Circle cx="60" cy="55" r="10" fill="#3a3a4e" />
      <Circle cx="55" cy="50" r="4" fill="rgba(255,255,255,0.3)" />
      <Circle cx="85" cy="35" r="5" fill="#ff4444" opacity="0.8" />
      <Rect x="22" y="35" width="12" height="8" rx="2" fill="rgba(255,255,255,0.3)" />
    </Svg>
  );
}

export function PhotoPickerModal({
  visible,
  onClose,
  onTakePhoto,
  onChooseFromGallery,
  onRemovePhoto,
  hasExistingPhoto = false,
}: PhotoPickerModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const options = [
    {
      id: "camera",
      icon: "camera",
      title: "Take a Photo",
      subtitle: "Use your camera to capture a new photo",
      onPress: onTakePhoto,
      gradient: [AppColors.primary, AppColors.accent] as [string, string],
    },
    {
      id: "gallery",
      icon: "image",
      title: "Photo Library",
      subtitle: "Choose from your existing photos",
      onPress: onChooseFromGallery,
      gradient: ["#3B82F6", "#60A5FA"] as [string, string],
    },
  ];

  if (hasExistingPhoto && onRemovePhoto) {
    options.push({
      id: "remove",
      icon: "trash-2",
      title: "Remove Photo",
      subtitle: "Delete your current profile photo",
      onPress: onRemovePhoto,
      gradient: ["#EF4444", "#F87171"] as [string, string],
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.darkOverlay} />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.modalContent,
            { 
              backgroundColor: theme.cardBackground,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.illustrationContainer}>
            <CameraIllustration />
          </View>

          <ThemedText type="h3" style={styles.title}>
            Update Profile Photo
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose how you'd like to add your photo
          </ThemedText>

          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.optionButton,
                  { 
                    backgroundColor: theme.backgroundSecondary,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                onPress={() => {
                  option.onPress();
                  onClose();
                }}
                testID={`button-photo-${option.id}`}
              >
                <LinearGradient
                  colors={option.gradient}
                  style={styles.optionIconContainer}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name={option.icon} size={22} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.optionTextContainer}>
                  <ThemedText type="h4" style={styles.optionTitle}>
                    {option.title}
                  </ThemedText>
                  <ThemedText type="small" style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                    {option.subtitle}
                  </ThemedText>
                </View>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={onClose}
            testID="button-photo-cancel"
          >
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Cancel
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(128,128,128,0.4)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  illustrationContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
});
