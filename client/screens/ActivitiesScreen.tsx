import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  ScrollView,
  Share,
  Dimensions,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { GradientButton } from "@/components/GradientButton";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { Activity, ActivityLocation, SafetyRating } from "@/types";
import { AppColors, Spacing, BorderRadius, Shadows, GradientPresets } from "@/constants/theme";
import MapScreen from "@/screens/MapScreen";
import LocationPickerModal from "@/components/LocationPickerModal";
import SafetyRatingModal from "@/components/SafetyRatingModal";
import { PickerModal } from "@/components/PickerModal";
import { useAlert } from "@/context/AlertContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ACTIVITY_TYPES: { type: Activity["type"]; label: string; icon: string }[] = [
  { type: "hiking", label: "Hiking", icon: "map" },
  { type: "climbing", label: "Climbing", icon: "trending-up" },
  { type: "skiing", label: "Skiing", icon: "wind" },
  { type: "camping", label: "Camping", icon: "home" },
  { type: "surfing", label: "Surfing", icon: "droplet" },
  { type: "other", label: "Other", icon: "star" },
];

const FILTER_CATEGORIES = [
  { id: "all", label: "All", icon: "grid" },
  { id: "hiking", label: "Hiking", icon: "map" },
  { id: "camping", label: "Camping", icon: "home" },
  { id: "climbing", label: "Climbing", icon: "trending-up" },
  { id: "surfing", label: "Surfing", icon: "droplet" },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { activities, isLoading, refreshData, createActivity, joinActivity, deleteActivity } = useData();
  const { user, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSafetyRating, setShowSafetyRating] = useState(false);
  const [activityForRating, setActivityForRating] = useState<Activity | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState<ActivityLocation | null>(null);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(Date.now() + 86400000 * 3));
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDuration, setSelectedDuration] = useState(2);
  
  const DURATION_OPTIONS = [
    { value: 1, label: "1h", fullLabel: "1 hour", icon: "clock" },
    { value: 2, label: "2h", fullLabel: "2 hours", icon: "clock" },
    { value: 4, label: "4h", fullLabel: "4 hours", icon: "clock" },
    { value: 8, label: "8h", fullLabel: "8 hours", icon: "clock" },
    { value: 24, label: "1 day", fullLabel: "1 day", icon: "sun" },
    { value: 168, label: "1 week", fullLabel: "1 week", icon: "calendar" },
    { value: 720, label: "1 month", fullLabel: "1 month", icon: "calendar" },
  ];
  
  const formatDuration = (hours: number): string => {
    if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
    if (hours < 168) {
      const days = Math.floor(hours / 24);
      return days === 1 ? "1 day" : `${days} days`;
    }
    if (hours < 720) {
      const weeks = Math.floor(hours / 168);
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    }
    const months = Math.floor(hours / 720);
    return months === 1 ? "1 month" : `${months} months`;
  };
  
  const [newActivity, setNewActivity] = useState({
    title: "",
    description: "",
    type: "hiking" as Activity["type"],
    location: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    date: new Date(Date.now() + 86400000 * 3).toISOString(),
    startTime: new Date().toISOString(),
    duration: 2,
    maxAttendees: 8,
    imageUrl: "",
    customType: "",
  });

  const getPlaceholderImage = (type: Activity["type"]) => {
    const placeholders: Record<Activity["type"], string> = {
      hiking: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800",
      climbing: "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800",
      skiing: "https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800",
      camping: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800",
      surfing: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800",
      other: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
    };
    return placeholders[type];
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewActivity({ ...newActivity, imageUrl: result.assets[0].uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    const currentActivity = activities.find(a => a.id === activity.id) || activity;
    setSelectedActivity(currentActivity);
    setShowDetailModal(true);
  };

  const handleSelectLocation = (location: ActivityLocation) => {
    setSelectedLocation(location);
    setNewActivity({
      ...newActivity,
      location: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  const handleCreateActivity = async () => {
    if (!newActivity.title.trim() || !newActivity.location.trim()) return;
    if (newActivity.type === "other" && !newActivity.customType.trim()) return;

    try {
      const activityTitle = newActivity.type === "other" && newActivity.customType.trim()
        ? `${newActivity.customType}: ${newActivity.title}`
        : newActivity.title;
      const imageUrl = newActivity.imageUrl || getPlaceholderImage(newActivity.type);
      
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(selectedTime.getHours());
      combinedDate.setMinutes(selectedTime.getMinutes());
      
      await createActivity({
        title: activityTitle,
        description: newActivity.description,
        type: newActivity.type,
        location: newActivity.location,
        latitude: newActivity.latitude,
        longitude: newActivity.longitude,
        date: combinedDate.toISOString(),
        startTime: selectedTime.toISOString(),
        duration: selectedDuration,
        maxAttendees: newActivity.maxAttendees,
        attendeeIds: [],
        imageUrl,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      setSelectedLocation(null);
      setSelectedDate(new Date(Date.now() + 86400000 * 3));
      setSelectedTime(new Date());
      setSelectedDuration(2);
      setNewActivity({
        title: "",
        description: "",
        type: "hiking",
        location: "",
        latitude: undefined,
        longitude: undefined,
        date: new Date(Date.now() + 86400000 * 3).toISOString(),
        startTime: new Date().toISOString(),
        duration: 2,
        maxAttendees: 8,
        imageUrl: "",
        customType: "",
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  
  const handleCompleteActivity = (activity: Activity) => {
    setActivityForRating(activity);
    setShowSafetyRating(true);
    setShowDetailModal(false);
  };

  const handleSafetyRatingSubmit = async (rating: Omit<SafetyRating, "id" | "createdAt" | "ratedByUserId">) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");
      const response = await fetch(`${baseUrl}/api/safety-ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rating,
          ratedByUserId: user?.id,
        }),
      });
      
      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to submit safety rating:", error);
    }
    setActivityForRating(null);
  };

  const handleJoinActivity = async () => {
    if (!selectedActivity || isJoining) return;

    setIsJoining(true);
    try {
      await joinActivity(selectedActivity.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = activities.find(a => a.id === selectedActivity.id);
      if (updated) {
        setSelectedActivity(updated);
      }
      setShowDetailModal(false);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleOpenChat = () => {
    if (!selectedActivity) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowDetailModal(false);
    navigation.navigate("ActivityChat", {
      activityId: selectedActivity.id,
      activityTitle: selectedActivity.title,
    });
  };

  const handleDeleteActivity = async () => {
    if (!selectedActivity || !isUserHost) return;
    
    const performDelete = async () => {
      try {
        await deleteActivity(selectedActivity.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowDetailModal(false);
        setSelectedActivity(null);
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (Platform.OS === "web") {
          window.alert("Failed to delete activity");
        } else {
          showAlert({ type: "error", title: "Error", message: "Failed to delete activity" });
        }
      }
    };

    if (Platform.OS === "web") {
      // Use window.confirm on web
      const confirmed = window.confirm("Are you sure you want to delete this activity? This cannot be undone.");
      if (confirmed) {
        await performDelete();
      }
    } else {
      showAlert({
        type: "confirm",
        title: "Delete Activity",
        message: "Are you sure you want to delete this activity? This cannot be undone.",
        buttons: [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ],
      });
    }
  };

  const handleInviteFriend = async () => {
    if (!selectedActivity) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const result = await Share.share({
        message: `Join me for "${selectedActivity.title}" on Nomad Connect!\n\n${selectedActivity.location}\n${formatDate(selectedActivity.date)}\n\n${selectedActivity.description}\n\nDownload Nomad Connect to join: https://nomadconnect.app`,
        title: `Join ${selectedActivity.title}`,
      });

      if (result.action === Share.sharedAction) {
        showAlert({ type: "success", title: "Invite Sent!", message: "Your friend will receive the invitation." });
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || activity.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const sortedActivities = [...filteredActivities].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const isUserAttending = selectedActivity && user 
    ? selectedActivity.attendeeIds.includes(user.id)
    : false;

  const isUserHost = selectedActivity && user
    ? selectedActivity.hostId === user.id
    : false;

  const canJoin = isAuthenticated && !isUserHost && !isUserAttending && selectedActivity && 
    (!selectedActivity.maxAttendees || selectedActivity.attendees.length < selectedActivity.maxAttendees);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="h2" style={[styles.headerTitle, { color: isDark ? "#FFFFFF" : theme.text }]}>
            Activities
          </ThemedText>
          <ThemedText type="body" style={[styles.headerSubtitle, { color: isDark ? "#A1A1A1" : theme.textSecondary }]}>
            Discover events near you
          </ThemedText>
        </View>
        <Pressable
          style={styles.radarBtn}
          onPress={() => navigation.navigate("SocialRadar" as any)}
        >
          <LinearGradient
            colors={["#FF8C42", "#F9A826"]}
            style={styles.radarBtnGradient}
          >
            <Ionicons name="radio-outline" size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  const renderFilterChips = () => (
    <View style={styles.filterSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTER_CATEGORIES.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <Pressable
              key={filter.id}
              style={[
                styles.filterChip,
                isActive
                  ? styles.filterChipActive
                  : isDark
                    ? styles.filterChipInactiveDark
                    : { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveFilter(filter.id);
              }}
            >
              <Icon
                name={filter.icon}
                size={15}
                color={isActive ? "#FFFFFF" : isDark ? "#EDEDED" : theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{
                  color: isActive ? "#FFFFFF" : isDark ? "#EDEDED" : theme.text,
                  marginLeft: 6,
                  fontWeight: isActive ? "700" : "400",
                  fontSize: 13,
                }}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderActivityCard = ({ item, index }: { item: Activity; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        style={[
          styles.activityCard,
          { backgroundColor: isDark ? "#22201E" : theme.cardBackground },
        ]}
        onPress={() => handleActivityPress(item)}
      >
        <View style={styles.cardImageContainer}>
          <Image
            source={{ uri: item.imageUrl || getPlaceholderImage(item.type) }}
            style={styles.cardImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
            style={styles.cardImageGradient}
          />
          <View style={styles.typeBadge}>
            <Icon name={ACTIVITY_TYPES.find(t => t.type === item.type)?.icon || "star"} size={12} color="#FFFFFF" />
            <ThemedText type="small" style={styles.typeBadgeText}>
              {(item.type || "other").charAt(0).toUpperCase() + (item.type || "other").slice(1)}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <ThemedText type="body" style={[styles.cardTitle, { color: isDark ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          
          <View style={styles.cardMeta}>
            <View style={styles.cardMetaItem}>
              <Icon name="map-pin" size={14} color={isDark ? "#C1C1C1" : theme.textSecondary} />
              <ThemedText type="small" style={[styles.cardMetaText, { color: isDark ? "#C1C1C1" : theme.textSecondary }]} numberOfLines={1}>
                {item.location}
              </ThemedText>
            </View>
            <View style={styles.cardMetaItem}>
              <Icon name="calendar" size={14} color={isDark ? "#C1C1C1" : theme.textSecondary} />
              <ThemedText type="small" style={[styles.cardMetaText, { color: isDark ? "#C1C1C1" : theme.textSecondary }]}>
                {formatDate(item.date)}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.cardFooter}>
            <View style={styles.attendeesPreview}>
              {item.attendees.slice(0, 3).map((attendee, idx) => (
                <Image
                  key={attendee.id}
                  source={attendee?.photos?.[0] ? { uri: attendee.photos[0] } : require("../../assets/images/default-avatar.png")}
                  style={[styles.attendeeThumb, { marginLeft: idx > 0 ? -8 : 0, borderColor: isDark ? "#22201E" : "#FFFFFF" }]}
                  contentFit="cover"
                />
              ))}
              <ThemedText type="small" style={[styles.attendeeCount, { color: isDark ? "#C1C1C1" : theme.textSecondary }]}>
                {item.attendees.length} going
              </ThemedText>
            </View>
            <View style={[styles.timeChip, { backgroundColor: isDark ? "#2B2A28" : theme.backgroundSecondary }]}>
              <Icon name="clock" size={12} color="#FF8C42" />
              <ThemedText type="small" style={styles.timeChipText}>
                {formatTime(item.date)}
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderListHeader = () => (
    <>
      {renderHeader()}
      {renderFilterChips()}
      <View style={styles.sectionHeader}>
        <ThemedText type="h3" style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : theme.text }]}>
          Upcoming
        </ThemedText>
        <ThemedText type="small" style={[styles.sectionCount, { color: isDark ? "#A1A1A1" : theme.textSecondary }]}>
          {sortedActivities.length} available
        </ThemedText>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.activitiesDark : GradientPresets.activitiesLight)]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={sortedActivities}
        renderItem={renderActivityCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top,
            paddingBottom: tabBarHeight + Spacing.lg,
          },
          activities.length === 0 && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor="#FF8C42"
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="compass"
            title="No Activities Yet"
            description="Be the first to organize a meetup! Create a hiking trip, climbing session, or campfire hangout."
            actionLabel={isAuthenticated ? "Create Activity" : undefined}
            onAction={isAuthenticated ? () => setShowCreateModal(true) : undefined}
          />
        }
      />

      <Pressable
        style={[styles.mapFab, { bottom: tabBarHeight + Spacing.lg, backgroundColor: isDark ? "#2A2A2A" : theme.cardBackground }]}
        onPress={() => setShowMapModal(true)}
        testID="button-open-map"
      >
        <Icon name="map" size={20} color="#FF8C42" />
      </Pressable>

      {isAuthenticated && activities.length > 0 ? (
        <Pressable
          style={[styles.fab, { bottom: tabBarHeight + Spacing.lg + 56 }]}
          onPress={() => setShowCreateModal(true)}
          testID="button-create-activity"
        >
          <Icon name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Create Activity</ThemedText>
            <Pressable onPress={() => setShowCreateModal(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <Input
              label="Title"
              placeholder="e.g., Sunrise hike at Cathedral Rock"
              value={newActivity.title}
              onChangeText={(text) => setNewActivity({ ...newActivity, title: text })}
              containerStyle={styles.modalInput}
              testID="input-activity-title"
            />

            <ThemedText type="small" style={styles.label}>
              Activity Type
            </ThemedText>
            <View style={styles.typeGrid}>
              {ACTIVITY_TYPES.map((activityType) => (
                <Pressable
                  key={activityType.type}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor:
                        newActivity.type === activityType.type
                          ? AppColors.primary
                          : theme.cardBackground,
                    },
                  ]}
                  onPress={() => setNewActivity({ ...newActivity, type: activityType.type })}
                >
                  <Icon
                    name={activityType.icon}
                    size={20}
                    color={newActivity.type === activityType.type ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: newActivity.type === activityType.type ? "#FFFFFF" : theme.text,
                      marginTop: 4,
                    }}
                  >
                    {activityType.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {newActivity.type === "other" && (
              <Input
                label="Specify Activity Type"
                placeholder="e.g., Yoga, Photography, Fishing..."
                value={newActivity.customType}
                onChangeText={(text) => setNewActivity({ ...newActivity, customType: text })}
                icon="tag"
                containerStyle={styles.modalInput}
                testID="input-custom-type"
              />
            )}

            <ThemedText type="small" style={styles.label}>
              Location
            </ThemedText>
            <Pressable
              style={[
                styles.locationPickerButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: newActivity.location ? AppColors.primary : theme.border,
                },
              ]}
              onPress={() => setShowLocationPicker(true)}
              testID="button-select-location"
            >
              <View style={[styles.locationPickerIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Icon name="map-pin" size={20} color={newActivity.location ? AppColors.primary : theme.textSecondary} />
              </View>
              <View style={styles.locationPickerText}>
                {newActivity.location ? (
                  <>
                    <ThemedText type="body" style={{ fontWeight: "500" }}>
                      {newActivity.location}
                    </ThemedText>
                    {selectedLocation?.address ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {selectedLocation.address}
                      </ThemedText>
                    ) : null}
                  </>
                ) : (
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Tap to select location on map
                  </ThemedText>
                )}
              </View>
              <Icon name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>

            <ThemedText type="small" style={styles.label}>
              When
            </ThemedText>
            <View style={[styles.scheduleCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Pressable
                style={styles.scheduleRow}
                onPress={() => setShowDatePicker(true)}
                testID="button-select-date"
              >
                <View style={[styles.scheduleIconContainer, { backgroundColor: `${AppColors.primary}15` }]}>
                  <Icon name="calendar" size={20} color={AppColors.primary} />
                </View>
                <View style={styles.scheduleTextContainer}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Date
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </ThemedText>
                </View>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
              
              <View style={[styles.scheduleDivider, { backgroundColor: theme.border }]} />
              
              <Pressable
                style={styles.scheduleRow}
                onPress={() => setShowTimePicker(true)}
                testID="button-select-time"
              >
                <View style={[styles.scheduleIconContainer, { backgroundColor: `${AppColors.accent}15` }]}>
                  <Icon name="clock" size={20} color={AppColors.accent} />
                </View>
                <View style={styles.scheduleTextContainer}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Time
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedTime.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
              
              <View style={[styles.scheduleDivider, { backgroundColor: theme.border }]} />
              
              <Pressable
                style={styles.scheduleRow}
                onPress={() => setShowDurationPicker(true)}
                testID="button-select-duration"
              >
                <View style={[styles.scheduleIconContainer, { backgroundColor: `${AppColors.primary}15` }]}>
                  <Icon name="clock" size={20} color={AppColors.primary} />
                </View>
                <View style={styles.scheduleTextContainer}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Duration
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {formatDuration(selectedDuration)}
                  </ThemedText>
                </View>
                <Icon name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Input
              label="Description"
              placeholder="Tell people what to expect..."
              value={newActivity.description}
              onChangeText={(text) => setNewActivity({ ...newActivity, description: text })}
              multiline
              numberOfLines={4}
              containerStyle={styles.modalInput}
              testID="input-activity-description"
            />

            <ThemedText type="small" style={styles.label}>
              Available Spots
            </ThemedText>
            <View style={[styles.spotsContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <View style={styles.spotsInfo}>
                <View style={[styles.spotsIconCircle, { backgroundColor: `${AppColors.accent}15` }]}>
                  <Ionicons name="people" size={20} color={AppColors.accent} />
                </View>
                <View>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {newActivity.maxAttendees} {newActivity.maxAttendees === 1 ? "spot" : "spots"}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Max participants
                  </ThemedText>
                </View>
              </View>
              <View style={styles.spotsButtons}>
                <Pressable
                  style={[styles.spotsBtn, { backgroundColor: theme.backgroundSecondary, opacity: newActivity.maxAttendees <= 2 ? 0.4 : 1 }]}
                  onPress={() => {
                    if (newActivity.maxAttendees > 2) {
                      setNewActivity({ ...newActivity, maxAttendees: newActivity.maxAttendees - 1 });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Ionicons name="remove" size={20} color={theme.text} />
                </Pressable>
                <TextInput
                  style={[styles.spotsCount, { color: theme.text, borderColor: theme.border }]}
                  value={String(newActivity.maxAttendees)}
                  onChangeText={(text) => {
                    const num = parseInt(text.replace(/[^0-9]/g, ""), 10);
                    if (!isNaN(num)) {
                      const clamped = Math.min(50, Math.max(2, num));
                      setNewActivity({ ...newActivity, maxAttendees: clamped });
                    } else if (text === "") {
                      setNewActivity({ ...newActivity, maxAttendees: 2 });
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  testID="input-spots-count"
                />
                <Pressable
                  style={[styles.spotsBtn, { backgroundColor: theme.backgroundSecondary, opacity: newActivity.maxAttendees >= 50 ? 0.4 : 1 }]}
                  onPress={() => {
                    if (newActivity.maxAttendees < 50) {
                      setNewActivity({ ...newActivity, maxAttendees: newActivity.maxAttendees + 1 });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Ionicons name="add" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>

            <ThemedText type="small" style={styles.label}>
              Activity Photo
            </ThemedText>
            <Pressable
              style={[
                styles.photoPickerButton,
                { 
                  backgroundColor: theme.cardBackground,
                  borderColor: newActivity.imageUrl ? AppColors.primary : theme.border,
                },
              ]}
              onPress={handlePickImage}
            >
              {newActivity.imageUrl ? (
                <View style={styles.photoPickerPreview}>
                  <Image
                    source={{ uri: newActivity.imageUrl }}
                    style={styles.photoPickerImage}
                    contentFit="cover"
                  />
                  <View style={styles.photoPickerOverlay}>
                    <Icon name="camera" size={24} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.photoPickerOverlayText}>
                      Change Photo
                    </ThemedText>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerEmpty}>
                  <View style={[styles.photoPickerIconCircle, { backgroundColor: theme.backgroundSecondary }]}>
                    <Icon name="camera" size={28} color={AppColors.primary} />
                  </View>
                  <ThemedText type="body" style={{ marginTop: Spacing.sm, fontWeight: "500" }}>
                    Add a Photo
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    Show the location or scenery
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <GradientButton
              onPress={handleCreateActivity}
              disabled={!newActivity.title.trim() || !newActivity.location.trim()}
              style={styles.createButton}
            >
              Create Activity
            </GradientButton>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedActivity ? (
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={{ flex: 1 }} numberOfLines={1}>
                {selectedActivity.title}
              </ThemedText>
              <Pressable onPress={() => setShowDetailModal(false)}>
                <Icon name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.detailRow}>
                <Icon name="calendar" size={18} color={AppColors.primary} />
                <ThemedText type="body" style={styles.detailText}>
                  {formatDate(selectedActivity.date)} at {formatTime(selectedActivity.date)}
                </ThemedText>
              </View>

              {selectedActivity.duration ? (
                <View style={styles.detailRow}>
                  <Icon name="clock" size={18} color={AppColors.primary} />
                  <ThemedText type="body" style={styles.detailText}>
                    Duration: {formatDuration(selectedActivity.duration || 2)}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Icon name="map-pin" size={18} color={AppColors.primary} />
                <ThemedText type="body" style={styles.detailText}>
                  {selectedActivity.location}
                </ThemedText>
              </View>

              <View style={styles.detailRow}>
                <Icon name="users" size={18} color={AppColors.primary} />
                <ThemedText type="body" style={styles.detailText}>
                  {selectedActivity.attendees.length}
                  {selectedActivity.maxAttendees
                    ? ` / ${selectedActivity.maxAttendees} spots`
                    : " attending"}
                </ThemedText>
              </View>

              <ThemedText type="body" style={styles.description}>
                {selectedActivity.description}
              </ThemedText>

              <View style={styles.hostSection}>
                <Image
                  source={selectedActivity.host?.photos?.[0] ? { uri: selectedActivity.host.photos[0] } : require("../../assets/images/default-avatar.png")}
                  style={styles.hostAvatar}
                  contentFit="cover"
                />
                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Hosted by
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedActivity.host.name}
                  </ThemedText>
                </View>
              </View>

              {selectedActivity.attendees.length > 0 ? (
                <View style={styles.attendeesSection}>
                  <ThemedText type="small" style={[styles.attendeesLabel, { color: theme.textSecondary }]}>
                    Attendees
                  </ThemedText>
                  <View style={styles.attendeesList}>
                    {selectedActivity.attendees.slice(0, 5).map((attendee, index) => (
                      <Image
                        key={attendee.id}
                        source={attendee?.photos?.[0] ? { uri: attendee.photos[0] } : require("../../assets/images/default-avatar.png")}
                        style={[styles.attendeeAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                        contentFit="cover"
                      />
                    ))}
                    {selectedActivity.attendees.length > 5 ? (
                      <View style={[styles.moreAttendees, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="small" style={{ fontWeight: "600" }}>
                          +{selectedActivity.attendees.length - 5}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {(isUserAttending || isUserHost) && (
                <View style={styles.actionButtons}>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.cardBackground, borderColor: theme.primary }]}
                    onPress={handleOpenChat}
                    testID="button-open-activity-chat"
                  >
                    <Icon name="message-circle" size={20} color={theme.primary} />
                    <ThemedText type="body" style={[styles.actionButtonText, { color: theme.primary }]}>
                      Group Chat
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.cardBackground, borderColor: AppColors.success }]}
                    onPress={handleInviteFriend}
                    testID="button-invite-friend"
                  >
                    <Icon name="user-plus" size={20} color={AppColors.success} />
                    <ThemedText type="body" style={[styles.actionButtonText, { color: AppColors.success }]}>
                      Invite Friend
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              {canJoin ? (
                <GradientButton 
                  onPress={handleJoinActivity} 
                  style={styles.joinButton}
                  disabled={isJoining}
                >
                  {isJoining ? "Joining..." : "Join Activity"}
                </GradientButton>
              ) : null}

              {isUserAttending ? (
                <>
                  <View style={styles.joinedBadge}>
                    <Icon name="check-circle" size={20} color={AppColors.success} />
                    <ThemedText style={[styles.joinedText, { color: AppColors.success }]}>
                      You're attending!
                    </ThemedText>
                  </View>
                  <Pressable
                    style={[styles.completeButton, { backgroundColor: `${AppColors.primary}15`, borderColor: AppColors.primary }]}
                    onPress={() => handleCompleteActivity(selectedActivity)}
                    testID="button-complete-activity"
                  >
                    <Icon name="flag" size={18} color={AppColors.primary} />
                    <ThemedText style={{ color: AppColors.primary, fontWeight: "600", fontSize: 14, marginLeft: Spacing.sm }}>
                      Mark Activity Complete
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}

              {isUserHost ? (
                <View style={styles.hostActionsSection}>
                  <View style={styles.joinedBadge}>
                    <Icon name="star" size={20} color={AppColors.primary} />
                    <ThemedText style={[styles.joinedText, { color: AppColors.primary }]}>
                      You're hosting this activity
                    </ThemedText>
                  </View>
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: "#FEE2E2" }]}
                    onPress={handleDeleteActivity}
                    testID="button-delete-activity"
                  >
                    <Icon name="trash-2" size={18} color="#EF4444" />
                    <ThemedText style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>
                      Delete Activity
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {!isAuthenticated ? (
                <ThemedText type="small" style={[styles.loginPrompt, { color: theme.textSecondary }]}>
                  Log in to join activities
                </ThemedText>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      <MapScreen
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialFilter="activities"
      />

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={handleSelectLocation}
        initialLocation={selectedLocation}
      />

      <SafetyRatingModal
        visible={showSafetyRating}
        onClose={() => {
          setShowSafetyRating(false);
          setActivityForRating(null);
        }}
        onSubmit={handleSafetyRatingSubmit}
        activity={activityForRating}
      />

      <PickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Select Date"
        type="date"
        dateValue={selectedDate}
        onDateChange={(date) => {
          setSelectedDate(date);
          const combinedDate = new Date(date);
          combinedDate.setHours(selectedTime.getHours());
          combinedDate.setMinutes(selectedTime.getMinutes());
          setNewActivity({ ...newActivity, date: combinedDate.toISOString() });
        }}
      />

      <PickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        title="Select Time"
        type="time"
        dateValue={selectedTime}
        onDateChange={(time) => {
          setSelectedTime(time);
          const combinedDate = new Date(selectedDate);
          combinedDate.setHours(time.getHours());
          combinedDate.setMinutes(time.getMinutes());
          setNewActivity({ 
            ...newActivity, 
            date: combinedDate.toISOString(),
            startTime: time.toISOString() 
          });
        }}
      />

      <PickerModal
        visible={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        title="Select Duration"
        type="duration"
        durationValue={selectedDuration}
        onDurationChange={(hours) => {
          setSelectedDuration(hours);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 24,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  radarBtn: {
    marginLeft: 12,
  },
  radarBtnGradient: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#A1A1A1",
    fontSize: 15,
    marginTop: 4,
  },
  filterSection: {
    paddingVertical: Spacing.md,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    marginRight: 0,
  },
  filterChipActive: {
    backgroundColor: "#FF8C42",
    shadowColor: "#FF8C42",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  filterChipInactiveDark: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sectionCount: {
    color: "#A1A1A1",
    fontSize: 13,
  },
  activityCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardImageContainer: {
    height: 150,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  cardImageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  typeBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(255,140,66,0.85)",
  },
  typeBadgeText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontWeight: "600",
    fontSize: 11,
  },
  cardContent: {
    padding: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    color: "#FFFFFF",
  },
  cardMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardMetaText: {
    marginLeft: 4,
    fontSize: 13,
    color: "#C1C1C1",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  attendeesPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  attendeeCount: {
    marginLeft: Spacing.sm,
    fontSize: 13,
    color: "#C1C1C1",
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeChipText: {
    color: "#FF8C42",
    marginLeft: 4,
    fontWeight: "600",
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8C42",
    shadowColor: "#FF8C42",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
  mapFab: {
    position: "absolute",
    right: Spacing.lg,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
  },
  modalInput: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeButton: {
    width: "30%",
    aspectRatio: 1.2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    marginTop: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  detailText: {
    marginLeft: Spacing.md,
  },
  description: {
    marginTop: Spacing.lg,
    lineHeight: 24,
  },
  hostSection: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing["2xl"],
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Spacing.md,
  },
  attendeesSection: {
    marginTop: Spacing.xl,
  },
  attendeesLabel: {
    marginBottom: Spacing.sm,
  },
  attendeesList: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  moreAttendees: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  joinButton: {
    marginTop: Spacing["2xl"],
  },
  joinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
  },
  joinedText: {
    marginLeft: Spacing.sm,
    fontWeight: "600",
    fontSize: 16,
  },
  hostActionsSection: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  loginPrompt: {
    textAlign: "center",
    marginTop: Spacing["2xl"],
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  actionButtonText: {
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
  locationPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.lg,
  },
  locationPickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  locationPickerText: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  spotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  spotsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  spotsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  spotsButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  spotsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  spotsCount: {
    fontSize: 18,
    fontWeight: "700" as const,
    minWidth: 40,
    textAlign: "center" as const,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoPickerButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  photoPickerEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  photoPickerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerPreview: {
    position: "relative",
    height: 160,
  },
  photoPickerImage: {
    width: "100%",
    height: "100%",
  },
  photoPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerOverlayText: {
    color: "#FFFFFF",
    marginTop: 4,
    fontWeight: "500",
  },
  scheduleCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  scheduleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  scheduleTextContainer: {
    flex: 1,
  },
  scheduleDivider: {
    height: 1,
    marginLeft: 64,
  },
  pickerContainer: {
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  pickerDoneButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  webDateTimeRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  durationScrollView: {
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.lg,
  },
  durationScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  durationIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
});
