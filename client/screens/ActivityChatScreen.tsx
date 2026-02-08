import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import {
StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  Alert,
  Linking,
  Animated as RNAnimated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { HeaderButton } from "@react-navigation/elements";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ChatBackground } from "@/components/ChatBackground";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ActivityChatMessage, LocationData, User, ActivityLocation } from "@/types";
import { getApiUrl } from "@/lib/query-client";
import { ChatAttachmentModal } from "@/components/ChatAttachmentModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import LocationPickerModal from "@/components/LocationPickerModal";
import { uploadPhoto, uploadFile, uploadAudio } from "@/lib/upload";
import { saveImageToGallery, saveFileToDevice } from "@/lib/media";
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import AudioModule from "expo-audio/build/AudioModule";
import type { AudioRecorder } from "expo-audio";

type ActivityChatRouteProp = RouteProp<RootStackParamList, "ActivityChat">;

type ActivityChatNavigationProp = NativeStackNavigationProp<RootStackParamList, "ActivityChat">;

const WAVE_BARS = [2, 4, 6, 4, 7, 5, 3, 6];

const AudioWave = ({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) => {
  const wave = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (active) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(wave, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          RNAnimated.timing(wave, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      wave.stopAnimation();
      wave.setValue(0);
    }
  }, [active, wave]);

  return (
    <View style={styles.audioWaveOval}>
      {WAVE_BARS.map((h, i) => {
        const scaleY = wave.interpolate({
          inputRange: [0, 1],
          outputRange: [0.55 + i * 0.03, 1.1 - i * 0.02],
        });
        const opacity = wave.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1],
        });

        return (
          <RNAnimated.View
            key={i}
            style={[
              styles.audioWaveBar,
              {
                height: h,
                backgroundColor: color,
                opacity,
                transform: [{ scaleY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};


interface Moderator {
  userId: string;
  isHost: boolean;
}

const formatDuration = (seconds?: number) => {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function ActivityChatScreen() {
  const route = useRoute<ActivityChatRouteProp>();
  const navigation = useNavigation<ActivityChatNavigationProp>();
  const { activityId, activityTitle } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { activities } = useData();
  const flatListRef = useRef<FlatList>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ActivityChatMessage[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ActivityChatMessage | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ uri: string; name?: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<ActivityChatMessage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F44F}"];
  const EXTRA_REACTIONS = [
    "\u{1F525}", "\u{1F389}", "\u{1F64C}", "\u{1F91D}", "\u{1F92F}", "\u{1F60D}",
    "\u{1F914}", "\u{1F60E}", "\u{1F605}", "\u{1F62D}", "\u{1F64F}", "\u{1F4AF}",
    "\u2705", "\u274C", "\u2B50", "\u26A1", "\u{1F4CC}", "\u{1F690}",
  ];

  const activity = activities.find(a => a.id === activityId);
  const isModerator = moderators.some(m => m.userId === user?.id);
  const isHost = activity?.hostId === user?.id;

  const activeMessages = messages.filter((m) => !m.deletedAt);
  const pinnedMessages = activeMessages.filter((m) => m.isPinned);

  const fetchMessages = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(new URL(`/api/activities/${activityId}/messages`, apiUrl).toString());
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, [activityId]);

  const fetchModerators = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(new URL(`/api/activities/${activityId}/moderators`, apiUrl).toString());
      if (response.ok) {
        const data = await response.json();
        setModerators(data);
      }
    } catch (error) {
      console.error("Failed to fetch moderators:", error);
    }
  }, [activityId]);

  const initializeChat = useCallback(async () => {
    if (activity && user && !hasInitialized) {
      try {
        const apiUrl = getApiUrl();
        await fetch(new URL(`/api/activities/${activityId}/init-chat`, apiUrl).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostId: activity.hostId }),
        });
        setHasInitialized(true);
      } catch (error) {
        console.error("Failed to initialize chat:", error);
      }
    }
  }, [activity, activityId, user, hasInitialized]);

  useEffect(() => {
    fetchMessages();
    fetchModerators();
    initializeChat();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages, fetchModerators, initializeChat]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowPinnedModal(true);
          }}
        >
          <View style={{ position: "relative" }}>
            <Icon name="pin" size={22} color={pinnedMessages.length > 0 ? AppColors.sunsetGold : theme.textSecondary} />
            {pinnedMessages.length > 0 && (
              <View style={{
                position: "absolute",
                top: -4,
                right: -6,
                backgroundColor: AppColors.sunsetGold,
                borderRadius: 8,
                minWidth: 16,
                height: 16,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <ThemedText style={{ fontSize: 10, fontWeight: "700", color: "#FFFFFF" }}>
                  {pinnedMessages.length}
                </ThemedText>
              </View>
            )}
          </View>
        </HeaderButton>
      ),
    });
  }, [navigation, pinnedMessages.length, theme.textSecondary]);

  const handleSendMessage = async (
    type: "text" | "photo" | "location" | "file" | "audio" = "text",
    content?: string,
    photoUrl?: string,
    location?: LocationData,
    fileUrl?: string,
    fileName?: string,
    audioUrl?: string
  ) => {
    const messageContent = content || message.trim();
    if ((!messageContent && type === "text") || !user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessage("");

    try {
      const apiUrl = getApiUrl();
      const replyPayload = replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderName: replyTo.senderId === user?.id ? "You" : replyTo.senderName,
          }
        : undefined;
      await fetch(new URL(`/api/activities/${activityId}/messages`, apiUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          senderName: user.name,
          senderPhoto: user?.photos?.[0] || "",
          type,
          content: messageContent,
          photoUrl,
          fileUrl,
          fileName,
          audioUrl,
          replyTo: replyPayload,
          location,
          isModeratorMessage: isModerator,
        }),
      });
      setReplyTo(null);
      fetchMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handlePinMessage = async (messageId: string, pin: boolean) => {
    if (!isModerator) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(new URL(`/api/activities/${activityId}/messages/${messageId}/pin`, apiUrl).toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, pin }),
      });
      if (!response.ok) {
        console.error("Failed to pin message:", await response.text());
      }
      await fetchMessages();
      setShowMessageMenu(false);
      setSelectedMessage(null);
      setShowPinnedModal(false);
    } catch (error) {
      console.error("Failed to pin message:", error);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    const canDelete = isModerator || selectedMessage.senderId === user?.id;
    if (!canDelete) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const apiUrl = getApiUrl();
      await fetch(new URL(`/api/activities/${activityId}/messages/${selectedMessage.id}`, apiUrl).toString(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      fetchMessages();
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
    setShowMessageMenu(false);
    setSelectedMessage(null);
  };

  const handleEdit = () => {
    if (selectedMessage) {
      setEditText(selectedMessage.content);
      setIsEditing(true);
      setShowMessageMenu(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMessage || !editText.trim()) return;
    
    try {
      const apiUrl = getApiUrl();
      await fetch(new URL(`/api/activities/${activityId}/messages/${selectedMessage.id}`, apiUrl).toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fetchMessages();
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
    setIsEditing(false);
    setEditText("");
    setSelectedMessage(null);
  };

  const handleLongPress = (item: ActivityChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(item);
    setShowMessageMenu(true);
  };

  const handleReaction = async (message: ActivityChatMessage, emoji: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(
        new URL(`/api/activities/${activityId}/messages/${message.id}/react`, apiUrl).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.id, emoji }),
        }
      );
      if (response.ok) {
        const updated = await response.json();
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (error) {
      console.error("Failed to react:", error);
    } finally {
      setShowMessageMenu(false);
      setSelectedMessage(null);
      setShowEmojiPicker(false);
    }
  };

  const handleDownloadImage = async (uri: string) => {
    try {
      await saveImageToGallery(uri);
      Alert.alert("Saved", "Image saved to your gallery.");
    } catch (error) {
      Alert.alert("Download Failed", "Could not save the image.");
    }
  };

  const handleDownloadFile = async (uri: string, name?: string) => {
    try {
      await saveFileToDevice(uri, name);
      Alert.alert("Saved", "File saved to your device.");
    } catch (error) {
      Alert.alert("Download Failed", "Could not save the file.");
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setIsLoading(true);
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        handleSendMessage("photo", "Shared a photo", uploadResult.url);
      } catch (error) {
        Alert.alert("Upload Failed", "Could not upload photo.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setIsLoading(true);
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        handleSendMessage("photo", "Shared a photo", uploadResult.url);
      } catch (error) {
        Alert.alert("Upload Failed", "Could not upload photo.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectLocation = async (location: ActivityLocation) => {
    const locationData: LocationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      address: location.address,
    };
    handleSendMessage("location", "Shared a location", undefined, locationData);
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        try {
          setIsLoading(true);
          const uploadResult = await uploadFile(file.uri, file.name);
          handleSendMessage("file", `Shared a file: ${file.name}`, undefined, undefined, uploadResult.url, file.name);
        } catch (error) {
          Alert.alert("Upload Failed", "Could not upload file.");
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  };

  const openLocationInMaps = (location: LocationData) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${location.latitude},${location.longitude}`,
      android: `geo:${location.latitude},${location.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`,
    });
    Linking.openURL(url);
  };

  const startRecording = useCallback(async () => {
    if (isRecording || recordingRef.current) {
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Microphone access is needed to record audio.");
        return;
      }

      await setAudioModeAsync({ playsInSilentMode: true });

      const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = recorder;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const recorder = recordingRef.current;
      if (!recorder) return;

      recorder.stop();
      const uri = recorder.uri;
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) return;
      setIsLoading(true);
      const uploadResult = await uploadAudio(uri, `voice_${Date.now()}.m4a`);
      await handleSendMessage("audio", "Voice message", undefined, undefined, undefined, "voice.m4a", uploadResult.url);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Recording Failed", "Could not save the audio.");
    } finally {
      setIsLoading(false);
    }
  }, [handleSendMessage]);

  const playAudio = useCallback(async (id: string, uri?: string) => {
    if (!uri) return;
    try {
      if (playingAudioId === id) {
        setPlayingAudioId(null);
        return;
      }
      const player = createAudioPlayer(uri);
      setPlayingAudioId(id);
      const checkInterval = setInterval(() => {
        if (!player.playing && player.currentTime > 0 && player.duration > 0 && player.currentTime >= player.duration - 0.15) {
          setPlayingAudioId(null);
          clearInterval(checkInterval);
          player.remove();
        }
      }, 250);
      player.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingAudioId(null);
    }
  }, [playingAudioId]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderMessage = useCallback(
    ({ item, index }: { item: ActivityChatMessage; index: number }) => {
      const isOwnMessage = item.senderId === user?.id;
      const isSystemMessage = item.type === "system";
      const senderIsModerator = moderators.some(m => m.userId === item.senderId);

      if (isSystemMessage) {
        return (
          <Animated.View
            entering={FadeIn}
            style={styles.systemMessageContainer}
          >
            <View style={[styles.systemBubble, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name="info" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.systemText, { color: theme.textSecondary }]}>
                {item.content}
              </ThemedText>
            </View>
          </Animated.View>
        );
      }

      const showTime = index === 0 || 
        new Date(item.createdAt).getTime() - new Date(activeMessages[index - 1]?.createdAt).getTime() > 300000;

      const onSwipe = () => setReplyTo(item);

      return (
        <Swipeable
          renderLeftActions={isOwnMessage ? undefined : () => <View style={styles.swipeAction} />}
          renderRightActions={isOwnMessage ? () => <View style={styles.swipeAction} /> : undefined}
          onSwipeableLeftOpen={() => !isOwnMessage && onSwipe()}
          onSwipeableRightOpen={() => isOwnMessage && onSwipe()}
        >
          <Pressable onLongPress={() => handleLongPress(item)} delayLongPress={300}>
            <Animated.View
            entering={FadeInUp.delay(index * 30).springify()}
            style={[
              styles.messageContainer,
              isOwnMessage ? styles.ownMessage : styles.otherMessage,
            ]}
          >
            {showTime ? (
              <ThemedText type="small" style={[styles.timestamp, { color: theme.textSecondary }]}>
                {formatTime(item.createdAt)}
              </ThemedText>
            ) : null}

            {!isOwnMessage && (
              <View style={styles.senderInfo}>
                <Image
                  source={item.senderPhoto ? { uri: item.senderPhoto } : require("../../assets/images/default-avatar.png")}
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.senderNameRow}>
                  <ThemedText style={[styles.senderName, { color: senderIsModerator ? AppColors.primary : theme.textSecondary }]}>
                    {item.senderName}
                  </ThemedText>
                  {senderIsModerator && (
                    <View style={[styles.modBadge, { backgroundColor: `${AppColors.primary}20` }]}>
                      <Icon name="shield" size={10} color={AppColors.primary} />
                      <ThemedText style={styles.modBadgeText}>MOD</ThemedText>
                    </View>
                  )}
                </View>
              </View>
            )}

            {item.isPinned && (
              <View style={[styles.pinnedIndicator, { backgroundColor: isDark ? "rgba(255,179,71,0.15)" : "#FEF3C7" }]}>
                <Icon name="pin" size={12} color={AppColors.sunsetGold} />
                <ThemedText style={styles.pinnedText}>Pinned</ThemedText>
              </View>
            )}

            <View
              style={[
                styles.messageBubble,
                isOwnMessage
                  ? [styles.ownBubble, { backgroundColor: item.isModeratorMessage ? "#7C3AED" : AppColors.primary }]
                  : [styles.otherBubble, { backgroundColor: theme.cardBackground }],
              ]}
            >
              {item.replyTo ? (
                <View style={styles.replyPreview}>
                  <ThemedText style={styles.replyText} numberOfLines={2}>
                    {(item.replyTo.senderName || "User") + ": " + item.replyTo.content}
                  </ThemedText>
                </View>
              ) : null}

              {item.type === "photo" && item.photoUrl ? (
                <Pressable onPress={() => setPreviewImageUri(item.photoUrl || null)}>
                  <Image source={{ uri: item.photoUrl }} style={styles.photoMessage} contentFit="cover" />
                </Pressable>
              ) : null}

              {item.type === "file" && item.fileName ? (
                <Pressable
                  style={styles.fileMessage}
                  onPress={() => item.fileUrl && setPreviewFile({ uri: item.fileUrl, name: item.fileName })}
                >
                  <View style={[styles.fileIconContainer, { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
                    <Icon name="file" size={22} color={isOwnMessage ? "#FFFFFF" : AppColors.primary} />
                  </View>
                  <View style={styles.fileDetails}>
                    <ThemedText style={[styles.fileName, { color: isOwnMessage ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
                      {item.fileName}
                    </ThemedText>
                    <ThemedText style={[styles.fileLabel, { color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
                      File attachment
                    </ThemedText>
                  </View>
                  <View style={styles.downloadIcon}>
                    <Icon name="download" size={16} color={isOwnMessage ? "#FFFFFF" : theme.textSecondary} />
                  </View>
                </Pressable>
              ) : null}

              {item.type === "audio" ? (
                (() => {
                  const isPlaying = playingAudioId === item.id;
                  const waveColor = isOwnMessage ? "rgba(255,255,255,0.9)" : theme.primary;
                  return (
                    <Pressable
                      style={[
                        styles.audioPill,
                        { backgroundColor: isOwnMessage ? AppColors.primary : theme.cardBackground },
                      ]}
                      onPress={() => playAudio(item.id, item.audioUrl || item.fileUrl)}
                    >
                      <View
                        style={[
                          styles.audioPillIcon,
                          { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary },
                        ]}
                      >
                        <Icon
                          name={isPlaying ? "pause" : "play"}
                          size={18}
                          color={isOwnMessage ? "#FFFFFF" : AppColors.primary}
                        />
                      </View>

                      <AudioWave active={isPlaying} color={waveColor} />

                      <ThemedText style={[styles.audioDurationText, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
                        {item.audioDuration ? formatDuration(item.audioDuration) : "0:00"}
                      </ThemedText>
                    </Pressable>
                  );
                })()
              ) : null}

              {item.type === "location" && item.location ? (
                <Pressable style={styles.locationMessage} onPress={() => item.location && openLocationInMaps(item.location)}>
                  <View style={[styles.locationIcon, { backgroundColor: "#EF4444" }]}>
                    <Icon name="map-pin" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.locationInfo}>
                    <ThemedText style={[styles.locationTitle, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
                      {item.location.name || "Shared Location"}
                    </ThemedText>
                    <ThemedText style={[styles.locationSubtitle, { color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
                      Tap to open in Maps
                    </ThemedText>
                  </View>
                  <Icon name="external-link" size={14} color={isOwnMessage ? "#FFFFFF" : theme.textSecondary} />
                </Pressable>
              ) : null}

              {item.type === "text" ? (
                <ThemedText style={[styles.messageText, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
                  {item.content}
                </ThemedText>
              ) : null}

              {item.reactions && Object.keys(item.reactions).length > 0 ? (
                <View style={styles.reactionsRow}>
                  {Object.entries(item.reactions).map(([emoji, users]) => (
                    <Pressable
                      key={`${item.id}-${emoji}`}
                      style={[
                        styles.reactionPill,
                        users.includes(user?.id || "") && styles.reactionPillActive,
                      ]}
                      onPress={() => handleReaction(item, emoji)}
                    >
                      <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                      <ThemedText style={styles.reactionCount}>{users.length}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {isOwnMessage && (
                <View style={styles.messageFooter}>
                  {item.isEdited && <ThemedText style={styles.editedText}>edited</ThemedText>}
                </View>
              )}
            </View>
          </Animated.View>
          </Pressable>
        </Swipeable>
      );
    },
    [user?.id, theme, moderators, activeMessages, handleLongPress, handleReaction, playAudio, playingAudioId]
  );

  const EmptyChat = () => (
    <Animated.View entering={FadeIn} style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.primary + "20" }]}>
          <Icon name="message-circle" size={32} color={theme.primary} />
        </View>
        <ThemedText type="h4" style={[styles.emptyTitle, { color: theme.text }]}>
          Start the conversation
        </ThemedText>
        <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Say hello to the group!
        </ThemedText>
      </View>
    </Animated.View>
  );

  const attendeeCount = activity?.attendees.length || 0;
  const allMembers = activity ? [activity.host, ...activity.attendees] : [];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: "transparent" }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ChatBackground />

      <FlatList
        ref={flatListRef}
        data={activeMessages.toReversed()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted={activeMessages.length > 0}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.lg },
          activeMessages.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={EmptyChat}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: "transparent",
            paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.lg,
            borderTopColor: "rgba(0,0,0,0.06)",
          },
        ]}
      >
        {replyTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLeft} />
            <View style={styles.replyBarContent}>
              <ThemedText style={styles.replyBarTitle}>Replying to</ThemedText>
              <ThemedText style={styles.replyBarText} numberOfLines={1}>
                {(replyTo.senderId === user?.id ? "You" : replyTo.senderName) + ": " + replyTo.content}
              </ThemedText>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Icon name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <Pressable
            style={[styles.attachButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowAttachmentModal(true)}
          >
          <Icon name="plus" size={20} color={theme.primary} />
        </Pressable>

        <View style={[styles.inputWrapper, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Message the group..."
            placeholderTextColor={theme.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            testID="input-chat-message"
          />
          <Pressable
            onPress={() => handleSendMessage()}
            disabled={!message.trim()}
            style={[
              styles.sendButton,
              { backgroundColor: message.trim() ? AppColors.primary : theme.backgroundSecondary },
            ]}
            testID="button-send-message"
          >
            <Icon name="send" size={18} color={message.trim() ? "#FFFFFF" : theme.textSecondary} />
          </Pressable>
          <Pressable
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[
              styles.micButton,
              { backgroundColor: isRecording ? AppColors.primary : theme.backgroundSecondary },
            ]}
          >
            <Icon name="mic" size={18} color={isRecording ? "#FFFFFF" : theme.textSecondary} />
          </Pressable>
        </View>
        </View>
      </View>

      

      <Modal
        visible={showMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMessageMenu(false)}>
          <View style={[styles.menuContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.reactionBar}>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.reactionButton}
                  onPress={() => selectedMessage && handleReaction(selectedMessage, emoji)}
                >
                  <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                </Pressable>
              ))}
              <Pressable
                style={styles.reactionButton}
                onPress={() => setShowEmojiPicker(true)}
              >
                <Icon name="plus" size={16} color={theme.text} />
              </Pressable>
            </View>
            {selectedMessage?.senderId === user?.id && selectedMessage?.type === "text" && (
              <>
                <Pressable style={styles.menuItem} onPress={handleEdit}>
                  <Icon name="edit-3" size={20} color={theme.primary} />
                  <ThemedText style={styles.menuItemText}>Edit Message</ThemedText>
                </Pressable>
                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              </>
            )}
            {isModerator && selectedMessage && (
              <>
                <Pressable style={styles.menuItem} onPress={() => handlePinMessage(selectedMessage.id, !selectedMessage.isPinned)}>
                  <Icon name="pin" size={20} color={selectedMessage.isPinned ? AppColors.sunsetGold : theme.text} />
                  <ThemedText style={styles.menuItemText}>{selectedMessage.isPinned ? "Unpin Message" : "Pin Message"}</ThemedText>
                </Pressable>
                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              </>
            )}
            <Pressable style={styles.menuItem} onPress={handleDeleteMessage}>
              <Icon name="trash-2" size={20} color={theme.danger} />
              <ThemedText style={[styles.menuItemText, { color: theme.danger }]}>Delete Message</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditing(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={[styles.editModalContent, { backgroundColor: theme.cardBackground }]}>
            <ThemedText style={[styles.editModalTitle, { color: theme.text }]}>Edit Message</ThemedText>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              placeholder="Edit your message..."
              placeholderTextColor={theme.textSecondary}
              testID="input-edit-message"
            />
            <View style={styles.editModalButtons}>
              <Pressable
                style={[styles.editButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  setIsEditing(false);
                  setEditText("");
                  setSelectedMessage(null);
                }}
              >
                <ThemedText style={[styles.editButtonText, { color: theme.text }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.editButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveEdit}
                testID="button-save-edit"
              >
                <ThemedText style={[styles.editButtonText, { color: "#FFFFFF" }]}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPinnedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPinnedModal(false)}
      >
        <View style={styles.membersModalOverlay}>
          <View style={[styles.pinnedModalContent, { backgroundColor: theme.cardBackground, paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.membersModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="pin" size={20} color={AppColors.sunsetGold} />
                <ThemedText type="h4" style={{ color: theme.text }}>Pinned Messages</ThemedText>
              </View>
              <Pressable onPress={() => setShowPinnedModal(false)}>
                <Icon name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.pinnedScrollView} contentContainerStyle={styles.pinnedScrollContent}>
              {pinnedMessages.length > 0 ? (
                pinnedMessages.map((msg) => {
                  const senderIsMod = moderators.some(m => m.userId === msg.senderId);
                  return (
                    <View key={msg.id} style={[styles.pinnedMessageItem, { backgroundColor: theme.backgroundSecondary }]}>
                      <View style={styles.pinnedMessageHeader}>
                        <Image
                          source={msg.senderPhoto ? { uri: msg.senderPhoto } : require("../../assets/images/default-avatar.png")}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                        <ThemedText style={{ color: senderIsMod ? AppColors.primary : theme.text, fontWeight: "600", fontSize: 13 }}>
                          {msg.senderName}
                        </ThemedText>
                        {senderIsMod && (
                          <View style={[styles.modBadge, { backgroundColor: `${AppColors.primary}20` }]}>
                            <Icon name="shield" size={10} color={AppColors.primary} />
                            <ThemedText style={styles.modBadgeText}>MOD</ThemedText>
                          </View>
                        )}
                        <ThemedText style={{ color: theme.textSecondary, fontSize: 11, marginLeft: "auto" }}>
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: theme.text, marginTop: 8, lineHeight: 20 }}>
                        {msg.type === "location" ? "Shared their location" : msg.content}
                      </ThemedText>
                      {isModerator && (
                        <Pressable
                          style={[styles.unpinButton, { backgroundColor: theme.cardBackground }]}
                          onPress={() => handlePinMessage(msg.id, false)}
                        >
                          <Icon name="x" size={14} color={theme.textSecondary} />
                          <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>Unpin</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyPinnedContainer}>
                  <Icon name="bookmark" size={40} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 12, textAlign: "center" }}>
                    No pinned messages yet
                  </ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                    Moderators can pin important messages
                  </ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.membersModalOverlay}>
          <View style={[styles.membersModalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.membersModalHeader}>
              <ThemedText type="h4" style={{ color: theme.text }}>Group Members</ThemedText>
              <Pressable onPress={() => setShowMembersModal(false)}>
                <Icon name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.membersList}>
              {allMembers.map((member) => {
                const memberIsMod = moderators.some(m => m.userId === member.id);
                const memberIsHost = activity?.hostId === member.id;
                return (
                  <View key={member.id} style={styles.memberItem}>
                    <Image
                      source={member?.photos?.[0] ? { uri: member.photos[0] } : require("../../assets/images/default-avatar.png")}
                      style={styles.memberAvatar}
                      contentFit="cover"
                    />
                    <View style={styles.memberInfo}>
                      <ThemedText style={{ color: theme.text, fontWeight: "600" }}>{member.name}</ThemedText>
                      {memberIsHost && <ThemedText style={[styles.memberRole, { color: AppColors.primary }]}>Host</ThemedText>}
                      {memberIsMod && !memberIsHost && <ThemedText style={[styles.memberRole, { color: theme.textSecondary }]}>Moderator</ThemedText>}
                    </View>
                    {isHost && !memberIsHost && (
                      <Pressable
                        style={[styles.modButton, { backgroundColor: memberIsMod ? theme.backgroundSecondary : `${AppColors.primary}20` }]}
                        onPress={async () => {
                          const apiUrl = getApiUrl();
                          await fetch(new URL(`/api/activities/${activityId}/moderators`, apiUrl).toString(), {
                            method: memberIsMod ? "DELETE" : "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: member.id }),
                          });
                          fetchModerators();
                        }}
                      >
                        <ThemedText style={{ color: memberIsMod ? theme.text : AppColors.primary, fontSize: 12, fontWeight: "600" }}>
                          {memberIsMod ? "Remove Mod" : "Make Mod"}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ChatAttachmentModal
        visible={showAttachmentModal}
        onClose={() => setShowAttachmentModal(false)}
        onSelectPhoto={() => setShowPhotoModal(true)}
        onSelectLocation={() => setShowLocationModal(true)}
        onSelectFile={handleSelectFile}
      />

      <PhotoPickerModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromGallery={handlePickImage}
      />

      <LocationPickerModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelectLocation={handleSelectLocation}
      />

      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewImageUri(null)}>
            <Icon name="x" size={24} color="#FFFFFF" />
          </Pressable>
          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.previewImage} contentFit="contain" />
          ) : null}
          <Pressable style={styles.previewDownload} onPress={() => previewImageUri && handleDownloadImage(previewImageUri)}>
            <Icon name="download" size={18} color="#FFFFFF" />
            <ThemedText style={styles.previewDownloadText}>Save</ThemedText>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={!!previewFile}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewFile(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.filePreviewCard}>
            <View style={styles.filePreviewHeader}>
              <Icon name="file" size={22} color="#FFFFFF" />
              <ThemedText style={styles.filePreviewTitle} numberOfLines={1}>
                {previewFile?.name || "File"}
              </ThemedText>
            </View>
            <Pressable
              style={styles.previewDownload}
              onPress={() => previewFile && handleDownloadFile(previewFile.uri, previewFile.name)}
            >
              <Icon name="download" size={18} color="#FFFFFF" />
              <ThemedText style={styles.previewDownloadText}>Download</ThemedText>
            </Pressable>
            <Pressable style={styles.previewCloseAlt} onPress={() => setPreviewFile(null)}>
              <ThemedText style={styles.previewCloseText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={[styles.emojiPicker, { backgroundColor: theme.cardBackground }]}>
            <ThemedText style={styles.emojiTitle}>Reactions</ThemedText>
            <View style={styles.emojiGrid}>
              {EXTRA_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.emojiCell}
                  onPress={() => selectedMessage && handleReaction(selectedMessage, emoji)}
                >
                  <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  messageContainer: {
    marginBottom: Spacing.sm,
    maxWidth: "80%",
  },
  ownMessage: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  timestamp: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  senderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.xs,
  },
  senderNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
  },
  modBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  modBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: AppColors.primary,
  },
  pinnedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
    gap: 4,
  },
  pinnedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#92400E",
  },
  messageBubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: 280,
  },
  ownBubble: {
    borderBottomLeftRadius: BorderRadius.xs,
  },
  otherBubble: {
    borderBottomRightRadius: BorderRadius.xs,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.xs,
  },
  editedText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
  },
  photoMessage: {
    width: 200,
    height: 150,
    borderRadius: BorderRadius.md,
  },

  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 48,
    gap: Spacing.sm,
  },
  attachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  locationSubtitle: {
    fontSize: 12,
  },
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  systemBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  systemText: {
    fontSize: 13,
  },
  pinnedBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  pinnedBarText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "column",
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  replyBarLeft: {
    width: 3,
    height: 32,
    backgroundColor: AppColors.primary,
    borderRadius: 999,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarTitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  replyBarText: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.5)",
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  replyText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },

  
  
  
  
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  
  
  
  
  
  
  attachMenu: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  attachOption: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  attachIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  attachLabel: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 15,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContent: {
    width: 280,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  menuItemText: {
    fontSize: 16,
  },
  menuDivider: {
    height: 1,
  },
  editModalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  
  editModalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  editButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  membersModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  membersModalContent: {
    maxHeight: "70%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  membersModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: Spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  modButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pinnedMessageItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  pinnedMessageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unpinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  emptyPinnedContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  pinnedModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    minHeight: 200,
    maxHeight: "60%",
  },
  pinnedScrollView: {
    flexGrow: 0,
  },
  pinnedScrollContent: {
    paddingBottom: Spacing.md,
  },
  fileMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minWidth: 160,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
  },
  fileLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadIcon: {
    marginLeft: Spacing.sm,
  },
    audioPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    minWidth: 180,
  },
  audioPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  audioWaveOval: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  audioWaveBar: {
    width: 3,
    borderRadius: 2,
  },
  audioDurationText: {
    fontSize: 12,
    fontWeight: "600",
  },  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.sm,
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    gap: 4,
  },
  reactionPillActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  reactionEmoji: {
    fontSize: 18,
  },
  reactionCount: {
    fontSize: 12,
    color: "#FFFFFF",
  },
  swipeAction: {
    width: 64,
  },
  reactionBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  reactionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  emojiPicker: {
    width: "90%",
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  emojiTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  emojiCell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "90%",
    height: "70%",
  },
  previewClose: {
    position: "absolute",
    top: 60,
    right: 24,
    padding: 8,
  },
  previewDownload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 16,
  },
  previewDownloadText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  filePreviewCard: {
    width: "85%",
    backgroundColor: "#1F2937",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.md,
  },
  filePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  filePreviewTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  previewCloseAlt: {
    paddingVertical: 6,
  },
  previewCloseText: {
    color: "rgba(255,255,255,0.7)",
  },
  editInput: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
});










