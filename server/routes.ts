import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

// Direct PostgreSQL connection for bypassing Supabase schema cache issues
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});


async function callGroqChat(messages: { role: string; content: string }[]) {
  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.6,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${text}`);
  }
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || "";
}

// Supabase client for server-side operations
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;

// In-memory OTP storage
interface OTPEntry {
  email: string;
  code: string;
  expiresAt: Date;
  used: boolean;
}
const otpStore: Map<string, OTPEntry> = new Map();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanupExpiredOTPs() {
  const now = new Date();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}

// Groq API
const groqApiKey = process.env.GROQ_API_KEY || "";

// In-memory storage for activity chat (would use database in production)
interface ActivityChatMessage {
  id: string;
  activityId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  type: "text" | "photo" | "location" | "file" | "audio" | "system";
  content: string;
  photoUrl?: string;
  fileUrl?: string;
  fileName?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: { id: string; content: string; senderName?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  isPinned: boolean;
  pinnedBy?: string;
  isModeratorMessage: boolean;
  isEdited?: boolean;
  reactions?: Record<string, string[]>;
  createdAt: string;
  deletedAt?: string;
}

interface ActivityModerator {
  activityId: string;
  userId: string;
  isHost: boolean;
  addedAt: string;
}

interface ActivityUser {
  id: string;
  name: string;
  email?: string;
  age?: number;
  bio?: string;
  location?: string;
  photos?: string[];
  interests?: string[];
  createdAt?: string;
}

interface Activity {
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
  host: ActivityUser;
  attendeeIds: string[];
  attendees: ActivityUser[];
  maxAttendees?: number;
  imageUrl?: string;
  isCompleted?: boolean;
  createdAt: string;
}

interface SafetyRating {
  id: string;
  activityId: string;
  ratedByUserId: string;
  safetyScore: number;
  wasLocationPublic: boolean;
  hostWasTrustworthy: boolean;
  createdAt: string;
}

interface SOSIncident {
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

const activityMessages: Map<string, ActivityChatMessage[]> = new Map();
const activityModerators: Map<string, ActivityModerator[]> = new Map();
const activitiesStore: Activity[] = [];
const safetyRatings: SafetyRating[] = [];
const sosIncidents: SOSIncident[] = [];

const VAN_BUILD_SYSTEM_PROMPT = `You are an expert van conversion advisor for the Nomad Connect app. You help van lifers and nomads with:
- Van conversion planning and design
- Electrical systems (solar, batteries, inverters)
- Plumbing and water systems
- Insulation and climate control
- Layout optimization
- Material recommendations
- Cost estimation
- Safety considerations
- DIY tips and professional recommendations

Be friendly, practical, and specific. When discussing costs, provide realistic price ranges. When recommending products, mention popular brands that nomads trust. Always prioritize safety and code compliance.

Keep responses concise but helpful. Use bullet points for lists. If someone asks about something dangerous, warn them appropriately.`;

const PHOTO_ANALYSIS_PROMPT = `You are analyzing a van build photo for the Nomad Connect app. Analyze the image and provide:
1. What you see in the build (materials, layout, systems visible)
2. What's done well
3. Potential issues or safety concerns
4. Suggestions for improvement
5. Estimated completion percentage if applicable

Be specific and constructive. Focus on practical advice.`;

const COST_ESTIMATOR_PROMPT = `You are a van conversion cost estimator for Nomad Connect. Based on the user's input about their van and desired features, provide:
1. Estimated total cost range (low/mid/high scenarios)
2. Breakdown by category (electrical, plumbing, insulation, furniture, etc.)
3. Key materials list with approximate prices
4. Money-saving tips
5. Where to splurge vs save

Be realistic with current market prices. Consider DIY vs professional installation costs.`;

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "nomad-connect-api" });
  });

    app.get("/api/ai/ping", async (_req: Request, res: Response) => {
    try {
      const reply = await callGroqChat([{ role: "user", content: "ping" }]);
      res.json({ ok: true, response: reply });
    } catch (error) {
      console.error("AI ping error:", error);
      res.status(500).json({ ok: false, error: "Failed to ping AI", detail: (error as Error)?.message });
    }
  });

  // AI Van Build Chat endpoint
  app.get("/api/ai/chat", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Use POST /api/ai/chat with { messages: [...] }" });
  });
  app.post("/api/ai/chat", async (req: Request, res: Response) => {
    try {
      const { messages, systemPrompt } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array required" });
      }

      const systemText = systemPrompt || VAN_BUILD_SYSTEM_PROMPT;
      const groqMessages = [
        { role: "system", content: systemText },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const reply = await callGroqChat(groqMessages);
      res.json({ response: reply });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to get AI response", detail: (error as Error)?.message });
    }
  });

  // AI Photo Analysis endpoint (disabled for Groq-only backend)
  app.post("/api/ai/analyze-photo", (_req: Request, res: Response) => {
    res.status(501).json({ error: "Photo analysis is not available in this build." });
  });

  // AI Cost Estimator endpoint using Groq
  app.post("/api/ai/estimate-cost", async (req: Request, res: Response) => {
    try {
      const { vanDetails } = req.body;

      if (!vanDetails) {
        return res.status(400).json({ error: "Van details are required" });
      }

      const systemPrompt = `You are an expert van conversion cost estimator with deep knowledge of DIY and professional van builds. Provide detailed, realistic cost estimates for van conversions.

When given van build specifications, provide:
1. A total estimated cost range (low to high)
2. Breakdown by category (electrical, plumbing, insulation, furniture, etc.)
3. Labor cost estimate if hiring professionals vs DIY savings
4. Tips for cost savings
5. Common hidden costs to watch out for

Base your estimates on current 2024-2025 market prices in the US. Be specific with dollar amounts and explain your reasoning. Format your response in a clear, readable way with sections and bullet points.`;

      const groqMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please provide a detailed cost estimate for the following van build:\n\n${vanDetails}` },
      ];

      const reply = await callGroqChat(groqMessages);
      res.json({ estimate: reply });
    } catch (error) {
      console.error("AI cost estimate error:", error);
      res.status(500).json({ error: "Failed to get cost estimate", detail: (error as Error)?.message });
    }
  });

  // AI Van Image Generation endpoint (disabled for Groq-only backend)
  app.post("/api/ai/generate-van-image", (_req: Request, res: Response) => {
    res.status(501).json({ error: "Image generation is not available in this build." });
  });

  // ==================== AI CHAT SESSIONS (Direct PostgreSQL) ====================

  // Get all chat sessions for a user
  app.get("/api/ai/sessions/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    try {
      const result = await pool.query(
        `SELECT id, user_id, title, messages, created_at, updated_at 
         FROM ai_chat_sessions 
         WHERE user_id = $1 
         ORDER BY updated_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Failed to get chat sessions:", error);
      res.status(500).json({ error: "Failed to get chat sessions" });
    }
  });

  // Create a new chat session
  app.post("/api/ai/sessions", async (req: Request, res: Response) => {
    const { id, userId, title, messages } = req.body;
    
    if (!id || !userId) {
      return res.status(400).json({ error: "Session ID and user ID are required" });
    }
    
    try {
      const result = await pool.query(
        `INSERT INTO ai_chat_sessions (id, user_id, title, messages, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, user_id, title, messages, created_at, updated_at`,
        [id, userId, title || "New Chat", JSON.stringify(messages || [])]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to create chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  // Update a chat session
  app.put("/api/ai/sessions/:sessionId", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { title, messages } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    try {
      const result = await pool.query(
        `UPDATE ai_chat_sessions 
         SET title = $1, messages = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, user_id, title, messages, created_at, updated_at`,
        [title, JSON.stringify(messages), sessionId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to update chat session:", error);
      res.status(500).json({ error: "Failed to update chat session" });
    }
  });

  // Delete a chat session
  app.delete("/api/ai/sessions/:sessionId", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    
    try {
      const result = await pool.query(
        `DELETE FROM ai_chat_sessions WHERE id = $1 RETURNING id`,
        [sessionId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  // ==================== ACTIVITY CHAT ROUTES ====================

  // ==================== ACTIVITIES (PostgreSQL) ====================

  app.get("/api/activities", async (_req: Request, res: Response) => {
    try {
      const now = new Date().toISOString();
      const result = await pool.query(
        `SELECT * FROM activities WHERE date >= $1 ORDER BY date ASC`,
        [now]
      );
      // Map database columns to Activity type
      const activities = result.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.category || "other",
        location: row.location,
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        date: row.date,
        hostId: row.host_id,
        host: row.host_data || { id: row.host_id, name: "Unknown" },
        attendeeIds: row.attendee_ids || [],
        attendees: row.attendees_data || [],
        maxAttendees: row.max_attendees ? parseInt(row.max_attendees) : undefined,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      }));
      res.json(activities);
    } catch (error) {
      console.error("Failed to get activities:", error);
      // Fallback to in-memory store
      res.json(activitiesStore);
    }
  });

  app.post("/api/activities", async (req: Request, res: Response) => {
    const { activity, user } = req.body as { activity?: Partial<Activity>; user?: ActivityUser };

    if (!activity || !user?.id || !user?.name) {
      return res.status(400).json({ error: "Activity and user are required" });
    }

    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    try {
      await pool.query(
        `INSERT INTO activities (id, title, description, category, date, location, latitude, longitude, host_id, host_data, attendee_ids, attendees_data, max_attendees, image_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          activityId,
          activity.title || "New Activity",
          activity.description || "",
          activity.type || "other",
          activity.date || now,
          activity.location || "TBD",
          activity.latitude?.toString() || null,
          activity.longitude?.toString() || null,
          user.id,
          JSON.stringify(user),
          JSON.stringify([]),
          JSON.stringify([]),
          activity.maxAttendees?.toString() || null,
          activity.imageUrl || null,
          now,
        ]
      );

      const newActivity: Activity = {
        id: activityId,
        title: activity.title || "New Activity",
        description: activity.description || "",
        type: (activity.type as Activity["type"]) || "other",
        location: activity.location || "TBD",
        latitude: activity.latitude,
        longitude: activity.longitude,
        date: activity.date || now,
        startTime: activity.startTime,
        duration: activity.duration,
        hostId: user.id,
        host: user,
        attendeeIds: [],
        attendees: [],
        maxAttendees: activity.maxAttendees,
        imageUrl: activity.imageUrl,
        isCompleted: activity.isCompleted,
        createdAt: now,
      };

      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Failed to create activity in database:", error);
      // Fallback to in-memory store
      const newActivity: Activity = {
        id: activityId,
        title: activity.title || "New Activity",
        description: activity.description || "",
        type: (activity.type as Activity["type"]) || "other",
        location: activity.location || "TBD",
        latitude: activity.latitude,
        longitude: activity.longitude,
        date: activity.date || now,
        startTime: activity.startTime,
        duration: activity.duration,
        hostId: user.id,
        host: user,
        attendeeIds: [],
        attendees: [],
        maxAttendees: activity.maxAttendees,
        imageUrl: activity.imageUrl,
        isCompleted: activity.isCompleted,
        createdAt: now,
      };
      activitiesStore.unshift(newActivity);
      res.status(201).json(newActivity);
    }
  });

  app.post("/api/activities/:activityId/join", async (req: Request, res: Response) => {
    const { activityId } = req.params;
    const { user } = req.body as { user?: ActivityUser };

    if (!user?.id) {
      return res.status(400).json({ error: "User is required" });
    }

    try {
      // Get current activity from database
      const result = await pool.query(`SELECT * FROM activities WHERE id = $1`, [activityId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Activity not found" });
      }

      const activity = result.rows[0];
      const attendeeIds = activity.attendee_ids || [];
      const attendeesData = activity.attendees_data || [];

      if (!attendeeIds.includes(user.id)) {
        attendeeIds.push(user.id);
        attendeesData.push(user);

        await pool.query(
          `UPDATE activities SET attendee_ids = $1, attendees_data = $2 WHERE id = $3`,
          [JSON.stringify(attendeeIds), JSON.stringify(attendeesData), activityId]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to join activity:", error);
      // Fallback to in-memory store
      const activity = activitiesStore.find((a) => a.id === activityId);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (!activity.attendeeIds.includes(user.id)) {
        activity.attendeeIds.push(user.id);
        activity.attendees.push(user);
      }
      res.json(activity);
    }
  });

  app.delete("/api/activities/:activityId", async (req: Request, res: Response) => {
    const { activityId } = req.params;
    const { userId } = req.body as { userId?: string };

    try {
      // Check if activity exists and user is host
      const result = await pool.query(`SELECT * FROM activities WHERE id = $1`, [activityId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Activity not found" });
      }

      const activity = result.rows[0];
      if (userId && activity.host_id !== userId) {
        return res.status(403).json({ error: "Only the host can delete the activity" });
      }

      await pool.query(`DELETE FROM activities WHERE id = $1`, [activityId]);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete activity:", error);
      // Fallback to in-memory store
      const idx = activitiesStore.findIndex((a) => a.id === activityId);
      if (idx === -1) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const activity = activitiesStore[idx];
      if (userId && activity.hostId !== userId) {
        return res.status(403).json({ error: "Only the host can delete the activity" });
      }
      activitiesStore.splice(idx, 1);
      res.json({ success: true });
    }
  });

  // Get messages for an activity (PostgreSQL)
  app.get("/api/activities/:activityId/messages", async (req: Request, res: Response) => {
    const { activityId } = req.params;
    try {
      const result = await pool.query(
        `SELECT * FROM activity_chat_messages 
         WHERE activity_id = $1 AND deleted_at IS NULL 
         ORDER BY created_at ASC`,
        [activityId]
      );
      const messages = result.rows.map(row => ({
        id: row.id,
        activityId: row.activity_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderPhoto: row.sender_photo,
        type: row.type || "text",
        content: row.content,
        photoUrl: row.photo_url,
        fileUrl: row.file_url,
        fileName: row.file_name,
        audioUrl: row.audio_url,
        audioDuration: row.audio_duration ? parseFloat(row.audio_duration) : undefined,
        replyTo: row.reply_to,
        location: row.location,
        isPinned: row.is_pinned === "true",
        isModeratorMessage: row.is_moderator_message === "true",
        reactions: row.reactions || {},
        isEdited: !!row.edited_at,
        createdAt: row.created_at?.toISOString(),
        deletedAt: row.deleted_at?.toISOString(),
      }));
      res.json(messages);
    } catch (error) {
      console.error("Failed to get activity messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message to activity chat (PostgreSQL)
  app.post("/api/activities/:activityId/messages", async (req: Request, res: Response) => {
    const { activityId } = req.params;
    const { senderId, senderName, senderPhoto, type, content, photoUrl, fileUrl, fileName, audioUrl, audioDuration, replyTo, location, isModeratorMessage } = req.body;

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await pool.query(
        `INSERT INTO activity_chat_messages 
         (id, activity_id, sender_id, sender_name, sender_photo, type, content, 
          photo_url, file_url, file_name, audio_url, audio_duration, 
          reply_to, location, is_pinned, is_moderator_message, reactions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
        [
          messageId, activityId, senderId, senderName, senderPhoto || '',
          type || "text", content, photoUrl, fileUrl, fileName, audioUrl,
          audioDuration?.toString(), JSON.stringify(replyTo), JSON.stringify(location),
          "false", isModeratorMessage ? "true" : "false", JSON.stringify({})
        ]
      );

      const message: ActivityChatMessage = {
        id: messageId,
        activityId,
        senderId,
        senderName,
        senderPhoto,
        type: type || "text",
        content,
        photoUrl,
        fileUrl,
        fileName,
        audioUrl,
        audioDuration,
        replyTo,
        location,
        isPinned: false,
        isModeratorMessage: isModeratorMessage || false,
        reactions: {},
        createdAt: new Date().toISOString(),
      };

      res.status(201).json(message);
    } catch (error) {
      console.error("Failed to send activity message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Pin/unpin a message (moderator only) - PostgreSQL
  app.patch("/api/activities/:activityId/messages/:messageId/pin", async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { pin } = req.body;

    try {
      const result = await pool.query(
        `UPDATE activity_chat_messages 
         SET is_pinned = $1 
         WHERE id = $2 
         RETURNING *`,
        [pin ? "true" : "false", messageId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        activityId: row.activity_id,
        isPinned: row.is_pinned === "true",
        content: row.content,
      });
    } catch (error) {
      console.error("Failed to pin message:", error);
      res.status(500).json({ error: "Failed to pin message" });
    }
  });

  // Edit a message (owner only) - PostgreSQL
  app.put("/api/activities/:activityId/messages/:messageId", async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;

    try {
      const result = await pool.query(
        `UPDATE activity_chat_messages 
         SET content = $1, edited_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [content, messageId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        activityId: row.activity_id,
        content: row.content,
        isEdited: true,
      });
    } catch (error) {
      console.error("Failed to edit message:", error);
      res.status(500).json({ error: "Failed to edit message" });
    }
  });

  // React to a message - PostgreSQL
  app.post("/api/activities/:activityId/messages/:messageId/react", async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body as { userId?: string; emoji?: string };

    if (!userId || !emoji) {
      return res.status(400).json({ error: "userId and emoji are required" });
    }

    try {
      // Get current reactions
      const getResult = await pool.query(
        `SELECT reactions FROM activity_chat_messages WHERE id = $1`,
        [messageId]
      );

      if (getResult.rows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      const reactions: Record<string, string[]> = getResult.rows[0].reactions || {};
      const current = new Set(reactions[emoji] || []);

      if (current.has(userId)) {
        current.delete(userId);
      } else {
        current.add(userId);
      }

      if (current.size === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = Array.from(current);
      }

      // Update reactions
      await pool.query(
        `UPDATE activity_chat_messages SET reactions = $1 WHERE id = $2`,
        [JSON.stringify(reactions), messageId]
      );

      res.json({ id: messageId, reactions });
    } catch (error) {
      console.error("Failed to react to message:", error);
      res.status(500).json({ error: "Failed to react to message" });
    }
  });

  // Delete a message (moderator or owner) - PostgreSQL
  app.delete("/api/activities/:activityId/messages/:messageId", async (req: Request, res: Response) => {
    const { messageId } = req.params;

    try {
      const result = await pool.query(
        `UPDATE activity_chat_messages 
         SET deleted_at = NOW() 
         WHERE id = $1 
         RETURNING id`,
        [messageId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Get moderators for an activity
  app.get("/api/activities/:activityId/moderators", (req: Request, res: Response) => {
    const { activityId } = req.params;
    const moderators = activityModerators.get(activityId) || [];
    res.json(moderators);
  });

  // Add a moderator (host only)
  app.post("/api/activities/:activityId/moderators", (req: Request, res: Response) => {
    const { activityId } = req.params;
    const { userId, isHost } = req.body;

    const moderator: ActivityModerator = {
      activityId,
      userId,
      isHost: isHost || false,
      addedAt: new Date().toISOString(),
    };

    const moderators = activityModerators.get(activityId) || [];
    if (!moderators.find(m => m.userId === userId)) {
      moderators.push(moderator);
      activityModerators.set(activityId, moderators);
    }

    res.status(201).json(moderator);
  });

  // Remove a moderator (host only)
  app.delete("/api/activities/:activityId/moderators/:userId", (req: Request, res: Response) => {
    const { activityId, userId } = req.params;

    const moderators = activityModerators.get(activityId) || [];
    const filtered = moderators.filter(m => m.userId !== userId || m.isHost);
    activityModerators.set(activityId, filtered);

    res.json({ success: true });
  });

  // Initialize host as moderator when activity chat is accessed
  app.post("/api/activities/:activityId/init-chat", (req: Request, res: Response) => {
    const { activityId } = req.params;
    const { hostId } = req.body;

    const moderators = activityModerators.get(activityId) || [];
    if (!moderators.find(m => m.userId === hostId)) {
      moderators.push({
        activityId,
        userId: hostId,
        isHost: true,
        addedAt: new Date().toISOString(),
      });
      activityModerators.set(activityId, moderators);
    }

    res.json({ success: true });
  });

  // ==================== SAFETY RATING ROUTES ====================

  // Submit a safety rating for an activity
  app.post("/api/safety-ratings", (req: Request, res: Response) => {
    const { activityId, ratedByUserId, safetyScore, wasLocationPublic, hostWasTrustworthy } = req.body;

    if (!activityId || !ratedByUserId || !safetyScore) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingRating = safetyRatings.find(
      r => r.activityId === activityId && r.ratedByUserId === ratedByUserId
    );

    if (existingRating) {
      return res.status(400).json({ error: "You have already rated this activity" });
    }

    const rating: SafetyRating = {
      id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      activityId,
      ratedByUserId,
      safetyScore,
      wasLocationPublic: wasLocationPublic || false,
      hostWasTrustworthy: hostWasTrustworthy || false,
      createdAt: new Date().toISOString(),
    };

    safetyRatings.push(rating);
    res.status(201).json(rating);
  });

  // Get safety ratings for an activity
  app.get("/api/safety-ratings/:activityId", (req: Request, res: Response) => {
    const { activityId } = req.params;
    const ratings = safetyRatings.filter(r => r.activityId === activityId);
    
    const averageSafetyScore = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.safetyScore, 0) / ratings.length
      : 0;
    
    const publicLocationPercentage = ratings.length > 0
      ? (ratings.filter(r => r.wasLocationPublic).length / ratings.length) * 100
      : 0;
    
    const trustworthyHostPercentage = ratings.length > 0
      ? (ratings.filter(r => r.hostWasTrustworthy).length / ratings.length) * 100
      : 0;

    res.json({
      ratings,
      summary: {
        totalRatings: ratings.length,
        averageSafetyScore: Math.round(averageSafetyScore * 10) / 10,
        publicLocationPercentage: Math.round(publicLocationPercentage),
        trustworthyHostPercentage: Math.round(trustworthyHostPercentage),
      },
    });
  });

  // SOS Emergency endpoints
  app.post("/api/sos/log", (req: Request, res: Response) => {
    const { userId, userName, location, emergencyContact, timestamp } = req.body;
    
    const incident: SOSIncident = {
      id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      location,
      emergencyContact,
      timestamp: timestamp || new Date().toISOString(),
      resolved: false,
    };
    
    sosIncidents.push(incident);
    console.log("[SOS] Emergency incident logged:", incident);
    
    res.json({ success: true, incidentId: incident.id });
  });

  app.get("/api/sos/incidents", (req: Request, res: Response) => {
    const { userId } = req.query;
    
    if (userId) {
      const userIncidents = sosIncidents.filter(i => i.userId === userId);
      return res.json(userIncidents);
    }
    
    res.json(sosIncidents);
  });

  app.patch("/api/sos/incidents/:incidentId", (req: Request, res: Response) => {
    const { incidentId } = req.params;
    const { resolved, notes } = req.body;
    
    const incident = sosIncidents.find(i => i.id === incidentId);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    if (resolved !== undefined) incident.resolved = resolved;
    if (notes) incident.notes = notes;
    
    res.json(incident);
  });

  // OTP Password Reset - Send OTP via EmailJS
  app.post("/api/password-reset/send-otp", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Generate a simple 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store code for verification
      otpStore.set(normalizedEmail, {
        email: normalizedEmail,
        code: code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
      });

      let emailSent = false;

      // Use EmailJS as primary email service
      const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
      const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
      const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
      const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;

      console.log("EmailJS config check:", {
        hasServiceId: !!emailjsServiceId,
        hasTemplateId: !!emailjsTemplateId,
        hasPublicKey: !!emailjsPublicKey,
        publicKeyLength: emailjsPublicKey?.length,
        hasPrivateKey: !!emailjsPrivateKey,
      });

      if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
        try {
          const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: emailjsServiceId,
              template_id: emailjsTemplateId,
              user_id: emailjsPublicKey,
              accessToken: emailjsPrivateKey,
              template_params: {
                to_email: normalizedEmail,
                to_name: normalizedEmail.split('@')[0],
                message: `Your verification code is: ${code}`,
                from_name: 'Nomad Connect',
              }
            })
          });

          if (emailResponse.ok) {
            emailSent = true;
            console.log(`OTP ${code} sent to ${normalizedEmail} via EmailJS`);
          } else {
            const errorText = await emailResponse.text();
            console.error("EmailJS error:", errorText);
          }
        } catch (emailjsErr) {
          console.error("EmailJS request failed:", emailjsErr);
        }
      }

      // Fallback to Resend if EmailJS failed
      if (!emailSent) {
        try {
          const { sendOTPEmail } = await import('./lib/resend');
          emailSent = await sendOTPEmail(normalizedEmail, code);
          if (emailSent) {
            console.log(`OTP ${code} sent to ${normalizedEmail} via Resend`);
          }
        } catch (resendErr: any) {
          console.log("Resend not available:", resendErr.message);
        }
      }

      if (!emailSent) {
        return res.status(500).json({ error: "Failed to send email. Please check EmailJS credentials." });
      }

      res.json({ 
        success: true, 
        message: "Code sent to your email"
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  // OTP Password Reset - Verify OTP
  app.post("/api/password-reset/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check stored OTP
      const storedOtp = otpStore.get(normalizedEmail);
      
      if (!storedOtp) {
        return res.status(400).json({ error: "No code found. Please request a new one." });
      }

      if (storedOtp.expiresAt < new Date()) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Code expired. Please request a new one." });
      }

      if (storedOtp.used) {
        return res.status(400).json({ error: "Code already used. Please request a new one." });
      }

      if (storedOtp.code !== code.trim()) {
        return res.status(400).json({ error: "Invalid code. Please check and try again." });
      }

      // Mark as verified (but not used yet - will be used when password is updated)
      otpStore.set(normalizedEmail, {
        ...storedOtp,
        used: false, // Will be set to true after password update
      });

      console.log(`OTP verified for ${normalizedEmail}`);

      res.json({ success: true, message: "Code verified" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Password Reset - Update Password after OTP verification
  app.post("/api/password-reset/update-password", async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const verifiedEntry = otpStore.get(normalizedEmail);

      if (!verifiedEntry || verifiedEntry.used) {
        return res.status(400).json({ error: "Please verify your code first" });
      }

      if (new Date() > verifiedEntry.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Session expired. Please start over." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Service not available" });
      }

      // Look up user by email to get their UUID
      const { data: userData, error: lookupError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (lookupError) {
        console.error("User lookup error:", lookupError);
        return res.status(500).json({ error: "Failed to find user" });
      }

      const user = userData.users.find(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update password using the user's actual UUID
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        return res.status(500).json({ error: "Failed to update password" });
      }

      verifiedEntry.used = true;
      otpStore.delete(normalizedEmail);

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  // Password reset page for Supabase auth - serve static HTML file
  app.get("/auth/reset-password", (req: Request, res: Response) => {
    const filePath = path.join(__dirname, "templates", "reset-password.html");
    res.sendFile(filePath);
  });
  
  // Also serve at root level for easier access
  app.get("/reset-password", (req: Request, res: Response) => {
    const filePath = path.join(__dirname, "templates", "reset-password.html");
    res.sendFile(filePath);
  });


  // ==================== USER PROFILES ====================

  app.post("/api/user-profiles/upsert", async (req: Request, res: Response) => {
    try {
      const { id, name, age, bio, interests, photos, location } = req.body;
      if (!id) return res.status(400).json({ error: "User ID is required" });

      const existing = await pool.query(`SELECT id FROM user_profiles WHERE id = $1`, [id]);
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE user_profiles SET name = COALESCE($2, name), age = COALESCE($3, age), bio = COALESCE($4, bio), interests = COALESCE($5, interests), photos = COALESCE($6, photos), location = COALESCE($7, location), updated_at = NOW() WHERE id = $1`,
          [id, name, age, bio, interests ? JSON.stringify(interests) : null, photos ? JSON.stringify(photos) : null, location]
        );
      } else {
        const now = Date.now();
        await pool.query(
          `INSERT INTO user_profiles (id, name, age, bio, interests, photos, location, compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp, is_visible_on_radar, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, true, NOW(), NOW())`,
          [id, name || '', age || 0, bio || '', JSON.stringify(interests || []), JSON.stringify(photos || []), location || '', now]
        );

        if (!id.startsWith('mock')) {
          const mockIds = await pool.query(`SELECT id FROM user_profiles WHERE id LIKE 'mock%'`);
          for (const mock of mockIds.rows) {
            await pool.query(
              `INSERT INTO swipes (id, swiper_id, swiped_id, direction, created_at)
               VALUES ($1, $2, $3, 'right', NOW())
               ON CONFLICT (swiper_id, swiped_id) DO NOTHING`,
              [`seed_${mock.id}_${id}`, mock.id, id]
            );
          }
        }
      }

      const result = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [id]);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Upsert profile error:", error);
      res.status(500).json({ error: "Failed to upsert profile" });
    }
  });

  app.get("/api/user-profiles/:userId", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [req.params.userId]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Profile not found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // ==================== COMPATIBILITY ANALYZER ====================

  const COMPATIBILITY_LIMITS: Record<string, number> = {
    free: 2,
    pro: 15,
    expert: -1,
  };

  function shouldResetWeekly(lastResetTimestamp: number): boolean {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return now - lastResetTimestamp > oneWeek;
  }

  app.post("/api/compatibility/check", async (req: Request, res: Response) => {
    try {
      const { userAId, userBId, userAProfile, userBProfile, tier } = req.body;
      if (!userAId || !userBId) return res.status(400).json({ error: "Both user IDs are required" });

      // Ensure user A profile exists
      let profileResult = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [userAId]);
      let profile = profileResult.rows[0];

      if (!profile) {
        const now = Date.now();
        await pool.query(
          `INSERT INTO user_profiles (id, name, age, bio, interests, photos, location, compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp, is_visible_on_radar, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, true, NOW(), NOW())`,
          [userAId, userAProfile?.name || '', userAProfile?.age || 0, userAProfile?.bio || '', JSON.stringify(userAProfile?.interests || []), JSON.stringify(userAProfile?.photos || []), userAProfile?.location || '', now]
        );
        profileResult = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [userAId]);
        profile = profileResult.rows[0];
      }

      // Check weekly reset
      if (shouldResetWeekly(Number(profile.last_reset_timestamp) || 0)) {
        await pool.query(
          `UPDATE user_profiles SET compatibility_checks_this_week = 0, radar_scans_this_week = 0, last_reset_timestamp = $2 WHERE id = $1`,
          [userAId, Date.now()]
        );
        profile.compatibility_checks_this_week = 0;
      }

      // Enforce weekly limit
      const currentTier = tier || "free";
      const limit = COMPATIBILITY_LIMITS[currentTier] ?? 2;
      if (limit !== -1 && (profile.compatibility_checks_this_week || 0) >= limit) {
        return res.status(403).json({
          error: "Weekly compatibility check limit reached",
          limit,
          used: profile.compatibility_checks_this_week,
          tier: currentTier,
          requiresUpgrade: true,
        });
      }

      // Check for existing recent compatibility
      const existingResult = await pool.query(
        `SELECT * FROM compatibility_history WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)) AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 1`,
        [userAId, userBId]
      );

      if (existingResult.rows.length > 0) {
        return res.json({ result: existingResult.rows[0], cached: true });
      }

      // Build AI prompt
      const profileA = userAProfile || { name: "User A", interests: [], bio: "" };
      const profileB = userBProfile || { name: "User B", interests: [], bio: "" };

      const compatPrompt = `You are a compatibility analyzer for a travel/nomad dating app. Analyze these two profiles and return ONLY valid JSON (no markdown, no explanation).

Profile A: Name: ${profileA.name}, Age: ${profileA.age || "unknown"}, Bio: "${profileA.bio || "No bio"}", Interests: ${JSON.stringify(profileA.interests || [])}, Location: "${profileA.location || "unknown"}"

Profile B: Name: ${profileB.name}, Age: ${profileB.age || "unknown"}, Bio: "${profileB.bio || "No bio"}", Interests: ${JSON.stringify(profileB.interests || [])}, Location: "${profileB.location || "unknown"}"

Return ONLY this JSON structure:
{"score":75,"strengths":["shared interest 1","shared interest 2"],"conflicts":["potential conflict 1"],"icebreakers":["conversation starter 1","conversation starter 2"],"first_message":"Hey! I noticed we both...","date_idea":"A cool activity idea based on shared interests"}`;

      const aiReply = await callGroqChat([
        { role: "system", content: "You are a compatibility analyzer. Return ONLY valid JSON. No markdown code blocks." },
        { role: "user", content: compatPrompt },
      ]);

      let compatResult;
      try {
        const cleaned = aiReply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        compatResult = JSON.parse(cleaned);
      } catch {
        compatResult = {
          score: 65,
          strengths: ["Both enjoy travel and adventure"],
          conflicts: ["May have different travel paces"],
          icebreakers: ["What's your favorite travel destination?"],
          first_message: "Hey! Looks like we're both on the road!",
          date_idea: "Explore a new hiking trail together",
        };
      }

      // Save to database
      const compatId = `compat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO compatibility_history (id, user_a, user_b, score, strengths, conflicts, icebreakers, first_message, date_idea, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [compatId, userAId, userBId, compatResult.score, JSON.stringify(compatResult.strengths), JSON.stringify(compatResult.conflicts), JSON.stringify(compatResult.icebreakers), compatResult.first_message, compatResult.date_idea]
      );

      // Increment usage counter
      await pool.query(
        `UPDATE user_profiles SET compatibility_checks_this_week = compatibility_checks_this_week + 1 WHERE id = $1`,
        [userAId]
      );

      res.json({
        result: {
          id: compatId,
          user_a: userAId,
          user_b: userBId,
          ...compatResult,
          created_at: new Date().toISOString(),
        },
        cached: false,
      });
    } catch (error) {
      console.error("Compatibility check error:", error);
      res.status(500).json({ error: "Failed to check compatibility" });
    }
  });

  app.get("/api/compatibility/history/:userId", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT * FROM compatibility_history WHERE user_a = $1 OR user_b = $1 ORDER BY created_at DESC LIMIT 20`,
        [req.params.userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Get compatibility history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // ==================== SOCIAL DISCOVERY RADAR ====================

  const RADAR_LIMITS: Record<string, number> = {
    free: 2,
    pro: 15,
    expert: -1,
  };

  app.post("/api/radar/update-location", async (req: Request, res: Response) => {
    try {
      const { userId, lat, lng } = req.body;
      if (!userId || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }

      const existing = await pool.query(`SELECT user_id FROM user_locations WHERE user_id = $1`, [userId]);
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE user_locations SET lat = $2, lng = $3, updated_at = NOW() WHERE user_id = $1`,
          [userId, lat, lng]
        );
      } else {
        await pool.query(
          `INSERT INTO user_locations (user_id, lat, lng, updated_at) VALUES ($1, $2, $3, NOW())`,
          [userId, lat, lng]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.post("/api/radar/scan", async (req: Request, res: Response) => {
    try {
      const { userId, lat, lng, radiusKm, tier } = req.body;
      if (!userId || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }

      // Get/create user profile
      let profileResult = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [userId]);
      let profile = profileResult.rows[0];

      if (!profile) {
        const now = Date.now();
        await pool.query(
          `INSERT INTO user_profiles (id, name, compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp, is_visible_on_radar, created_at, updated_at) VALUES ($1, '', 0, 0, $2, true, NOW(), NOW())`,
          [userId, now]
        );
        profileResult = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [userId]);
        profile = profileResult.rows[0];
      }

      // Check weekly reset
      if (shouldResetWeekly(Number(profile.last_reset_timestamp) || 0)) {
        await pool.query(
          `UPDATE user_profiles SET compatibility_checks_this_week = 0, radar_scans_this_week = 0, last_reset_timestamp = $2 WHERE id = $1`,
          [userId, Date.now()]
        );
        profile.radar_scans_this_week = 0;
      }

      // Enforce scan limit
      const currentTier = tier || "free";
      const limit = RADAR_LIMITS[currentTier] ?? 2;
      if (limit !== -1 && (profile.radar_scans_this_week || 0) >= limit) {
        return res.status(403).json({
          error: "Weekly radar scan limit reached",
          limit,
          used: profile.radar_scans_this_week,
          tier: currentTier,
          requiresUpgrade: true,
        });
      }

      // Update own location
      const existingLoc = await pool.query(`SELECT user_id FROM user_locations WHERE user_id = $1`, [userId]);
      if (existingLoc.rows.length > 0) {
        await pool.query(`UPDATE user_locations SET lat = $2, lng = $3, updated_at = NOW() WHERE user_id = $1`, [userId, lat, lng]);
      } else {
        await pool.query(`INSERT INTO user_locations (user_id, lat, lng, updated_at) VALUES ($1, $2, $3, NOW())`, [userId, lat, lng]);
      }

      // Query nearby users using bounding box
      const radius = radiusKm || 50;
      const latDelta = radius / 111.0;
      const lngDelta = radius / (111.0 * Math.cos((lat * Math.PI) / 180));

      const nearbyResult = await pool.query(
        `SELECT ul.user_id, ul.lat, ul.lng, ul.updated_at,
                up.name, up.age, up.bio, up.interests, up.photos, up.location as profile_location
         FROM user_locations ul
         LEFT JOIN user_profiles up ON ul.user_id = up.id
         WHERE ul.user_id != $1
           AND ul.lat BETWEEN $2 AND $3
           AND ul.lng BETWEEN $4 AND $5
           AND (up.is_visible_on_radar IS NULL OR up.is_visible_on_radar = true)
           AND ul.updated_at > NOW() - INTERVAL '7 days'
         LIMIT 50`,
        [userId, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
      );

      // Calculate actual distances and filter
      const nearbyUsers = nearbyResult.rows
        .map((row: any) => {
          const dLat = ((row.lat - lat) * Math.PI) / 180;
          const dLng = ((row.lng - lng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((row.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return {
            userId: row.user_id,
            lat: row.lat,
            lng: row.lng,
            distance: Math.round(distance * 10) / 10,
            name: row.name || "Nomad",
            age: row.age,
            bio: row.bio,
            interests: row.interests || [],
            photos: row.photos || [],
            location: row.profile_location,
            lastSeen: row.updated_at,
          };
        })
        .filter((u: any) => u.distance <= radius)
        .sort((a: any, b: any) => a.distance - b.distance);

      // Increment scan count
      await pool.query(
        `UPDATE user_profiles SET radar_scans_this_week = radar_scans_this_week + 1 WHERE id = $1`,
        [userId]
      );

      res.json({
        users: nearbyUsers,
        scansUsed: (profile.radar_scans_this_week || 0) + 1,
        scansLimit: limit,
      });
    } catch (error) {
      console.error("Radar scan error:", error);
      res.status(500).json({ error: "Failed to scan nearby users" });
    }
  });

  app.post("/api/radar/toggle-visibility", async (req: Request, res: Response) => {
    try {
      const { userId, isVisible } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });

      await pool.query(
        `UPDATE user_profiles SET is_visible_on_radar = $2 WHERE id = $1`,
        [userId, isVisible !== false]
      );

      res.json({ success: true, isVisible: isVisible !== false });
    } catch (error) {
      console.error("Toggle visibility error:", error);
      res.status(500).json({ error: "Failed to toggle visibility" });
    }
  });

  // ==================== USAGE STATS ====================

  app.get("/api/usage/:userId", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`SELECT * FROM user_profiles WHERE id = $1`, [req.params.userId]);
      if (result.rows.length === 0) {
        return res.json({ compatibilityChecks: 0, radarScans: 0 });
      }
      const profile = result.rows[0];

      // Check if we need to reset
      if (shouldResetWeekly(Number(profile.last_reset_timestamp) || 0)) {
        await pool.query(
          `UPDATE user_profiles SET compatibility_checks_this_week = 0, radar_scans_this_week = 0, last_reset_timestamp = $2 WHERE id = $1`,
          [req.params.userId, Date.now()]
        );
        return res.json({ compatibilityChecks: 0, radarScans: 0 });
      }

      res.json({
        compatibilityChecks: profile.compatibility_checks_this_week || 0,
        radarScans: profile.radar_scans_this_week || 0,
      });
    } catch (error) {
      console.error("Get usage error:", error);
      res.status(500).json({ error: "Failed to get usage stats" });
    }
  });

  // ==================== TRAVEL LIFESTYLE VERIFICATION ====================

  app.get("/api/verification/status/:userId", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT is_travel_verified, travel_badge FROM user_profiles WHERE id = $1`,
        [req.params.userId]
      );
      if (result.rows.length === 0) {
        return res.json({ isVerified: false, badge: null });
      }
      res.json({
        isVerified: result.rows[0].is_travel_verified || false,
        badge: result.rows[0].travel_badge || null,
      });
    } catch (error) {
      console.error("Get verification status error:", error);
      res.status(500).json({ error: "Failed to get verification status" });
    }
  });

  app.post("/api/verification/verify-travel", async (req: Request, res: Response) => {
    try {
      const { userId, photoUrl, secondaryPhotoUrl, answer1, answer2, answer3 } = req.body;

      if (!userId || !photoUrl || !answer1 || !answer2) {
        return res.status(400).json({ error: "userId, photoUrl, answer1, and answer2 are required" });
      }

      const aiPrompt = `You are an AI Travel Lifestyle Verification Engine.

This is a demo-friendly version.
Your job is to verify if the user shows signs of being a traveler, outdoor enthusiast, adventurer, cultural explorer, or potential nomad.

You will receive:
1. Photo URL(s) submitted by the user
2. Answers to travel questions

The user submitted these photos:
- Primary photo URL: ${photoUrl}
${secondaryPhotoUrl ? `- Secondary photo URL: ${secondaryPhotoUrl}` : "- No secondary photo"}

The user answered these questions:
Q1: "What kind of places do you enjoy traveling to?"
A1: "${answer1}"

Q2: "Describe your most recent travel experience."
A2: "${answer2}"

${answer3 ? `Q3: "What do you usually carry when you travel?"
A3: "${answer3}"` : "Q3 was skipped."}

IMPORTANT: Since you cannot view images directly, evaluate based on the URL context and focus primarily on the quality and authenticity of the written answers.

ANSWER CHECKS:
- Does the user describe a real travel experience?
- Do they mention adventure (hiking, camping, exploring), historic or cultural travel (visiting forts, temples, ancient cities, ruins, museums), or travel preferences (solo travel, road trips, nature trips)?
- Does the answer sound natural and human?
- Flag overly generic or AI-like answers.

SCORING:
- Strong, detailed, authentic answers about real travel experiences = higher scores
- Mentions of historic places, cultural locations, ancient sites = HIGH SCORE BOOST
- Generic or vague answers = lower scores
- Give photo_score based on whether a photo URL was provided (base 50 if provided, up to 80 if two photos)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "photo_score": (0-100),
  "travel_experience_score": (0-100),
  "final_travel_score": (0-100),
  "badge": "nomad" | "adventurer" | "explorer" | "none",
  "verdict": "verified" | "not_verified",
  "reasons": ["reason 1", "reason 2"],
  "advice": "short helpful text",
  "coming_soon": "Advanced Nomad/Vanlifer AI verification will be added in the next release."
}

Badge assignment:
- final_travel_score >= 80 -> "explorer"
- 60-79 -> "adventurer"
- 40-59 -> "nomad"
- <40 -> "none" with verdict "not_verified"`;

      const aiReply = await callGroqChat([
        { role: "system", content: "You are a travel lifestyle verification AI. Return ONLY valid JSON. No markdown code blocks." },
        { role: "user", content: aiPrompt },
      ]);

      let verificationResult;
      try {
        const cleaned = aiReply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        verificationResult = JSON.parse(cleaned);
      } catch {
        verificationResult = {
          photo_score: photoUrl ? 60 : 0,
          travel_experience_score: 50,
          final_travel_score: 55,
          badge: "nomad",
          verdict: "verified",
          reasons: ["Travel answers provided", "Photo submitted"],
          advice: "Keep exploring and sharing your adventures!",
          coming_soon: "Advanced Nomad/Vanlifer AI verification will be added in the next release.",
        };
      }

      const score = verificationResult.final_travel_score || 0;
      let badge = verificationResult.badge;
      let verdict = verificationResult.verdict;

      if (score >= 80) badge = "explorer";
      else if (score >= 60) badge = "adventurer";
      else if (score >= 40) badge = "nomad";
      else { badge = "none"; verdict = "not_verified"; }

      verificationResult.badge = badge;
      verificationResult.verdict = verdict;

      const verId = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO travel_verification (id, user_id, photo_url, secondary_photo_url, answer1, answer2, answer3, status, badge_type, reviewer_notes, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [verId, userId, photoUrl, secondaryPhotoUrl || null, answer1, answer2, answer3 || null,
         verdict, badge, JSON.stringify(verificationResult.reasons)]
      );

      if (verdict === "verified") {
        const existingProfile = await pool.query(`SELECT id FROM user_profiles WHERE id = $1`, [userId]);
        if (existingProfile.rows.length > 0) {
          await pool.query(
            `UPDATE user_profiles SET is_travel_verified = true, travel_badge = $2, updated_at = NOW() WHERE id = $1`,
            [userId, badge]
          );
        } else {
          await pool.query(
            `INSERT INTO user_profiles (id, is_travel_verified, travel_badge, created_at, updated_at) VALUES ($1, true, $2, NOW(), NOW())`,
            [userId, badge]
          );
        }
      }

      res.json(verificationResult);
    } catch (error) {
      console.error("Travel verification error:", error);
      res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  // ==================== DISCOVER / SWIPES / MATCHES ====================

  app.get("/api/discover/profiles/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID is required" });

      const result = await pool.query(
        `SELECT up.* FROM user_profiles up
         WHERE up.id != $1
           AND up.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
           AND up.id NOT IN (
             SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
             FROM matches WHERE user_a_id = $1 OR user_b_id = $1
           )
           AND up.name IS NOT NULL AND up.name != ''
         ORDER BY RANDOM()
         LIMIT 30`,
        [userId]
      );

      const profiles = result.rows.map((row: any) => ({
        user: {
          id: row.id,
          email: row.email || "",
          name: row.name || "Nomad",
          age: row.age || 25,
          bio: row.bio || "",
          location: row.location || "On the road",
          photos: row.photos || [],
          interests: row.interests || [],
          vanType: row.van_type || undefined,
          travelStyle: row.travel_style || undefined,
          isTravelVerified: row.is_travel_verified || false,
          travelBadge: row.travel_badge || "none",
          createdAt: row.created_at?.toISOString() || new Date().toISOString(),
        },
        distance: Math.floor(Math.random() * 50) + 1,
      }));

      res.json(profiles);
    } catch (error) {
      console.error("Discover profiles error:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.post("/api/swipes", async (req: Request, res: Response) => {
    try {
      const { swiperId, swipedId, direction } = req.body;
      if (!swiperId || !swipedId || !direction) {
        return res.status(400).json({ error: "swiperId, swipedId, and direction are required" });
      }

      await pool.query(
        `INSERT INTO swipes (swiper_id, swiped_id, direction, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET direction = $3, created_at = NOW()`,
        [swiperId, swipedId, direction]
      );

      let match = null;
      if (direction === "right") {
        const reverseSwipe = await pool.query(
          `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'right'`,
          [swipedId, swiperId]
        );

        if (reverseSwipe.rows.length > 0) {
          const existingMatch = await pool.query(
            `SELECT id FROM matches
             WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
            [swiperId, swipedId]
          );

          if (existingMatch.rows.length === 0) {
            const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await pool.query(
              `INSERT INTO matches (id, user_a_id, user_b_id, created_at) VALUES ($1, $2, $3, NOW())`,
              [matchId, swiperId, swipedId]
            );

            const matchedProfile = await pool.query(
              `SELECT * FROM user_profiles WHERE id = $1`, [swipedId]
            );
            const mp = matchedProfile.rows[0];
            if (mp) {
              match = {
                id: matchId,
                matchedUserId: swipedId,
                matchedUser: {
                  id: mp.id,
                  email: mp.email || "",
                  name: mp.name || "Nomad",
                  age: mp.age || 25,
                  bio: mp.bio || "",
                  location: mp.location || "On the road",
                  photos: mp.photos || [],
                  interests: mp.interests || [],
                  vanType: mp.van_type || undefined,
                  travelStyle: mp.travel_style || undefined,
                  isTravelVerified: mp.is_travel_verified || false,
                  travelBadge: mp.travel_badge || "none",
                  createdAt: mp.created_at?.toISOString() || new Date().toISOString(),
                },
                createdAt: new Date().toISOString(),
              };
            }
          }
        }
      }

      res.json({ success: true, match });
    } catch (error) {
      console.error("Swipe error:", error);
      res.status(500).json({ error: "Failed to record swipe" });
    }
  });

  app.get("/api/matches/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID is required" });

      const result = await pool.query(
        `SELECT m.id, m.user_a_id, m.user_b_id, m.created_at,
                up.id as profile_id, up.name, up.age, up.bio,
                up.interests, up.photos, up.location, up.van_type,
                up.travel_style, up.email, up.is_travel_verified, up.travel_badge
         FROM matches m
         JOIN user_profiles up ON up.id = CASE WHEN m.user_a_id = $1 THEN m.user_b_id ELSE m.user_a_id END
         WHERE m.user_a_id = $1 OR m.user_b_id = $1
         ORDER BY m.created_at DESC`,
        [userId]
      );

      const matchList = result.rows.map((row: any) => ({
        id: row.id,
        matchedUserId: row.profile_id,
        matchedUser: {
          id: row.profile_id,
          email: row.email || "",
          name: row.name || "Nomad",
          age: row.age || 25,
          bio: row.bio || "",
          location: row.location || "On the road",
          photos: row.photos || [],
          interests: row.interests || [],
          vanType: row.van_type || undefined,
          travelStyle: row.travel_style || undefined,
          isTravelVerified: row.is_travel_verified || false,
          travelBadge: row.travel_badge || "none",
          createdAt: new Date().toISOString(),
        },
        createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      }));

      res.json(matchList);
    } catch (error) {
      console.error("Get matches error:", error);
      res.status(500).json({ error: "Failed to get matches" });
    }
  });

  app.get("/api/swipes/liked/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT up.* FROM swipes s
         JOIN user_profiles up ON up.id = s.swiped_id
         WHERE s.swiper_id = $1 AND s.direction = 'right'
           AND s.swiped_id NOT IN (
             SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
             FROM matches WHERE user_a_id = $1 OR user_b_id = $1
           )
         ORDER BY s.created_at DESC`,
        [userId]
      );

      const likedProfiles = result.rows.map((row: any) => ({
        id: row.id,
        email: row.email || "",
        name: row.name || "Nomad",
        age: row.age || 25,
        bio: row.bio || "",
        location: row.location || "On the road",
        photos: row.photos || [],
        interests: row.interests || [],
        vanType: row.van_type || undefined,
        travelStyle: row.travel_style || undefined,
        createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      }));

      res.json(likedProfiles);
    } catch (error) {
      console.error("Get liked profiles error:", error);
      res.status(500).json({ error: "Failed to get liked profiles" });
    }
  });

  app.post("/api/seed/mock-swipes", async (req: Request, res: Response) => {
    try {
      const mockIds = await pool.query(
        `SELECT id FROM user_profiles WHERE id LIKE 'mock%'`
      );
      const realIds = await pool.query(
        `SELECT id FROM user_profiles WHERE id NOT LIKE 'mock%'`
      );

      if (mockIds.rows.length === 0 || realIds.rows.length === 0) {
        return res.json({ message: "No mock or real profiles found", seeded: 0 });
      }

      let seeded = 0;
      for (const mock of mockIds.rows) {
        for (const real of realIds.rows) {
          await pool.query(
            `INSERT INTO swipes (id, swiper_id, swiped_id, direction, created_at)
             VALUES ($1, $2, $3, 'right', NOW())
             ON CONFLICT (swiper_id, swiped_id) DO NOTHING`,
            [`seed_${mock.id}_${real.id}`, mock.id, real.id]
          );
          seeded++;
        }
      }

      res.json({ message: "Mock swipes seeded", seeded, mockCount: mockIds.rows.length, realCount: realIds.rows.length });
    } catch (error) {
      console.error("Seed mock swipes error:", error);
      res.status(500).json({ error: "Failed to seed mock swipes" });
    }
  });

  app.post("/api/swipes/reset/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      await pool.query(`DELETE FROM swipes WHERE swiper_id = $1`, [userId]);
      res.json({ message: "Swipes reset successfully" });
    } catch (error) {
      console.error("Reset swipes error:", error);
      res.status(500).json({ error: "Failed to reset swipes" });
    }
  });

  // ==========================================
  // EXPERT APPLICATION ROUTES
  // ==========================================

  app.post("/api/expert/apply", async (req: Request, res: Response) => {
    try {
      const {
        userId, resumeUrl, resumeText, portfolioUrls, specialization,
        experienceYears, skills, projectDescriptions, introVideoUrl, hourlyRate
      } = req.body;

      if (!userId) return res.status(400).json({ error: "User ID required" });

      const existing = await pool.query(
        `SELECT id, status FROM expert_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (existing.rows.length > 0 && ['pending', 'approved'].includes(existing.rows[0].status)) {
        return res.status(400).json({ error: "You already have an active application", existing: existing.rows[0] });
      }

      const result = await pool.query(
        `INSERT INTO expert_applications (user_id, resume_url, resume_text, portfolio_urls, specialization, experience_years, skills, project_descriptions, intro_video_url, hourly_rate, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
         RETURNING *`,
        [userId, resumeUrl || null, resumeText || null, JSON.stringify(portfolioUrls || []),
         specialization, experienceYears, JSON.stringify(skills || []),
         JSON.stringify(projectDescriptions || []), introVideoUrl || null, hourlyRate]
      );

      res.json({ application: result.rows[0] });
    } catch (error) {
      console.error("Expert apply error:", error);
      res.status(500).json({ error: "Failed to submit application" });
    }
  });

  app.get("/api/expert/status/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT * FROM expert_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (result.rows.length === 0) {
        return res.json({ application: null });
      }
      res.json({ application: result.rows[0] });
    } catch (error) {
      console.error("Expert status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.post("/api/expert/verify/:applicationId", async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;

      const appResult = await pool.query(
        `SELECT * FROM expert_applications WHERE id = $1`, [applicationId]
      );
      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: "Application not found" });
      }
      const application = appResult.rows[0];

      const verificationPrompt = `You are an AI Expert Verification Engine.

Your job is to verify if the applicant is qualified to be a Van Build Expert.

You will receive:
1. Resume text: ${application.resume_text || "Not provided"}
2. Portfolio photos count: ${(application.portfolio_urls || []).length}
3. Skills list: ${JSON.stringify(application.skills || [])}
4. Experience years: ${application.experience_years || 0}
5. Specialization: ${application.specialization || "Not specified"}
6. Past projects: ${JSON.stringify(application.project_descriptions || [])}
7. Hourly rate: $${application.hourly_rate || 0}/hr
8. Has intro video: ${application.intro_video_url ? "Yes" : "No"}

Analyze:

RESUME CHECK:
- Is experience real and detailed?
- Are skills realistic for van building?
- Does experience match claimed specialization?

PORTFOLIO CHECK:
- Number of portfolio items provided (more = better)
- Consider if portfolio count matches claimed experience

SKILL ALIGNMENT:
- Do skills match specialization?
- Are electrical/woodworking/plumbing skills legitimate for van building?

EXPERIENCE CHECK:
- Are past projects detailed and believable?
- Do processes and terminology match real van builders?

Return ONLY valid JSON (no markdown, no explanation):
{
  "portfolio_score": <0-100>,
  "resume_score": <0-100>,
  "skill_alignment_score": <0-100>,
  "experience_score": <0-100>,
  "final_expert_score": <0-100>,
  "verdict": "approved" | "manual_review" | "rejected",
  "badge": "expert" | "pro_expert" | "none",
  "reasons": ["reason1","reason2"],
  "advice": "short helpful text"
}

Scoring rules:
- final_expert_score >= 80 → verdict "approved", badge "pro_expert"
- 60-79 → verdict "approved", badge "expert"
- 40-59 → verdict "manual_review", badge "none"
- below 40 → verdict "rejected", badge "none"`;

      const aiResponse = await callGroqChat([
        { role: "system", content: "You are an expert verification AI. Return ONLY valid JSON." },
        { role: "user", content: verificationPrompt }
      ]);

      let verification;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        verification = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
      } catch {
        verification = {
          portfolio_score: 50, resume_score: 50, skill_alignment_score: 50,
          experience_score: 50, final_expert_score: 50,
          verdict: "manual_review", badge: "none",
          reasons: ["AI could not parse response properly"],
          advice: "Your application needs manual review."
        };
      }

      const status = verification.verdict === "approved" ? "approved" :
                     verification.verdict === "manual_review" ? "manual_review" : "rejected";
      const badge = verification.badge || "none";

      await pool.query(
        `UPDATE expert_applications SET
          status = $1, ai_score = $2, expert_badge = $3, reasons = $4, advice = $5,
          portfolio_score = $6, resume_score = $7, skill_alignment_score = $8, experience_score = $9
        WHERE id = $10`,
        [status, verification.final_expert_score, badge, JSON.stringify(verification.reasons),
         verification.advice, verification.portfolio_score, verification.resume_score,
         verification.skill_alignment_score, verification.experience_score, applicationId]
      );

      if (status === "approved") {
        await pool.query(
          `UPDATE user_profiles SET is_expert = true, expert_badge = $1 WHERE id = $2`,
          [badge, application.user_id]
        );
      }

      res.json({ verification, status, badge });
    } catch (error) {
      console.error("Expert verify error:", error);
      res.status(500).json({ error: "Failed to verify application" });
    }
  });

  app.get("/api/experts", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT ea.*, up.name, up.photos, up.location, up.expert_rating, up.reviews_count
         FROM expert_applications ea
         JOIN user_profiles up ON ea.user_id = up.id
         WHERE ea.status = 'approved'
         ORDER BY ea.ai_score DESC NULLS LAST, ea.created_at DESC`
      );
      res.json({ experts: result.rows });
    } catch (error) {
      console.error("List experts error:", error);
      res.status(500).json({ error: "Failed to list experts" });
    }
  });

  // ==========================================
  // CONSULTATION BOOKING ROUTES
  // ==========================================

  app.post("/api/consultations/book", async (req: Request, res: Response) => {
    try {
      const { userId, expertId, expertApplicationId, hourlyRate, durationMinutes, notes, transactionId } = req.body;
      if (!userId || !expertId) return res.status(400).json({ error: "User ID and Expert ID required" });

      const duration = durationMinutes || 60;
      const rate = hourlyRate || 0;
      const totalAmount = (rate / 60) * duration;
      const platformFee = totalAmount * 0.3;

      const result = await pool.query(
        `INSERT INTO consultation_bookings (user_id, expert_id, expert_application_id, hourly_rate, duration_minutes, total_amount, platform_fee, payment_status, revenuecat_transaction_id, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed')
         RETURNING *`,
        [userId, expertId, expertApplicationId || null, rate, duration, totalAmount, platformFee,
         transactionId ? "completed" : "pending", transactionId || null, notes || null]
      );

      res.json({ booking: result.rows[0] });
    } catch (error) {
      console.error("Book consultation error:", error);
      res.status(500).json({ error: "Failed to book consultation" });
    }
  });

  app.get("/api/consultations/user/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        `SELECT cb.*, up.name as expert_name, up.photos as expert_photos, ea.specialization
         FROM consultation_bookings cb
         JOIN user_profiles up ON cb.expert_id = up.id
         LEFT JOIN expert_applications ea ON cb.expert_application_id = ea.id
         WHERE cb.user_id = $1
         ORDER BY cb.created_at DESC`,
        [userId]
      );
      res.json({ bookings: result.rows });
    } catch (error) {
      console.error("List consultations error:", error);
      res.status(500).json({ error: "Failed to list consultations" });
    }
  });

  app.get("/api/consultations/expert/:expertId", async (req: Request, res: Response) => {
    try {
      const { expertId } = req.params;
      const result = await pool.query(
        `SELECT cb.*, up.name as client_name, up.photos as client_photos
         FROM consultation_bookings cb
         JOIN user_profiles up ON cb.user_id = up.id
         WHERE cb.expert_id = $1
         ORDER BY cb.created_at DESC`,
        [expertId]
      );
      res.json({ bookings: result.rows });
    } catch (error) {
      console.error("List expert consultations error:", error);
      res.status(500).json({ error: "Failed to list consultations" });
    }
  });

  app.patch("/api/consultations/:bookingId/payment", async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const { transactionId, paymentStatus } = req.body;

      const result = await pool.query(
        `UPDATE consultation_bookings SET payment_status = $1, revenuecat_transaction_id = $2
         WHERE id = $3 RETURNING *`,
        [paymentStatus || "completed", transactionId || null, bookingId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: "Booking not found" });
      res.json({ booking: result.rows[0] });
    } catch (error) {
      console.error("Update consultation payment error:", error);
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}



