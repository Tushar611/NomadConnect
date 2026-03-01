import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, Match, Message, Activity, ForumPost, SwipeCard, ChatMessageType } from "@/types";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "./AuthContext";

interface DataContextType {
  profiles: SwipeCard[];
  matches: Match[];
  messages: Record<string, Message[]>;
  activities: Activity[];
  forumPosts: ForumPost[];
  likedProfiles: User[];
  isLoading: boolean;
  swipeRight: (userId: string) => Promise<Match | null>;
  swipeLeft: (userId: string) => void;
  sendMessage: (matchId: string, content: string, type?: ChatMessageType, photoUrl?: string, location?: { latitude: number; longitude: number; name?: string; address?: string }, fileUrl?: string, fileName?: string, replyTo?: { id: string; content: string; senderName?: string }, audioDuration?: number) => Promise<Message>;
  editMessage: (matchId: string, messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (matchId: string, messageId: string) => Promise<void>;
  toggleMessageReaction: (matchId: string, messageId: string, emoji: string) => Promise<void>;
  toggleFavourite: (matchId: string) => Promise<void>;
  markMatchAsRead: (matchId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  createActivity: (activity: Omit<Activity, "id" | "createdAt" | "host" | "attendees" | "hostId">) => Promise<Activity>;
  joinActivity: (activityId: string) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  createForumPost: (post: Omit<ForumPost, "id" | "createdAt" | "author" | "authorId" | "upvotes" | "commentCount">) => Promise<ForumPost>;
  upvotePost: (postId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const MATCHES_KEY = "@nomad_matches";
const MESSAGES_KEY = "@nomad_messages";
const FORUM_KEY = "@nomad_forum";
const SWIPES_KEY = "@nomad_swipes";

const MOCK_USERS: User[] = [
  {
    id: "mock1",
    email: "alex@example.com",
    name: "Alex Rivera",
    age: 28,
    bio: "Full-time van lifer exploring the American Southwest. Love hiking, rock climbing, and finding hidden hot springs. Built my own Sprinter conversion last year.",
    location: "Sedona, AZ",
    photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"],
    interests: ["Hiking", "Climbing", "Photography", "Yoga"],
    vanType: "Sprinter",
    travelStyle: "Slow travel",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock2",
    email: "maya@example.com",
    name: "Maya Chen",
    age: 26,
    bio: "Remote software engineer living the van life dream. Currently chasing waves along the California coast. Looking for adventure buddies!",
    location: "Big Sur, CA",
    photos: ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"],
    interests: ["Surfing", "Coding", "Camping", "Stargazing"],
    vanType: "ProMaster",
    travelStyle: "Beach hopping",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock3",
    email: "jordan@example.com",
    name: "Jordan Woods",
    age: 31,
    bio: "Freelance photographer documenting the nomad lifestyle. My van is my mobile studio. Always down for sunrise hikes and campfire conversations.",
    location: "Moab, UT",
    photos: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400"],
    interests: ["Photography", "Hiking", "Mountain Biking", "Coffee"],
    vanType: "Transit",
    travelStyle: "Adventure seeker",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock4",
    email: "sam@example.com",
    name: "Sam Taylor",
    age: 29,
    bio: "Former teacher turned full-time traveler. Currently learning to ski and exploring Colorado mountains. Looking for ski buddies this winter!",
    location: "Telluride, CO",
    photos: ["https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400"],
    interests: ["Skiing", "Reading", "Cooking", "Hiking"],
    vanType: "Econoline",
    travelStyle: "Mountain chaser",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock5",
    email: "river@example.com",
    name: "River Stone",
    age: 27,
    bio: "Yoga instructor on wheels. Teaching classes at campsites and beaches. Vegetarian cook and amateur surfer. Life is better in a van!",
    location: "Oahu, HI",
    photos: ["https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"],
    interests: ["Yoga", "Surfing", "Cooking", "Meditation"],
    vanType: "Westfalia",
    travelStyle: "Island vibes",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock6",
    email: "casey@example.com",
    name: "Casey Morgan",
    age: 32,
    bio: "Digital nomad and writer. Working on my first novel while exploring national parks. Coffee addict and amateur astronomer.",
    location: "Zion, UT",
    photos: ["https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400"],
    interests: ["Writing", "Stargazing", "Hiking", "Coffee"],
    vanType: "Sprinter",
    travelStyle: "Park hopper",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock7",
    email: "dakota@example.com",
    name: "Dakota Lee",
    age: 25,
    bio: "Rock climber and outdoor enthusiast. Living in my converted school bus and chasing the best climbing spots across the country.",
    location: "Joshua Tree, CA",
    photos: ["https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400"],
    interests: ["Climbing", "Camping", "Photography", "Music"],
    vanType: "Skoolie",
    travelStyle: "Crag chaser",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock8",
    email: "phoenix@example.com",
    name: "Phoenix Brooks",
    age: 30,
    bio: "Adventure filmmaker creating content about sustainable nomad living. Looking for collaborators and travel companions.",
    location: "Portland, OR",
    photos: ["https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400"],
    interests: ["Filmmaking", "Sustainability", "Hiking", "Surfing"],
    vanType: "Transit",
    travelStyle: "Content creator",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock9",
    email: "sage@example.com",
    name: "Sage Williams",
    age: 28,
    bio: "Plant-based chef traveling and cooking at pop-up events. My van has a full kitchen! Always looking for local farmers markets.",
    location: "Austin, TX",
    photos: ["https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400"],
    interests: ["Cooking", "Farmers Markets", "Yoga", "Music"],
    vanType: "ProMaster",
    travelStyle: "Foodie",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock10",
    email: "indigo@example.com",
    name: "Indigo James",
    age: 33,
    bio: "Wildlife biologist doing remote field work. My van is my mobile research station. Love birdwatching and nature photography.",
    location: "Yellowstone, WY",
    photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"],
    interests: ["Wildlife", "Photography", "Hiking", "Science"],
    vanType: "Truck Camper",
    travelStyle: "Nature researcher",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock11",
    email: "quinn@example.com",
    name: "Quinn Adams",
    age: 26,
    bio: "Musician on tour living full-time in my van. Playing acoustic shows at campgrounds and coffee shops. Let's jam around the fire!",
    location: "Nashville, TN",
    photos: ["https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400"],
    interests: ["Music", "Camping", "Coffee", "Hiking"],
    vanType: "Econoline",
    travelStyle: "Touring musician",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock12",
    email: "wren@example.com",
    name: "Wren Martinez",
    age: 24,
    bio: "Art student documenting vanlife through watercolors. Selling paintings at markets to fund my travels. Love meeting creative people!",
    location: "Santa Fe, NM",
    photos: ["https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400"],
    interests: ["Art", "Markets", "Hiking", "Photography"],
    vanType: "Westfalia",
    travelStyle: "Artist nomad",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock13",
    email: "rowan@example.com",
    name: "Rowan Pierce",
    age: 35,
    bio: "Retired firefighter living my dream of full-time travel. Expert in van maintenance and always happy to help fellow nomads with repairs.",
    location: "Flagstaff, AZ",
    photos: ["https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400"],
    interests: ["Mechanics", "Hiking", "Fishing", "Community"],
    vanType: "Sprinter",
    travelStyle: "Helper",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock14",
    email: "finley@example.com",
    name: "Finley O'Brien",
    age: 29,
    bio: "Traveling nurse with 3 months on, 3 months off schedule. Using my time off to explore every corner of the country. Adventure is calling!",
    location: "Denver, CO",
    photos: ["https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400"],
    interests: ["Healthcare", "Hiking", "Skiing", "Photography"],
    vanType: "ProMaster",
    travelStyle: "Part-time nomad",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock15",
    email: "skyler@example.com",
    name: "Skyler Fox",
    age: 27,
    bio: "Paragliding instructor and outdoor educator. Living in my van to follow the wind. Looking for flying partners and adventure lovers!",
    location: "Lake Tahoe, CA",
    photos: ["https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400"],
    interests: ["Paragliding", "Skiing", "Camping", "Teaching"],
    vanType: "Transit",
    travelStyle: "Sky chaser",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock16",
    email: "ember@example.com",
    name: "Ember Stone",
    age: 31,
    bio: "Sustainability consultant working remotely while living off-grid. Solar expert and minimalist. Love deep conversations by campfires.",
    location: "Bend, OR",
    photos: ["https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400"],
    interests: ["Sustainability", "Solar", "Hiking", "Meditation"],
    vanType: "Skoolie",
    travelStyle: "Off-grid living",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock17",
    email: "aspen@example.com",
    name: "Aspen Reed",
    age: 23,
    bio: "Recent grad taking a gap year before starting my career. Documenting everything on my blog. Looking for travel buddies to share adventures!",
    location: "Grand Canyon, AZ",
    photos: ["https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400"],
    interests: ["Blogging", "Photography", "Hiking", "Cooking"],
    vanType: "Econoline",
    travelStyle: "Gap year explorer",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock18",
    email: "cedar@example.com",
    name: "Cedar Walsh",
    age: 34,
    bio: "Mountain guide and wilderness first responder. Teaching survival skills and leading backcountry trips. Safety first, adventure always!",
    location: "Jackson Hole, WY",
    photos: ["https://images.unsplash.com/photo-1463453091185-61582044d556?w=400"],
    interests: ["Mountaineering", "First Aid", "Skiing", "Teaching"],
    vanType: "Truck Camper",
    travelStyle: "Mountain guide",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock19",
    email: "juniper@example.com",
    name: "Juniper Hayes",
    age: 26,
    bio: "Herbalist and forager traveling to learn about wild plants. Making natural remedies and tinctures. Love sharing plant knowledge!",
    location: "Asheville, NC",
    photos: ["https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400"],
    interests: ["Herbalism", "Foraging", "Cooking", "Hiking"],
    vanType: "Westfalia",
    travelStyle: "Plant explorer",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock20",
    email: "storm@example.com",
    name: "Storm Riley",
    age: 30,
    bio: "Storm chaser and weather enthusiast. Following severe weather across the plains. My van is my mobile weather station. Thrill seeker!",
    location: "Oklahoma City, OK",
    photos: ["https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400"],
    interests: ["Weather", "Photography", "Driving", "Science"],
    vanType: "Sprinter",
    travelStyle: "Storm chaser",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock21",
    email: "haven@example.com",
    name: "Haven Brooks",
    age: 28,
    bio: "Podcaster interviewing nomads across the country. Sharing stories of life on the road. Always looking for interesting people to feature!",
    location: "San Diego, CA",
    photos: ["https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400"],
    interests: ["Podcasting", "Storytelling", "Surfing", "Community"],
    vanType: "ProMaster",
    travelStyle: "Story collector",
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock22",
    email: "blaze@example.com",
    name: "Blaze Cooper",
    age: 33,
    bio: "CrossFit coach who took the gym on the road. Running outdoor fitness classes at campsites. Looking for workout partners and adventure seekers!",
    location: "Boulder, CO",
    photos: ["https://images.unsplash.com/photo-1507081323647-4d250478b919?w=400"],
    interests: ["Fitness", "Climbing", "Hiking", "Nutrition"],
    vanType: "Transit",
    travelStyle: "Mobile trainer",
    createdAt: new Date().toISOString(),
  },
];

const MOCK_ACTIVITIES: Activity[] = [];

const MOCK_FORUM_POSTS: ForumPost[] = [
  {
    id: "post1",
    title: "Best solar setup for full-time living?",
    content: "Looking to upgrade my solar system. Currently have 200W but struggling with running a small fridge and laptop. What's working for you all?",
    authorId: "mock2",
    author: MOCK_USERS[1],
    category: "electrical",
    upvotes: 42,
    commentCount: 15,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "post2",
    title: "DIY shower build - complete guide",
    content: "Just finished my indoor shower build! Sharing my complete process including materials list, drainage solution, and water heater setup...",
    authorId: "mock1",
    author: MOCK_USERS[0],
    category: "plumbing",
    upvotes: 87,
    commentCount: 23,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "post3",
    title: "Wool vs Foam insulation - my experience",
    content: "After trying both in different builds, here's my honest comparison of sheep's wool vs closed cell foam for van insulation...",
    authorId: "mock3",
    author: MOCK_USERS[2],
    category: "insulation",
    upvotes: 56,
    commentCount: 18,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "post4",
    title: "Best apps for finding free camping",
    content: "Sharing my favorite apps and websites for finding dispersed camping and boondocking spots. iOverlander, FreeRoam, and some lesser-known gems...",
    authorId: "mock6",
    author: MOCK_USERS[5],
    category: "tips",
    upvotes: 124,
    commentCount: 31,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "post5",
    title: "ProMaster vs Sprinter - real world comparison",
    content: "I've owned both for extended periods. Here's my honest take on the pros and cons of each for full-time vanlife...",
    authorId: "mock13",
    author: MOCK_USERS[12],
    category: "builds",
    upvotes: 98,
    commentCount: 45,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [profiles, setProfiles] = useState<SwipeCard[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const fetchActivitiesFromAPI = async (): Promise<Activity[] | null> => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/activities", baseUrl).toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (!data) return null;
      
      // Transform API data to Activity format
      const activities: Activity[] = data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description || "",
        category: row.category || row.type,
        date: row.date,
        location: row.location,
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        hostId: row.host_id || row.hostId,
        host: row.host_data || row.host,
        attendeeIds: row.attendee_ids || row.attendeeIds || [],
        attendees: row.attendees_data || row.attendees || [],
        maxAttendees: row.max_attendees || row.maxAttendees,
        imageUrl: row.image_url || row.imageUrl,
        createdAt: row.created_at || row.createdAt,
      }));
      
      return activities;
    } catch (error) {
      console.error("Failed to fetch activities from API:", error);
      return null;
    }
  };

  const mapApiMessageToClient = (row: any): Message => ({
    id: row.id,
    matchId: row.match_id || row.matchId,
    senderId: row.sender_id || row.senderId,
    content: row.content || "",
    type: row.type || "text",
    photoUrl: row.photo_url || row.photoUrl || undefined,
    fileUrl: row.file_url || row.fileUrl || undefined,
    fileName: row.file_name || row.fileName || undefined,
    audioUrl: row.audio_url || row.audioUrl || undefined,
    audioDuration: row.audio_duration || row.audioDuration || undefined,
    replyTo: row.reply_to || row.replyTo || undefined,
    reactions: row.reactions || undefined,
    location: row.location || undefined,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    status: row.status || "sent",
    editedAt: row.edited_at || row.editedAt || undefined,
  });

  const mergeMessagesById = (localMessages: Message[], serverMessages: Message[]): Message[] => {
    const byId = new Map<string, Message>();

    for (const message of localMessages) {
      byId.set(message.id, message);
    }

    for (const message of serverMessages) {
      byId.set(message.id, message);
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  const getLatestMessage = (matchMessages: Message[] | undefined): Message | undefined => {
    if (!matchMessages || matchMessages.length === 0) return undefined;
    return [...matchMessages].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  };

  const hydrateMatchesWithLastMessage = (
    inputMatches: Match[],
    sourceMessages: Record<string, Message[]>
  ): Match[] => {
    return inputMatches.map((match) => {
      const latest = getLatestMessage(sourceMessages[match.id]);
      return latest ? { ...match, lastMessage: latest } : match;
    });
  };
  const authHeaders = () => {
    const headers: Record<string, string> = {};
    if (session?.sessionToken) {
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }
    return headers;
  };

  const jsonAuthHeaders = () => ({
    "Content-Type": "application/json",
    ...authHeaders(),
  });

  const fetchJsonWithTimeout = async <T,>(url: URL, fallback: T, timeoutMs = 6000, headers: Record<string, string> = {}): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal, headers });
      if (!response.ok) return fallback;
      return (await response.json()) as T;
    } catch {
      return fallback;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const loadData = async () => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);

    try {
      if (!user) {
        const serverActivities = await fetchActivitiesFromAPI();
        const loadedActivities: Activity[] = serverActivities || [];
        const now = new Date();
        const activeActivities = loadedActivities.filter((a: Activity) => new Date(a.date) > now);

        if (requestId !== loadRequestRef.current) return;

        setProfiles([]);
        setMatches([]);
        setMessages({});
        setActivities(activeActivities);
        setForumPosts(MOCK_FORUM_POSTS);
        setLikedIds(new Set());
        setIsLoading(false);
        return;
      }

      const userId = user.id;
      const baseUrl = getApiUrl();

      const [messagesStr, forumStr, localMatchesStr] = await Promise.all([
        AsyncStorage.getItem(`${MESSAGES_KEY}_${userId}`),
        AsyncStorage.getItem(FORUM_KEY),
        AsyncStorage.getItem(`${MATCHES_KEY}_${userId}`),
      ]);

      const loadedMessages: Record<string, Message[]> = messagesStr ? JSON.parse(messagesStr) : {};
      const loadedForum: ForumPost[] = forumStr ? JSON.parse(forumStr) : MOCK_FORUM_POSTS;
      const localMatches: Match[] = localMatchesStr ? JSON.parse(localMatchesStr) : [];

      if (requestId !== loadRequestRef.current) return;

      // Show cached data immediately to avoid cold-start spinner on mobile.
      const hydratedLocalMatches = hydrateMatchesWithLastMessage(localMatches, loadedMessages);
      setMessages(loadedMessages);
      setMatches(hydratedLocalMatches);
      setForumPosts(loadedForum);
      setIsLoading(false);

      const [discoverRes, matchesRes, likedRes, loadedActivities] = await Promise.all([
        fetchJsonWithTimeout<SwipeCard[]>(new URL(`/api/discover/profiles/${userId}`, baseUrl), [], 7000),
        fetchJsonWithTimeout<Match[]>(new URL(`/api/matches/${userId}`, baseUrl), [], 7000, authHeaders()),
        fetchJsonWithTimeout<User[]>(new URL(`/api/swipes/liked/${userId}`, baseUrl), [], 7000, authHeaders()),
        fetchActivitiesFromAPI(),
      ]);

      if (requestId !== loadRequestRef.current) return;

      const serverMatchIds = new Set(matchesRes.map((m) => m.id));
      const mergedMatches = [
        ...matchesRes.map((serverMatch) => {
          const local = hydratedLocalMatches.find((localMatch) => localMatch.id === serverMatch.id);
          return local
            ? {
                ...serverMatch,
                lastMessage: local.lastMessage,
                isFavourite: local.isFavourite,
                unreadCount: local.unreadCount,
              }
            : serverMatch;
        }),
        ...localMatches.filter((localMatch) => !serverMatchIds.has(localMatch.id)),
      ];

      const discoverCards = (discoverRes && discoverRes.length > 0)
        ? discoverRes
        : [];
      const sortedDiscoverCards = [...discoverCards].sort((a, b) => {
        const aMock = String(a?.user?.id || "").startsWith("mock");
        const bMock = String(b?.user?.id || "").startsWith("mock");
        if (aMock === bMock) return 0;
        return aMock ? 1 : -1;
      });
      setProfiles(sortedDiscoverCards);
      setActivities(loadedActivities || []);
      setLikedIds(new Set(likedRes.map((u) => u.id)));

      const messageEntries = await Promise.all(
        mergedMatches.map(async (match) => {
          const messagesUrl = new URL(`/api/messages/${match.id}`, baseUrl);
          messagesUrl.searchParams.set("userId", userId);
          const serverRows = await fetchJsonWithTimeout<any[]>(
            messagesUrl,
            [],
            4000,
            authHeaders()
          );
          const serverMessages: Message[] = (serverRows || []).map(mapApiMessageToClient);
          const localForMatch = loadedMessages[match.id] || [];
          return [match.id, mergeMessagesById(localForMatch, serverMessages)] as const;
        })
      );

      if (requestId !== loadRequestRef.current) return;

      const syncedMessages: Record<string, Message[]> = { ...loadedMessages };
      for (const [matchId, msgs] of messageEntries) {
        syncedMessages[matchId] = msgs;
      }

      const finalMatches = hydrateMatchesWithLastMessage(mergedMatches, syncedMessages);
      setMatches(finalMatches);
      setMessages(syncedMessages);

      AsyncStorage.setItem(`${MATCHES_KEY}_${userId}`, JSON.stringify(finalMatches)).catch(() => {});
      AsyncStorage.setItem(`${MESSAGES_KEY}_${userId}`, JSON.stringify(syncedMessages)).catch(() => {});
    } catch (error) {
      console.error("Failed to load data:", error);
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const swipeRight = async (userId: string): Promise<Match | null> => {
    if (!user) return null;

    setProfiles((prev) => prev.filter((p) => p.user.id !== userId));
    setLikedIds(prev => new Set(prev).add(userId));


    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/swipes", baseUrl).toString(), {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ swiperId: user.id, swipedId: userId, direction: "right" }),
      });

      if (!response.ok) throw new Error("Failed to record swipe");
      const data = await response.json();

      if (data.match) {
        const newMatch: Match = data.match;
        const updatedMatches = [...matches, newMatch];
        setMatches(updatedMatches);
        await AsyncStorage.setItem(
          `${MATCHES_KEY}_${user.id}`,
          JSON.stringify(updatedMatches)
        );
        return newMatch;
      }
    } catch (error) {
      console.error("Swipe right error:", error);
    }

    return null;
  };

  const swipeLeft = async (userId: string) => {
    if (!user) return;

    setProfiles((prev) => prev.filter((p) => p.user.id !== userId));

    try {
      const baseUrl = getApiUrl();
      await fetch(new URL("/api/swipes", baseUrl).toString(), {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ swiperId: user.id, swipedId: userId, direction: "left" }),
      });
    } catch (error) {
      console.error("Swipe left error:", error);
    }
  };

  const sendMessage = async (
    matchId: string,
    content: string,
    type?: ChatMessageType,
    photoUrl?: string,
    location?: { latitude: number; longitude: number; name?: string; address?: string },
    fileUrl?: string,
    fileName?: string,
    replyTo?: { id: string; content: string; senderName?: string },
    audioDuration?: number
  ): Promise<Message> => {
    if (!user) throw new Error("Not authenticated");

    const optimisticMessage: Message = {
      id: `msg_${Date.now()}`,
      matchId,
      senderId: user.id,
      content,
      type: type || "text",
      photoUrl,
      location,
      fileUrl,
      fileName,
      audioUrl: type === "audio" ? fileUrl : undefined,
      audioDuration: type === "audio" ? audioDuration : undefined,
      replyTo,
      createdAt: new Date().toISOString(),
      status: "sent",
    };

    let messageToStore = optimisticMessage;

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL(`/api/messages/${matchId}`, baseUrl).toString(), {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          senderId: user.id,
          content,
          type: type || "text",
          photoUrl,
          fileUrl,
          fileName,
          audioUrl: type === "audio" ? fileUrl : undefined,
          audioDuration: type === "audio" ? audioDuration : undefined,
          replyTo,
          location,
        }),
      });

      if (response.ok) {
        const created = await response.json();
        messageToStore = mapApiMessageToClient(created);
      }
    } catch (error) {
      console.error("Send message API error:", error);
    }

    setTimeout(() => {
      updateMessageStatus(matchId, messageToStore.id, "delivered");
    }, 1000);

    setTimeout(() => {
      updateMessageStatus(matchId, messageToStore.id, "read");
    }, 3000);

    const matchMessages = messages[matchId] || [];
    const updatedMessages = {
      ...messages,
      [matchId]: mergeMessagesById(matchMessages, [messageToStore]),
    };

    setMessages(updatedMessages);
    await AsyncStorage.setItem(
      `${MESSAGES_KEY}_${user.id}`,
      JSON.stringify(updatedMessages)
    );

    const updatedMatches = matches.map((m) =>
      m.id === matchId ? { ...m, lastMessage: messageToStore } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem(
      `${MATCHES_KEY}_${user.id}`,
      JSON.stringify(updatedMatches)
    );

    return messageToStore;
  };

  const createActivity = async (
    activityData: Omit<Activity, "id" | "createdAt" | "host" | "attendees" | "hostId">
  ): Promise<Activity> => {
    if (!user) throw new Error("Not authenticated");
    
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        new URL("/api/activities", baseUrl).toString(),
        {
          method: "POST",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({
            activity: {
              title: activityData.title,
              description: activityData.description || "",
              type: activityData.category,
              date: new Date(activityData.date).toISOString(),
              location: activityData.location,
              latitude: activityData.latitude,
              longitude: activityData.longitude,
              maxAttendees: activityData.maxAttendees,
              imageUrl: activityData.imageUrl,
            },
            user: {
              id: user.id,
              name: user.name,
              photoUrl: user.photoUrl,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to create activity");
      
      const createdActivity = await response.json();

      const newActivity: Activity = {
        ...activityData,
        id: createdActivity.id,
        hostId: user.id,
        host: user,
        attendeeIds: [],
        attendees: [],
        createdAt: createdActivity.createdAt || new Date().toISOString(),
      };

      const updatedActivities = [newActivity, ...activities];
      setActivities(updatedActivities);

      return newActivity;
    } catch (error) {
      console.error("Failed to create activity:", error);
      throw error;
    }
  };

  const joinActivity = async (activityId: string) => {
    if (!user) throw new Error("Not authenticated");

    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity) throw new Error("Activity not found");
      
      if (activity.attendeeIds.includes(user.id)) {
        return; // Already joined
      }

      const baseUrl = getApiUrl();
      const response = await fetch(
        new URL(`/api/activities/${activityId}/join`, baseUrl).toString(),
        {
          method: "POST",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({
            user: {
              id: user.id,
              name: user.name,
              photoUrl: user.photoUrl,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to join activity");

      const newAttendeeIds = [...activity.attendeeIds, user.id];
      const newAttendees = [...activity.attendees, user];

      const updatedActivities = activities.map((a) => {
        if (a.id === activityId) {
          return {
            ...a,
            attendeeIds: newAttendeeIds,
            attendees: newAttendees,
          };
        }
        return a;
      });

      setActivities(updatedActivities);
    } catch (error) {
      console.error("Failed to join activity:", error);
      throw error;
    }
  };

  const deleteActivity = async (activityId: string) => {
    if (!user) throw new Error("Not authenticated");

    const activity = activities.find(a => a.id === activityId);
    if (!activity) throw new Error("Activity not found");
    if (activity.hostId !== user.id) throw new Error("Only the host can delete the activity");

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(
        new URL(`/api/activities/${activityId}`, baseUrl).toString(),
        {
          method: "DELETE",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ userId: user.id }),
        }
      );
      
      if (!response.ok) throw new Error("Failed to delete activity");
      
      const updatedActivities = activities.filter(a => a.id !== activityId);
      setActivities(updatedActivities);
    } catch (error) {
      console.error("Failed to delete activity:", error);
      throw error;
    }
  };

  const createForumPost = async (
    postData: Omit<ForumPost, "id" | "createdAt" | "author" | "authorId" | "upvotes" | "commentCount">
  ): Promise<ForumPost> => {
    if (!user) throw new Error("Not authenticated");

    const newPost: ForumPost = {
      ...postData,
      id: `post_${Date.now()}`,
      authorId: user.id,
      author: user,
      upvotes: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    const updatedPosts = [newPost, ...forumPosts];
    setForumPosts(updatedPosts);
    await AsyncStorage.setItem(FORUM_KEY, JSON.stringify(updatedPosts));

    return newPost;
  };

  const upvotePost = async (postId: string) => {
    const updatedPosts = forumPosts.map((p) =>
      p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p
    );
    setForumPosts(updatedPosts);
    await AsyncStorage.setItem(FORUM_KEY, JSON.stringify(updatedPosts));
  };

  const updateMessageStatus = async (matchId: string, messageId: string, status: "sent" | "delivered" | "read") => {
    if (!user) return;
    
    setMessages(prev => {
      const matchMessages = prev[matchId] || [];
      const updatedMatchMessages = matchMessages.map(m => 
        m.id === messageId ? { ...m, status } : m
      );
      const updatedMessages = { ...prev, [matchId]: updatedMatchMessages };
      AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });
  };

  const editMessage = async (matchId: string, messageId: string, newContent: string): Promise<void> => {
    if (!user) return;

    let editedAt = new Date().toISOString();
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL(`/api/messages/${messageId}`, baseUrl).toString(), {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ content: newContent, userId: user.id }),
      });
      if (response.ok) {
        const updated = await response.json();
        editedAt = updated.edited_at || updated.editedAt || editedAt;
      }
    } catch (error) {
      console.error("Edit message API error:", error);
    }

    const matchMessages = messages[matchId] || [];
    const updatedMatchMessages = matchMessages.map((m) =>
      m.id === messageId ? { ...m, content: newContent, editedAt } : m
    );
    const updatedMessages = { ...messages, [matchId]: updatedMatchMessages };

    setMessages(updatedMessages);
    await AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(updatedMessages));

    const editedMessage = updatedMatchMessages.find((m) => m.id === messageId);
    if (editedMessage) {
      const lastMessage = updatedMatchMessages[updatedMatchMessages.length - 1];
      if (lastMessage?.id === messageId) {
        const updatedMatches = matches.map((m) =>
          m.id === matchId ? { ...m, lastMessage: editedMessage } : m
        );
        setMatches(updatedMatches);
        await AsyncStorage.setItem(`${MATCHES_KEY}_${user.id}`, JSON.stringify(updatedMatches));
      }
    }
  };

  const deleteMessage = async (matchId: string, messageId: string): Promise<void> => {
    if (!user) return;

    try {
      const baseUrl = getApiUrl();
      const deleteUrl = new URL(`/api/messages/${messageId}`, baseUrl);
      deleteUrl.searchParams.set("userId", user.id);
      await fetch(deleteUrl.toString(), {
        method: "DELETE",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Delete message API error:", error);
    }

    const matchMessages = messages[matchId] || [];
    const updatedMatchMessages = matchMessages.filter((m) => m.id !== messageId);
    const updatedMessages = { ...messages, [matchId]: updatedMatchMessages };

    setMessages(updatedMessages);
    await AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(updatedMessages));

    const lastMessage = updatedMatchMessages[updatedMatchMessages.length - 1];
    const updatedMatches = matches.map((m) =>
      m.id === matchId ? { ...m, lastMessage: lastMessage || undefined } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem(`${MATCHES_KEY}_${user.id}`, JSON.stringify(updatedMatches));
  };

  const toggleMessageReaction = async (matchId: string, messageId: string, emoji: string): Promise<void> => {
    if (!user) return;

    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL(`/api/messages/${messageId}/reactions`, baseUrl).toString(), {
        method: "PATCH",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ userId: user.id, emoji }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMessages((prev) => {
          const matchMessages = prev[matchId] || [];
          const updatedMatchMessages = matchMessages.map((m) =>
            m.id === messageId ? { ...m, reactions: updated.reactions || {} } : m
          );
          const updatedMessages = { ...prev, [matchId]: updatedMatchMessages };
          AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(updatedMessages));
          return updatedMessages;
        });
        return;
      }
    } catch (error) {
      console.error("Toggle reaction API error:", error);
    }

    setMessages((prev) => {
      const matchMessages = prev[matchId] || [];
      const updatedMatchMessages = matchMessages.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = new Set(reactions[emoji] || []);
        if (users.has(user.id)) {
          users.delete(user.id);
        } else {
          users.add(user.id);
        }
        if (users.size === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = Array.from(users);
        }
        return { ...m, reactions };
      });
      const updatedMessages = { ...prev, [matchId]: updatedMatchMessages };
      AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(updatedMessages));
      return updatedMessages;
    });
  };

  const toggleFavourite = async (matchId: string): Promise<void> => {
    if (!user) return;
    
    const updatedMatches = matches.map(m => 
      m.id === matchId ? { ...m, isFavourite: !m.isFavourite } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem(`${MATCHES_KEY}_${user.id}`, JSON.stringify(updatedMatches));
  };

  const markMatchAsRead = async (matchId: string): Promise<void> => {
    if (!user) return;
    
    const updatedMatches = matches.map(m => 
      m.id === matchId ? { ...m, unreadCount: 0 } : m
    );
    setMatches(updatedMatches);
    await AsyncStorage.setItem(`${MATCHES_KEY}_${user.id}`, JSON.stringify(updatedMatches));
  };

  const deleteMatch = async (matchId: string): Promise<void> => {
    if (!user) return;
    
    const updatedMatches = matches.filter(m => m.id !== matchId);
    setMatches(updatedMatches);
    await AsyncStorage.setItem(`${MATCHES_KEY}_${user.id}`, JSON.stringify(updatedMatches));
    
    const { [matchId]: _, ...remainingMessages } = messages;
    setMessages(remainingMessages);
    await AsyncStorage.setItem(`${MESSAGES_KEY}_${user.id}`, JSON.stringify(remainingMessages));
  };

  const refreshData = async () => {
    if (user) {
      await loadData();
    }
  };

  const [likedProfilesList, setLikedProfilesList] = useState<User[]>([]);

  useEffect(() => {
    if (!user) {
      setLikedProfilesList([]);
      return;
    }
    const fetchLiked = async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(new URL(`/api/swipes/liked/${user.id}`, baseUrl).toString(), { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setLikedProfilesList(data || []);
        }
      } catch {}
    };
    fetchLiked();
  }, [user?.id, likedIds.size]);

  const likedProfiles = likedProfilesList;

  return (
    <DataContext.Provider
      value={{
        profiles,
        matches,
        messages,
        activities,
        forumPosts,
        likedProfiles,
        isLoading,
        swipeRight,
        swipeLeft,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleMessageReaction,
        toggleFavourite,
        markMatchAsRead,
        deleteMatch,
        createActivity,
        joinActivity,
        deleteActivity,
        createForumPost,
        upvotePost,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

