import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Modal,
  Platform,
  ToastAndroid,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle, Rect } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { AppColors, Spacing } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function VanLogo({ size = 60, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * 0.65} viewBox="0 0 100 65">
      <Rect x="5" y="18" width="70" height="32" rx="6" fill={color} />
      <Rect x="65" y="22" width="30" height="28" rx="4" fill={color} />
      <Rect x="72" y="26" width="18" height="14" rx="2" fill="rgba(173,216,255,0.85)" />
      <Rect x="10" y="24" width="16" height="12" rx="2" fill="rgba(173,216,255,0.7)" />
      <Rect x="30" y="24" width="16" height="12" rx="2" fill="rgba(173,216,255,0.7)" />
      <Rect x="50" y="24" width="12" height="12" rx="2" fill="rgba(173,216,255,0.7)" />
      <Circle cx="22" cy="50" r="9" fill="#2C2C2E" />
      <Circle cx="22" cy="50" r="5" fill="#4A4A4A" />
      <Circle cx="22" cy="50" r="2" fill="#6A6A6A" />
      <Circle cx="68" cy="50" r="9" fill="#2C2C2E" />
      <Circle cx="68" cy="50" r="5" fill="#4A4A4A" />
      <Circle cx="68" cy="50" r="2" fill="#6A6A6A" />
      <Rect x="0" y="35" width="7" height="5" rx="2" fill={color} />
      <Path d="M88 35 L95 35 L95 40 L88 42 Z" fill="rgba(255,200,0,0.8)" />
    </Svg>
  );
}

type ResetStep = "email" | "otp" | "password" | "success";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, signup, sendPasswordResetOTP, verifyOTP, updatePassword } = useAuth();
  const { showAlert } = useAlert();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<ResetStep>("email");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const showAuthErrorToast = (message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.LONG);
      return;
    }

    showAlert({ type: "error", title: "Sign in failed", message });
  };

  const handleSubmit = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (!isLogin && !name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (!result.success) {
          const message = result.error || "Invalid email or password";
          setError(message);
          showAuthErrorToast(message);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        const result = await signup(email, password, name);
        if (!result.success) {
          const message = result.error || "Failed to create account";
          setError(message);
          showAuthErrorToast(message);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (err) {
      const message = "Something went wrong. Please try again.";
      setError(message);
      showAuthErrorToast(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    Haptics.selectionAsync();
    setIsLogin(!isLogin);
    setError("");
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setResetStep("email");
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
    setShowForgotModal(true);
  };

  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleSendOTP = async () => {
    if (!resetEmail.trim()) {
      setResetError("Please enter your email");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      const result = await sendPasswordResetOTP(resetEmail);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetStep("otp");
      } else {
        setResetError(result.error || "Failed to send code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      setResetError("Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      setResetError("Please enter the code from your email");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      const result = await verifyOTP(resetEmail, otpCode);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetStep("password");
      } else {
        setResetError(result.error || "Invalid code");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      setResetError("Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      setResetError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      const result = await updatePassword(resetEmail, newPassword);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetStep("success");
      } else {
        setResetError(result.error || "Failed to reset password");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      setResetError("Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setResetStep("email");
    setResetError("");
    setOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/images/auth-mountains.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            "rgba(30,20,15,0.10)",
            "rgba(60,40,25,0.30)",
            "rgba(50,30,20,0.55)",
            "rgba(35,22,15,0.85)",
          ]}
          locations={[0, 0.3, 0.6, 1]}
          style={styles.overlay}
        />
      </ImageBackground>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
          <View style={styles.logoContainer}>
            <VanLogo size={80} color={AppColors.primary} />
          </View>
          <ThemedText style={styles.appName}>Nomad Connect</ThemedText>
          <ThemedText style={styles.tagline}>Find your tribe on the road</ThemedText>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(300).duration(600)} 
          style={styles.formCard}
        >
          <ThemedText style={styles.formTitle}>
            {isLogin ? "Welcome Back" : "Join the Community"}
          </ThemedText>

          {!isLogin && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.inputWrapper}>
              <View style={[
                styles.inputContainer,
                focusedField === 'name' && styles.inputContainerFocused
              ]}>
                <View style={styles.inputIcon}>
                  <Icon name="user" size={20} color="rgba(255,255,255,0.6)" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  testID="input-name"
                />
              </View>
            </Animated.View>
          )}

          <View style={styles.inputWrapper}>
            <View style={[
              styles.inputContainer,
              focusedField === 'email' && styles.inputContainerFocused
            ]}>
              <View style={styles.inputIcon}>
                <Icon name="mail" size={20} color="rgba(255,255,255,0.6)" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                testID="input-email"
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <View style={[
              styles.inputContainer,
              focusedField === 'password' && styles.inputContainerFocused
            ]}>
              <View style={styles.inputIcon}>
                <Icon name="lock" size={20} color="rgba(255,255,255,0.6)" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                testID="input-password"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Icon 
                  name={showPassword ? "eye" : "eye-off"} 
                  size={20} 
                  color="rgba(255,255,255,0.6)" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
              <ThemedText style={styles.error}>{error}</ThemedText>
            </Animated.View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
            style={styles.submitButtonWrapper}
          >
            <LinearGradient
              colors={isLoading ? ['#666', '#555'] : [AppColors.primary, AppColors.accent]}
              style={styles.submitButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ThemedText style={styles.submitButtonText}>
                {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword} testID="button-forgot-password">
              <ThemedText style={styles.forgotPasswordText}>Forgot password?</ThemedText>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500).duration(600)} style={styles.footer}>
          <ThemedText style={styles.footerText}>
            {isLogin ? "New to Nomad Connect? " : "Already a member? "}
          </ThemedText>
          <Pressable onPress={toggleMode} testID="button-toggle-auth">
            <ThemedText style={styles.footerLink}>
              {isLogin ? "Sign Up" : "Sign In"}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={closeForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {resetStep === "email" ? (
              <>
                <ThemedText style={styles.modalTitle}>Reset Password</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  Enter your email address and we'll send you a verification code.
                </ThemedText>
                <View style={[styles.inputContainer, styles.modalInput]}>
                  <View style={styles.inputIcon}>
                    <Icon name="mail" size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!resetLoading}
                    testID="input-reset-email"
                  />
                </View>
                {resetError ? (
                  <View style={[styles.errorContainer, { marginBottom: 16, width: "100%" }]}>
                    <ThemedText style={styles.error}>{resetError}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={closeForgotModal}
                    disabled={resetLoading}
                  >
                    <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSendOTP} activeOpacity={0.8} disabled={resetLoading}>
                    <LinearGradient
                      colors={resetLoading ? ['#666', '#555'] : [AppColors.primary, AppColors.accent]}
                      style={styles.modalSendButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <ThemedText style={styles.modalSendText}>
                        {resetLoading ? "Sending..." : "Send Code"}
                      </ThemedText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : resetStep === "otp" ? (
              <>
                <View style={styles.successIcon}>
                  <Icon name="mail" size={48} color={AppColors.primary} />
                </View>
                <ThemedText style={styles.modalTitle}>Enter Code</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  Check your email for the 6-digit code
                </ThemedText>
                <View style={[styles.inputContainer, styles.modalInput]}>
                  <View style={styles.inputIcon}>
                    <Icon name="hash" size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="input-otp-code"
                  />
                </View>
                {resetError ? (
                  <View style={[styles.errorContainer, { marginBottom: 16, width: "100%" }]}>
                    <ThemedText style={styles.error}>{resetError}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={() => setResetStep("email")}
                  >
                    <ThemedText style={styles.modalCancelText}>Back</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleVerifyOTP} activeOpacity={0.8}>
                    <LinearGradient
                      colors={[AppColors.primary, AppColors.accent]}
                      style={styles.modalSendButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <ThemedText style={styles.modalSendText}>Verify</ThemedText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleSendOTP} style={{ marginTop: 16 }} disabled={resetLoading}>
                  <ThemedText style={styles.resendText}>
                    {resetLoading ? "Sending..." : "Resend Code"}
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : resetStep === "password" ? (
              <>
                <ThemedText style={styles.modalTitle}>New Password</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  Enter your new password below
                </ThemedText>
                <View style={[styles.inputContainer, styles.modalInput]}>
                  <View style={styles.inputIcon}>
                    <Icon name="lock" size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!resetLoading}
                    testID="input-new-password"
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeButton}>
                    <Icon name={showNewPassword ? "eye" : "eye-off"} size={20} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputContainer, styles.modalInput, { marginTop: 0 }]}>
                  <View style={styles.inputIcon}>
                    <Icon name="lock" size={20} color="rgba(255,255,255,0.7)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!resetLoading}
                    testID="input-confirm-password"
                  />
                </View>
                {resetError ? (
                  <View style={[styles.errorContainer, { marginBottom: 16, width: "100%" }]}>
                    <ThemedText style={styles.error}>{resetError}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={() => setResetStep("otp")}
                    disabled={resetLoading}
                  >
                    <ThemedText style={styles.modalCancelText}>Back</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResetPassword} activeOpacity={0.8} disabled={resetLoading}>
                    <LinearGradient
                      colors={resetLoading ? ['#666', '#555'] : [AppColors.primary, AppColors.accent]}
                      style={styles.modalSendButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <ThemedText style={styles.modalSendText}>
                        {resetLoading ? "Updating..." : "Update Password"}
                      </ThemedText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.successIcon}>
                  <Icon name="check-circle" size={48} color={AppColors.success} />
                </View>
                <ThemedText style={styles.modalTitle}>Password Updated</ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  Your password has been successfully updated. You can now sign in with your new password.
                </ThemedText>
                <TouchableOpacity onPress={closeForgotModal} activeOpacity={0.8} style={{ width: "100%", marginTop: 16 }}>
                  <LinearGradient
                    colors={[AppColors.primary, AppColors.accent]}
                    style={styles.modalSendButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <ThemedText style={styles.modalSendText}>Sign In</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1210",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  formCard: {
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 16,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: AppColors.primary,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    height: "100%",
  },
  eyeButton: {
    padding: 8,
    marginRight: -4,
  },
  errorContainer: {
    backgroundColor: "rgba(255,107,107,0.15)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    textAlign: "center",
  },
  submitButtonWrapper: {
    marginTop: 8,
  },
  submitButton: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  forgotPassword: {
    alignItems: "center",
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "rgba(30,30,50,0.95)",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    width: "100%",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  modalSendButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalSendText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  successIcon: {
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: AppColors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
  },
  footerLink: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.primary,
  },
});
