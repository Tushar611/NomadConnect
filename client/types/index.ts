export type LookingForType = 
  | "friendship"
  | "travel-buddy"
  | "dating"
  | "help-with-build"
  | "local-tips"
  | "activities"
  | "networking";

export type TravelBadge = "nomad" | "adventurer" | "explorer" | "none";

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  bio: string;
  location: string;
  photos: string[];
  interests: string[];
  vanType?: string;
  travelStyle?: string;
  lookingFor?: LookingForType[];
  emergencyContact?: {
    name: string;
    phone: string;
  };
  isTravelVerified?: boolean;
  travelBadge?: TravelBadge;
  createdAt: string;
}

export interface TravelVerificationResult {
  photo_score: number;
  travel_experience_score: number;
  final_travel_score: number;
  badge: TravelBadge;
  verdict: "verified" | "not_verified";
  reasons: string[];
  advice: string;
  coming_soon: string;
}

export interface Match {
  id: string;
  matchedUserId: string;
  matchedUser: User;
  createdAt: string;
  lastMessage?: Message;
  isFavourite?: boolean;
  unreadCount?: number;
}

export type MessageStatus = "sent" | "delivered" | "read";
export type ChatMessageType = "text" | "photo" | "location" | "file" | "audio";

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  type?: ChatMessageType;
  photoUrl?: string;
  fileUrl?: string;
  fileName?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
  };
  reactions?: Record<string, string[]>;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  createdAt: string;
  status: MessageStatus;
  editedAt?: string;
}

export interface ActivityLocation {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  type: "hiking" | "climbing" | "skiing" | "camping" | "surfing" | "other";
  location: string;
  latitude?: number;
  longitude?: number;
  date: string;
  startTime?: string;
  duration?: number;
  hostId: string;
  host: User;
  attendeeIds: string[];
  attendees: User[];
  maxAttendees?: number;
  imageUrl?: string;
  isCompleted?: boolean;
  createdAt: string;
}

export interface SafetyRating {
  id: string;
  activityId: string;
  ratedByUserId: string;
  safetyScore: number;
  wasLocationPublic: boolean;
  hostWasTrustworthy: boolean;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author: User;
  category: "builds" | "electrical" | "plumbing" | "insulation" | "tips" | "general";
  upvotes: number;
  commentCount: number;
  createdAt: string;
}

export interface ForumComment {
  id: string;
  postId: string;
  authorId: string;
  author: User;
  content: string;
  upvotes: number;
  createdAt: string;
}

export interface SwipeCard {
  user: User;
  distance?: number;
}

// Activity Group Chat Types
export type ActivityMessageType = "text" | "photo" | "location" | "file" | "audio" | "system";

export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ActivityChatMessage {
  id: string;
  activityId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  type: ActivityMessageType;
  content: string;
  photoUrl?: string;
  fileUrl?: string;
  fileName?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
  };
  location?: LocationData;
  isPinned: boolean;
  pinnedBy?: string;
  isModeratorMessage: boolean;
  isEdited?: boolean;
  reactions?: Record<string, string[]>;
  createdAt: string;
  deletedAt?: string;
}

export interface ActivityModerator {
  id: string;
  activityId: string;
  userId: string;
  user: User;
  isHost: boolean;
  addedAt: string;
}

export interface ActivityChatMember {
  userId: string;
  user: User;
  isModerator: boolean;
  isHost: boolean;
  joinedAt: string;
}

export interface SOSIncident {
  id: string;
  userId: string;
  userName: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  emergencyContact?: {
    name: string;
    phone: string;
  };
  timestamp: string;
  resolved: boolean;
  notes?: string;
}
