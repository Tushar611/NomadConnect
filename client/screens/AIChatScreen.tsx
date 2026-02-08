import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
  Modal,
  Animated as RNAnimated,
  Easing,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import AudioModule from "expo-audio/build/AudioModule";
import type { AudioPlayer, AudioRecorder } from "expo-audio";

import { ChatBackground } from "@/components/ChatBackground";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/context/AuthContext";
import { useAlert } from "@/context/AlertContext";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { AppColors, Spacing, BorderRadius, GradientPresets } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { getApiUrl } from "@/lib/query-client";
import { ChatAttachmentModal } from "@/components/ChatAttachmentModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import LocationPickerModal from "@/components/LocationPickerModal";
import { ActivityLocation } from "@/types";
import { uploadPhoto, uploadFile, uploadAudio } from "@/lib/upload";
import { saveImageToGallery, saveFileToDevice } from "@/lib/media";

type MessageType = "text" | "photo" | "location" | "file" | "audio";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: MessageType;
  imageUrl?: string;
  photoUrl?: string;
  fileUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  fileName?: string;
  reactions?: Record<string, string[]>;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "What solar setup do I need for a weekend warrior?",
  "Best insulation for hot climates?",
  "How do I wire a 12V system?",
  "Stealth camping essentials?",
];

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

const AI_CHAT_SESSIONS_KEY = "@nomad_ai_chat_sessions";
const AI_CURRENT_SESSION_KEY = "@nomad_ai_current_session";

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const generateSessionTitle = (messages: Message[]): string => {
  const firstUserMessage = messages.find(m => m.role === "user");
  if (firstUserMessage) {
    const content = firstUserMessage.content;
    return content.length > 30 ? content.substring(0, 30) + "..." : content;
  }
  return "New Chat";
};

export default function AIChatScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastTapRef = useRef(0);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ uri: string; name?: string } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSoundRef = useRef<AudioPlayer | null>(null);
  const audioProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioProgress, setAudioProgress] = useState({ id: null as string | null, position: 0, duration: 0, isPlaying: false });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(false);

  useEffect(() => {
    loadAllSessions();
  }, [user?.id]);

  useEffect(() => {
    if (messages.length > 0 && !isLoadingHistory && currentSessionId) {
      saveCurrentSession();
    }
  }, [messages, isLoadingHistory, currentSessionId]);

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadAllSessions = async () => {
    if (!user?.id) {
      setIsLoadingHistory(false);
      return;
    }
    
    try {
      const response = await fetch(
        new URL(`/api/ai/sessions/${user.id}`, getApiUrl()).toString()
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        const sessionsWithDates = data.map((session: any) => ({
          id: session.id,
          title: session.title,
          messages: (session.messages as Message[]).map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          createdAt: new Date(session.created_at),
          updatedAt: new Date(session.updated_at),
        }));
        setSessions(sessionsWithDates);
        const latestSession = sessionsWithDates[0];
        setCurrentSessionId(latestSession.id);
        setMessages(latestSession.messages);
      }
    } catch (error) {
      console.error("Failed to load AI chat sessions:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveCurrentSession = async () => {
    if (!currentSessionId || !user?.id) return;
    
    try {
      const title = generateSessionTitle(messages);
      const updatedSessions = sessions.map(session => {
        if (session.id === currentSessionId) {
          return { ...session, messages, title, updatedAt: new Date() };
        }
        return session;
      });
      setSessions(updatedSessions);
      
      await fetch(
        new URL(`/api/ai/sessions/${currentSessionId}`, getApiUrl()).toString(),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages }),
        }
      );
    } catch (error) {
      console.error("Failed to save AI chat session:", error);
    }
  };

  const createNewChat = useCallback(async () => {
    if (!user?.id) return;
    
    // Save current session first before creating new one
    if (currentSessionId && messages.length > 0) {
      const title = generateSessionTitle(messages);
      const updatedSessions = sessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages, title, updatedAt: new Date() };
        }
        return s;
      });
      setSessions(updatedSessions);
      
      // Save to API
      fetch(
        new URL(`/api/ai/sessions/${currentSessionId}`, getApiUrl()).toString(),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages }),
        }
      ).catch(console.error);
    }
    
    const newSessionId = `chat_${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    try {
      const response = await fetch(
        new URL("/api/ai/sessions", getApiUrl()).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newSessionId,
            userId: user.id,
            title: "New Chat",
            messages: [],
          }),
        }
      );
      
      if (!response.ok) throw new Error("Failed to create session");
      
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setCurrentSessionId(newSessionId);
      setMessages([]);
      setShowChatList(false);
      
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  }, [sessions, user?.id, currentSessionId, messages]);

  const switchToSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      // Save current session first before switching
      if (currentSessionId && messages.length > 0) {
        const title = generateSessionTitle(messages);
        const updatedSessions = sessions.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, messages, title, updatedAt: new Date() };
          }
          return s;
        });
        setSessions(updatedSessions);
        
        // Save to API
        fetch(
          new URL(`/api/ai/sessions/${currentSessionId}`, getApiUrl()).toString(),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, messages }),
          }
        ).catch(console.error);
      }
      
      // Now switch to the new session
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setShowChatList(false);
      
      try {
        if (Platform.OS !== "web") {
          Haptics.selectionAsync();
        }
      } catch (error) {
        console.error("Failed to switch session:", error);
      }
    }
  }, [sessions, currentSessionId, messages]);

  const deleteSession = useCallback(async (sessionId: string) => {
    showAlert({
      type: "confirm",
      title: "Delete Chat",
      message: "Are you sure you want to delete this chat?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(
                new URL(`/api/ai/sessions/${sessionId}`, getApiUrl()).toString(),
                { method: "DELETE" }
              );
              
              const updatedSessions = sessions.filter(s => s.id !== sessionId);
              setSessions(updatedSessions);
              
              if (currentSessionId === sessionId) {
                if (updatedSessions.length > 0) {
                  setCurrentSessionId(updatedSessions[0].id);
                  setMessages(updatedSessions[0].messages);
                } else {
                  setCurrentSessionId(null);
                  setMessages([]);
                }
              }
              
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error("Failed to delete chat:", error);
            }
          },
        },
      ],
    });
  }, [sessions, currentSessionId]);

  const clearAllChats = useCallback(async () => {
    if (!user?.id) return;
    
    showAlert({
      type: "confirm",
      title: "Clear All Chats",
      message: "Are you sure you want to delete all chat history?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              for (const session of sessions) {
                await fetch(
                  new URL(`/api/ai/sessions/${session.id}`, getApiUrl()).toString(),
                  { method: "DELETE" }
                );
              }
              setSessions([]);
              setCurrentSessionId(null);
              setMessages([]);
              setShowChatList(false);
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error("Failed to clear all chats:", error);
            }
          },
        },
      ],
    });
  }, [sessions]);

    const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || !user?.id) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSessionId = `chat_${Date.now()}`;
      const newSession: ChatSession = {
        id: newSessionId,
        title: "New Chat",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessionId = newSessionId;
      
      try {
        const response = await fetch(
          new URL("/api/ai/sessions", getApiUrl()).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: newSessionId,
              userId: user.id,
              title: "New Chat",
              messages: [],
            }),
          }
        );
        
        if (!response.ok) throw new Error("Failed to create session");
        
        const updatedSessions = [newSession, ...sessions];
        setSessions(updatedSessions);
        setCurrentSessionId(sessionId);
      } catch (error) {
        console.error("Failed to create initial session:", error);
        return;
      }
    }

    const replyPayload = replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          senderName: replyTo.role === "user" ? "You" : "AI Advisor",
        }
      : undefined;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      type: "text",
      replyTo: replyPayload,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setReplyTo(null);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(new URL("/api/ai/chat", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`AI ${response.status}: ${responseText || response.statusText}`);
      }

      let data: { response?: string } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (error) {
        throw new Error("Invalid response from AI server");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "I couldn't generate a response. Please try again.",
        type: "text",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please try again.",
        type: "text",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setUploadLabel(null);
    }
  }, [messages, isLoading, replyTo]);

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
        setIsLoading(true);
        setUploadLabel("Uploading photo...");
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        const replyPayload = replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              senderName: replyTo.role === "user" ? "You" : "AI Advisor",
            }
          : undefined;
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: "I'm sharing a photo of my van build",
          type: "photo",
          photoUrl: uploadResult.url,
          replyTo: replyPayload,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setReplyTo(null);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        console.error("Failed to upload photo:", error);
        showAlert({ type: "error", title: "Upload Failed", message: "Could not upload photo. Please try again." });
      } finally {
        setIsLoading(false);
        setUploadLabel(null);
      }
    }
  }, [replyTo]);

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
        setIsLoading(true);
        setUploadLabel("Uploading photo...");
        const uploadResult = await uploadPhoto(result.assets[0].uri);
        const replyPayload = replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              senderName: replyTo.role === "user" ? "You" : "AI Advisor",
            }
          : undefined;
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: "I'm sharing a photo of my van build",
          type: "photo",
          photoUrl: uploadResult.url,
          replyTo: replyPayload,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setReplyTo(null);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        console.error("Failed to upload photo:", error);
        showAlert({ type: "error", title: "Upload Failed", message: "Could not upload photo. Please try again." });
      } finally {
        setIsLoading(false);
        setUploadLabel(null);
      }
    }
  }, [replyTo]);

  const handleSelectLocation = useCallback(async (location: ActivityLocation) => {
    const replyPayload = replyTo
      ? {
          id: replyTo.id,
          content: replyTo.content,
          senderName: replyTo.role === "user" ? "You" : "AI Advisor",
        }
      : undefined;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `My current location: ${location.name}`,
      type: "location",
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        address: location.address,
      },
      replyTo: replyPayload,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setReplyTo(null);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [replyTo]);

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        try {
          setIsLoading(true);
          setUploadLabel("Uploading file...");
          const uploadResult = await uploadFile(file.uri, file.name);
          const replyPayload = replyTo
            ? {
                id: replyTo.id,
                content: replyTo.content,
                senderName: replyTo.role === "user" ? "You" : "AI Advisor",
              }
            : undefined;
          const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: `Sharing a file: ${file.name}`,
            type: "file",
            fileName: file.name,
            fileUrl: uploadResult.url,
            replyTo: replyPayload,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, userMessage]);
          setReplyTo(null);
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } catch (error) {
          console.error("Failed to upload file:", error);
          showAlert({ type: "error", title: "Upload Failed", message: "Could not upload file. Please try again." });
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  }, [replyTo]);

  const handleReaction = useCallback((message: Message, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message.id) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = new Set(reactions[emoji] || []);
        const userId = "me";
        if (users.has(userId)) {
          users.delete(userId);
        } else {
          users.add(userId);
        }
        if (users.size === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = Array.from(users);
        }
        return { ...m, reactions };
      })
    );
    setShowMessageMenu(false);
    setShowEmojiPicker(false);
    setSelectedMessage(null);
  }, []);

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
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
    }
  }, []);

  const handleMessagePress = useCallback((message: Message) => {
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      handleReaction(message, "\u{1F44D}");
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  }, [handleReaction]);

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
      setIsLoading(true);
      setUploadLabel("Uploading audio...");
      const uploadResult = await uploadAudio(uri, `voice_${Date.now()}.m4a`);
      const replyPayload = replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderName: replyTo.role === "user" ? "You" : "AI Advisor",
          }
        : undefined;
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: "Voice message",
        type: "audio",
        audioUrl: uploadResult.url,
        fileName: "voice.m4a",
        replyTo: replyPayload,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setReplyTo(null);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      showAlert({ type: "error", title: "Recording Failed", message: "Could not save the audio." });
    } finally {
      setIsLoading(false);
      setUploadLabel(null);
    }
  }, [replyTo]);

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
          setPlayingAudioId(null);
          return;
        }
        audioSoundRef.current.play();
        setPlayingAudioId(id);
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
  }, [playingAudioId]);

  const seekAudio = useCallback(async (id: string, fraction: number) => {
    if (!audioSoundRef.current || playingAudioId !== id) return;
    const duration = audioSoundRef.current.duration || 0;
    if (duration <= 0) return;
    const target = Math.max(0, Math.min(duration, duration * fraction));
    await audioSoundRef.current.seekTo(target);
  }, [playingAudioId]);

  const handleDownloadImage = useCallback(async (uri: string) => {
    try {
      await saveImageToGallery(uri);
      showAlert({ type: "success", title: "Saved", message: "Image saved to your gallery." });
    } catch (error) {
      showAlert({ type: "error", title: "Download Failed", message: "Could not save the image." });
    }
  }, []);

  const handleDownloadFile = useCallback(async (uri: string, name?: string) => {
    try {
      await saveFileToDevice(uri, name);
      showAlert({ type: "success", title: "Saved", message: "File saved to your device." });
    } catch (error) {
      showAlert({ type: "error", title: "Download Failed", message: "Could not save the file." });
    }
  }, []);

  const formatTimeRemaining = (positionMs: number, durationMs: number) => {
    const remaining = Math.max(durationMs - positionMs, 0);
    const totalSeconds = Math.ceil(remaining / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const renderMessageContent = (item: Message, isUser: boolean) => {
    const textColor = isUser ? "#FFF" : theme.text;
    const messageType = item.type || "text";

    if (messageType === "photo" && item.photoUrl) {
      return (
        <View>
          <Pressable onPress={() => setPreviewImageUri(item.photoUrl || null)}>
            <Image source={{ uri: item.photoUrl }} style={styles.messageImage} resizeMode="cover" />
          </Pressable>
          {item.content ? (
            <ThemedText style={[styles.messageText, { color: textColor, marginTop: Spacing.sm }]}>
              {item.content}
            </ThemedText>
          ) : null}
        </View>
      );
    }

    if (messageType === "file" && item.fileUrl) {
      return (
        <Pressable
          style={styles.fileMessage}
          onPress={() => setPreviewFile({ uri: item.fileUrl as string, name: item.fileName })}
        >
          <View style={[styles.fileIconContainer, { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
            <Icon name="file" size={22} color={isUser ? "#FFFFFF" : AppColors.primary} />
          </View>
          <View style={styles.fileDetails}>
            <ThemedText style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
              {item.fileName || "File"}
            </ThemedText>
            <ThemedText style={[styles.fileLabel, { color: isUser ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
              File attachment
            </ThemedText>
          </View>
          <View style={styles.downloadIcon}>
            <Icon name="download" size={16} color={isUser ? "#FFFFFF" : theme.textSecondary} />
          </View>
        </Pressable>
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
          <View style={[styles.locationIconContainer, { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
            <Icon name="map-pin" size={20} color={isUser ? "#FFFFFF" : AppColors.primary} />
          </View>
          <View style={styles.locationDetails}>
            <ThemedText style={[styles.locationName, { color: textColor }]}>
              {item.location.name || "Shared Location"}
            </ThemedText>
            {item.location.address ? (
              <ThemedText style={[styles.locationAddress, { color: isUser ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>
                {item.location.address}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      );
    }

    if (messageType === "audio") {
      const isPlaying = playingAudioId === item.id;
      const waveColor = isUser ? "rgba(255,255,255,0.9)" : theme.primary;
      return (
        <Pressable
          style={[styles.audioPill, { backgroundColor: isUser ? AppColors.primary : theme.cardBackground }]}
          onPress={() => playAudio(item.id, item.audioUrl || item.fileUrl)}
        >
          <View style={[styles.audioPillIcon, { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : theme.backgroundSecondary }]}>
            <Icon name={isPlaying ? "pause" : "play"} size={18} color={isUser ? "#FFFFFF" : AppColors.primary} />
          </View>
          <AudioWave active={isPlaying} color={waveColor} />
          <ThemedText style={[styles.audioDurationText, { color: isUser ? "#FFFFFF" : theme.text }]}>
            {item.audioDuration ? formatDuration(item.audioDuration) : "0:00"}
          </ThemedText>
        </Pressable>
      );
    }

    if (item.imageUrl) {
      return (
        <Pressable onPress={() => setPreviewImageUri(item.imageUrl || null)}>
          <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
        </Pressable>
      );
    }

    return (
      <ThemedText style={[styles.messageText, { color: textColor }]}>
        {item.content}
      </ThemedText>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          { backgroundColor: isUser ? AppColors.primary : theme.cardBackground },
        ]}
      >
        {!isUser ? (
          <View style={styles.aiLabel}>
            <Icon name="sparkles" size={12} color={AppColors.primary} />
            <ThemedText style={styles.aiLabelText}>AI Advisor</ThemedText>
          </View>
        ) : null}

        {item.replyTo ? (
          <View style={styles.replyPreview}>
            <ThemedText style={styles.replyText} numberOfLines={2}>
              {(item.replyTo.senderName || "User") + ": " + item.replyTo.content}
            </ThemedText>
          </View>
        ) : null}

        {renderMessageContent(item, isUser)}

        {item.reactions && Object.keys(item.reactions).length > 0 ? (
          <View style={styles.reactionsRow}>
            {Object.entries(item.reactions).map(([emoji, users]) => (
              <Pressable
                key={`${item.id}-${emoji}`}
                style={styles.reactionPill}
                onPress={() => handleReaction(item, emoji)}
              >
                <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                <ThemedText style={styles.reactionCount}>{users.length}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: AppColors.primary + "20" }]}>
        <Icon name="message-circle" size={48} color={AppColors.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>Van Build Advisor</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Ask me anything about van conversions, builds, costs, and nomad life!
      </ThemedText>
      <View style={styles.suggestionsContainer}>
        <ThemedText style={[styles.suggestionsLabel, { color: theme.textSecondary }]}>
          Try asking:
        </ThemedText>
        {[
          "What's the best van for a beginner build?",
          "How do I install solar panels?",
          "What's a good budget for a full conversion?",
        ].map((suggestion, index) => (
          <Pressable
            key={index}
            style={[styles.suggestionChip, { backgroundColor: theme.cardBackground }]}
            onPress={() => sendMessage(suggestion)}
          >
            <ThemedText style={styles.suggestionText}>{suggestion}</ThemedText>
            <Icon name="arrow-right" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <LinearGradient
        colors={[...(isDark ? GradientPresets.aiDark : GradientPresets.aiLight)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ChatBackground />
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages.length > 0 ? [...messages].reverse() : messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted={messages.length > 0}
          contentContainerStyle={[
            styles.messagesList, 
            { paddingTop: Spacing.lg, paddingBottom: headerHeight + Spacing.lg }, 
            messages.length === 0 && styles.emptyList
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={renderEmptyState}
        />

        <View style={[styles.inputContainer, { borderTopColor: "rgba(0,0,0,0.08)", backgroundColor: "rgba(255,255,255,0.95)", paddingBottom: insets.bottom + Spacing.sm }]}
        >
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFF" />
              <ThemedText style={styles.loadingText}>AI is thinking...</ThemedText>
            </View>
          )}

          {replyTo ? (
            <View style={styles.replyBar}>
              <View style={styles.replyBarLeft} />
              <View style={styles.replyBarContent}>
                <ThemedText style={styles.replyBarTitle}>Replying to</ThemedText>
                <ThemedText style={styles.replyBarText} numberOfLines={1}>
                  {(replyTo.role === "user" ? "You" : "AI Advisor") + ": " + replyTo.content}
                </ThemedText>
              </View>
              <Pressable onPress={() => setReplyTo(null)}>
                <Icon name="x" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.inputWrapper, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" }]}
          >
            <Pressable
              onPress={() => setShowAttachmentModal(true)}
              style={[styles.attachButton, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Icon name="plus" size={20} color={AppColors.primary} />
            </Pressable>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Ask about van building..."
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: input.trim() && !isLoading ? AppColors.primary : theme.textSecondary }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              <Icon name="send" size={18} color="#FFF" />
            </Pressable>
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[styles.micButton, { backgroundColor: isRecording ? AppColors.primary : theme.textSecondary }]}
            >
              <Icon name="mic" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

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
              <Pressable style={styles.reactionButton} onPress={() => setShowEmojiPicker(true)}>
                <Icon name="plus" size={16} color={theme.text} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

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
        visible={showChatList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChatList(false)}
      >
        <View style={[styles.chatListOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.chatListContainer, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
            <View style={styles.chatListHeader}>
              <ThemedText type="h3">Chat History</ThemedText>
              <View style={styles.chatListHeaderButtons}>
                <Pressable 
                  style={[styles.chatListHeaderBtn, { backgroundColor: AppColors.primary }]} 
                  onPress={createNewChat}
                  testID="button-new-chat"
                >
                  <Icon name="plus" size={18} color="#FFF" />
                  <ThemedText style={styles.chatListHeaderBtnText}>New</ThemedText>
                </Pressable>
                <Pressable 
                  style={styles.chatListCloseBtn} 
                  onPress={() => setShowChatList(false)}
                >
                  <Icon name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
            </View>
            
            {sessions.length === 0 ? (
              <View style={styles.chatListEmpty}>
                <Icon name="message-circle" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.chatListEmptyText, { color: theme.textSecondary }]}>
                  No chats yet. Start a new conversation!
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatListContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.chatListItem,
                      { 
                        backgroundColor: item.id === currentSessionId 
                          ? AppColors.primary + "20" 
                          : theme.cardBackground,
                        borderColor: item.id === currentSessionId 
                          ? AppColors.primary 
                          : theme.border,
                      }
                    ]}
                    onPress={() => switchToSession(item.id)}
                    testID={`button-chat-${item.id}`}
                  >
                    <View style={styles.chatListItemContent}>
                      <Icon 
                        name="message-circle" 
                        size={20} 
                        color={item.id === currentSessionId ? AppColors.primary : theme.textSecondary} 
                      />
                      <View style={styles.chatListItemText}>
                        <ThemedText 
                          style={[
                            styles.chatListItemTitle,
                            item.id === currentSessionId && { color: AppColors.primary }
                          ]} 
                          numberOfLines={1}
                        >
                          {item.title}
                        </ThemedText>
                        <ThemedText 
                          style={[styles.chatListItemDate, { color: theme.textSecondary }]}
                        >
                          {item.messages.length} messages
                        </ThemedText>
                      </View>
                    </View>
                    <Pressable
                      style={styles.chatListDeleteBtn}
                      onPress={() => deleteSession(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      testID={`button-delete-chat-${item.id}`}
                    >
                      <Icon name="trash-2" size={18} color="#EF4444" />
                    </Pressable>
                  </Pressable>
                )}
              />
            )}
            
            {sessions.length > 0 ? (
              <Pressable 
                style={[styles.clearAllBtn, { borderTopColor: theme.border }]}
                onPress={clearAllChats}
                testID="button-clear-all-chats"
              >
                <Icon name="trash" size={16} color="#EF4444" />
                <ThemedText style={styles.clearAllText}>Clear All Chats</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Pressable
        style={[styles.chatListButton, { top: headerHeight - 45, backgroundColor: theme.cardBackground }]}
        onPress={() => setShowChatList(true)}
        testID="button-open-chat-list"
      >
        <Icon name="list" size={20} color={theme.text} />
      </Pressable>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexGrow: 1,
  },
  emptyList: {
    justifyContent: "center",
  },
  messageBubble: {
    maxWidth: "85%",
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  aiLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  aiLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: AppColors.primary,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
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
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeAction: {
    width: 64,
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    opacity: 0.7,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  generatedImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
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
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  suggestionsContainer: {
    width: "100%",
    gap: Spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.5,
    marginBottom: Spacing.xs,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: 12,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
  chatListButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatListOverlay: {
    flex: 1,
  },
  chatListContainer: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  chatListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  chatListHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  chatListHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chatListHeaderBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  chatListCloseBtn: {
    padding: 4,
  },
  chatListContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  chatListEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  chatListEmptyText: {
    textAlign: "center",
    fontSize: 15,
  },
  chatListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatListItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  chatListItemText: {
    flex: 1,
  },
  chatListItemTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  chatListItemDate: {
    fontSize: 12,
    marginTop: 2,
  },
  chatListDeleteBtn: {
    padding: 8,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  clearAllText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 14,
  },
});