import React, {  useState, useCallback, useRef , useEffect } from "react";
import {
StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  Modal,
  Image,
  Linking,
  Animated as RNAnimated,
  Easing,
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { ChatAttachmentModal } from "@/components/ChatAttachmentModal";
import LocationPickerModal from "@/components/LocationPickerModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import { ActivityLocation } from "@/types";

import { ChatBackground } from "@/components/ChatBackground";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { Message } from "@/types";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { uploadPhoto, uploadFile, uploadAudio } from "@/lib/upload";
import { saveImageToGallery, saveFileToDevice } from "@/lib/media";
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import AudioModule from "expo-audio/build/AudioModule";
import type { AudioPlayer, AudioRecorder } from "expo-audio";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F44F}"];
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
 

const EXTRA_REACTIONS = [
  "\u{1F525}", "\u{1F389}", "\u{1F64C}", "\u{1F91D}", "\u{1F92F}", "\u{1F60D}",
  "\u{1F914}", "\u{1F60E}", "\u{1F605}", "\u{1F62D}", "\u{1F64F}", "\u{1F4AF}",
  "\u2705", "\u274C", "\u2B50", "\u26A1", "\u{1F4CC}", "\u{1F690}",
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const CUSTOM_HEADER_HEIGHT = 56;
  const headerHeight = (Platform.OS === "web" ? 67 : insets.top) + CUSTOM_HEADER_HEIGHT;
  const { theme } = useTheme();
  const route = useRoute<ChatRouteProp>();
  const { matchId, matchPhoto } = route.params as { matchId: string; matchName: string; matchPhoto?: string };
  const { messages, sendMessage, editMessage, deleteMessage, toggleMessageReaction, matches } = useData();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [inputText, setInputText] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastTapRef = useRef(0);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ uri: string; name?: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioProgress, setAudioProgress] = useState({ id: null as string | null, position: 0, duration: 0, isPlaying: false });
  const chatMessages = messages[matchId] || [];
  const match = matches.find((m) => m.id === matchId);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      const replyPayload = replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
          }
        : undefined;
      await sendMessage(matchId, text, "text", undefined, undefined, undefined, undefined, replyPayload);
      setReplyTo(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Failed to send message:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSending(false);
      setUploadLabel(null);
    }
  }, [inputText, matchId, sendMessage, isSending, replyTo, user?.id, match?.matchedUser.name]);

  const handleLongPress = useCallback((message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setShowMessageMenu(true);
  }, []);

  const handleMessagePress = useCallback((message: Message) => {
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      toggleMessageReaction(matchId, message.id, "\u{1F44D}");
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  }, [matchId, toggleMessageReaction]);

  const handleEdit = useCallback(() => {
    if (selectedMessage) {
      setEditText(selectedMessage.content);
      setIsEditing(true);
      setShowMessageMenu(false);
    }
  }, [selectedMessage]);

  const handleSaveEdit = useCallback(async () => {
    if (selectedMessage && editText.trim()) {
      await editMessage(matchId, selectedMessage.id, editText.trim());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsEditing(false);
    setEditText("");
    setSelectedMessage(null);
  }, [selectedMessage, editText, matchId, editMessage]);

  const handleDelete = useCallback(async () => {
    if (selectedMessage) {
      await deleteMessage(matchId, selectedMessage.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowMessageMenu(false);
    setSelectedMessage(null);
  }, [selectedMessage, matchId, deleteMessage]);

  const handleReaction = useCallback(async (message: Message, emoji: string) => {
    await toggleMessageReaction(matchId, message.id, emoji);
    setShowMessageMenu(false);
    setSelectedMessage(null);
    setShowEmojiPicker(false);
  }, [matchId, toggleMessageReaction]);

  const handleDownloadImage = useCallback(async (uri: string) => {
    try {
      await saveImageToGallery(uri);
      showAlert({ type: "success", title: "Saved", message: "Image saved to your gallery." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not save the image.";
      showAlert({ type: "error", title: "Download Failed", message: detail });
    }
  }, []);

  const handleDownloadFile = useCallback(async (uri: string, name?: string) => {
    try {
      await saveFileToDevice(uri, name);
      showAlert({ type: "success", title: "Saved", message: "File saved to your device." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not save the file.";
      showAlert({ type: "error", title: "Download Failed", message: detail });
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert({ type: "warning", title: "Permission Required", message: "Camera permission is needed to take photos." });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setIsSending(true);
        setUploadLabel("Uploading photo...");
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        const replyPayload = replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
            }
          : undefined;
        await sendMessage(matchId, "Shared a photo", "photo", uploadResult.url, undefined, undefined, undefined, replyPayload);
        setReplyTo(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("Failed to upload photo:", error);
        showAlert({ type: "error", title: "Upload Failed", message: "Could not upload photo. Please try again." });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsSending(false);
        setUploadLabel(null);
      }
    }
  }, [matchId, sendMessage, replyTo, user?.id, match?.matchedUser.name]);

  const handleChoosePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert({ type: "warning", title: "Permission Required", message: "Photo library permission is needed to select photos." });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setIsSending(true);
        setUploadLabel("Uploading photo...");
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        const replyPayload = replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
            }
          : undefined;
        await sendMessage(matchId, "Shared a photo", "photo", uploadResult.url, undefined, undefined, undefined, replyPayload);
        setReplyTo(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("Failed to upload photo:", error);
        showAlert({ type: "error", title: "Upload Failed", message: "Could not upload photo. Please try again." });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsSending(false);
        setUploadLabel(null);
      }
    }
  }, [matchId, sendMessage, replyTo, user?.id, match?.matchedUser.name]);

  const handleSelectLocation = useCallback(async (location: ActivityLocation) => {
    const replyPayload = replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
        }
      : undefined;
    await sendMessage(matchId, `\u{1F4CD} ${location.name}`, "location", undefined, location, undefined, undefined, replyPayload);
    setReplyTo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [matchId, sendMessage, replyTo, user?.id, match?.matchedUser.name]);

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        try {
          setIsSending(true);
          setUploadLabel("Uploading file...");
          const uploadResult = await uploadFile(file.uri, file.name);
          const replyPayload = replyTo
            ? {
                id: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
              }
            : undefined;
          await sendMessage(matchId, `Shared a file: ${file.name}`, "file", undefined, undefined, uploadResult.url, file.name, replyPayload);
          setReplyTo(null);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
          console.error("Failed to upload file:", error);
          showAlert({ type: "error", title: "Upload Failed", message: "Could not upload file. Please try again." });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
          setIsSending(false);
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  }, [matchId, sendMessage, replyTo, user?.id, match?.matchedUser.name]);

  const startRecording = useCallback(async () => {
        if (isRecording || recordingRef.current) {
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert({ type: "warning", title: "Permission Required", message: "Microphone access is needed to record audio." });
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
    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      const recorder = recordingRef.current;
      if (!recorder) return;

      const status = recorder.getStatus();
      try {
        recorder.stop();
      } catch (error) {
        const message = (error as Error)?.message || "";
        if (message.includes("no valid audio data")) {
          recordingRef.current = null;
          setIsRecording(false);
          return;
        }
        throw error;
      }
      const uri = recorder.uri;
      const durationMillis = status.durationMillis || 0;
      const durationSeconds = durationMillis ? Math.round(durationMillis / 1000) : undefined;
      if (durationMillis < 300) {
        recordingRef.current = null;
        setIsRecording(false);
        return;
      }
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) return;
      setIsSending(true);
      setUploadLabel("Uploading audio...");
      const uploadResult = await uploadAudio(uri, `voice_${Date.now()}.m4a`);
      const replyPayload = replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderName: replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User"),
          }
        : undefined;
      await sendMessage(matchId, "Voice message", "audio", undefined, undefined, uploadResult.url, "voice.m4a", replyPayload, durationSeconds);
      setReplyTo(null);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      showAlert({ type: "error", title: "Recording Failed", message: "Could not save the audio." });
    } finally {
      setIsSending(false);
      setUploadLabel(null);
    }
  }, [matchId, sendMessage, replyTo, user?.id, match?.matchedUser.name]);

  const clearAudioInterval = useCallback(() => {
    if (audioProgressIntervalRef.current) {
      clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }
  }, []);

  const playAudio = useCallback(async (id: string, uri?: string) => {
    if (!uri) return;
    try {
      if (playingAudioId === id && audioSoundRef.current) {
        if (audioSoundRef.current.playing) {
          audioSoundRef.current.pause();
          setAudioProgress(prev => ({ ...prev, isPlaying: false }));
        } else {
          audioSoundRef.current.play();
        }
        return;
      }

      if (audioSoundRef.current) {
        audioSoundRef.current.remove();
      }
      clearAudioInterval();

      const player = createAudioPlayer(uri, { updateInterval: 0.25 });
      audioSoundRef.current = player;
      setPlayingAudioId(id);

      audioProgressIntervalRef.current = setInterval(() => {
        if (!player.playing && player.currentTime > 0 && player.duration > 0 && player.currentTime >= player.duration - 0.15) {
          setPlayingAudioId(null);
          setAudioProgress({ id: null, position: 0, duration: 0, isPlaying: false });
          clearAudioInterval();
          player.remove();
          audioSoundRef.current = null;
          return;
        }
        setAudioProgress({
          id,
          position: (player.currentTime || 0) * 1000,
          duration: (player.duration || 0) * 1000,
          isPlaying: player.playing,
        });
      }, 250);

      player.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingAudioId(null);
    }
  }, [playingAudioId, clearAudioInterval]);

  const seekAudio = useCallback(async (id: string, fraction: number) => {
    if (!audioSoundRef.current || playingAudioId !== id) return;
    const duration = audioSoundRef.current.duration || 0;
    if (duration <= 0) return;
    const target = Math.max(0, Math.min(duration, duration * fraction));
    await audioSoundRef.current.seekTo(target);
  }, [playingAudioId]);

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatTimeRemaining = (positionMs: number, durationMs: number) => {
    const remaining = Math.max(durationMs - positionMs, 0);
    const totalSeconds = Math.ceil(remaining / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const MessageTicks = ({ status }: { status?: string }) => {
    if (status === "read") {
      return (
        <View style={styles.ticksContainer}>
          <Icon name="check" size={12} color="#34D399" />
          <View style={{ marginLeft: -6 }}>
            <Icon name="check" size={12} color="#34D399" />
          </View>
        </View>
      );
    }
    if (status === "delivered") {
      return (
        <View style={styles.ticksContainer}>
          <Icon name="check" size={12} color="rgba(255,255,255,0.7)" />
          <View style={{ marginLeft: -6 }}>
            <Icon name="check" size={12} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.ticksContainer}>
        <Icon name="check" size={12} color="rgba(255,255,255,0.5)" />
      </View>
    );
  };

  const renderMessageContent = useCallback((item: Message, isOwnMessage: boolean) => {
    const textColor = isOwnMessage ? "#FFFFFF" : theme.text;
    const messageType = item.type || "text";

    if (messageType === "photo" && item.photoUrl) {
      return (
        <View>
          <Pressable onPress={() => setPreviewImageUri(item.photoUrl || null)}>
            <Image
              source={{ uri: item.photoUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </Pressable>
          {item.content && item.content !== "Shared a photo" ? (
            <ThemedText style={[styles.messageText, { color: textColor, marginTop: Spacing.xs }]}>
              {item.content}
            </ThemedText>
          ) : null}
        </View>
      );
    }

    if (messageType === "location" && item.location) {
      return (
        <Pressable 
          style={styles.locationMessage}
          onPress={() => {
            const url = Platform.select({
              ios: `maps:0,0?q=${item.location?.latitude},${item.location?.longitude}`,
              android: `geo:0,0?q=${item.location?.latitude},${item.location?.longitude}`,
              default: `https://www.google.com/maps?q=${item.location?.latitude},${item.location?.longitude}`,
            });
            Linking.openURL(url as string);
          }}
        >
          <View style={[styles.locationIconContainer, { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
            <Icon name="map-pin" size={24} color={isOwnMessage ? "#FFFFFF" : AppColors.primary} />
          </View>
          <View style={styles.locationDetails}>
            <ThemedText style={[styles.locationName, { color: textColor }]}>
              {item.location.name || "Shared Location"}
            </ThemedText>
            {item.location.address ? (
              <ThemedText style={[styles.locationAddress, { color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
                {item.location.address}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.tapToView, { color: isOwnMessage ? "rgba(255,255,255,0.7)" : AppColors.primary }]}>
              Tap to view in Maps
            </ThemedText>
          </View>
        </Pressable>
      );
    }

    if (messageType === "file" && item.fileName) {
      return (
        <Pressable
          style={styles.fileMessage}
          onPress={() => item.fileUrl && setPreviewFile({ uri: item.fileUrl, name: item.fileName })}
        >
          <View style={[styles.fileIconContainer, { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
            <Icon name="file" size={24} color={isOwnMessage ? "#FFFFFF" : AppColors.primary} />
          </View>
          <View style={styles.fileDetails}>
            <ThemedText style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
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
      );
    }

    if (messageType === "audio") {
      const isThisAudio = audioProgress.id === item.id;
      const isPlaying = isThisAudio && audioProgress.isPlaying;
      const progress = isThisAudio && audioProgress.duration > 0 
        ? audioProgress.position / audioProgress.duration 
        : 0;
      const currentTime = isThisAudio ? Math.floor(audioProgress.position / 1000) : 0;
      const totalDuration = item.audioDuration || (isThisAudio ? Math.floor(audioProgress.duration / 1000) : 0);

      return (
        <View
          style={[
            styles.audioPill,
            { backgroundColor: isOwnMessage ? AppColors.primary : theme.cardBackground },
          ]}
        >
          <Pressable
            style={[
              styles.audioPillIcon,
              { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary },
            ]}
            onPress={() => playAudio(item.id, item.audioUrl || item.fileUrl)}
          >
            <Icon
              name={isPlaying ? "pause" : "play"}
              size={18}
              color={isOwnMessage ? "#FFFFFF" : AppColors.primary}
            />
          </Pressable>

          <View style={styles.audioSliderContainer}>
            <Slider
              style={styles.audioSlider}
              minimumValue={0}
              maximumValue={1}
              value={progress}
              onSlidingComplete={(value) => seekAudio(item.id, value)}
              minimumTrackTintColor={isOwnMessage ? "#FFFFFF" : AppColors.primary}
              maximumTrackTintColor={isOwnMessage ? "rgba(255,255,255,0.3)" : theme.backgroundSecondary}
              thumbTintColor={isOwnMessage ? "#FFFFFF" : AppColors.primary}
            />
            <View style={styles.audioTimeRow}>
              <ThemedText style={[styles.audioTimeText, { color: isOwnMessage ? "rgba(255,255,255,0.8)" : theme.textSecondary }]}>
                {formatDuration(currentTime)}
              </ThemedText>
              <ThemedText style={[styles.audioTimeText, { color: isOwnMessage ? "rgba(255,255,255,0.8)" : theme.textSecondary }]}>
                {formatDuration(totalDuration)}
              </ThemedText>
            </View>
          </View>
        </View>
      );
    }

    return (
      <ThemedText
        style={[
          styles.messageText,
          { color: textColor },
        ]}
      >
        {item.content}
      </ThemedText>
    );
  }, [theme, playAudio, audioProgress, seekAudio]);

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwnMessage = item.senderId === user?.id;
      const showTime =
        index === 0 ||
        new Date(item.createdAt).getTime() -
          new Date(chatMessages[index - 1]?.createdAt).getTime() >
          300000;

      const onSwipe = () => setReplyTo(item);

      return (
        <Animated.View
          entering={FadeInUp.delay(index * 50).springify()}
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
          ]}
        >
          {showTime ? (
            <ThemedText
              type="small"
              style={[styles.timestamp, { color: theme.textSecondary }]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </ThemedText>
          ) : null}
          <Swipeable
            renderLeftActions={isOwnMessage ? undefined : () => <View style={styles.swipeAction} />}
            renderRightActions={isOwnMessage ? () => <View style={styles.swipeAction} /> : undefined}
            onSwipeableOpen={(direction, swipeable) => {
              if (direction === 'left' && !isOwnMessage) onSwipe();
              if (direction === 'right' && isOwnMessage) onSwipe();
              swipeable.close();
            }}
          >
            <Pressable onPress={() => handleMessagePress(item)} onLongPress={() => handleLongPress(item)} delayLongPress={300}>
              <View
                style={[
                  styles.messageBubble,
                  isOwnMessage
                    ? [styles.ownBubble, { backgroundColor: AppColors.primary }]
                    : [styles.otherBubble, { backgroundColor: theme.cardBackground }],
                ]}
              >
                {item.replyTo ? (
                  <View style={[styles.replyPreview, { backgroundColor: isOwnMessage ? "rgba(255,255,255,0.12)" : theme.backgroundSecondary }]}>
                    <ThemedText style={styles.replyText} numberOfLines={2}>
                      {(item.replyTo.senderName || "User") + ": " + item.replyTo.content}
                    </ThemedText>
                  </View>
                ) : null}
              {renderMessageContent(item, isOwnMessage)}
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
              {isOwnMessage ? (
                <View style={styles.messageFooter}>
                  {item.editedAt ? (
                    <ThemedText style={styles.editedText}>edited</ThemedText>
                  ) : null}
                  <MessageTicks status={item.status} />
                </View>
              ) : null}
              </View>
            </Pressable>
          </Swipeable>
        </Animated.View>
      );
    },
    [user?.id, theme, chatMessages, handleLongPress, renderMessageContent, handleReaction, replyTo, playingAudioId]
  );

  const EmptyChat = () => (
    <Animated.View entering={FadeIn} style={styles.emptyContainer}>
      <View style={styles.emptyContent}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.primary + "20" }]}>
          <Icon name="send" size={32} color={theme.primary} />
        </View>
        <ThemedText
          type="h4"
          style={[styles.emptyTitle, { color: theme.text }]}
        >
          Start the conversation
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.emptySubtitle, { color: theme.textSecondary }]}
        >
          Say hello to {match?.matchedUser.name.split(" ")[0]}!
        </ThemedText>
      </View>
    </Animated.View>
  );

  const matchedUser = match?.matchedUser;
  const avatarUri = matchPhoto || matchedUser?.photos?.[0] || null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: "transparent" }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ChatBackground />

      <FlatList
        ref={flatListRef}
        data={chatMessages.toReversed()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted={chatMessages.length > 0}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: headerHeight + Spacing.sm },
          chatMessages.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={EmptyChat}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.chatHeaderOverlay, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <Pressable
          style={styles.chatHeaderBack}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Icon name="chevron-back" size={28} color="#000000" />
        </Pressable>
        <Pressable
          style={styles.chatHeaderProfile}
          onPress={() => setShowProfileModal(true)}
          hitSlop={8}
        >
          <Image
            source={avatarUri ? { uri: avatarUri } : require("../../assets/images/default-avatar.png")}
            style={styles.chatHeaderAvatar}
          />
          <View>
            <ThemedText style={styles.chatHeaderName} numberOfLines={1}>
              {matchedUser?.name || route.params.matchName}
            </ThemedText>
            {matchedUser?.location ? (
              <ThemedText style={styles.chatHeaderLocation} numberOfLines={1}>
                {matchedUser.location}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      </View>

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: "transparent",
            paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.lg,
            borderTopColor: theme.border,
          },
        ]}
      >
        {uploadLabel ? (
          <View style={styles.uploadPill}>
            <ThemedText style={styles.uploadText}>{uploadLabel}</ThemedText>
          </View>
        ) : null}
        {isRecording ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingText}>Recording...</ThemedText>
          </View>
        ) : null}
        {replyTo ? (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLeft} />
            <View style={styles.replyBarContent}>
              <ThemedText style={styles.replyBarTitle}>Replying to</ThemedText>
              <ThemedText style={styles.replyBarText} numberOfLines={1}>
                {(replyTo.senderId === user?.id ? "You" : (match?.matchedUser.name || "User")) + ': ' + replyTo.content}
              </ThemedText>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Icon name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.inputBorder },
          ]}
        >
          <Pressable
            onPress={() => setShowAttachmentModal(true)}
            style={[
              styles.attachButton,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            testID="button-attach"
          >
            <Icon name="plus" size={20} color={AppColors.primary} />
          </Pressable>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            testID="input-message"
          />
          {inputText.trim() ? (
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              style={[
                styles.sendButton,
                {
                  backgroundColor: inputText.trim()
                    ? AppColors.primary
                    : theme.backgroundSecondary,
                },
              ]}
              testID="button-send"
            >
              <Icon
                name="send"
                size={18}
                color={inputText.trim() ? "#FFFFFF" : theme.textSecondary}
              />
            </Pressable>
          ) : null}
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

      <Modal
        visible={showMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageMenu(false)}
      >
        <Pressable 
          style={styles.menuOverlay} 
          onPress={() => setShowMessageMenu(false)}
        >
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
            {selectedMessage?.senderId === user?.id ? (
              <>
                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.menuItem} onPress={handleEdit}>
                  <Icon name="edit-3" size={20} color={theme.primary} />
                  <ThemedText style={styles.menuItemText}>Edit Message</ThemedText>
                </Pressable>
                <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.menuItem} onPress={handleDelete}>
                  <Icon name="trash-2" size={20} color={theme.danger} />
                  <ThemedText style={[styles.menuItemText, { color: theme.danger }]}>Delete Message</ThemedText>
                </Pressable>
              </>
            ) : null}
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
              >
                <ThemedText style={[styles.editButtonText, { color: "#FFFFFF" }]}>Save</ThemedText>
              </Pressable>
            </View>
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
        onChooseFromGallery={handleChoosePhoto}
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
            <Image source={{ uri: previewImageUri }} style={styles.previewImage} resizeMode="contain" />
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

      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={[styles.profileModalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.profileModalHeader}>
            <ThemedText type="h3">Profile</ThemedText>
            <Pressable onPress={() => setShowProfileModal(false)} hitSlop={12}>
              <Icon name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.profileModalContent} showsVerticalScrollIndicator={false}>
            {matchedUser?.photos && matchedUser.photos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.profilePhotosScroll}
              >
                {matchedUser.photos.map((photo: string, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: photo }}
                    style={styles.profilePhotoFull}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.profileModalAvatarWrap}>
                <Image
                  source={avatarUri ? { uri: avatarUri } : require("../../assets/images/default-avatar.png")}
                  style={styles.profileModalAvatar}
                />
              </View>
            )}
            {matchedUser?.photos && matchedUser.photos.length > 1 ? (
              <View style={styles.profilePhotoDots}>
                {matchedUser.photos.map((_: string, i: number) => (
                  <View key={i} style={[styles.profilePhotoDot, i === 0 && styles.profilePhotoDotActive]} />
                ))}
              </View>
            ) : null}
            <ThemedText style={[styles.profileModalName, { color: theme.text }]}>
              {matchedUser?.name || route.params.matchName}
              {matchedUser?.age ? `, ${matchedUser.age}` : ""}
            </ThemedText>
            {matchedUser?.travelBadge && matchedUser.travelBadge !== "none" ? (
              <View style={styles.profileModalBadge}>
                <View style={[styles.profileBadgePill, { backgroundColor: AppColors.primary + "20" }]}>
                  <Icon name="award" size={14} color={AppColors.primary} />
                  <ThemedText style={{ color: AppColors.primary, fontSize: 13, fontWeight: "600" as const, marginLeft: 4 }}>
                    {matchedUser.travelBadge.charAt(0).toUpperCase() + matchedUser.travelBadge.slice(1)}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            {matchedUser?.location ? (
              <View style={styles.profileModalInfoRow}>
                <Icon name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.profileModalInfoText, { color: theme.textSecondary }]}>
                  {matchedUser.location}
                </ThemedText>
              </View>
            ) : null}
            {matchedUser?.vanType ? (
              <View style={styles.profileModalInfoRow}>
                <Icon name="truck" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.profileModalInfoText, { color: theme.textSecondary }]}>
                  {matchedUser.vanType}
                </ThemedText>
              </View>
            ) : null}
            {matchedUser?.travelStyle ? (
              <View style={styles.profileModalInfoRow}>
                <Icon name="compass" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.profileModalInfoText, { color: theme.textSecondary }]}>
                  {matchedUser.travelStyle}
                </ThemedText>
              </View>
            ) : null}
            {matchedUser?.bio ? (
              <View style={[styles.profileModalSection, { backgroundColor: theme.cardBackground }]}>
                <ThemedText style={[styles.profileModalSectionTitle, { color: theme.text }]}>About</ThemedText>
                <ThemedText style={{ color: theme.text, lineHeight: 22 }}>{matchedUser.bio}</ThemedText>
              </View>
            ) : null}
            {matchedUser?.interests && matchedUser.interests.length > 0 ? (
              <View style={[styles.profileModalSection, { backgroundColor: theme.cardBackground }]}>
                <ThemedText style={[styles.profileModalSectionTitle, { color: theme.text }]}>Interests</ThemedText>
                <View style={styles.profileModalTags}>
                  {matchedUser.interests.map((interest: string, i: number) => (
                    <View key={i} style={[styles.profileModalTag, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText style={{ color: theme.text, fontSize: 13 }}>{interest}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    marginTop: Spacing.xs,
  },
  messageContainer: {
    marginBottom: Spacing.sm,
    width: "100%",
  },
  ownMessage: {
    alignItems: "flex-end",
  },
  otherMessage: {
    alignItems: "flex-start",
  },
  timestamp: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  messageBubble: {
    maxWidth: "80%",
    minWidth: 110,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  ownBubble: {
    borderBottomLeftRadius: Spacing.xs,
  },
  otherBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  editedText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
  },
  ticksContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  inputContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255,140,66,0.1)",
    borderRadius: 10,
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
    fontWeight: "600" as const,
    color: AppColors.primary,
  },
  replyBarText: {
    fontSize: 13,
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
  
  
  
  
  
  
  
  
  
  

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 52,
    gap: Spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.md,
  },
  locationMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minWidth: 180,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  locationDetails: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "600",
  },
  locationAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  tapToView: {
    fontSize: 11,
    marginTop: 4,
  },
  fileMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minWidth: 160,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginLeft: Spacing.sm,
  },
  downloadIcon: {
    marginLeft: Spacing.sm,
  },
  audioPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minWidth: 220,
    maxWidth: 280,
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
  },
  audioSliderContainer: {
    flex: 1,
    marginLeft: 4,
  },
  audioSlider: {
    width: "100%",
    height: 24,
  },
  audioTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  audioTimeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  reactionsRow: {
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
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(36, 107, 253, 0.15)",
    marginBottom: 8,
    alignSelf: "center",
  },
  uploadText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
    color: AppColors.primary,
  },
  recordingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    marginBottom: 8,
    alignSelf: "center",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#EF4444",
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 36,
  },
  chatHeaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  chatHeaderBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 20,
  },
  chatHeaderProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatHeaderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.15)",
  },
  chatHeaderName: {
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  chatHeaderLocation: {
    color: "rgba(0,0,0,0.5)",
    fontSize: 11,
    marginTop: 1,
  },
  profileModalContainer: {
    flex: 1,
  },
  profileModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  profileModalContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileModalAvatarWrap: {
    marginTop: 24,
    marginBottom: 16,
  },
  profileModalAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileModalName: {
    fontSize: 24,
    fontWeight: "800" as const,
    textAlign: "center",
    marginBottom: 6,
  },
  profileModalBadge: {
    marginBottom: 10,
  },
  profileBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  profileModalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  profileModalInfoText: {
    fontSize: 14,
  },
  profileModalSection: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  profileModalSectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 10,
  },
  profileModalTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  profileModalTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  profilePhotosScroll: {
    width: "100%",
    height: 300,
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  profilePhotoFull: {
    width: 340,
    height: 300,
    borderRadius: 16,
    marginRight: 8,
  },
  profilePhotoDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  profilePhotoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  profilePhotoDotActive: {
    backgroundColor: AppColors.primary,
    width: 20,
  },
});