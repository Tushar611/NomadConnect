import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapView, Marker, Callout, PROVIDER_GOOGLE, mapsAvailable, Region } from "@/lib/maps";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GradientButton } from "@/components/GradientButton";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { Activity, User } from "@/types";
import { AppColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface MapMarker {
  id: string;
  type: "activity" | "user" | "spot";
  coordinate: { latitude: number; longitude: number };
  title: string;
  data: Activity | User | CampSpot;
}

interface CampSpot {
  id: string;
  name: string;
  description: string;
  type: "hiking" | "surfing" | "camping" | "fishing" | "climbing" | "kayaking";
  coordinate: { latitude: number; longitude: number };
  activityId?: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const MOCK_USER_LOCATIONS: { userId: string; coordinate: { latitude: number; longitude: number } }[] = [
  { userId: "mock1", coordinate: { latitude: 34.869, longitude: -111.761 } },
  { userId: "mock2", coordinate: { latitude: 36.245, longitude: -121.808 } },
  { userId: "mock3", coordinate: { latitude: 38.573, longitude: -109.549 } },
  { userId: "mock4", coordinate: { latitude: 37.937, longitude: -107.811 } },
  { userId: "mock5", coordinate: { latitude: 21.306, longitude: -157.858 } },
];

const SPOT_ICONS: Record<CampSpot["type"], string> = {
  hiking: "compass",
  surfing: "wind",
  camping: "tent",
  fishing: "anchor",
  climbing: "mountain",
  kayaking: "droplet",
};

const SPOT_COLORS: Record<CampSpot["type"], string> = {
  hiking: "#4CAF50",
  surfing: "#2196F3",
  camping: "#FF9800",
  fishing: "#00BCD4",
  climbing: "#9C27B0",
  kayaking: "#009688",
};

type FilterType = "all" | "activities" | "spots";

interface Props {
  visible?: boolean;
  onClose?: () => void;
  initialFilter?: FilterType;
}

const { width, height } = Dimensions.get("window");

export default function MapScreen({ visible = true, onClose, initialFilter = "all" }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { activities, profiles } = useData();
  const { user } = useAuth();
  const mapRef = useRef<typeof MapView>(null);

  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [savedSpots, setSavedSpots] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [region, setRegion] = useState<Region>({
    latitude: 36.0,
    longitude: -115.0,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  const [activityGeo, setActivityGeo] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const geocodingRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const requestLocationPermission = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);
        setRegion({
          ...coords,
          latitudeDelta: 5,
          longitudeDelta: 5,
        });
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 5,
          longitudeDelta: 5,
        }, 500);
      } else {
        setLocationPermission(false);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationPermission(false);
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const geocodeActivities = async () => {
      for (const activity of activities) {
        if (activity.latitude !== undefined && activity.longitude !== undefined) continue;
        if (!activity.location) continue;
        if (activityGeo[activity.id]) continue;
        if (geocodingRef.current.has(activity.id)) continue;
        geocodingRef.current.add(activity.id);

        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(activity.location)}`;
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              "User-Agent": "NomadConnect/1.0 (hackathon)",
            },
          });
          if (!response.ok) continue;
          const data = (await response.json()) as { lat: string; lon: string }[];
          if (data && data.length > 0 && !isCancelled) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              setActivityGeo((prev) => ({
                ...prev,
                [activity.id]: { latitude: lat, longitude: lon },
              }));
            }
          }
        } catch (error) {
          console.error("Activity geocode error:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };

    geocodeActivities();

    return () => {
      isCancelled = true;
    };
  }, [activities, activityGeo]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const centerOnUserLocation = useCallback(async () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 2,
        longitudeDelta: 2,
      }, 500);
    } else {
      await requestLocationPermission();
    }
  }, [userLocation, requestLocationPermission]);

  const activityMarkers: MapMarker[] = activities
    .map((activity) => {
      const direct = activity.latitude !== undefined && activity.longitude !== undefined
        ? { latitude: activity.latitude, longitude: activity.longitude }
        : undefined;
      const geocoded = activityGeo[activity.id];
      const coordinate = direct || geocoded;
      if (!coordinate) return null;
      return {
        id: `activity-${activity.id}`,
        type: "activity",
        coordinate,
        title: activity.title,
        data: activity,
      } as MapMarker;
    })
    .filter(Boolean) as MapMarker[];

  const userMarkers: MapMarker[] = profiles.slice(0, 8).map((profile, index) => {
    let coordinate: { latitude: number; longitude: number };
    
    if (userLocation) {
      coordinate = {
        latitude: userLocation.latitude + (Math.random() - 0.5) * 3,
        longitude: userLocation.longitude + (Math.random() - 0.5) * 3,
      };
    } else {
      const location = MOCK_USER_LOCATIONS[index % MOCK_USER_LOCATIONS.length];
      coordinate = location.coordinate;
    }
    
    return {
      id: `user-${profile.user.id}`,
      type: "user",
      coordinate,
      title: profile.user.name,
      data: profile.user,
    };
  });

  const mapActivityTypeToSpotType = (activityType: string): CampSpot["type"] => {
    const mapping: Record<string, CampSpot["type"]> = {
      hiking: "hiking",
      climbing: "climbing",
      skiing: "hiking",
      camping: "camping",
      surfing: "surfing",
      other: "hiking",
    };
    return mapping[activityType] || "hiking";
  };

  const spotMarkers: MapMarker[] = activities
    .map((activity) => {
      const direct = activity.latitude !== undefined && activity.longitude !== undefined
        ? { latitude: activity.latitude, longitude: activity.longitude }
        : undefined;
      const geocoded = activityGeo[activity.id];
      const coordinate = direct || geocoded;
      if (!coordinate) return null;
      
      const spot: CampSpot = {
        id: `spot-from-activity-${activity.id}`,
        name: activity.location,
        description: activity.description,
        type: mapActivityTypeToSpotType(activity.type),
        coordinate,
        activityId: activity.id,
      };
      
      return {
        id: `spot-${activity.id}`,
        type: "spot",
        coordinate,
        title: activity.location,
        data: spot,
      } as MapMarker;
    })
    .filter(Boolean) as MapMarker[];

  const allMarkers = [
    ...(filter === "all" || filter === "activities" ? activityMarkers : []),
    ...(filter === "all" || filter === "spots" ? spotMarkers : []),
  ];

  const handleMarkerPress = (marker: MapMarker) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMarker(marker);
    setShowDetail(true);
    mapRef.current?.animateToRegion({
      ...marker.coordinate,
      latitudeDelta: 2,
      longitudeDelta: 2,
    }, 300);
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }
        abortRef.current = new AbortController();
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(query.trim())}`;
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "NomadConnect/1.0 (hackathon)",
          },
          signal: abortRef.current.signal,
        });
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }
        const data = (await response.json()) as NominatimResult[];
        setSearchResults(data);
        setShowSearchResults(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Map search error:", error);
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } finally {
        setIsSearching(false);
      }
    }, 450);
  }, []);

  const handleSelectSearchResult = useCallback((result: NominatimResult) => {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    Haptics.selectionAsync();
    const nextRegion = {
      latitude,
      longitude,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 500);
    setSearchQuery(result.display_name);
    setShowSearchResults(false);
  }, []);

  const handleGetDirections = (coordinate: { latitude: number; longitude: number }, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { latitude, longitude } = coordinate;
    const label = encodeURIComponent(name);
    
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}&q=${label}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        Linking.openURL(webUrl);
      }
    });
  };

  const handleSaveSpot = (spotId: string, spotName: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (savedSpots.includes(spotId)) {
      setSavedSpots(savedSpots.filter(id => id !== spotId));
      Alert.alert("Removed", `${spotName} removed from saved spots`);
    } else {
      setSavedSpots([...savedSpots, spotId]);
      Alert.alert("Saved!", `${spotName} added to your saved spots`);
    }
  };

  const getMarkerColor = (marker: MapMarker) => {
    if (marker.type === "activity") {
      const activity = marker.data as Activity;
      const activityType = activity.type as keyof typeof SPOT_COLORS;
      return SPOT_COLORS[activityType] || theme.primary;
    }
    if (marker.type === "spot") {
      const spot = marker.data as CampSpot;
      return SPOT_COLORS[spot.type] || "#4CAF50";
    }
    return theme.primary;
  };

  const getMarkerIcon = (marker: MapMarker) => {
    if (marker.type === "activity") {
      const activity = marker.data as Activity;
      const activityType = activity.type as keyof typeof SPOT_ICONS;
      return SPOT_ICONS[activityType] || "calendar";
    }
    if (marker.type === "spot") {
      const spot = marker.data as CampSpot;
      return SPOT_ICONS[spot.type] || "map-pin";
    }
    return "map-pin";
  };

  const FilterPill = ({ label, filterType, icon, color }: { label: string; filterType: FilterType; icon: string; color: string }) => {
    const isActive = filter === filterType || filter === "all";
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setFilter(filter === filterType ? "all" : filterType);
        }}
        style={[
          styles.filterPill,
          {
            backgroundColor: isActive ? color : theme.cardBackground,
            borderColor: isActive ? color : theme.border,
          },
        ]}
      >
        <Icon name={icon} size={14} color={isActive ? "#FFF" : theme.textSecondary} />
        <ThemedText
          type="small"
          style={{
            color: isActive ? "#FFF" : theme.textSecondary,
            marginLeft: 6,
            fontWeight: "600",
          }}
        >
          {label}
        </ThemedText>
        <View style={[styles.filterToggle, { backgroundColor: isActive ? "rgba(255,255,255,0.3)" : theme.backgroundSecondary }]}>
          <View style={[styles.filterToggleDot, { backgroundColor: isActive ? "#FFF" : theme.textSecondary, marginLeft: isActive ? 12 : 2 }]} />
        </View>
      </Pressable>
    );
  };

  const renderDetailContent = () => {
    if (!selectedMarker) return null;

    if (selectedMarker.type === "activity") {
      const activity = selectedMarker.data as Activity;
      return (
        <>
          <View style={styles.detailHeader}>
            <View style={[styles.typeBadge, { backgroundColor: theme.primary }]}>
              <Icon name="calendar" size={12} color="#FFF" />
              <ThemedText style={styles.typeBadgeText}>{activity.type}</ThemedText>
            </View>
            <Pressable onPress={() => setShowDetail(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ThemedText type="h3" style={styles.detailTitle}>{activity.title}</ThemedText>
          <View style={styles.detailRow}>
            <Icon name="map-pin" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: 8, color: theme.textSecondary }}>
              {activity.location}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Icon name="clock" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: 8, color: theme.textSecondary }}>
              {new Date(activity.date).toLocaleDateString()}
            </ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Icon name="users" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: 8, color: theme.textSecondary }}>
              {activity.attendees.length} attending
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.detailDescription}>
            {activity.description}
          </ThemedText>
        </>
      );
    }

    if (selectedMarker.type === "user") {
      const profile = selectedMarker.data as User;
      return (
        <>
          <View style={styles.detailHeader}>
            <View style={[styles.typeBadge, { backgroundColor: "#9C27B0" }]}>
              <Icon name="user" size={12} color="#FFF" />
              <ThemedText style={styles.typeBadgeText}>Nomad</ThemedText>
            </View>
            <Pressable onPress={() => setShowDetail(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.userDetailHeader}>
            <Image
              source={profile.photos?.[0] ? { uri: profile.photos[0] } : require("../../assets/images/default-avatar.png")}
              style={styles.userAvatar}
              contentFit="cover"
            />
            <View style={styles.userInfo}>
              <ThemedText type="h3">{profile.name}, {profile.age}</ThemedText>
              <View style={styles.detailRow}>
                <Icon name="map-pin" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary }}>
                  {profile.location || "Somewhere on the road"}
                </ThemedText>
              </View>
              {profile.vanType ? (
                <View style={[styles.vanBadge, { backgroundColor: theme.primary + "20" }]}>
                  <Icon name="truck" size={12} color={theme.primary} />
                  <ThemedText type="small" style={{ marginLeft: 4, color: theme.primary }}>
                    {profile.vanType}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <ThemedText type="body" style={styles.detailDescription}>
            {profile.bio}
          </ThemedText>
        </>
      );
    }

    if (selectedMarker.type === "spot") {
      const spot = selectedMarker.data as CampSpot;
      return (
        <>
          <View style={styles.detailHeader}>
            <View style={[styles.typeBadge, { backgroundColor: SPOT_COLORS[spot.type] || AppColors.primary }]}>
              <Icon name={SPOT_ICONS[spot.type] || "map-pin"} size={12} color="#FFF" />
              <ThemedText style={styles.typeBadgeText}>
                {(spot.type || "spot").charAt(0).toUpperCase() + (spot.type || "spot").slice(1)}
              </ThemedText>
            </View>
            <Pressable onPress={() => setShowDetail(false)}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ThemedText type="h3" style={styles.detailTitle}>{spot.name}</ThemedText>
          <ThemedText type="body" style={styles.detailDescription}>
            {spot.description}
          </ThemedText>
          <View style={styles.spotActions}>
            <Pressable 
              style={[styles.spotActionButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => handleGetDirections(spot.coordinate, spot.name)}
              testID="button-get-directions"
            >
              <Icon name="navigation" size={18} color={theme.primary} />
              <ThemedText type="small" style={{ marginLeft: 6, color: theme.primary, fontWeight: "600" }}>
                Get Directions
              </ThemedText>
            </Pressable>
          </View>
        </>
      );
    }

    return null;
  };

  if (Platform.OS === 'web' || !MapView) {
    const webContent = (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.webFallback}>
          {onClose ? (
            <Pressable
              style={[styles.closeButton, { top: insets.top + 12, backgroundColor: theme.cardBackground }, Shadows.medium]}
              onPress={onClose}
            >
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          ) : null}
          <Icon name="map" size={64} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.webFallbackTitle}>Map Feature</ThemedText>
          <ThemedText type="body" style={[styles.webFallbackText, { color: theme.textSecondary }]}>
            The interactive map is available on mobile devices. Open this app in Expo Go on your phone to explore activities, nomads, and camping spots near you.
          </ThemedText>
          <View style={styles.webFallbackStats}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
              <ThemedText type="h3" style={{ color: theme.primary }}>{activities.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Activities</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
              <ThemedText type="h3" style={{ color: "#4CAF50" }}>{activities.length}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Spots</ThemedText>
            </View>
          </View>
        </View>
      </View>
    );

    if (visible !== undefined) {
      return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
          {webContent}
        </Modal>
      );
    }
    return webContent;
  }

  const mapContent = (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
      >
        {allMarkers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            onPress={() => handleMarkerPress(marker)}
          >
            <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(marker) }]}>
              <Icon
                name={getMarkerIcon(marker)}
                size={16}
                color="#FFF"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.searchContainer, { top: insets.top + (onClose ? 130 : 82) }]}>
        <View style={[styles.searchCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}>
          <View style={styles.searchInputRow}>
            <Icon name="search" size={16} color={theme.textSecondary} />
            <TextInput
              placeholder="Search places, cities, landmarks..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchResults(true);
                }
              }}
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  hitSlop={8}
                >
                  <Icon name="x" size={16} color={theme.textSecondary} />
                </Pressable>
              ) : null
            )}
          </View>
          {showSearchResults ? (
            <View style={[styles.searchResults, { borderTopColor: theme.border }]}>
              <ScrollView style={styles.searchResultsList} keyboardShouldPersistTaps="handled">
                {searchResults.length === 0 ? (
                  <View style={styles.searchingRow}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      No results yet. Try a different search.
                    </ThemedText>
                  </View>
                ) : (
                  searchResults.map((result, index) => (
                    <Pressable
                      key={`${result.lat}-${result.lon}-${index}`}
                      onPress={() => handleSelectSearchResult(result)}
                      style={styles.searchResultItem}
                    >
                      <Icon name="map-pin" size={16} color={theme.primary} />
                      <ThemedText type="small" style={[styles.searchResultText, { color: theme.text }]}>
                        {result.display_name}
                      </ThemedText>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.filterContainer, { top: insets.top + (onClose ? 60 : 12) }]}>
        <View style={[styles.filterCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}>
          <ThemedText type="small" style={[styles.filterLabel, { color: theme.textSecondary }]}>
            Show on map
          </ThemedText>
          <View style={styles.filterPillsRow}>
            <FilterPill label="Activities" filterType="activities" icon="calendar" color={theme.primary} />
            <FilterPill label="Spots" filterType="spots" icon="map-pin" color="#4CAF50" />
          </View>
        </View>
      </View>

      {onClose ? (
        <Pressable
          style={[styles.closeButton, { top: insets.top + 12, backgroundColor: theme.cardBackground }, Shadows.medium]}
          onPress={onClose}
        >
          <Icon name="x" size={24} color={theme.text} />
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.myLocationButton, { bottom: showDetail ? 320 : insets.bottom + 100, backgroundColor: theme.cardBackground }, Shadows.medium]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          centerOnUserLocation();
        }}
        disabled={isLoadingLocation}
      >
        {isLoadingLocation ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Icon name="navigation" size={20} color={userLocation ? theme.primary : theme.textSecondary} />
        )}
      </Pressable>

      <View style={[styles.legendContainer, { bottom: showDetail ? 320 : insets.bottom + 100, backgroundColor: theme.cardBackground }, Shadows.small]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
          <ThemedText type="small">Activities</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
          <ThemedText type="small">Spots</ThemedText>
        </View>
      </View>

      {showDetail && selectedMarker ? (
        <Animated.View
          entering={SlideInDown}
          exiting={FadeOut}
          style={[styles.detailContainer, { backgroundColor: theme.cardBackground }, Shadows.large]}
        >
          <ScrollView contentContainerStyle={styles.detailContent}>
            {renderDetailContent()}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );

  if (onClose) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        {mapContent}
      </Modal>
    );
  }

  return mapContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  filterContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
  },
  searchContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 12,
  },
  searchCard: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
  },
  searchResults: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    maxHeight: 220,
  },
  searchResultsList: {
    maxHeight: 220,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: Spacing.sm,
  },
  searchResultText: {
    flex: 1,
    lineHeight: 18,
  },
  searchingRow: {
    paddingVertical: 8,
  },
  filterCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  filterLabel: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  filterPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterToggle: {
    width: 26,
    height: 14,
    borderRadius: 7,
    marginLeft: 8,
    justifyContent: "center",
  },
  filterToggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeButton: {
    position: "absolute",
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  myLocationButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  legendContainer: {
    position: "absolute",
    left: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    zIndex: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  detailContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 300,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  detailContent: {
    padding: Spacing.lg,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
    marginLeft: 4,
    textTransform: "uppercase",
  },
  detailTitle: {
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  detailDescription: {
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  userDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  webFallbackTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  webFallbackText: {
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  webFallbackStats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 80,
  },
  userInfo: {
    flex: 1,
  },
  vanBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  spotActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  spotActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
