import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { Input } from "@/components/Input";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useThemeContext } from "@/context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { AppColors, Spacing, BorderRadius, Shadows, GradientPresets } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { TravelBadgeDisplay } from "@/components/TravelBadge";
import { useSubscription } from "@/context/SubscriptionContext";
import { Ionicons } from "@expo/vector-icons";

const INTERESTS = [
  "Hiking",
  "Climbing",
  "Skiing",
  "Surfing",
  "Camping",
  "Photography",
  "Yoga",
  "Cooking",
  "Coffee",
  "Stargazing",
  "Mountain Biking",
  "Reading",
  "Music",
  "Art",
  "Meditation",
];

const VAN_TYPES = [
  "Sprinter",
  "ProMaster",
  "Transit",
  "Econoline",
  "Westfalia",
  "Skoolie",
  "Truck Camper",
  "Other",
];

const LOOKING_FOR_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "friendship", label: "Friendship", icon: "users" },
  { value: "travel-buddy", label: "Travel Buddy", icon: "navigation" },
  { value: "dating", label: "Dating", icon: "heart" },
  { value: "help-with-build", label: "Help with Build", icon: "tool" },
  { value: "local-tips", label: "Local Tips", icon: "map-pin" },
  { value: "activities", label: "Activities", icon: "calendar" },
  { value: "networking", label: "Networking", icon: "briefcase" },
];

const THEME_COLORS = [
  { name: "Sunset Orange", primary: "#E8744F", accent: "#F4A261" },
  { name: "Ocean Blue", primary: "#0077B6", accent: "#00B4D8" },
  { name: "Forest Green", primary: "#2D6A4F", accent: "#52B788" },
  { name: "Mountain Purple", primary: "#7B2CBF", accent: "#9D4EDD" },
  { name: "Desert Sand", primary: "#BC6C25", accent: "#DDA15E" },
  { name: "Night Sky", primary: "#1E3A5F", accent: "#3A7CA5" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user, logout, updateProfile, refreshProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { themeMode, setThemeMode, customTheme, setCustomTheme, resetToDefault } = useThemeContext();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    location: user?.location || "",
    age: user?.age?.toString() || "25",
    vanType: user?.vanType || "",
    interests: user?.interests || [],
    lookingFor: user?.lookingFor || [],
  });
  
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const { tier: currentTier } = useSubscription();
  const [emergencyContact, setEmergencyContact] = useState({
    name: user?.emergencyContact?.name || "",
    phone: user?.emergencyContact?.phone || "",
    policeHelpline: (user?.emergencyContact as any)?.policeHelpline || "",
  });

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    logout();
  };

  const handleChangePhoto = () => {
    Haptics.selectionAsync();
    setShowPhotoModal(true);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is needed to take photos."
      );
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      await updateProfile({ photos: [result.assets[0].uri] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleChooseFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Gallery permission is needed to select photos."
      );
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      await updateProfile({ photos: [result.assets[0].uri] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleRemovePhoto = async () => {
    await updateProfile({ photos: [] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        name: editData.name,
        bio: editData.bio,
        location: editData.location,
        age: parseInt(editData.age) || 25,
        vanType: editData.vanType,
        interests: editData.interests,
        lookingFor: editData.lookingFor,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const toggleInterest = (interest: string) => {
    Haptics.selectionAsync();
    if (editData.interests.includes(interest)) {
      setEditData({
        ...editData,
        interests: editData.interests.filter((i) => i !== interest),
      });
    } else if (editData.interests.length < 6) {
      setEditData({
        ...editData,
        interests: [...editData.interests, interest],
      });
    }
  };

  const toggleLookingFor = (value: string) => {
    Haptics.selectionAsync();
    if (editData.lookingFor.includes(value as any)) {
      setEditData({
        ...editData,
        lookingFor: editData.lookingFor.filter((i) => i !== value),
      });
    } else {
      setEditData({
        ...editData,
        lookingFor: [...editData.lookingFor, value as any],
      });
    }
  };

  const handleSaveEmergencyContact = async () => {
    try {
      await updateProfile({
        emergencyContact: {
          name: emergencyContact.name,
          phone: emergencyContact.phone,
          policeHelpline: emergencyContact.policeHelpline || "911",
        } as { name: string; phone: string; policeHelpline?: string },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSafetyModal(false);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleThemeColorSelect = (colorSet: { primary: string; accent: string }) => {
    Haptics.selectionAsync();
    setCustomTheme({
      primary: colorSet.primary,
      accent: colorSet.accent,
      backgroundRoot: theme.backgroundRoot,
      cardBackground: theme.cardBackground,
    });
  };

  const handleInviteFriends = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await Share.share({
        message: `Join me on Nomad Connect - the community app for van lifers and nomads!\n\nConnect with fellow travelers, find adventure buddies, join activities, and get expert van build advice.\n\nDownload now: https://nomadconnect.app`,
        title: "Invite to Nomad Connect",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const photoUrl = user?.photos?.[0] || null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.profileDark : GradientPresets.profileLight)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.lg,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image
              source={photoUrl ? { uri: photoUrl } : require("../../assets/images/default-avatar.png")}
              style={styles.avatar}
              contentFit="cover"
            />
            <Pressable
              style={[styles.editAvatarButton, { backgroundColor: theme.primary }]}
              onPress={handleChangePhoto}
            >
              <Icon name="camera" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <ThemedText type="h2" style={styles.name}>
            {user?.name || "Your Name"}
            {user?.age ? `, ${user.age}` : ""}
          </ThemedText>

          {user?.travelBadge && user.travelBadge !== "none" && (
            <View style={{ marginTop: 6, marginBottom: 2 }}>
              <TravelBadgeDisplay badge={user.travelBadge} size="medium" verified={user.isTravelVerified} />
            </View>
          )}

          {user?.location ? (
            <View style={styles.locationRow}>
              <Icon name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {user.location}
              </ThemedText>
            </View>
          ) : null}

          {user?.vanType ? (
            <View style={[styles.vanBadge, { backgroundColor: theme.primary }]}>
              <Icon name="truck" size={14} color="#FFFFFF" />
              <ThemedText style={styles.vanBadgeText}>{user.vanType}</ThemedText>
            </View>
          ) : null}

        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          {user?.bio ? (
            <View style={[styles.section, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                About
              </ThemedText>
              <ThemedText type="body" style={{ lineHeight: 24 }}>
                {user.bio}
              </ThemedText>
            </View>
          ) : null}

          {user?.interests && user.interests.length > 0 ? (
            <View style={[styles.section, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Interests
              </ThemedText>
              <View style={styles.interestsGrid}>
                {user.interests.map((interest, index) => (
                  <View
                    key={index}
                    style={[styles.interestTag, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <ThemedText type="small">{interest}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {user?.lookingFor && user.lookingFor.length > 0 ? (
            <View style={[styles.section, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Looking For
              </ThemedText>
              <View style={styles.interestsGrid}>
                {user.lookingFor.map((item, index) => {
                  const option = LOOKING_FOR_OPTIONS.find(o => o.value === item);
                  return (
                    <View
                      key={index}
                      style={[styles.lookingForTag, { backgroundColor: theme.primary + "20" }]}
                    >
                      <Icon name={option?.icon || "users"} size={14} color={theme.primary} />
                      <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                        {option?.label || item}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }, Shadows.small]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Safety
            </ThemedText>
            
            <Pressable 
              style={styles.settingsRow}
              onPress={() => setShowSafetyModal(true)}
            >
              <View style={styles.settingsLeft}>
                <Icon name="shield" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.settingsText}>
                  Emergency Contact
                </ThemedText>
              </View>
              <View style={styles.settingsRight}>
                <ThemedText type="small" style={{ color: user?.emergencyContact?.name ? AppColors.success : theme.textSecondary }}>
                  {user?.emergencyContact?.name ? "Set" : "Not set"}
                </ThemedText>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Pressable>

            <View style={[styles.safetyTipCard, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="alert-triangle" size={18} color={theme.accent} />
              <ThemedText type="small" style={[styles.safetyTipText, { color: theme.textSecondary }]}>
                Always meet in public places and let someone know your plans when meeting new connections.
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View style={[styles.section, { backgroundColor: theme.cardBackground }, Shadows.small]}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Settings
            </ThemedText>
            
            <Pressable 
              style={styles.settingsRow}
              onPress={() => setShowThemeModal(true)}
            >
              <View style={styles.settingsLeft}>
                <Icon name="sun" size={20} color={theme.text} />
                <ThemedText type="body" style={styles.settingsText}>
                  Theme
                </ThemedText>
              </View>
              <View style={styles.settingsRight}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Customize
                </ThemedText>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Pressable>

          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Pressable
            onPress={() => navigation.navigate("Subscription")}
            style={styles.upgradeCard}
            testID="button-upgrade"
          >
            <LinearGradient
              colors={
                currentTier === "lifetime"
                  ? ["#F59E0B", "#D97706"]
                  : currentTier === "expert"
                    ? ["#8B5CF6", "#6D28D9"]
                    : currentTier === "pro"
                      ? ["#FF8C42", "#F9A826"]
                      : ["#E8744F", "#F4A261"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeGradient}
            >
              <View style={styles.upgradeLeft}>
                <View style={styles.upgradeIconCircle}>
                  <Ionicons
                    name={
                      currentTier === "lifetime" ? "infinite"
                        : currentTier === "expert" ? "diamond"
                          : currentTier === "pro" ? "flame"
                            : "rocket"
                    }
                    size={22}
                    color="#FFF"
                  />
                </View>
                <View>
                  <ThemedText style={styles.upgradeTitle}>
                    {currentTier === "lifetime" ? "Lifetime Member"
                      : currentTier === "free" ? "Upgrade"
                        : currentTier === "pro" ? "Go Legend"
                          : "Go Lifetime"}
                  </ThemedText>
                  <ThemedText style={styles.upgradeSubtitle}>
                    {currentTier === "lifetime"
                      ? "You have unlimited access forever"
                      : currentTier === "free"
                        ? "Unlock unlimited features"
                        : currentTier === "pro"
                          ? "Get the ultimate experience"
                          : "One-time payment, forever free"}
                  </ThemedText>
                </View>
              </View>
              {currentTier !== "lifetime" && (
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.actions}>
          <GradientButton onPress={() => setShowEditModal(true)} style={styles.editButton}>
            Edit Profile
          </GradientButton>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleInviteFriends}
              style={[styles.actionButtonSmall, { backgroundColor: theme.cardBackground }]}
              testID="button-invite-friends"
            >
              <Icon name="user-plus" size={20} color={AppColors.success} />
              <ThemedText type="small" style={{ color: theme.text, marginTop: 4 }}>
                Invite
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={[styles.actionButtonSmall, { backgroundColor: theme.cardBackground }]}
              testID="button-logout"
            >
              <Icon name="log-out" size={20} color={theme.danger} />
              <ThemedText type="small" style={{ color: theme.text, marginTop: 4 }}>
                Log Out
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showThemeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Theme Settings</ThemedText>
            <Pressable onPress={() => setShowThemeModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <ThemedText type="h4" style={styles.themeSection}>
              Appearance
            </ThemedText>

            <ThemedText type="h4" style={styles.themeSection}>
              Customize Theme
            </ThemedText>
            <ThemedText type="small" style={[styles.themeHint, { color: theme.textSecondary }]}>
              Choose your favorite color scheme
            </ThemedText>

            <View style={styles.colorGrid}>
              {THEME_COLORS.map((colorSet) => (
                <Pressable
                  key={colorSet.name}
                  style={[
                    styles.colorButton,
                    {
                      borderColor: customTheme?.primary === colorSet.primary 
                        ? colorSet.primary 
                        : "transparent",
                      borderWidth: 3,
                    },
                  ]}
                  onPress={() => handleThemeColorSelect(colorSet)}
                >
                  <View style={[styles.colorPreview, { backgroundColor: colorSet.primary }]}>
                    <View style={[styles.colorAccent, { backgroundColor: colorSet.accent }]} />
                  </View>
                  <ThemedText type="small" style={styles.colorName}>
                    {colorSet.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.resetButton, { borderColor: theme.border }]}
              onPress={() => {
                Haptics.selectionAsync();
                resetToDefault();
              }}
            >
              <Icon name="refresh-cw" size={18} color={theme.text} />
              <ThemedText style={styles.resetText}>
                Reset to Default
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Edit Profile</ThemedText>
            <Pressable onPress={() => setShowEditModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <Input
              label="Name"
              placeholder="Your name"
              value={editData.name}
              onChangeText={(text) => setEditData({ ...editData, name: text })}
              containerStyle={styles.modalInput}
              testID="input-edit-name"
            />

            <Input
              label="Age"
              placeholder="Your age"
              value={editData.age}
              onChangeText={(text) => setEditData({ ...editData, age: text.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              containerStyle={styles.modalInput}
              testID="input-edit-age"
            />

            <Input
              label="Location"
              placeholder="e.g., Sedona, AZ"
              value={editData.location}
              onChangeText={(text) => setEditData({ ...editData, location: text })}
              icon="map-pin"
              containerStyle={styles.modalInput}
              testID="input-edit-location"
            />

            <ThemedText type="small" style={styles.label}>
              Van Type
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vanTypeScroll}
            >
              {VAN_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setEditData({ ...editData, vanType: type })}
                  style={[
                    styles.vanTypeButton,
                    {
                      backgroundColor:
                        editData.vanType === type ? theme.primary : theme.cardBackground,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: editData.vanType === type ? "#FFFFFF" : theme.text,
                      fontWeight: "500",
                    }}
                  >
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <Input
              label="Bio"
              placeholder="Tell others about yourself and your van life journey..."
              value={editData.bio}
              onChangeText={(text) => setEditData({ ...editData, bio: text })}
              multiline
              numberOfLines={4}
              containerStyle={styles.modalInput}
              testID="input-edit-bio"
            />

            <ThemedText type="small" style={styles.label}>
              Interests (select up to 6)
            </ThemedText>
            <View style={styles.interestsEditGrid}>
              {INTERESTS.map((interest) => (
                <Pressable
                  key={interest}
                  onPress={() => toggleInterest(interest)}
                  style={[
                    styles.interestEditTag,
                    {
                      backgroundColor: editData.interests.includes(interest)
                        ? theme.primary
                        : theme.cardBackground,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: editData.interests.includes(interest) ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {interest}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="small" style={styles.label}>
              Looking For
            </ThemedText>
            <View style={styles.lookingForEditGrid}>
              {LOOKING_FOR_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => toggleLookingFor(option.value)}
                  style={[
                    styles.lookingForEditTag,
                    {
                      backgroundColor: editData.lookingFor.includes(option.value as any)
                        ? theme.primary
                        : theme.cardBackground,
                    },
                  ]}
                >
                  <Icon
                    name={option.icon}
                    size={14}
                    color={editData.lookingFor.includes(option.value as any) ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: editData.lookingFor.includes(option.value as any) ? "#FFFFFF" : theme.text,
                      marginLeft: 4,
                    }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <GradientButton onPress={handleSaveProfile} style={styles.saveButton}>
              Save Changes
            </GradientButton>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <Modal
        visible={showSafetyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSafetyModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Safety Settings</ThemedText>
            <Pressable onPress={() => setShowSafetyModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <View style={[styles.safetyTipCard, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="shield" size={24} color={theme.primary} />
              <ThemedText type="body" style={[styles.safetyTipText, { color: theme.text }]}>
                Set an emergency contact so fellow nomads can help in case of an emergency.
              </ThemedText>
            </View>

            <ThemedText type="h4" style={[styles.label, { marginTop: Spacing.xl }]}>
              Emergency Contact
            </ThemedText>

            <Input
              label="Contact Name"
              placeholder="e.g., Mom, Partner, Best Friend"
              value={emergencyContact.name}
              onChangeText={(text) => setEmergencyContact({ ...emergencyContact, name: text })}
              icon="user"
              containerStyle={styles.modalInput}
              testID="input-emergency-name"
            />

            <Input
              label="Phone Number"
              placeholder="e.g., +1 555 123 4567"
              value={emergencyContact.phone}
              onChangeText={(text) => setEmergencyContact({ ...emergencyContact, phone: text })}
              icon="phone"
              keyboardType="phone-pad"
              containerStyle={styles.modalInput}
              testID="input-emergency-phone"
            />

            <ThemedText type="h4" style={[styles.label, { marginTop: Spacing.xl }]}>
              Police Helpline
            </ThemedText>

            <View style={[styles.safetyTipCard, { backgroundColor: theme.backgroundSecondary, marginBottom: Spacing.md }]}>
              <Icon name="info" size={18} color={theme.primary} />
              <ThemedText type="small" style={[styles.safetyTipText, { color: theme.textSecondary }]}>
                Set your local police helpline number. This will be used instead of 911 when you trigger SOS.
              </ThemedText>
            </View>

            <Input
              label="Police Helpline Number"
              placeholder="e.g., 911, 100, 999"
              value={emergencyContact.policeHelpline}
              onChangeText={(text) => setEmergencyContact({ ...emergencyContact, policeHelpline: text })}
              icon="phone-call"
              keyboardType="phone-pad"
              containerStyle={styles.modalInput}
              testID="input-police-helpline"
            />

            <GradientButton 
              onPress={handleSaveEmergencyContact} 
              style={styles.saveButton}
              disabled={!emergencyContact.name.trim() || !emergencyContact.phone.trim()}
            >
              Save Emergency Contact
            </GradientButton>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <PhotoPickerModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handleChooseFromGallery}
        onRemovePhoto={handleRemovePhoto}
        hasExistingPhoto={user?.photos && user.photos.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  name: {
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  upgradeCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 20,
    overflow: "hidden" as const,
    shadowColor: "#E8744F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  upgradeGradient: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  upgradeLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    flex: 1,
  },
  upgradeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#FFF",
  },
  upgradeSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  vanBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  vanBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  profileActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: Spacing.md,
  },
  profileActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  interestTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  settingsLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingsText: {
    marginLeft: Spacing.md,
  },
  settingsRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    marginTop: Spacing.lg,
  },
  editButton: {
    marginBottom: Spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  actionButtonSmall: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 70,
    borderRadius: BorderRadius.lg,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  modalInput: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  vanTypeScroll: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  vanTypeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  interestsEditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  interestEditTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
  themeSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  themeHint: {
    marginBottom: Spacing.md,
  },
  themeModeGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  themeModeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  colorButton: {
    width: "30%",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  colorAccent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: "absolute",
    bottom: -2,
    right: -2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  colorName: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 11,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing["2xl"],
  },
  resetText: {
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  lookingForTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  safetyTipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  safetyTipText: {
    flex: 1,
    marginLeft: Spacing.sm,
    lineHeight: 20,
  },
  lookingForEditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  lookingForEditTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});
