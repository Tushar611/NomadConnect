import React from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import { DatePickerWheel, TimePickerWheel, DurationPickerWheel } from "./WheelPicker";

interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  type: "date" | "time" | "duration";
  dateValue?: Date;
  durationValue?: number;
  onDateChange?: (date: Date) => void;
  onDurationChange?: (hours: number) => void;
}

export function PickerModal({
  visible,
  onClose,
  title,
  type,
  dateValue,
  durationValue,
  onDateChange,
  onDurationChange,
}: PickerModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.cardBackground,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <ThemedText type="h3" style={styles.title}>
              {title}
            </ThemedText>
          </View>

          <View style={styles.pickerContainer}>
            {type === "date" && dateValue && onDateChange ? (
              <DatePickerWheel value={dateValue} onChange={onDateChange} />
            ) : null}
            {type === "time" && dateValue && onDateChange ? (
              <TimePickerWheel value={dateValue} onChange={onDateChange} />
            ) : null}
            {type === "duration" && durationValue !== undefined && onDurationChange ? (
              <DurationPickerWheel value={durationValue} onChange={onDurationChange} />
            ) : null}
          </View>

          <Pressable
            style={[styles.doneButton, { backgroundColor: AppColors.primary }]}
            onPress={onClose}
          >
            <ThemedText type="body" style={styles.doneButtonText}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  title: {
    fontWeight: "600",
  },
  pickerContainer: {
    marginBottom: Spacing.lg,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
