import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  Keyboard,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { GradientButton } from "@/components/GradientButton";
import { useTheme } from "@/hooks/useTheme";
import { ActivityLocation } from "@/types";
import { AppColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useAlert } from "@/context/AlertContext";
import { MapView, Marker, mapsAvailable, Region } from "@/lib/maps";

interface SearchResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: ActivityLocation) => void;
  initialLocation?: ActivityLocation | null;
}

export default function LocationPickerModal({
  visible,
  onClose,
  onSelectLocation,
  initialLocation,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { showAlert } = useAlert();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<ActivityLocation | null>(
    initialLocation || null
  );
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLoadingUserLocation, setIsLoadingUserLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [tempPinLocation, setTempPinLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<typeof MapView>(null);

  useEffect(() => {
    if (visible && initialLocation) {
      setSelectedLocation(initialLocation);
    }
  }, [visible, initialLocation]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (selectedLocation && mapRef.current && typeof (mapRef.current as any).animateToRegion === 'function') {
      (mapRef.current as any).animateToRegion({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [selectedLocation]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(text)}`;
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "Accept-Language": "en",
            "User-Agent": "NomadConnect/1.0 (hackathon)"
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        const results = (data || []).map((item: any) => {
          const name = item.display_name?.split(",")[0] || item.display_name || text;
          const address = item.display_name || "";
          return {
            id: item.place_id?.toString() || `${item.lat}-${item.lon}`,
            name,
            address,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
          } as SearchResult;
        });
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Location search failed:", error);
        setSearchResults([]);
        setShowSearchResults(true);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const handleUseCustomLocation = useCallback(async () => {
    if (searchQuery.trim().length < 2) return;

    try {
      setIsSearching(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(searchQuery.trim())}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
          "User-Agent": "NomadConnect/1.0 (hackathon)",
        },
      });
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      if (!data || data.length === 0) {
        showAlert({ type: "warning", title: "Location not found", message: "Please choose a suggestion or try a more specific address." });
        return;
      }
      const item = data[0];
      const name = item.display_name?.split(",")[0] || item.display_name || searchQuery.trim();
      const address = item.display_name || "Custom location";
      const location: ActivityLocation = {
        name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        address,
      };
      setSelectedLocation(location);
      setShowSearchResults(false);
      Keyboard.dismiss();
    } catch (error) {
      showAlert({ type: "warning", title: "Location not found", message: "Please choose a suggestion or try a more specific address." });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, showAlert]);

  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    Haptics.selectionAsync();
    const location: ActivityLocation = {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    };
    setSelectedLocation(location);
    setSearchQuery(result.name);
    setShowSearchResults(false);
    Keyboard.dismiss();
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setIsLoadingUserLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsLoadingUserLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });

      let name = "Current Location";
      let address = "";

      if (results.length > 0) {
        const result = results[0];
        const parts = [];
        if (result.city) parts.push(result.city);
        if (result.region) parts.push(result.region);
        if (result.country) parts.push(result.country);
        name = result.city || "Current Location";
        address = parts.join(", ");
      }

      const selectedLoc: ActivityLocation = {
        name,
        latitude,
        longitude,
        address,
      };

      setSelectedLocation(selectedLoc);
      setSearchQuery(name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsLoadingUserLocation(false);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedLocation) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelectLocation(selectedLocation);
      onClose();
    }
  }, [selectedLocation, onSelectLocation, onClose]);

  const handleRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
    setTempPinLocation({ latitude: region.latitude, longitude: region.longitude });
  }, []);

  const handleConfirmPin = useCallback(async () => {
    if (!tempPinLocation) return;
    
    setIsSettingPin(true);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: tempPinLocation.latitude,
        longitude: tempPinLocation.longitude,
      });

      let name = "Selected Location";
      let address = "";

      if (results.length > 0) {
        const result = results[0];
        const parts = [];
        if (result.street) parts.push(result.street);
        if (result.city) parts.push(result.city);
        if (result.region) parts.push(result.region);
        name = result.street || result.city || result.name || "Selected Location";
        address = parts.join(", ");
      }

      const location: ActivityLocation = {
        name,
        latitude: tempPinLocation.latitude,
        longitude: tempPinLocation.longitude,
        address,
      };

      setSelectedLocation(location);
      setSearchQuery(name);
      setTempPinLocation(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      const location: ActivityLocation = {
        name: "Selected Location",
        latitude: tempPinLocation.latitude,
        longitude: tempPinLocation.longitude,
        address: `${tempPinLocation.latitude.toFixed(4)}, ${tempPinLocation.longitude.toFixed(4)}`,
      };
      setSelectedLocation(location);
      setSearchQuery("Selected Location");
      setTempPinLocation(null);
    } finally {
      setIsSettingPin(false);
    }
  }, [tempPinLocation]);

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={[styles.searchResultItem, { borderBottomColor: theme.border }]}
      onPress={() => handleSelectSearchResult(item)}
    >
      <View style={[styles.searchResultIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Icon name="map-pin" size={16} color={AppColors.primary} />
      </View>
      <View style={styles.searchResultText}>
        <ThemedText type="body" style={{ fontWeight: "500" }}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {item.address}
        </ThemedText>
      </View>
    </Pressable>
  );

    return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Icon name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={styles.headerTitle}>
            Select Location
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchSection}>
          <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search for a location..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={handleSearch}
                onFocus={() => setShowSearchResults(searchQuery.length >= 2)}
                testID="input-location-search"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                >
                  <Icon name="x-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
              {searchQuery.length >= 2 ? (
                <Pressable onPress={handleUseCustomLocation}>
                  <Icon name="search" size={18} color={AppColors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {showSearchResults ? (
            <View style={[styles.searchResultsContainer, { backgroundColor: theme.cardBackground }]}>
            {isSearching ? (
              <View style={{ flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.sm }}>
                <ActivityIndicator size="small" color={AppColors.primary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Searching...</ThemedText>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.searchResultsList}
                ListFooterComponent={
                  <Pressable
                    style={[styles.customLocationItem, { borderTopColor: theme.border }]}
                    onPress={handleUseCustomLocation}
                  >
                    <View style={[styles.searchResultIcon, { backgroundColor: AppColors.sunsetCoral }]}>
                      <Icon name="edit-2" size={16} color="#FFFFFF" />
                    </View>
                    <View style={styles.searchResultText}>
                      <ThemedText type="body" style={{ fontWeight: "500" }}>
                        Use "{searchQuery}"
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Enter custom location
                      </ThemedText>
                    </View>
                  </Pressable>
                }
              />
            ) : (
              <Pressable
                style={[styles.customLocationItem, { borderTopWidth: 0 }]}
                onPress={handleUseCustomLocation}
              >
                <View style={[styles.searchResultIcon, { backgroundColor: AppColors.sunsetCoral }]}>
                  <Icon name="edit-2" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.searchResultText}>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>
                    Use "{searchQuery}"
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Enter custom location
                  </ThemedText>
                </View>
              </Pressable>
            )}
            </View>
          ) : null}
        </View>

        <View style={styles.locationListContainer}>
          {Platform.OS !== "web" && mapsAvailable ? (
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={undefined}
                initialRegion={selectedLocation ? {
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                } : {
                  latitude: 34.0522,
                  longitude: -118.2437,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
                onRegionChangeComplete={handleRegionChange}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
                showsUserLocation={true}
              >
                {selectedLocation && !tempPinLocation ? (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                    }}
                    title={selectedLocation.name}
                    description={selectedLocation.address}
                  />
                ) : null}
              </MapView>
              <View style={styles.centerPinContainer} pointerEvents="none">
                <View style={styles.centerPin}>
                  <Icon name="map-pin" size={36} color={AppColors.primary} />
                </View>
                <View style={styles.pinShadow} />
              </View>
              {tempPinLocation ? (
                <View style={styles.confirmPinContainer}>
                  <Pressable
                    style={[styles.confirmPinButton, { backgroundColor: AppColors.primary }]}
                    onPress={handleConfirmPin}
                    disabled={isSettingPin}
                  >
                    {isSettingPin ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="check" size={18} color="#FFFFFF" />
                        <ThemedText type="body" style={styles.confirmPinText}>
                          Set Pin Here
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}
              <ThemedText type="small" style={[styles.mapHint, { backgroundColor: theme.cardBackground }]}>
                Drag map to move pin location
              </ThemedText>
              <Pressable
                style={[styles.floatingLocationBtn, { backgroundColor: theme.cardBackground }]}
                onPress={handleUseCurrentLocation}
                disabled={isLoadingUserLocation}
              >
                {isLoadingUserLocation ? (
                  <ActivityIndicator size="small" color={AppColors.primary} />
                ) : (
                  <Icon name="navigation" size={22} color={AppColors.primary} />
                )}
              </Pressable>
            </View>
          ) : (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xl }}>
              Use the search box to pick a location. Map selection is not available on this device.
            </ThemedText>
          )}
        </View>

        {selectedLocation ? (
          <View style={[styles.selectedLocationCard, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.selectedLocationInfo}>
              <View style={[styles.selectedLocationIcon, { backgroundColor: AppColors.primary }]}>
                <Icon name="map-pin" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.selectedLocationText}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {selectedLocation.name}
                </ThemedText>
                {selectedLocation.address ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {selectedLocation.address}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <GradientButton
            onPress={handleConfirm}
            disabled={!selectedLocation}
            style={styles.confirmButton}
          >
            Confirm Location
          </GradientButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  floatingLocationBtn: {
    position: "absolute",
    bottom: 80,
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.medium,
    zIndex: 10,
  },
  searchSection: {
    zIndex: 100,
  },
  searchResultsContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    maxHeight: 300,
    borderRadius: BorderRadius.md,
    ...Shadows.medium,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  customLocationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  locationListContainer: {
    flex: 1,
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    flex: 1,
    minHeight: 200,
  },
  centerPinContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centerPin: {
    marginBottom: 36,
  },
  pinShadow: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  confirmPinContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  confirmPinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    ...Shadows.medium,
  },
  confirmPinText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mapHint: {
    position: "absolute",
    top: Spacing.sm,
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  locationList: {
    flex: 1,
  },
  locationListContent: {
    paddingVertical: Spacing.md,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  selectedLocationCard: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  selectedLocationInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedLocationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  confirmButton: {
    width: "100%",
  },
});


