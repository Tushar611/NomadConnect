var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/lib/resend.ts
var resend_exports = {};
__export(resend_exports, {
  getResendClient: () => getResendClient,
  sendOTPEmail: () => sendOTPEmail
});
import { Resend } from "resend";
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}
async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || "onboarding@resend.dev"
  };
}
async function sendOTPEmail(toEmail, code) {
  try {
    const { client } = await getResendClient();
    const { error } = await client.emails.send({
      from: "Nomad Connect <onboarding@resend.dev>",
      to: toEmail,
      subject: "Your Nomad Connect Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E8744F;">Password Reset</h2>
          <p>You requested to reset your password for Nomad Connect.</p>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">Nomad Connect - Connect with fellow travelers</p>
        </div>
      `
    });
    if (error) {
      console.error("Resend email error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}
var connectionSettings;
var init_resend = __esm({
  "server/lib/resend.ts"() {
    "use strict";
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
async function callGroqChat(messages) {
  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.6
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${text}`);
  }
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || "";
}
var supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;
function getSupabase() {
  if (!supabaseAdmin) throw new Error("Supabase client not configured");
  return supabaseAdmin;
}
async function checkSupabaseTables() {
  if (!supabaseAdmin) {
    console.log("[DB] Supabase client not configured - skipping table check");
    return;
  }
  const tables = [
    "ai_chat_sessions",
    "activities",
    "activity_chat_messages",
    "user_profiles",
    "user_locations",
    "compatibility_history",
    "swipes",
    "matches",
    "travel_verification",
    "expert_applications",
    "consultation_bookings",
    "radar_chat_requests",
    "safety_ratings",
    "sos_incidents",
    "activity_moderators",
    "chat_messages",
    "forum_posts"
  ];
  for (const table of tables) {
    const col = table === "user_locations" ? "user_id" : "id";
    const { error } = await supabaseAdmin.from(table).select(col).limit(1);
    if (error) {
      console.log(`[DB] Table '${table}': NOT accessible (${error.message})`);
    } else {
      console.log(`[DB] Table '${table}': OK`);
    }
  }
}
var otpStore = /* @__PURE__ */ new Map();
var groqApiKey = process.env.GROQ_API_KEY || "";
var VAN_BUILD_SYSTEM_PROMPT = `You are an expert van conversion advisor for the Nomad Connect app. You help van lifers and nomads with:
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
async function registerRoutes(app2) {
  checkSupabaseTables().catch((err) => console.error("[DB] Table check failed:", err));
  app2.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nomad-connect-api" });
  });
  app2.get("/api/ai/ping", async (_req, res) => {
    try {
      const reply = await callGroqChat([{ role: "user", content: "ping" }]);
      res.json({ ok: true, response: reply });
    } catch (error) {
      console.error("AI ping error:", error);
      res.status(500).json({ ok: false, error: "Failed to ping AI", detail: error?.message });
    }
  });
  app2.get("/api/ai/chat", (_req, res) => {
    res.status(405).json({ error: "Use POST /api/ai/chat with { messages: [...] }" });
  });
  app2.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, systemPrompt } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array required" });
      }
      const systemText = systemPrompt || VAN_BUILD_SYSTEM_PROMPT;
      const groqMessages = [
        { role: "system", content: systemText },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      ];
      const reply = await callGroqChat(groqMessages);
      res.json({ response: reply });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to get AI response", detail: error?.message });
    }
  });
  app2.post("/api/ai/analyze-photo", (_req, res) => {
    res.status(501).json({ error: "Photo analysis is not available in this build." });
  });
  app2.post("/api/ai/estimate-cost", async (req, res) => {
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
        { role: "user", content: `Please provide a detailed cost estimate for the following van build:

${vanDetails}` }
      ];
      const reply = await callGroqChat(groqMessages);
      res.json({ estimate: reply });
    } catch (error) {
      console.error("AI cost estimate error:", error);
      res.status(500).json({ error: "Failed to get cost estimate", detail: error?.message });
    }
  });
  app2.post("/api/ai/generate-van-image", (_req, res) => {
    res.status(501).json({ error: "Image generation is not available in this build." });
  });
  app2.get("/api/ai/sessions/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("ai_chat_sessions").select("id, user_id, title, messages, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Failed to get chat sessions:", error);
      res.json([]);
    }
  });
  app2.post("/api/ai/sessions", async (req, res) => {
    const { id, userId, title, messages } = req.body;
    if (!id || !userId) {
      return res.status(400).json({ error: "Session ID and user ID are required" });
    }
    try {
      const sb = getSupabase();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await sb.from("ai_chat_sessions").insert({
        id,
        user_id: userId,
        title: title || "New Chat",
        messages: messages || [],
        created_at: now,
        updated_at: now
      }).select().single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error("Failed to create chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });
  app2.put("/api/ai/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const { title, messages } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("ai_chat_sessions").update({
        title,
        messages,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", sessionId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Session not found" });
        }
        throw error;
      }
      res.json(data);
    } catch (error) {
      console.error("Failed to update chat session:", error);
      res.status(500).json({ error: "Failed to update chat session" });
    }
  });
  app2.delete("/api/ai/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("ai_chat_sessions").delete().eq("id", sessionId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete chat session:", error);
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });
  app2.get("/api/activities", async (_req, res) => {
    try {
      const sb = getSupabase();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await sb.from("activities").select("*").gte("date", now).order("date", { ascending: true });
      if (error) throw error;
      const activities = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.category || "other",
        location: row.location,
        latitude: row.latitude ? parseFloat(row.latitude) : void 0,
        longitude: row.longitude ? parseFloat(row.longitude) : void 0,
        date: row.date,
        hostId: row.host_id,
        host: row.host_data || { id: row.host_id, name: "Unknown" },
        attendeeIds: row.attendee_ids || [],
        attendees: row.attendees_data || [],
        maxAttendees: row.max_attendees ? parseInt(row.max_attendees) : void 0,
        imageUrl: row.image_url,
        createdAt: row.created_at
      }));
      res.json(activities);
    } catch (error) {
      console.error("Failed to get activities:", error);
      res.status(500).json({ error: "Failed to get activities" });
    }
  });
  app2.post("/api/activities", async (req, res) => {
    const { activity, user } = req.body;
    if (!activity || !user?.id || !user?.name) {
      return res.status(400).json({ error: "Activity and user are required" });
    }
    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const sb = getSupabase();
      await sb.from("activities").insert({
        id: activityId,
        title: activity.title || "New Activity",
        description: activity.description || "",
        category: activity.type || "other",
        date: activity.date || now,
        location: activity.location || "TBD",
        latitude: activity.latitude?.toString() || null,
        longitude: activity.longitude?.toString() || null,
        host_id: user.id,
        host_data: user,
        attendee_ids: [],
        attendees_data: [],
        max_attendees: activity.maxAttendees?.toString() || null,
        image_url: activity.imageUrl || null,
        created_at: now
      });
      const newActivity = {
        id: activityId,
        title: activity.title || "New Activity",
        description: activity.description || "",
        type: activity.type || "other",
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
        createdAt: now
      };
      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Failed to create activity in database:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });
  app2.post("/api/activities/:activityId/join", async (req, res) => {
    const { activityId } = req.params;
    const { user } = req.body;
    if (!user?.id) {
      return res.status(400).json({ error: "User is required" });
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activities").select("*").eq("id", activityId).single();
      if (error || !data) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const attendeeIds = data.attendee_ids || [];
      const attendeesData = data.attendees_data || [];
      if (!attendeeIds.includes(user.id)) {
        attendeeIds.push(user.id);
        attendeesData.push(user);
        const { error: updateError } = await sb.from("activities").update({ attendee_ids: attendeeIds, attendees_data: attendeesData }).eq("id", activityId);
        if (updateError) throw updateError;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to join activity:", error);
      res.status(500).json({ error: "Failed to join activity" });
    }
  });
  app2.delete("/api/activities/:activityId", async (req, res) => {
    const { activityId } = req.params;
    const { userId } = req.body;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activities").select("*").eq("id", activityId).single();
      if (error || !data) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (userId && data.host_id !== userId) {
        return res.status(403).json({ error: "Only the host can delete the activity" });
      }
      const { error: deleteError } = await sb.from("activities").delete().eq("id", activityId);
      if (deleteError) throw deleteError;
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });
  app2.get("/api/activities/:activityId/messages", async (req, res) => {
    const { activityId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activity_chat_messages").select("*").eq("activity_id", activityId).is("deleted_at", null).order("created_at", { ascending: true });
      if (error) throw error;
      const messages = (data || []).map((row) => ({
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
        audioDuration: row.audio_duration ? parseFloat(row.audio_duration) : void 0,
        replyTo: row.reply_to,
        location: row.location,
        isPinned: row.is_pinned === true || row.is_pinned === "true",
        isModeratorMessage: row.is_moderator_message === true || row.is_moderator_message === "true",
        reactions: row.reactions || {},
        isEdited: !!row.edited_at,
        createdAt: row.created_at,
        deletedAt: row.deleted_at
      }));
      res.json(messages);
    } catch (error) {
      console.error("Failed to get activity messages:", error);
      res.json([]);
    }
  });
  app2.post("/api/activities/:activityId/messages", async (req, res) => {
    const { activityId } = req.params;
    const { senderId, senderName, senderPhoto, type, content, photoUrl, fileUrl, fileName, audioUrl, audioDuration, replyTo, location, isModeratorMessage } = req.body;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const sb = getSupabase();
      const { error } = await sb.from("activity_chat_messages").insert({
        id: messageId,
        activity_id: activityId,
        sender_id: senderId,
        sender_name: senderName,
        sender_photo: senderPhoto || "",
        type: type || "text",
        content,
        photo_url: photoUrl || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        audio_url: audioUrl || null,
        audio_duration: audioDuration?.toString() || null,
        reply_to: replyTo || null,
        location: location || null,
        is_pinned: false,
        is_moderator_message: isModeratorMessage || false,
        reactions: {},
        created_at: now
      });
      if (error) throw error;
      const message = {
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
        createdAt: now
      };
      res.status(201).json(message);
    } catch (error) {
      console.error("Failed to send activity message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.patch("/api/activities/:activityId/messages/:messageId/pin", async (req, res) => {
    const { messageId } = req.params;
    const { pin } = req.body;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activity_chat_messages").update({ is_pinned: !!pin }).eq("id", messageId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw error;
      }
      res.json({
        id: data.id,
        activityId: data.activity_id,
        isPinned: data.is_pinned,
        content: data.content
      });
    } catch (error) {
      console.error("Failed to pin message:", error);
      res.status(500).json({ error: "Failed to pin message" });
    }
  });
  app2.put("/api/activities/:activityId/messages/:messageId", async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activity_chat_messages").update({ content, edited_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", messageId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw error;
      }
      res.json({
        id: data.id,
        activityId: data.activity_id,
        content: data.content,
        isEdited: true
      });
    } catch (error) {
      console.error("Failed to edit message:", error);
      res.status(500).json({ error: "Failed to edit message" });
    }
  });
  app2.post("/api/activities/:activityId/messages/:messageId/react", async (req, res) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      return res.status(400).json({ error: "userId and emoji are required" });
    }
    try {
      const sb = getSupabase();
      const { data: msgData, error: getError } = await sb.from("activity_chat_messages").select("reactions").eq("id", messageId).single();
      if (getError) {
        if (getError.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw getError;
      }
      const reactions = msgData.reactions || {};
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
      const { error: updateError } = await sb.from("activity_chat_messages").update({ reactions }).eq("id", messageId);
      if (updateError) throw updateError;
      res.json({ id: messageId, reactions });
    } catch (error) {
      console.error("Failed to react to message:", error);
      res.status(500).json({ error: "Failed to react to message" });
    }
  });
  app2.delete("/api/activities/:activityId/messages/:messageId", async (req, res) => {
    const { messageId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activity_chat_messages").update({ deleted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", messageId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  app2.get("/api/activities/:activityId/moderators", async (req, res) => {
    const { activityId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("activity_moderators").select("*").eq("activity_id", activityId);
      if (error) throw error;
      const moderators = (data || []).map((row) => ({
        activityId: row.activity_id,
        userId: row.user_id,
        isHost: row.is_host,
        addedAt: row.added_at
      }));
      res.json(moderators);
    } catch (error) {
      console.error("Failed to get moderators:", error);
      res.status(500).json({ error: "Failed to get moderators" });
    }
  });
  app2.post("/api/activities/:activityId/moderators", async (req, res) => {
    const { activityId } = req.params;
    const { userId, isHost } = req.body;
    try {
      const sb = getSupabase();
      const { data: existing } = await sb.from("activity_moderators").select("id").eq("activity_id", activityId).eq("user_id", userId);
      if (existing && existing.length > 0) {
        return res.json({ activityId, userId, isHost: isHost || false, addedAt: (/* @__PURE__ */ new Date()).toISOString() });
      }
      const modId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { error } = await sb.from("activity_moderators").insert({
        id: modId,
        activity_id: activityId,
        user_id: userId,
        is_host: isHost || false,
        added_at: now
      });
      if (error) throw error;
      res.status(201).json({ activityId, userId, isHost: isHost || false, addedAt: now });
    } catch (error) {
      console.error("Failed to add moderator:", error);
      res.status(500).json({ error: "Failed to add moderator" });
    }
  });
  app2.delete("/api/activities/:activityId/moderators/:userId", async (req, res) => {
    const { activityId, userId } = req.params;
    try {
      const sb = getSupabase();
      const { error } = await sb.from("activity_moderators").delete().eq("activity_id", activityId).eq("user_id", userId).eq("is_host", false);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove moderator:", error);
      res.status(500).json({ error: "Failed to remove moderator" });
    }
  });
  app2.post("/api/activities/:activityId/init-chat", async (req, res) => {
    const { activityId } = req.params;
    const { hostId } = req.body;
    try {
      const sb = getSupabase();
      const { data: existing } = await sb.from("activity_moderators").select("id").eq("activity_id", activityId).eq("user_id", hostId);
      if (!existing || existing.length === 0) {
        const modId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const { error } = await sb.from("activity_moderators").insert({
          id: modId,
          activity_id: activityId,
          user_id: hostId,
          is_host: true,
          added_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to init chat:", error);
      res.status(500).json({ error: "Failed to initialize chat" });
    }
  });
  app2.post("/api/safety-ratings", async (req, res) => {
    const { activityId, ratedByUserId, safetyScore, wasLocationPublic, hostWasTrustworthy } = req.body;
    if (!activityId || !ratedByUserId || !safetyScore) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const sb = getSupabase();
      const { data: existingRating } = await sb.from("safety_ratings").select("id").eq("activity_id", activityId).eq("rated_by_user_id", ratedByUserId);
      if (existingRating && existingRating.length > 0) {
        return res.status(400).json({ error: "You have already rated this activity" });
      }
      const ratingId = `rating_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { error } = await sb.from("safety_ratings").insert({
        id: ratingId,
        activity_id: activityId,
        rated_by_user_id: ratedByUserId,
        safety_score: safetyScore,
        was_location_public: wasLocationPublic || false,
        host_was_trustworthy: hostWasTrustworthy || false,
        created_at: now
      });
      if (error) throw error;
      res.status(201).json({
        id: ratingId,
        activityId,
        ratedByUserId,
        safetyScore,
        wasLocationPublic: wasLocationPublic || false,
        hostWasTrustworthy: hostWasTrustworthy || false,
        createdAt: now
      });
    } catch (error) {
      console.error("Failed to submit safety rating:", error);
      res.status(500).json({ error: "Failed to submit safety rating" });
    }
  });
  app2.get("/api/safety-ratings/:activityId", async (req, res) => {
    const { activityId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("safety_ratings").select("*").eq("activity_id", activityId);
      if (error) throw error;
      const ratings = (data || []).map((r) => ({
        id: r.id,
        activityId: r.activity_id,
        ratedByUserId: r.rated_by_user_id,
        safetyScore: r.safety_score,
        wasLocationPublic: r.was_location_public,
        hostWasTrustworthy: r.host_was_trustworthy,
        createdAt: r.created_at
      }));
      const averageSafetyScore = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.safetyScore, 0) / ratings.length : 0;
      const publicLocationPercentage = ratings.length > 0 ? ratings.filter((r) => r.wasLocationPublic).length / ratings.length * 100 : 0;
      const trustworthyHostPercentage = ratings.length > 0 ? ratings.filter((r) => r.hostWasTrustworthy).length / ratings.length * 100 : 0;
      res.json({
        ratings,
        summary: {
          totalRatings: ratings.length,
          averageSafetyScore: Math.round(averageSafetyScore * 10) / 10,
          publicLocationPercentage: Math.round(publicLocationPercentage),
          trustworthyHostPercentage: Math.round(trustworthyHostPercentage)
        }
      });
    } catch (error) {
      console.error("Failed to get safety ratings:", error);
      res.status(500).json({ error: "Failed to get safety ratings" });
    }
  });
  app2.post("/api/sos/log", async (req, res) => {
    const { userId, userName, location, emergencyContact, timestamp, message } = req.body;
    const incidentId = `sos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const ts = timestamp || (/* @__PURE__ */ new Date()).toISOString();
    try {
      const sb = getSupabase();
      const { error } = await sb.from("sos_incidents").insert({
        id: incidentId,
        user_id: userId,
        user_name: userName,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        emergency_contact_name: emergencyContact?.name || null,
        emergency_contact_phone: emergencyContact?.phone || null,
        emergency_contact_email: emergencyContact?.email || null,
        timestamp: ts,
        resolved: false,
        notes: null
      });
      if (error) throw error;
      console.log("[SOS] Emergency incident logged:", incidentId);
      if (emergencyContact?.email && message) {
        try {
          const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
          const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
          const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
          const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;
          if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
            await fetch("https://api.emailjs.com/api/v1.0/email/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                service_id: emailjsServiceId,
                template_id: emailjsTemplateId,
                user_id: emailjsPublicKey,
                accessToken: emailjsPrivateKey,
                template_params: {
                  to_email: emergencyContact.email,
                  to_name: emergencyContact.name || "Emergency Contact",
                  from_name: "Nomad Connect SOS",
                  message
                }
              })
            });
            console.log("[SOS] Emergency email sent to:", emergencyContact.email);
          }
        } catch (emailErr) {
          console.error("[SOS] Failed to send emergency email:", emailErr);
        }
      }
      res.json({ success: true, incidentId });
    } catch (error) {
      console.error("Failed to log SOS incident:", error);
      res.status(500).json({ error: "Failed to log SOS incident" });
    }
  });
  app2.get("/api/sos/incidents", async (req, res) => {
    const { userId } = req.query;
    try {
      const sb = getSupabase();
      let query = sb.from("sos_incidents").select("*");
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data, error } = await query.order("timestamp", { ascending: false });
      if (error) throw error;
      const incidents = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        location: row.latitude != null ? { latitude: row.latitude, longitude: row.longitude } : void 0,
        emergencyContact: row.emergency_contact_name ? {
          name: row.emergency_contact_name,
          phone: row.emergency_contact_phone,
          email: row.emergency_contact_email
        } : void 0,
        timestamp: row.timestamp,
        resolved: row.resolved,
        notes: row.notes
      }));
      res.json(incidents);
    } catch (error) {
      console.error("Failed to get SOS incidents:", error);
      res.status(500).json({ error: "Failed to get SOS incidents" });
    }
  });
  app2.patch("/api/sos/incidents/:incidentId", async (req, res) => {
    const { incidentId } = req.params;
    const { resolved, notes } = req.body;
    try {
      const sb = getSupabase();
      const updateData = {};
      if (resolved !== void 0) updateData.resolved = resolved;
      if (notes) updateData.notes = notes;
      const { data, error } = await sb.from("sos_incidents").update(updateData).eq("id", incidentId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Incident not found" });
        }
        throw error;
      }
      res.json({
        id: data.id,
        userId: data.user_id,
        userName: data.user_name,
        location: data.latitude != null ? { latitude: data.latitude, longitude: data.longitude } : void 0,
        emergencyContact: data.emergency_contact_name ? {
          name: data.emergency_contact_name,
          phone: data.emergency_contact_phone,
          email: data.emergency_contact_email
        } : void 0,
        timestamp: data.timestamp,
        resolved: data.resolved,
        notes: data.notes
      });
    } catch (error) {
      console.error("Failed to update SOS incident:", error);
      res.status(500).json({ error: "Failed to update SOS incident" });
    }
  });
  app2.post("/api/password-reset/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const code = Math.floor(1e5 + Math.random() * 9e5).toString();
      otpStore.set(normalizedEmail, {
        email: normalizedEmail,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1e3),
        used: false
      });
      let emailSent = false;
      const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
      const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
      const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
      const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;
      console.log("EmailJS config check:", {
        hasServiceId: !!emailjsServiceId,
        hasTemplateId: !!emailjsTemplateId,
        hasPublicKey: !!emailjsPublicKey,
        publicKeyLength: emailjsPublicKey?.length,
        hasPrivateKey: !!emailjsPrivateKey
      });
      if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
        try {
          const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: emailjsServiceId,
              template_id: emailjsTemplateId,
              user_id: emailjsPublicKey,
              accessToken: emailjsPrivateKey,
              template_params: {
                to_email: normalizedEmail,
                to_name: normalizedEmail.split("@")[0],
                message: `Your verification code is: ${code}`,
                from_name: "Nomad Connect"
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
      if (!emailSent) {
        try {
          const { sendOTPEmail: sendOTPEmail2 } = await Promise.resolve().then(() => (init_resend(), resend_exports));
          emailSent = await sendOTPEmail2(normalizedEmail, code);
          if (emailSent) {
            console.log(`OTP ${code} sent to ${normalizedEmail} via Resend`);
          }
        } catch (resendErr) {
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
  app2.post("/api/password-reset/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const storedOtp = otpStore.get(normalizedEmail);
      if (!storedOtp) {
        return res.status(400).json({ error: "No code found. Please request a new one." });
      }
      if (storedOtp.expiresAt < /* @__PURE__ */ new Date()) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Code expired. Please request a new one." });
      }
      if (storedOtp.used) {
        return res.status(400).json({ error: "Code already used. Please request a new one." });
      }
      if (storedOtp.code !== code.trim()) {
        return res.status(400).json({ error: "Invalid code. Please check and try again." });
      }
      otpStore.set(normalizedEmail, {
        ...storedOtp,
        used: false
        // Will be set to true after password update
      });
      console.log(`OTP verified for ${normalizedEmail}`);
      res.json({ success: true, message: "Code verified" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });
  app2.post("/api/password-reset/update-password", async (req, res) => {
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
      if (/* @__PURE__ */ new Date() > verifiedEntry.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Session expired. Please start over." });
      }
      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Service not available" });
      }
      const { data: userData, error: lookupError } = await supabaseAdmin.auth.admin.listUsers();
      if (lookupError) {
        console.error("User lookup error:", lookupError);
        return res.status(500).json({ error: "Failed to find user" });
      }
      const user = userData.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword
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
  app2.get("/auth/reset-password", (req, res) => {
    const filePath = path.join(__dirname, "templates", "reset-password.html");
    res.sendFile(filePath);
  });
  app2.get("/reset-password", (req, res) => {
    const filePath = path.join(__dirname, "templates", "reset-password.html");
    res.sendFile(filePath);
  });
  app2.post("/api/user-profiles/upsert", async (req, res) => {
    try {
      const { id, name, age, bio, interests, photos, location } = req.body;
      if (!id) return res.status(400).json({ error: "User ID is required" });
      const sb = getSupabase();
      const { data: existing, error: selectError } = await sb.from("user_profiles").select("id").eq("id", id);
      if (selectError) throw selectError;
      if (existing && existing.length > 0) {
        const updateData = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (name !== void 0) updateData.name = name;
        if (age !== void 0) updateData.age = age;
        if (bio !== void 0) updateData.bio = bio;
        if (interests !== void 0) updateData.interests = interests;
        if (photos !== void 0) updateData.photos = photos;
        if (location !== void 0) updateData.location = location;
        const { error: updateError } = await sb.from("user_profiles").update(updateData).eq("id", id);
        if (updateError) throw updateError;
      } else {
        const now = Date.now();
        const { error: insertError } = await sb.from("user_profiles").insert({
          id,
          name: name || "",
          age: age || 0,
          bio: bio || "",
          interests: interests || [],
          photos: photos || [],
          location: location || "",
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: now,
          is_visible_on_radar: true,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (insertError) throw insertError;
        if (!id.startsWith("mock")) {
          const { data: mockIds } = await sb.from("user_profiles").select("id").like("id", "mock%");
          if (mockIds) {
            for (const mock of mockIds) {
              await sb.from("swipes").upsert({
                id: `seed_${mock.id}_${id}`,
                swiper_id: mock.id,
                swiped_id: id,
                direction: "right",
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              }, { onConflict: "swiper_id,swiped_id" });
            }
          }
        }
      }
      const { data: result, error: getError } = await sb.from("user_profiles").select("*").eq("id", id).single();
      if (getError) throw getError;
      res.json(result);
    } catch (error) {
      console.error("Upsert profile error:", error);
      res.status(500).json({ error: "Failed to upsert profile" });
    }
  });
  app2.get("/api/user-profiles/:userId", async (req, res) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("user_profiles").select("*").eq("id", req.params.userId).single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Profile not found" });
        }
        throw error;
      }
      res.json(data);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });
  const COMPATIBILITY_LIMITS = {
    starter: 2,
    free: 2,
    explorer: 15,
    pro: 15,
    adventurer: -1,
    expert: -1,
    lifetime: -1
  };
  function shouldResetDaily(lastResetTimestamp) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1e3;
    return now - lastResetTimestamp > oneDay;
  }
  app2.post("/api/compatibility/check", async (req, res) => {
    try {
      const { userAId, userBId, userAProfile, userBProfile, tier } = req.body;
      if (!userAId || !userBId) return res.status(400).json({ error: "Both user IDs are required" });
      const sb = getSupabase();
      const { data: profileData, error: profileError } = await sb.from("user_profiles").select("*").eq("id", userAId).single();
      let profile = profileData;
      if (profileError || !profile) {
        const now = Date.now();
        await sb.from("user_profiles").insert({
          id: userAId,
          name: userAProfile?.name || "",
          age: userAProfile?.age || 0,
          bio: userAProfile?.bio || "",
          interests: userAProfile?.interests || [],
          photos: userAProfile?.photos || [],
          location: userAProfile?.location || "",
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: now,
          is_visible_on_radar: true,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        const { data: newProfile } = await sb.from("user_profiles").select("*").eq("id", userAId).single();
        profile = newProfile;
      }
      if (!profile) {
        return res.status(500).json({ error: "Failed to get or create profile" });
      }
      if (shouldResetDaily(Number(profile.last_reset_timestamp) || 0)) {
        await sb.from("user_profiles").update({
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: Date.now()
        }).eq("id", userAId);
        profile.compatibility_checks_this_week = 0;
      }
      const limit = COMPATIBILITY_LIMITS[currentTier] ?? 2;
      if (limit !== -1 && (profile.compatibility_checks_this_week || 0) >= limit) {
        return res.status(403).json({
          error: "Daily compatibility check limit reached",
          limit,
          used: profile.compatibility_checks_this_week,
          tier: currentTier,
          requiresUpgrade: true
        });
      }
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const { data: existingAB } = await sb.from("compatibility_history").select("*").eq("user_a", userAId).eq("user_b", userBId).gte("created_at", oneDayAgo).order("created_at", { ascending: false }).limit(1);
      const { data: existingBA } = await sb.from("compatibility_history").select("*").eq("user_a", userBId).eq("user_b", userAId).gte("created_at", oneDayAgo).order("created_at", { ascending: false }).limit(1);
      const existingRow = existingAB && existingAB.length > 0 ? existingAB[0] : existingBA && existingBA.length > 0 ? existingBA[0] : null;
      if (existingRow) {
        return res.json({ result: existingRow, cached: true });
      }
      const profileA = userAProfile || { name: "User A", interests: [], bio: "" };
      const profileB = userBProfile || { name: "User B", interests: [], bio: "" };
      const compatPrompt = `You are a compatibility analyzer for a travel/nomad dating app. Analyze these two profiles and return ONLY valid JSON (no markdown, no explanation).

Profile A: Name: ${profileA.name}, Age: ${profileA.age || "unknown"}, Bio: "${profileA.bio || "No bio"}", Interests: ${JSON.stringify(profileA.interests || [])}, Location: "${profileA.location || "unknown"}"

Profile B: Name: ${profileB.name}, Age: ${profileB.age || "unknown"}, Bio: "${profileB.bio || "No bio"}", Interests: ${JSON.stringify(profileB.interests || [])}, Location: "${profileB.location || "unknown"}"

Return ONLY this JSON structure:
{"score":75,"strengths":["shared interest 1","shared interest 2"],"conflicts":["potential conflict 1"],"icebreakers":["conversation starter 1","conversation starter 2"],"first_message":"Hey! I noticed we both...","date_idea":"A cool activity idea based on shared interests"}`;
      const aiReply = await callGroqChat([
        { role: "system", content: "You are a compatibility analyzer. Return ONLY valid JSON. No markdown code blocks." },
        { role: "user", content: compatPrompt }
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
          date_idea: "Explore a new hiking trail together"
        };
      }
      const compatId = `compat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await sb.from("compatibility_history").insert({
        id: compatId,
        user_a: userAId,
        user_b: userBId,
        score: compatResult.score,
        strengths: compatResult.strengths,
        conflicts: compatResult.conflicts,
        icebreakers: compatResult.icebreakers,
        first_message: compatResult.first_message,
        date_idea: compatResult.date_idea,
        created_at: nowIso
      });
      await sb.from("user_profiles").update({
        compatibility_checks_this_week: (profile.compatibility_checks_this_week || 0) + 1
      }).eq("id", userAId);
      res.json({
        result: {
          id: compatId,
          user_a: userAId,
          user_b: userBId,
          ...compatResult,
          created_at: nowIso
        },
        cached: false
      });
    } catch (error) {
      console.error("Compatibility check error:", error);
      res.status(500).json({ error: "Failed to check compatibility" });
    }
  });
  app2.get("/api/compatibility/history/:userId", async (req, res) => {
    try {
      const sb = getSupabase();
      const userId = req.params.userId;
      const { data: dataA } = await sb.from("compatibility_history").select("*").eq("user_a", userId).order("created_at", { ascending: false }).limit(20);
      const { data: dataB } = await sb.from("compatibility_history").select("*").eq("user_b", userId).order("created_at", { ascending: false }).limit(20);
      const combined = [...dataA || [], ...dataB || []].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
      res.json(combined);
    } catch (error) {
      console.error("Get compatibility history error:", error);
      res.json([]);
    }
  });
  const RADAR_LIMITS = {
    starter: 2,
    free: 2,
    explorer: 15,
    pro: 15,
    adventurer: -1,
    expert: -1,
    lifetime: -1
  };
  app2.post("/api/radar/update-location", async (req, res) => {
    try {
      const { userId, lat, lng } = req.body;
      if (!userId || lat === void 0 || lng === void 0) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }
      const sb = getSupabase();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data: existing } = await sb.from("user_locations").select("user_id").eq("user_id", userId);
      if (existing && existing.length > 0) {
        await sb.from("user_locations").update({ lat, lng, updated_at: now }).eq("user_id", userId);
      } else {
        await sb.from("user_locations").insert({ user_id: userId, lat, lng, updated_at: now });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });
  app2.post("/api/radar/scan", async (req, res) => {
    try {
      const { userId, lat, lng, radiusKm, tier } = req.body;
      if (!userId || lat === void 0 || lng === void 0) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }
      const sb = getSupabase();
      const { data: profileData } = await sb.from("user_profiles").select("*").eq("id", userId).single();
      let profile = profileData;
      if (!profile) {
        const now2 = Date.now();
        await sb.from("user_profiles").insert({
          id: userId,
          name: "",
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: now2,
          is_visible_on_radar: true,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        const { data: newProfile } = await sb.from("user_profiles").select("*").eq("id", userId).single();
        profile = newProfile;
      }
      if (!profile) {
        return res.status(500).json({ error: "Failed to get or create profile" });
      }
      if (shouldResetDaily(Number(profile.last_reset_timestamp) || 0)) {
        await sb.from("user_profiles").update({
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: Date.now()
        }).eq("id", userId);
        profile.radar_scans_this_week = 0;
      }
      const currentTier2 = tier || "starter";
      const limit = RADAR_LIMITS[currentTier2] ?? 2;
      if (limit !== -1 && (profile.radar_scans_this_week || 0) >= limit) {
        return res.status(403).json({
          error: "Daily radar scan limit reached",
          limit,
          used: profile.radar_scans_this_week,
          tier: currentTier2,
          requiresUpgrade: true
        });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data: existingLoc } = await sb.from("user_locations").select("user_id").eq("user_id", userId);
      if (existingLoc && existingLoc.length > 0) {
        await sb.from("user_locations").update({ lat, lng, updated_at: now }).eq("user_id", userId);
      } else {
        await sb.from("user_locations").insert({ user_id: userId, lat, lng, updated_at: now });
      }
      const radius = radiusKm || 50;
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos(lat * Math.PI / 180));
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const { data: nearbyLocs } = await sb.from("user_locations").select("user_id, lat, lng, updated_at").neq("user_id", userId).gte("lat", lat - latDelta).lte("lat", lat + latDelta).gte("lng", lng - lngDelta).lte("lng", lng + lngDelta).gte("updated_at", oneDayAgo).limit(50);
      const nearbyUserIds = (nearbyLocs || []).map((l) => l.user_id);
      let profilesMap = {};
      if (nearbyUserIds.length > 0) {
        const { data: profiles } = await sb.from("user_profiles").select("id, name, age, bio, interests, photos, location, is_visible_on_radar").in("id", nearbyUserIds);
        if (profiles) {
          for (const p of profiles) {
            if (p.is_visible_on_radar === false) continue;
            profilesMap[p.id] = p;
          }
        }
      }
      const nearbyUsers = (nearbyLocs || []).filter((loc) => profilesMap[loc.user_id]).map((row) => {
        const dLat = (row.lat - lat) * Math.PI / 180;
        const dLng = (row.lng - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(row.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const up = profilesMap[row.user_id];
        return {
          userId: row.user_id,
          lat: row.lat,
          lng: row.lng,
          distance: Math.round(distance * 10) / 10,
          name: up?.name || "Nomad",
          age: up?.age,
          bio: up?.bio,
          interests: up?.interests || [],
          photos: up?.photos || [],
          location: up?.location,
          lastSeen: row.updated_at
        };
      }).filter((u) => u.distance <= radius).sort((a, b) => a.distance - b.distance);
      const actNow = (/* @__PURE__ */ new Date()).toISOString();
      const { data: allActivities } = await sb.from("activities").select("*").gte("date", actNow).order("date", { ascending: true }).limit(50);
      const nearbyActivities = (allActivities || []).filter((act) => {
        if (!act.latitude || !act.longitude) return false;
        const aLat = parseFloat(act.latitude);
        const aLng = parseFloat(act.longitude);
        const dLat = (aLat - lat) * Math.PI / 180;
        const dLng = (aLng - lng) * Math.PI / 180;
        const a2 = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(aLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
        act._distance = Math.round(dist * 10) / 10;
        return dist <= radius;
      }).slice(0, 10).map((act) => ({
        id: act.id,
        title: act.title,
        description: act.description,
        type: act.category || "other",
        location: act.location,
        date: act.date,
        distance: act._distance,
        attendeeCount: (act.attendee_ids || []).length,
        maxAttendees: act.max_attendees ? parseInt(act.max_attendees) : void 0,
        imageUrl: act.image_url,
        hostId: act.host_id
      }));
      await sb.from("user_profiles").update({
        radar_scans_this_week: (profile.radar_scans_this_week || 0) + 1
      }).eq("id", userId);
      res.json({
        users: nearbyUsers,
        activities: nearbyActivities,
        scansUsed: (profile.radar_scans_this_week || 0) + 1,
        scansLimit: limit
      });
    } catch (error) {
      console.error("Radar scan error:", error);
      res.status(500).json({ error: "Failed to scan nearby users" });
    }
  });
  app2.post("/api/radar/toggle-visibility", async (req, res) => {
    try {
      const { userId, isVisible } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      const sb = getSupabase();
      await sb.from("user_profiles").update({ is_visible_on_radar: isVisible !== false }).eq("id", userId);
      res.json({ success: true, isVisible: isVisible !== false });
    } catch (error) {
      console.error("Toggle visibility error:", error);
      res.status(500).json({ error: "Failed to toggle visibility" });
    }
  });
  app2.post("/api/radar/chat-request", async (req, res) => {
    try {
      const { senderId, receiverId, senderName, senderPhoto, receiverName, receiverPhoto, message } = req.body;
      if (!senderId || !receiverId) {
        return res.status(400).json({ error: "senderId and receiverId are required" });
      }
      const id = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const nowStr = (/* @__PURE__ */ new Date()).toISOString();
      const sb = getSupabase();
      const { data: existing } = await sb.from("radar_chat_requests").select("id, status").or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`).in("status", ["pending", "accepted"]);
      if (existing && existing.length > 0) {
        const match = existing[0];
        if (match.status === "accepted") {
          return res.json({ alreadyConnected: true, requestId: match.id });
        }
        return res.json({ alreadyRequested: true, requestId: match.id });
      }
      const { error } = await sb.from("radar_chat_requests").insert({
        id,
        sender_id: senderId,
        receiver_id: receiverId,
        sender_name: senderName || "",
        sender_photo: senderPhoto || "",
        receiver_name: receiverName || "",
        receiver_photo: receiverPhoto || "",
        message: message || "",
        status: "pending",
        created_at: nowStr,
        updated_at: nowStr
      });
      if (error) throw error;
      res.json({ success: true, requestId: id });
    } catch (error) {
      console.error("Send chat request error:", error);
      res.status(500).json({ error: "Failed to send chat request" });
    }
  });
  app2.get("/api/radar/chat-requests/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const sb = getSupabase();
      const { data: received } = await sb.from("radar_chat_requests").select("*").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false });
      const { data: sent } = await sb.from("radar_chat_requests").select("*").eq("sender_id", userId).order("created_at", { ascending: false }).limit(20);
      res.json({ received: received || [], sent: sent || [] });
    } catch (error) {
      console.error("Get chat requests error:", error);
      res.json({ received: [], sent: [] });
    }
  });
  app2.post("/api/radar/chat-request/:requestId/respond", async (req, res) => {
    try {
      const { action } = req.body;
      if (!["accepted", "declined"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accepted' or 'declined'" });
      }
      const requestId = req.params.requestId;
      const sb = getSupabase();
      const { error } = await sb.from("radar_chat_requests").update({ status: action, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId);
      if (error) throw error;
      if (action === "accepted") {
        const { data: request } = await sb.from("radar_chat_requests").select("*").eq("id", requestId).single();
        if (request) {
          const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          await sb.from("matches").insert({
            id: matchId,
            user_a_id: request.sender_id,
            user_b_id: request.receiver_id,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      res.json({ success: true, status: action });
    } catch (error) {
      console.error("Respond to chat request error:", error);
      res.status(500).json({ error: "Failed to respond to chat request" });
    }
  });
  app2.get("/api/usage/:userId", async (req, res) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("user_profiles").select("*").eq("id", req.params.userId).single();
      if (error || !data) {
        return res.json({ compatibilityChecks: 0, radarScans: 0 });
      }
      const profile = data;
      if (shouldResetDaily(Number(profile.last_reset_timestamp) || 0)) {
        await sb.from("user_profiles").update({
          compatibility_checks_this_week: 0,
          radar_scans_this_week: 0,
          last_reset_timestamp: Date.now()
        }).eq("id", req.params.userId);
        return res.json({ compatibilityChecks: 0, radarScans: 0 });
      }
      res.json({
        compatibilityChecks: profile.compatibility_checks_this_week || 0,
        radarScans: profile.radar_scans_this_week || 0
      });
    } catch (error) {
      console.error("Get usage error:", error);
      res.json({ compatibilityChecks: 0, radarScans: 0 });
    }
  });
  app2.get("/api/verification/status/:userId", async (req, res) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("user_profiles").select("is_travel_verified, travel_badge").eq("id", req.params.userId).single();
      if (error || !data) {
        return res.json({ isVerified: false, badge: null });
      }
      res.json({
        isVerified: data.is_travel_verified || false,
        badge: data.travel_badge || null
      });
    } catch (error) {
      console.error("Get verification status error:", error);
      res.json({ isVerified: false, badge: null });
    }
  });
  app2.post("/api/verification/verify-travel", async (req, res) => {
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
        { role: "user", content: aiPrompt }
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
          coming_soon: "Advanced Nomad/Vanlifer AI verification will be added in the next release."
        };
      }
      const score = verificationResult.final_travel_score || 0;
      let badge = verificationResult.badge;
      let verdict = verificationResult.verdict;
      if (score >= 80) badge = "explorer";
      else if (score >= 60) badge = "adventurer";
      else if (score >= 40) badge = "nomad";
      else {
        badge = "none";
        verdict = "not_verified";
      }
      verificationResult.badge = badge;
      verificationResult.verdict = verdict;
      const sb = getSupabase();
      const verId = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await sb.from("travel_verification").insert({
        id: verId,
        user_id: userId,
        photo_url: photoUrl,
        secondary_photo_url: secondaryPhotoUrl || null,
        answer1,
        answer2,
        answer3: answer3 || null,
        status: verdict,
        badge_type: badge,
        reviewer_notes: verificationResult.reasons,
        submitted_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (verdict === "verified") {
        const { data: existingProfile } = await sb.from("user_profiles").select("id").eq("id", userId);
        if (existingProfile && existingProfile.length > 0) {
          await sb.from("user_profiles").update({
            is_travel_verified: true,
            travel_badge: badge,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userId);
        } else {
          await sb.from("user_profiles").insert({
            id: userId,
            is_travel_verified: true,
            travel_badge: badge,
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      res.json(verificationResult);
    } catch (error) {
      console.error("Travel verification error:", error);
      res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });
  app2.get("/api/discover/profiles/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID is required" });
      const sb = getSupabase();
      const { data: swipedData } = await sb.from("swipes").select("swiped_id").eq("swiper_id", userId);
      const swipedIds = (swipedData || []).map((s) => s.swiped_id);
      const { data: matchesA } = await sb.from("matches").select("user_b_id").eq("user_a_id", userId);
      const { data: matchesB } = await sb.from("matches").select("user_a_id").eq("user_b_id", userId);
      const matchedIds = [
        ...(matchesA || []).map((m) => m.user_b_id),
        ...(matchesB || []).map((m) => m.user_a_id)
      ];
      const excludeIds = /* @__PURE__ */ new Set([userId, ...swipedIds, ...matchedIds]);
      const { data: allProfiles, error } = await sb.from("user_profiles").select("*").neq("id", userId).not("name", "is", null).neq("name", "").order("id");
      if (error) throw error;
      let filtered = (allProfiles || []).filter((p) => !excludeIds.has(p.id));
      const realProfiles = filtered.filter((p) => !p.id.startsWith("mock_"));
      const mockProfiles = filtered.filter((p) => p.id.startsWith("mock_"));
      const realCount = realProfiles.length;
      if (realCount >= 15) {
        filtered = realProfiles;
      } else {
        filtered = [...realProfiles, ...mockProfiles];
      }
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      filtered = filtered.slice(0, 30);
      const profiles = filtered.map((row) => ({
        user: {
          id: row.id,
          email: row.email || "",
          name: row.name || "Nomad",
          age: row.age || 25,
          bio: row.bio || "",
          location: row.location || "On the road",
          photos: row.photos || [],
          interests: row.interests || [],
          vanType: row.van_type || void 0,
          travelStyle: row.travel_style || void 0,
          isTravelVerified: row.is_travel_verified || false,
          travelBadge: row.travel_badge || "none",
          createdAt: row.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          isMock: row.id.startsWith("mock_")
        },
        distance: Math.floor(Math.random() * 50) + 1
      }));
      res.json(profiles);
    } catch (error) {
      console.error("Discover profiles error:", error);
      res.json([]);
    }
  });
  app2.post("/api/swipes", async (req, res) => {
    try {
      const { swiperId, swipedId, direction } = req.body;
      if (!swiperId || !swipedId || !direction) {
        return res.status(400).json({ error: "swiperId, swipedId, and direction are required" });
      }
      const sb = getSupabase();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sb.from("swipes").upsert({
        swiper_id: swiperId,
        swiped_id: swipedId,
        direction,
        created_at: now
      }, { onConflict: "swiper_id,swiped_id" });
      const isMockProfile = swipedId.startsWith("mock_");
      let match = null;
      if (direction === "right" && isMockProfile) {
        const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const { data: existingMatchA } = await sb.from("matches").select("id").eq("user_a_id", swiperId).eq("user_b_id", swipedId);
        const { data: existingMatchB } = await sb.from("matches").select("id").eq("user_a_id", swipedId).eq("user_b_id", swiperId);
        const hasExistingMatch = existingMatchA && existingMatchA.length > 0 || existingMatchB && existingMatchB.length > 0;
        if (!hasExistingMatch) {
          await sb.from("matches").insert({
            id: matchId,
            user_a_id: swiperId,
            user_b_id: swipedId,
            created_at: now
          });
          const { data: mp } = await sb.from("user_profiles").select("*").eq("id", swipedId).single();
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
                vanType: mp.van_type || void 0,
                travelStyle: mp.travel_style || void 0,
                isTravelVerified: mp.is_travel_verified || false,
                travelBadge: mp.travel_badge || "none",
                createdAt: mp.created_at || (/* @__PURE__ */ new Date()).toISOString()
              },
              createdAt: now
            };
          }
        }
      } else if (direction === "right" && !isMockProfile) {
        const { data: reverseSwipe } = await sb.from("swipes").select("id").eq("swiper_id", swipedId).eq("swiped_id", swiperId).eq("direction", "right");
        if (reverseSwipe && reverseSwipe.length > 0) {
          const { data: existingMatchA } = await sb.from("matches").select("id").eq("user_a_id", swiperId).eq("user_b_id", swipedId);
          const { data: existingMatchB } = await sb.from("matches").select("id").eq("user_a_id", swipedId).eq("user_b_id", swiperId);
          const hasExistingMatch = existingMatchA && existingMatchA.length > 0 || existingMatchB && existingMatchB.length > 0;
          if (!hasExistingMatch) {
            const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await sb.from("matches").insert({
              id: matchId,
              user_a_id: swiperId,
              user_b_id: swipedId,
              created_at: now
            });
            const { data: mp } = await sb.from("user_profiles").select("*").eq("id", swipedId).single();
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
                  vanType: mp.van_type || void 0,
                  travelStyle: mp.travel_style || void 0,
                  isTravelVerified: mp.is_travel_verified || false,
                  travelBadge: mp.travel_badge || "none",
                  createdAt: mp.created_at || (/* @__PURE__ */ new Date()).toISOString()
                },
                createdAt: now
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
  app2.get("/api/matches/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID is required" });
      const sb = getSupabase();
      const { data: matchesA } = await sb.from("matches").select("id, user_a_id, user_b_id, created_at").eq("user_a_id", userId).order("created_at", { ascending: false });
      const { data: matchesB } = await sb.from("matches").select("id, user_a_id, user_b_id, created_at").eq("user_b_id", userId).order("created_at", { ascending: false });
      const allMatches = [...matchesA || [], ...matchesB || []].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const matchedUserIds = allMatches.map(
        (m) => m.user_a_id === userId ? m.user_b_id : m.user_a_id
      );
      let profilesMap = {};
      if (matchedUserIds.length > 0) {
        const { data: profiles } = await sb.from("user_profiles").select("*").in("id", matchedUserIds);
        if (profiles) {
          for (const p of profiles) {
            profilesMap[p.id] = p;
          }
        }
      }
      const matchList = allMatches.map((m) => {
        const matchedUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const row = profilesMap[matchedUserId] || {};
        return {
          id: m.id,
          matchedUserId,
          matchedUser: {
            id: matchedUserId,
            email: row.email || "",
            name: row.name || "Nomad",
            age: row.age || 25,
            bio: row.bio || "",
            location: row.location || "On the road",
            photos: row.photos || [],
            interests: row.interests || [],
            vanType: row.van_type || void 0,
            travelStyle: row.travel_style || void 0,
            isTravelVerified: row.is_travel_verified || false,
            travelBadge: row.travel_badge || "none",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          createdAt: m.created_at || (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      res.json(matchList);
    } catch (error) {
      console.error("Get matches error:", error);
      res.json([]);
    }
  });
  app2.get("/api/swipes/liked/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sb = getSupabase();
      const { data: swipes } = await sb.from("swipes").select("swiped_id, created_at").eq("swiper_id", userId).eq("direction", "right").order("created_at", { ascending: false });
      if (!swipes || swipes.length === 0) {
        return res.json([]);
      }
      const swipedIds = swipes.map((s) => s.swiped_id);
      const { data: matchesA } = await sb.from("matches").select("user_b_id").eq("user_a_id", userId);
      const { data: matchesB } = await sb.from("matches").select("user_a_id").eq("user_b_id", userId);
      const matchedIds = /* @__PURE__ */ new Set([
        ...(matchesA || []).map((m) => m.user_b_id),
        ...(matchesB || []).map((m) => m.user_a_id)
      ]);
      const filteredIds = swipedIds.filter((id) => !matchedIds.has(id));
      if (filteredIds.length === 0) {
        return res.json([]);
      }
      const { data: profiles } = await sb.from("user_profiles").select("*").in("id", filteredIds);
      const likedProfiles = (profiles || []).map((row) => ({
        id: row.id,
        email: row.email || "",
        name: row.name || "Nomad",
        age: row.age || 25,
        bio: row.bio || "",
        location: row.location || "On the road",
        photos: row.photos || [],
        interests: row.interests || [],
        vanType: row.van_type || void 0,
        travelStyle: row.travel_style || void 0,
        createdAt: row.created_at || (/* @__PURE__ */ new Date()).toISOString()
      }));
      res.json(likedProfiles);
    } catch (error) {
      console.error("Get liked profiles error:", error);
      res.json([]);
    }
  });
  app2.post("/api/seed/mock-swipes", async (req, res) => {
    try {
      const sb = getSupabase();
      const { data: mockIds } = await sb.from("user_profiles").select("id").like("id", "mock%");
      const { data: realIds } = await sb.from("user_profiles").select("id").not("id", "like", "mock%");
      if (!mockIds || mockIds.length === 0 || !realIds || realIds.length === 0) {
        return res.json({ message: "No mock or real profiles found", seeded: 0 });
      }
      let seeded = 0;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const mock of mockIds) {
        for (const real of realIds) {
          await sb.from("swipes").upsert({
            id: `seed_${mock.id}_${real.id}`,
            swiper_id: mock.id,
            swiped_id: real.id,
            direction: "right",
            created_at: now
          }, { onConflict: "swiper_id,swiped_id" });
          seeded++;
        }
      }
      res.json({ message: "Mock swipes seeded", seeded, mockCount: mockIds.length, realCount: realIds.length });
    } catch (error) {
      console.error("Seed mock swipes error:", error);
      res.status(500).json({ error: "Failed to seed mock swipes" });
    }
  });
  app2.post("/api/swipes/reset/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      const sb = getSupabase();
      await sb.from("swipes").delete().eq("swiper_id", userId);
      res.json({ message: "Swipes reset successfully" });
    } catch (error) {
      console.error("Reset swipes error:", error);
      res.status(500).json({ error: "Failed to reset swipes" });
    }
  });
  app2.post("/api/expert/apply", async (req, res) => {
    try {
      const {
        userId,
        resumeUrl,
        resumeText,
        portfolioUrls,
        specialization,
        experienceYears,
        skills,
        projectDescriptions,
        introVideoUrl,
        hourlyRate
      } = req.body;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      const sb = getSupabase();
      const { data: existing } = await sb.from("expert_applications").select("id, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      if (existing && existing.length > 0 && ["pending", "approved"].includes(existing[0].status)) {
        return res.status(400).json({ error: "You already have an active application", existing: existing[0] });
      }
      const { data: result, error } = await sb.from("expert_applications").insert({
        user_id: userId,
        resume_url: resumeUrl || null,
        resume_text: resumeText || null,
        portfolio_urls: portfolioUrls || [],
        specialization,
        experience_years: experienceYears,
        skills: skills || [],
        project_descriptions: projectDescriptions || [],
        intro_video_url: introVideoUrl || null,
        hourly_rate: hourlyRate,
        status: "pending"
      }).select().single();
      if (error) throw error;
      res.json({ application: result });
    } catch (error) {
      console.error("Expert apply error:", error);
      res.status(500).json({ error: "Failed to submit application" });
    }
  });
  app2.get("/api/expert/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sb = getSupabase();
      const { data } = await sb.from("expert_applications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      if (!data || data.length === 0) {
        return res.json({ application: null });
      }
      res.json({ application: data[0] });
    } catch (error) {
      console.error("Expert status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });
  app2.post("/api/expert/verify/:applicationId", async (req, res) => {
    try {
      const { applicationId } = req.params;
      const sb = getSupabase();
      const { data: appData, error: appError } = await sb.from("expert_applications").select("*").eq("id", applicationId).single();
      if (appError || !appData) {
        return res.status(404).json({ error: "Application not found" });
      }
      const application = appData;
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
- final_expert_score >= 80 \u2192 verdict "approved", badge "pro_expert"
- 60-79 \u2192 verdict "approved", badge "expert"
- 40-59 \u2192 verdict "manual_review", badge "none"
- below 40 \u2192 verdict "rejected", badge "none"`;
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
          portfolio_score: 50,
          resume_score: 50,
          skill_alignment_score: 50,
          experience_score: 50,
          final_expert_score: 50,
          verdict: "manual_review",
          badge: "none",
          reasons: ["AI could not parse response properly"],
          advice: "Your application needs manual review."
        };
      }
      const status = verification.verdict === "approved" ? "approved" : verification.verdict === "manual_review" ? "manual_review" : "rejected";
      const badge = verification.badge || "none";
      await sb.from("expert_applications").update({
        status,
        ai_score: verification.final_expert_score,
        expert_badge: badge,
        reasons: verification.reasons,
        advice: verification.advice,
        portfolio_score: verification.portfolio_score,
        resume_score: verification.resume_score,
        skill_alignment_score: verification.skill_alignment_score,
        experience_score: verification.experience_score
      }).eq("id", applicationId);
      if (status === "approved") {
        await sb.from("user_profiles").update({ is_expert: true, expert_badge: badge }).eq("id", application.user_id);
      }
      res.json({ verification, status, badge });
    } catch (error) {
      console.error("Expert verify error:", error);
      res.status(500).json({ error: "Failed to verify application" });
    }
  });
  app2.get("/api/experts", async (_req, res) => {
    try {
      const sb = getSupabase();
      const { data: expertApps, error } = await sb.from("expert_applications").select("*").eq("status", "approved").order("ai_score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      if (!expertApps || expertApps.length === 0) {
        return res.json({ experts: [] });
      }
      const userIds = expertApps.map((e) => e.user_id);
      const { data: profiles } = await sb.from("user_profiles").select("id, name, photos, location, expert_rating, reviews_count").in("id", userIds);
      const profilesMap = {};
      if (profiles) {
        for (const p of profiles) {
          profilesMap[p.id] = p;
        }
      }
      const experts = expertApps.map((ea) => ({
        ...ea,
        name: profilesMap[ea.user_id]?.name,
        photos: profilesMap[ea.user_id]?.photos,
        location: profilesMap[ea.user_id]?.location,
        expert_rating: profilesMap[ea.user_id]?.expert_rating,
        reviews_count: profilesMap[ea.user_id]?.reviews_count
      }));
      res.json({ experts });
    } catch (error) {
      console.error("List experts error:", error);
      res.json({ experts: [] });
    }
  });
  app2.post("/api/consultations/book", async (req, res) => {
    try {
      const { userId, expertId, expertApplicationId, hourlyRate, durationMinutes, notes, transactionId } = req.body;
      if (!userId || !expertId) return res.status(400).json({ error: "User ID and Expert ID required" });
      const duration = durationMinutes || 60;
      const rate = hourlyRate || 0;
      const totalAmount = rate / 60 * duration;
      const platformFee = totalAmount * 0.3;
      const sb = getSupabase();
      const { data: result, error } = await sb.from("consultation_bookings").insert({
        user_id: userId,
        expert_id: expertId,
        expert_application_id: expertApplicationId || null,
        hourly_rate: rate,
        duration_minutes: duration,
        total_amount: totalAmount,
        platform_fee: platformFee,
        payment_status: transactionId ? "completed" : "pending",
        revenuecat_transaction_id: transactionId || null,
        notes: notes || null,
        status: "confirmed"
      }).select().single();
      if (error) throw error;
      res.json({ booking: result });
    } catch (error) {
      console.error("Book consultation error:", error);
      res.status(500).json({ error: "Failed to book consultation" });
    }
  });
  app2.get("/api/consultations/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sb = getSupabase();
      const { data: bookings, error } = await sb.from("consultation_bookings").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      if (!bookings || bookings.length === 0) {
        return res.json({ bookings: [] });
      }
      const expertIds = [...new Set(bookings.map((b) => b.expert_id))];
      const appIds = bookings.map((b) => b.expert_application_id).filter(Boolean);
      const { data: expertProfiles } = await sb.from("user_profiles").select("id, name, photos").in("id", expertIds);
      let appsMap = {};
      if (appIds.length > 0) {
        const { data: apps } = await sb.from("expert_applications").select("id, specialization").in("id", appIds);
        if (apps) {
          for (const a of apps) {
            appsMap[a.id] = a;
          }
        }
      }
      const profilesMap = {};
      if (expertProfiles) {
        for (const p of expertProfiles) {
          profilesMap[p.id] = p;
        }
      }
      const enrichedBookings = bookings.map((cb) => ({
        ...cb,
        expert_name: profilesMap[cb.expert_id]?.name,
        expert_photos: profilesMap[cb.expert_id]?.photos,
        specialization: cb.expert_application_id ? appsMap[cb.expert_application_id]?.specialization : void 0
      }));
      res.json({ bookings: enrichedBookings });
    } catch (error) {
      console.error("List consultations error:", error);
      res.json({ bookings: [] });
    }
  });
  app2.get("/api/consultations/expert/:expertId", async (req, res) => {
    try {
      const { expertId } = req.params;
      const sb = getSupabase();
      const { data: bookings, error } = await sb.from("consultation_bookings").select("*").eq("expert_id", expertId).order("created_at", { ascending: false });
      if (error) throw error;
      if (!bookings || bookings.length === 0) {
        return res.json({ bookings: [] });
      }
      const clientIds = [...new Set(bookings.map((b) => b.user_id))];
      const { data: clientProfiles } = await sb.from("user_profiles").select("id, name, photos").in("id", clientIds);
      const profilesMap = {};
      if (clientProfiles) {
        for (const p of clientProfiles) {
          profilesMap[p.id] = p;
        }
      }
      const enrichedBookings = bookings.map((cb) => ({
        ...cb,
        client_name: profilesMap[cb.user_id]?.name,
        client_photos: profilesMap[cb.user_id]?.photos
      }));
      res.json({ bookings: enrichedBookings });
    } catch (error) {
      console.error("List expert consultations error:", error);
      res.json({ bookings: [] });
    }
  });
  app2.patch("/api/consultations/:bookingId/payment", async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { transactionId, paymentStatus } = req.body;
      const sb = getSupabase();
      const { data, error } = await sb.from("consultation_bookings").update({
        payment_status: paymentStatus || "completed",
        revenuecat_transaction_id: transactionId || null
      }).eq("id", bookingId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Booking not found" });
        }
        throw error;
      }
      res.json({ booking: data });
    } catch (error) {
      console.error("Update consultation payment error:", error);
      res.status(500).json({ error: "Failed to update payment" });
    }
  });
  app2.get("/api/messages/:matchId", async (req, res) => {
    const { matchId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("chat_messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Failed to get messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });
  app2.post("/api/messages/:matchId", async (req, res) => {
    const { matchId } = req.params;
    const { senderId, content, type, photoUrl, fileUrl, fileName, audioUrl, audioDuration, replyTo, location } = req.body;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("chat_messages").insert({
        id: msgId,
        match_id: matchId,
        sender_id: senderId,
        content: content || "",
        type: type || "text",
        photo_url: photoUrl || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        audio_url: audioUrl || null,
        audio_duration: audioDuration || null,
        reply_to: replyTo || null,
        location: location || null,
        reactions: {},
        status: "sent",
        created_at: now
      }).select().single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.patch("/api/messages/:messageId", async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("chat_messages").update({ content, edited_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", messageId).select().single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw error;
      }
      res.json(data);
    } catch (error) {
      console.error("Failed to edit message:", error);
      res.status(500).json({ error: "Failed to edit message" });
    }
  });
  app2.delete("/api/messages/:messageId", async (req, res) => {
    const { messageId } = req.params;
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("chat_messages").delete().eq("id", messageId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  app2.patch("/api/messages/:messageId/reactions", async (req, res) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      return res.status(400).json({ error: "userId and emoji are required" });
    }
    try {
      const sb = getSupabase();
      const { data: msgData, error: getError } = await sb.from("chat_messages").select("reactions").eq("id", messageId).single();
      if (getError) {
        if (getError.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw getError;
      }
      const reactions = msgData.reactions || {};
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
      const { error: updateError } = await sb.from("chat_messages").update({ reactions }).eq("id", messageId);
      if (updateError) throw updateError;
      res.json({ id: messageId, reactions });
    } catch (error) {
      console.error("Failed to toggle reaction:", error);
      res.status(500).json({ error: "Failed to toggle reaction" });
    }
  });
  app2.get("/api/forum/posts", async (_req, res) => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("forum_posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Failed to get forum posts:", error);
      res.status(500).json({ error: "Failed to get forum posts" });
    }
  });
  app2.post("/api/forum/posts", async (req, res) => {
    const { authorId, authorData, title, content, category } = req.body;
    if (!authorId || !title) {
      return res.status(400).json({ error: "authorId and title are required" });
    }
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("forum_posts").insert({
        id: postId,
        author_id: authorId,
        author_data: authorData || null,
        title,
        content: content || "",
        category: category || "general",
        upvotes: 0,
        upvoted_by: [],
        comment_count: 0,
        created_at: now,
        updated_at: now
      }).select().single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      console.error("Failed to create forum post:", error);
      res.status(500).json({ error: "Failed to create forum post" });
    }
  });
  app2.post("/api/forum/posts/:postId/upvote", async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: post, error: getError } = await sb.from("forum_posts").select("upvotes, upvoted_by").eq("id", postId).single();
      if (getError) {
        if (getError.code === "PGRST116") {
          return res.status(404).json({ error: "Post not found" });
        }
        throw getError;
      }
      const upvotedBy = post.upvoted_by || [];
      let newUpvotes = post.upvotes || 0;
      if (upvotedBy.includes(userId)) {
        const idx = upvotedBy.indexOf(userId);
        upvotedBy.splice(idx, 1);
        newUpvotes = Math.max(0, newUpvotes - 1);
      } else {
        upvotedBy.push(userId);
        newUpvotes += 1;
      }
      const { data, error: updateError } = await sb.from("forum_posts").update({
        upvotes: newUpvotes,
        upvoted_by: upvotedBy,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", postId).select().single();
      if (updateError) throw updateError;
      res.json(data);
    } catch (error) {
      console.error("Failed to upvote post:", error);
      res.status(500).json({ error: "Failed to upvote post" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
