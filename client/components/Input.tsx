import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
  Pressable,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/Icon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, AppColors } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...props
}: InputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const borderColor = useSharedValue(theme.inputBorder);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
  }));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    borderColor.value = withTiming(AppColors.primary, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    borderColor.value = withTiming(theme.inputBorder, { duration: 200 });
    onBlur?.(e);
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const isPassword = secureTextEntry !== undefined;

  return (
    <View style={containerStyle}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.inputBackground,
          },
          animatedStyle,
        ]}
      >
        {icon ? (
          <Icon
            name={icon}
            size={20}
            color={isFocused ? AppColors.primary : theme.textSecondary}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
            },
            icon ? styles.inputWithIcon : null,
            isPassword ? styles.inputWithToggle : null,
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword ? !isPasswordVisible : false}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={togglePasswordVisibility}
            style={styles.toggleButton}
            testID="button-toggle-password"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={isPasswordVisible ? "eye" : "eye-off"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: AppColors.danger }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputWithToggle: {
    paddingRight: Spacing.sm,
  },
  toggleButton: {
    padding: Spacing.xs,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
