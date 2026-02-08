import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 48, 300);
const RADAR_GREEN = "#00E676";

interface NearbyUser {
  userId: string;
  lat: number;
  lng: number;
  distance: number;
  name: string;
  age?: number;
  bio?: string;
  interests: string[];
  photos: string[];
  location?: string;
}

interface NearbyActivity {
  id: string;
  title: string;
  description?: string;
  type: string;
  location?: string;
  date: string;
  distance: number;
  attendeeCount: number;
  maxAttendees?: number;
  imageUrl?: string;
  hostId: string;
}

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    if (domain.startsWith("http")) return domain;
    return `https://${domain}`;
  }
  return "http://localhost:5000";
}

function RadarDot({ user, index, radarSize, onPress }: { user: NearbyUser; index: number; radarSize: number; onPress: () => void }) {
  const dotScale = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    dotScale.value = withDelay(
      index * 250 + 600,
      withSpring(1, { damping: 10, stiffness: 100 })
    );
    glowAnim.value = withDelay(
      index * 250 + 1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: interpolate(glowAnim.value, [0, 1], [0.6, 1]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0, 0.5]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 2]) }],
  }));

  const center = radarSize / 2;
  const maxRadius = center - 34;
  const angle = (index * 137.5 * Math.PI) / 180;
  const distRatio = Math.min(user.distance / 50, 0.95);
  const r = 20 + distRatio * (maxRadius - 20);
  const x = center + r * Math.cos(angle) - 18;
  const y = center + r * Math.sin(angle) - 18;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.dotContainer, { left: x, top: y }]}
    >
      <Animated.View style={[styles.dotGlow, glowStyle]} />
      <Animated.View style={[styles.dot, dotStyle]}>
        {user.photos?.[0] ? (
          <Image source={{ uri: user.photos[0] }} style={styles.dotPhoto} contentFit="cover" />
        ) : (
          <View style={styles.dotPlaceholder}>
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function PulsingRing({ delay, size }: { delay: number; size: number }) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 0 }),
          withTiming(1.1, { duration: 2800, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 2800, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: RADAR_GREEN,
        },
        style,
      ]}
    />
  );
}

function ActivityCard({ activity, onPress }: { activity: NearbyActivity; onPress: () => void }) {
  const dateStr = new Date(activity.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    hiking: "trail-sign",
    camping: "bonfire",
    meetup: "people",
    food: "restaurant",
    sports: "fitness",
    music: "musical-notes",
    other: "calendar",
  };

  return (
    <Pressable onPress={onPress} style={styles.activityCard}>
      <View style={styles.activityIconWrap}>
        <Ionicons
          name={typeIcons[activity.type] || "calendar"}
          size={18}
          color={RADAR_GREEN}
        />
      </View>
      <View style={styles.activityInfo}>
        <ThemedText style={styles.activityTitle} numberOfLines={1}>
          {activity.title}
        </ThemedText>
        <View style={styles.activityMeta}>
          <Ionicons name="navigate" size={11} color="rgba(255,255,255,0.4)" />
          <ThemedText style={styles.activityMetaText}>
            {activity.distance} km
          </ThemedText>
          <Ionicons name="time" size={11} color="rgba(255,255,255,0.4)" />
          <ThemedText style={styles.activityMetaText}>{dateStr}</ThemedText>
        </View>
      </View>
      <View style={styles.activityAttendees}>
        <Ionicons name="people" size={13} color="rgba(255,255,255,0.5)" />
        <ThemedText style={styles.attendeeCount}>
          {activity.attendeeCount}
          {activity.maxAttendees ? `/${activity.maxAttendees}` : ""}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function SocialRadarScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const navigation = useNavigation<any>();

  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [nearbyActivities, setNearbyActivities] = useState<NearbyActivity[]>([]);
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [scansUsed, setScansUsed] = useState(0);
  const [scansLimit, setScansLimit] = useState(2);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"people" | "activities">("people");

  const sweepRotation = useSharedValue(0);
  const centerPulse = useSharedValue(1);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweepRotation.value}deg` }],
  }));

  const centerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerPulse.value }],
  }));

  useEffect(() => {
    centerPulse.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const startScanAnimation = () => {
    sweepRotation.value = 0;
    sweepRotation.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
  };

  const stopScanAnimation = () => {
    cancelAnimation(sweepRotation);
  };

  const handleScan = async () => {
    if (!user?.id) return;
    setScanning(true);
    setLocationError(null);
    setSelectedUser(null);
    setRequestSent(new Set());
    startScanAnimation();

    try {
      let lat: number, lng: number;

      if (Platform.OS === "web") {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch {
          lat = 34.0522 + (Math.random() - 0.5) * 0.1;
          lng = -118.2437 + (Math.random() - 0.5) * 0.1;
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location permission is needed to scan for nearby nomads");
          setScanning(false);
          stopScanAnimation();
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/radar/scan", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          lat,
          lng,
          radiusKm: 50,
          tier,
        }),
      });

      if (response.status === 403) {
        setLimitReached(true);
        stopScanAnimation();
        setScanning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      if (!response.ok) throw new Error("Scan failed");

      const data = await response.json();

      await new Promise((resolve) => setTimeout(resolve, 3000));

      stopScanAnimation();
      setNearbyUsers(data.users || []);
      setNearbyActivities(data.activities || []);
      setScansUsed(data.scansUsed || 0);
      setScansLimit(data.scansLimit || 2);
      setScanned(true);
      setScanning(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      stopScanAnimation();
      setScanning(false);
      setLocationError(err.message || "Something went wrong");
    }
  };

  const handleUserPress = (u: NearbyUser) => {
    setSelectedUser(u);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleViewProfile = (targetUser: NearbyUser) => {
    Alert.alert(
      `${targetUser.name}${targetUser.age ? `, ${targetUser.age}` : ""}`,
      [
        targetUser.location ? `Location: ${targetUser.location}` : null,
        `Distance: ${targetUser.distance} km away`,
        targetUser.bio ? `\n${targetUser.bio}` : null,
        targetUser.interests?.length ? `\nInterests: ${targetUser.interests.join(", ")}` : null,
      ].filter(Boolean).join("\n"),
      [{ text: "OK" }]
    );
  };

  const handleSendChatRequest = async (targetUser: NearbyUser) => {
    if (!user?.id || sendingRequest) return;
    setSendingRequest(true);

    try {
      const baseUrl = getApiUrl();

      const { data: myProfile } = await fetch(
        new URL(`/api/profile/${user.id}`, baseUrl).toString()
      ).then(r => r.json().then(d => ({ data: d })).catch(() => ({ data: null })));

      const response = await fetch(new URL("/api/radar/chat-request", baseUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: targetUser.userId,
          senderName: myProfile?.name || user.email?.split("@")[0] || "Nomad",
          senderPhoto: myProfile?.photos?.[0] || "",
          receiverName: targetUser.name,
          receiverPhoto: targetUser.photos?.[0] || "",
        }),
      });

      const data = await response.json();

      if (data.alreadyConnected) {
        Alert.alert("Already Connected", "You're already connected with this person. Check your matches!");
      } else if (data.alreadyRequested) {
        Alert.alert("Request Pending", "You've already sent a chat request to this person.");
      } else if (data.success) {
        setRequestSent(prev => new Set(prev).add(targetUser.userId));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send chat request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleActivityPress = (activity: NearbyActivity) => {
    setSelectedUser(null);
    navigation.navigate("Activities");
  };

  const totalFound = nearbyUsers.length + nearbyActivities.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0D0B", "#0D1A12", "#0A0D0B"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.bgParticles}>
        {[...Array(12)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.bgDot,
              {
                top: `${8 + Math.random() * 84}%`,
                left: `${5 + Math.random() * 90}%`,
                width: 2 + Math.random() * 3,
                height: 2 + Math.random() * 3,
                opacity: 0.15 + Math.random() * 0.2,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="radio" size={16} color="#00E676" />
          <ThemedText style={styles.headerTitle}>Social Radar</ThemedText>
        </View>
        <View style={styles.scanBadge}>
          <ThemedText style={styles.scanBadgeText}>
            {scansLimit === -1 ? `${scansUsed}` : `${scansUsed}/${scansLimit}`}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.radarArea}>
          <View style={[styles.radarOuter, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
            <View style={styles.radarBorder} />

            <View style={[styles.ring, styles.ring1]} />
            <View style={[styles.ring, styles.ring2]} />
            <View style={[styles.ring, styles.ring3]} />

            <View style={styles.crossH} />
            <View style={styles.crossV} />

            <View style={styles.diagLine1} />
            <View style={styles.diagLine2} />

            {scanning && (
              <>
                <PulsingRing delay={0} size={RADAR_SIZE} />
                <PulsingRing delay={900} size={RADAR_SIZE} />
                <PulsingRing delay={1800} size={RADAR_SIZE} />

                <Animated.View style={[styles.sweepWrap, sweepStyle]}>
                  <LinearGradient
                    colors={["rgba(0,230,118,0.45)", "rgba(0,230,118,0.15)", "rgba(0,230,118,0)"]}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.sweepGradient, { width: RADAR_SIZE / 2, height: RADAR_SIZE / 2 }]}
                  />
                </Animated.View>
              </>
            )}

            {scanned && nearbyUsers.map((u, i) => (
              <RadarDot
                key={u.userId}
                user={u}
                index={i}
                radarSize={RADAR_SIZE}
                onPress={() => handleUserPress(u)}
              />
            ))}

            <Animated.View style={[styles.centerGlow, centerPulseStyle]}>
              <View style={styles.centerDotOuter}>
                <View style={styles.centerDotInner} />
              </View>
            </Animated.View>

            <View style={styles.distLabel1}>
              <ThemedText style={styles.distLabelText}>15km</ThemedText>
            </View>
            <View style={styles.distLabel2}>
              <ThemedText style={styles.distLabelText}>30km</ThemedText>
            </View>
            <View style={styles.distLabel3}>
              <ThemedText style={styles.distLabelText}>50km</ThemedText>
            </View>
          </View>
        </View>

        {!scanning && !scanned && !limitReached && (
          <View style={styles.ctaArea}>
            <ThemedText style={styles.ctaHint}>Find nomads near your location</ThemedText>
            <Pressable onPress={handleScan} style={styles.scanBtn}>
              <LinearGradient
                colors={["#00E676", "#00C853"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scanBtnGrad}
              >
                <Ionicons name="radio-outline" size={24} color="#FFF" />
                <ThemedText style={styles.scanBtnText}>Start Scan</ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {scanning && (
          <View style={styles.statusArea}>
            <View style={styles.statusDots}>
              <ActivityIndicator size="small" color="#00E676" />
            </View>
            <ThemedText style={styles.statusText}>Scanning for nomads...</ThemedText>
            <ThemedText style={styles.statusSub}>Using your current location</ThemedText>
          </View>
        )}

        {scanned && totalFound === 0 && (
          <View style={styles.statusArea}>
            <Ionicons name="location-outline" size={28} color="rgba(255,255,255,0.3)" />
            <ThemedText style={styles.statusText}>No nomads found nearby</ThemedText>
            <ThemedText style={styles.statusSub}>Try scanning again later</ThemedText>
            <Pressable onPress={handleScan} style={styles.rescanBtn}>
              <ThemedText style={styles.rescanText}>Scan Again</ThemedText>
            </Pressable>
          </View>
        )}

        {scanned && totalFound > 0 && (
          <View style={styles.resultsArea}>
            <View style={styles.resultsSummary}>
              <ThemedText style={styles.foundCount}>
                {nearbyUsers.length} nomad{nearbyUsers.length !== 1 ? "s" : ""}
                {nearbyActivities.length > 0 && ` + ${nearbyActivities.length} activit${nearbyActivities.length !== 1 ? "ies" : "y"}`}
              </ThemedText>
              <Pressable onPress={() => { setScanned(false); setNearbyUsers([]); setNearbyActivities([]); handleScan(); }} style={styles.rescanBtn}>
                <Ionicons name="refresh" size={14} color={RADAR_GREEN} />
              </Pressable>
            </View>

            {(nearbyUsers.length > 0 && nearbyActivities.length > 0) && (
              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => setActiveTab("people")}
                  style={[styles.tab, activeTab === "people" && styles.tabActive]}
                >
                  <Ionicons name="people" size={15} color={activeTab === "people" ? "#FFF" : "rgba(255,255,255,0.4)"} />
                  <ThemedText style={[styles.tabText, activeTab === "people" && styles.tabTextActive]}>
                    People ({nearbyUsers.length})
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab("activities")}
                  style={[styles.tab, activeTab === "activities" && styles.tabActive]}
                >
                  <Ionicons name="calendar" size={15} color={activeTab === "activities" ? "#FFF" : "rgba(255,255,255,0.4)"} />
                  <ThemedText style={[styles.tabText, activeTab === "activities" && styles.tabTextActive]}>
                    Activities ({nearbyActivities.length})
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {(activeTab === "people" || nearbyActivities.length === 0) && nearbyUsers.length > 0 && (
              <View style={styles.listSection}>
                <ThemedText style={styles.sectionHint}>Tap a dot on the radar or a person below</ThemedText>
                {nearbyUsers.map((u) => (
                  <Pressable key={u.userId} onPress={() => handleUserPress(u)} style={styles.userRow}>
                    {u.photos?.[0] ? (
                      <Image source={{ uri: u.photos[0] }} style={styles.userRowPhoto} contentFit="cover" />
                    ) : (
                      <View style={[styles.userRowPhoto, styles.userRowPhotoEmpty]}>
                        <Ionicons name="person" size={16} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                    <View style={styles.userRowInfo}>
                      <ThemedText style={styles.userRowName}>{u.name}{u.age ? `, ${u.age}` : ""}</ThemedText>
                      <View style={styles.userRowDistRow}>
                        <Ionicons name="navigate" size={11} color={RADAR_GREEN} />
                        <ThemedText style={styles.userRowDist}>{u.distance} km</ThemedText>
                      </View>
                    </View>
                    {requestSent.has(u.userId) ? (
                      <View style={styles.requestSentBadge}>
                        <Ionicons name="checkmark" size={14} color={RADAR_GREEN} />
                      </View>
                    ) : (
                      <Pressable onPress={() => handleSendChatRequest(u)} style={styles.miniRequestBtn}>
                        <Ionicons name="chatbubble" size={14} color={RADAR_GREEN} />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {activeTab === "activities" && nearbyActivities.length > 0 && (
              <View style={styles.listSection}>
                <ThemedText style={styles.sectionHint}>Upcoming activities near you</ThemedText>
                {nearbyActivities.map((act) => (
                  <ActivityCard key={act.id} activity={act} onPress={() => handleActivityPress(act)} />
                ))}
              </View>
            )}
          </View>
        )}

        {locationError && (
          <View style={styles.statusArea}>
            <Ionicons name="warning-outline" size={24} color="#FFCA28" />
            <ThemedText style={styles.statusText}>{locationError}</ThemedText>
            <Pressable onPress={handleScan} style={styles.rescanBtn}>
              <ThemedText style={styles.rescanText}>Try Again</ThemedText>
            </Pressable>
          </View>
        )}

        {limitReached && (
          <View style={styles.limitArea}>
            <Ionicons name="lock-closed" size={24} color="#00E676" />
            <ThemedText style={styles.limitTitle}>Weekly Limit Reached</ThemedText>
            <ThemedText style={styles.limitSub}>Upgrade for unlimited radar scans</ThemedText>
            <Pressable onPress={() => navigation.navigate("Subscription")}>
              <LinearGradient
                colors={["#00E676", "#00C853"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeBtn}
              >
                <ThemedText style={styles.upgradeBtnText}>Upgrade Now</ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {selectedUser && (
        <Animated.View
          entering={FadeInUp.springify()}
          exiting={FadeOut.duration(150)}
          style={[styles.profileSheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.profileSheetInner}>
            <Pressable style={styles.profileClose} onPress={() => setSelectedUser(null)}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>

            <View style={styles.profileTop}>
              {selectedUser.photos?.[0] ? (
                <Image source={{ uri: selectedUser.photos[0] }} style={styles.profileAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.profileAvatar, styles.profileAvatarEmpty]}>
                  <Ionicons name="person" size={24} color="rgba(255,255,255,0.35)" />
                </View>
              )}
              <View style={styles.profileDetails}>
                <ThemedText style={styles.profileName}>
                  {selectedUser.name}{selectedUser.age ? `, ${selectedUser.age}` : ""}
                </ThemedText>
                <View style={styles.profileDistRow}>
                  <Ionicons name="navigate" size={13} color="#00E676" />
                  <ThemedText style={styles.profileDist}>{selectedUser.distance} km away</ThemedText>
                </View>
                {selectedUser.location && (
                  <ThemedText style={styles.profileLocation}>{selectedUser.location}</ThemedText>
                )}
              </View>
            </View>

            {selectedUser.bio && (
              <ThemedText style={styles.profileBio} numberOfLines={2}>{selectedUser.bio}</ThemedText>
            )}

            {selectedUser.interests && selectedUser.interests.length > 0 && (
              <View style={styles.chipRow}>
                {(selectedUser.interests as string[]).slice(0, 5).map((tag, i) => (
                  <View key={i} style={styles.chip}>
                    <ThemedText style={styles.chipText}>{tag}</ThemedText>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.profileActions}>
              <Pressable
                onPress={() => handleViewProfile(selectedUser)}
                style={styles.profileActionBtn}
              >
                <Ionicons name="person-circle" size={20} color={RADAR_GREEN} />
                <ThemedText style={styles.profileActionText}>View Profile</ThemedText>
              </Pressable>

              {requestSent.has(selectedUser.userId) ? (
                <View style={styles.profileActionSent}>
                  <Ionicons name="checkmark-circle" size={20} color={RADAR_GREEN} />
                  <ThemedText style={styles.profileActionSentText}>Request Sent</ThemedText>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleSendChatRequest(selectedUser)}
                  disabled={sendingRequest}
                  style={styles.chatRequestBtn}
                >
                  <LinearGradient
                    colors={["#00E676", "#00C853"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.chatRequestGrad}
                  >
                    {sendingRequest ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble" size={18} color="#FFF" />
                        <ThemedText style={styles.chatRequestText}>Chat Request</ThemedText>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgParticles: {
    ...StyleSheet.absoluteFillObject,
  },
  bgDot: {
    position: "absolute",
    borderRadius: 4,
    backgroundColor: "#00E676",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginRight: 38,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700" as const,
  },
  scanBadge: {
    backgroundColor: "rgba(0,230,118,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scanBadgeText: {
    color: "#00E676",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    alignItems: "center",
    paddingBottom: 20,
  },
  radarArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  radarOuter: {
    borderRadius: 999,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  radarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(0,230,118,0.2)",
    backgroundColor: "rgba(0,230,118,0.02)",
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.08)",
  },
  ring1: {
    width: "75%",
    height: "75%",
    top: "12.5%",
    left: "12.5%",
  },
  ring2: {
    width: "50%",
    height: "50%",
    top: "25%",
    left: "25%",
  },
  ring3: {
    width: "25%",
    height: "25%",
    top: "37.5%",
    left: "37.5%",
  },
  crossH: {
    position: "absolute",
    width: "100%",
    height: 1,
    top: "50%",
    backgroundColor: "rgba(0,230,118,0.06)",
  },
  crossV: {
    position: "absolute",
    height: "100%",
    width: 1,
    left: "50%",
    backgroundColor: "rgba(0,230,118,0.06)",
  },
  diagLine1: {
    position: "absolute",
    width: "141%",
    height: 1,
    top: "50%",
    left: "-20.5%",
    backgroundColor: "rgba(0,230,118,0.04)",
    transform: [{ rotate: "45deg" }],
  },
  diagLine2: {
    position: "absolute",
    width: "141%",
    height: 1,
    top: "50%",
    left: "-20.5%",
    backgroundColor: "rgba(0,230,118,0.04)",
    transform: [{ rotate: "-45deg" }],
  },
  sweepWrap: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  sweepGradient: {
    position: "absolute",
    top: 0,
    left: "50%",
    borderTopRightRadius: 999,
  },
  centerGlow: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,230,118,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,230,118,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00E676",
  },
  distLabel1: {
    position: "absolute",
    top: "14%",
    right: "14%",
  },
  distLabel2: {
    position: "absolute",
    top: "27%",
    right: "24%",
  },
  distLabel3: {
    position: "absolute",
    top: "39%",
    right: "35%",
  },
  distLabelText: {
    color: "rgba(0,230,118,0.25)",
    fontSize: 9,
    fontWeight: "500" as const,
  },
  dotContainer: {
    position: "absolute",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  dotGlow: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,230,118,0.25)",
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#00C853",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  dotPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  dotPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaArea: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  ctaHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  scanBtn: {
    borderRadius: 28,
    overflow: "hidden",
  },
  scanBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 10,
    borderRadius: 28,
  },
  scanBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700" as const,
  },
  statusArea: {
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  statusDots: {
    marginBottom: 4,
  },
  statusText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  statusSub: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  foundCount: {
    color: "#00E676",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  rescanBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,230,118,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.2)",
  },
  rescanText: {
    color: "#00E676",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  resultsArea: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  resultsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tabActive: {
    backgroundColor: "rgba(0,230,118,0.12)",
    borderColor: "rgba(0,230,118,0.25)",
  },
  tabText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  tabTextActive: {
    color: "#FFF",
  },
  listSection: {
    gap: 8,
  },
  sectionHint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    marginBottom: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  userRowPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(0,230,118,0.25)",
  },
  userRowPhotoEmpty: {
    backgroundColor: "rgba(0,230,118,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  userRowInfo: {
    flex: 1,
  },
  userRowName: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600" as const,
  },
  userRowDistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  userRowDist: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
  },
  miniRequestBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,230,118,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.2)",
  },
  requestSentBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,230,118,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(0,230,118,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.15)",
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  activityMetaText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    marginRight: 6,
  },
  activityAttendees: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendeeCount: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  limitArea: {
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  limitTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700" as const,
  },
  limitSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  upgradeBtn: {
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 8,
  },
  upgradeBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  profileSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  profileSheetInner: {
    backgroundColor: "rgba(20,28,22,0.97)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.15)",
  },
  profileClose: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(0,230,118,0.35)",
  },
  profileAvatarEmpty: {
    backgroundColor: "rgba(0,230,118,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  profileDistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  profileDist: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  profileLocation: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginTop: 2,
  },
  profileBio: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  chip: {
    backgroundColor: "rgba(0,230,118,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.18)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: "#00E676",
    fontSize: 12,
    fontWeight: "500" as const,
  },
  profileActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  profileActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,230,118,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.18)",
  },
  profileActionText: {
    color: RADAR_GREEN,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  profileActionSent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,230,118,0.05)",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.1)",
  },
  profileActionSentText: {
    color: "rgba(0,230,118,0.6)",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  chatRequestBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  chatRequestGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  chatRequestText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700" as const,
  },
});
