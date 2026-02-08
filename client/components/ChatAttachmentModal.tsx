import React from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";

interface ChatAttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPhoto: () => void;
  onSelectLocation: () => void;
  onSelectFile: () => void;
}

export function ChatAttachmentModal({
  visible,
  onClose,
  onSelectPhoto,
  onSelectLocation,
  onSelectFile,
}: ChatAttachmentModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const options = [
    {
      id: "photo",
      icon: "image",
      title: "Photo",
      subtitle: "Share a photo from your gallery or camera",
      onPress: onSelectPhoto,
      gradient: [AppColors.primary, AppColors.accent] as [string, string],
    },
    {
      id: "location",
      icon: "map-pin",
      title: "Location",
      subtitle: "Share your current or selected location",
      onPress: onSelectLocation,
      gradient: ["#10B981", "#34D399"] as [string, string],
    },
    {
      id: "file",
      icon: "file",
      title: "File",
      subtitle: "Share a document or file",
      onPress: onSelectFile,
      gradient: ["#3B82F6", "#60A5FA"] as [string, string],
    },
  ];

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

          <ThemedText type="h3" style={styles.title}>
            Share Content
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose what you'd like to share
          </ThemedText>

          <View style={styles.optionsContainer}>
            {options.map((option) => (
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
                testID={`button-attach-${option.id}`}
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
            testID="button-attach-cancel"
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
