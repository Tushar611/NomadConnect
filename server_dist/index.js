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
      from: "ExploreX <onboarding@resend.dev>",
      to: toEmail,
      subject: "Your ExploreX Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #E8744F;">Password Reset</h2>
          <p>You requested to reset your password for ExploreX.</p>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">ExploreX - Connect with fellow travelers</p>
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
import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import multer from "multer";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

// server/security.ts
function getClientIp(req) {
  const header = req.headers["x-forwarded-for"];
  const first = Array.isArray(header) ? header[0] : header;
  if (typeof first === "string" && first.length > 0) {
    return first.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
function createRateLimiter(options) {
  const buckets = /* @__PURE__ */ new Map();
  const windowMs = Math.max(1e3, options.windowMs);
  const max = Math.max(1, options.max);
  const keyGenerator = options.keyGenerator || ((req) => getClientIp(req));
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(windowMs, 6e4)).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1e3)));
      return next();
    }
    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1e3));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1e3)));
      return res.status(429).json({
        error: options.message || "Too many requests. Please try again later."
      });
    }
    existing.count += 1;
    buckets.set(key, existing);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - existing.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1e3)));
    next();
  };
}

// server/routes.ts
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
var supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
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
var authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  max: 25,
  message: "Too many auth attempts. Please try again in 15 minutes."
});
var passwordResetRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1e3,
  max: 8,
  message: "Too many password reset attempts. Please wait and try again."
});
var feedbackRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1e3,
  max: 6,
  message: "Too many feedback submissions. Please wait before trying again."
});
var otpStore = /* @__PURE__ */ new Map();
var loginFailureStore = /* @__PURE__ */ new Map();
function sleep(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isStrongPassword(password) {
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}
function getAuthAttemptKey(req, email) {
  const fwd = req.headers["x-forwarded-for"];
  const ipRaw = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = typeof ipRaw === "string" && ipRaw ? ipRaw.split(",")[0].trim() : req.ip || "unknown";
  return `${email}::${ip}`;
}
function getLockState(key) {
  const now = Date.now();
  const state = loginFailureStore.get(key);
  if (!state || !state.lockUntil) return { locked: false, remainingMs: 0 };
  if (state.lockUntil <= now) {
    loginFailureStore.delete(key);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: state.lockUntil - now };
}
function recordFailedLogin(key) {
  const now = Date.now();
  const state = loginFailureStore.get(key) || { attempts: 0 };
  state.attempts += 1;
  if (state.attempts >= 8) {
    state.lockUntil = now + 15 * 60 * 1e3;
    state.attempts = 0;
  }
  loginFailureStore.set(key, state);
}
function clearFailedLogins(key) {
  loginFailureStore.delete(key);
}
var SESSION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function getSessionSecret() {
  return process.env.SESSION_SECRET || "";
}
function base64UrlEncode(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}
function base64UrlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function createSessionToken(userId) {
  const secret = getSessionSecret();
  if (!secret) return "";
  const payload = {
    userId,
    exp: Date.now() + SESSION_TOKEN_TTL_MS,
    nonce: randomBytes(8).toString("hex")
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifySessionToken(token) {
  const secret = getSessionSecret();
  if (!secret || !token) return { valid: false };
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return { valid: false };
  const expected = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false };
  }
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.userId || !payload?.exp || payload.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, userId: String(payload.userId) };
  } catch {
    return { valid: false };
  }
}
function extractBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}
function requireUserSession(selector) {
  return (req, res, next) => {
    const raw = selector(req);
    const expectedUserId = Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
    if (!expectedUserId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const token = extractBearerToken(req);
    const verified = verifySessionToken(token);
    if (!verified.valid || !verified.userId || verified.userId !== expectedUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
}
var groqApiKey = process.env.GROQ_API_KEY || "";
var pgPool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : void 0
}) : null;
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}
function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const digest = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (digest.length !== keyBuffer.length) return false;
  return timingSafeEqual(digest, keyBuffer);
}
async function ensureAuthTables() {
  if (!pgPool) {
    console.log("[DB] DATABASE_URL missing - custom auth disabled");
    return;
  }
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
var uploadsRootDir = path.resolve(process.cwd(), "uploads");
function ensureUploadsDir() {
  if (!fs.existsSync(uploadsRootDir)) {
    fs.mkdirSync(uploadsRootDir, { recursive: true });
  }
}
function sanitizeCategory(value) {
  const category = String(value || "file").toLowerCase();
  if (category === "photo" || category === "audio") return category;
  return "file";
}
var VALID_INTENT_MODES = [
  "coffee_now",
  "explore_city",
  "adventure_partner",
  "deep_talk"
];
var INTENT_CHAT_PROMPTS = {
  coffee_now: [
    "Best nearby coffee place in the next 30 minutes?",
    "What drink are you ordering first?",
    "Want to do a quick 20-min coffee and walk?"
  ],
  explore_city: [
    "One hidden spot in this city you love?",
    "Sunset point or street-food lane first?",
    "What neighborhood should we explore together?"
  ],
  adventure_partner: [
    "Hike, surf, or road trip this weekend?",
    "What gear do you always carry for adventures?",
    "Want to plan a short micro-adventure for tomorrow?"
  ],
  deep_talk: [
    "What changed your perspective recently?",
    "What does a meaningful connection look like to you?",
    "What kind of conversations do you wish people had more often?"
  ]
};
function normalizeIntentMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (VALID_INTENT_MODES.includes(raw)) {
    return raw;
  }
  return "explore_city";
}
function getDayKey(date = /* @__PURE__ */ new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function computeTrustScore(input) {
  let score = 10;
  if (input.isTravelVerified) score += 35;
  const photos = Array.isArray(input.photos) ? input.photos.length : 0;
  const interests = Array.isArray(input.interests) ? input.interests.length : 0;
  const bioLen = String(input.bio || "").trim().length;
  if (photos >= 1) score += 10;
  if (photos >= 3) score += 10;
  if (interests >= 3) score += 10;
  if (bioLen >= 40) score += 10;
  const meetups = Math.max(0, Number(input.meetupCount || 0));
  score += Math.min(15, meetups * 3);
  return Math.max(0, Math.min(100, score));
}
async function ensureExploreXTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explorex_intents (
      user_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'explore_city',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explorex_plan_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      city TEXT,
      starts_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explorex_meetups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      venue_name TEXT,
      venue_address TEXT,
      midpoint_lat DOUBLE PRECISION,
      midpoint_lng DOUBLE PRECISION,
      status TEXT DEFAULT 'planned',
      scheduled_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explorex_journey_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      city TEXT,
      met_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS explorex_daily_serendipity (
      user_id TEXT NOT NULL,
      day_key TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, day_key)
    );
  `);
}
async function ensureSocialTables() {
  if (!pgPool) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS swipes (
      id TEXT PRIMARY KEY,
      swiper_id TEXT NOT NULL,
      swiped_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(swiper_id, swiped_id)
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_a_id, user_b_id)
    );
  `);
  await pgPool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_a_id TEXT;`);
  await pgPool.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_b_id TEXT;`);
  await pgPool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'matches' AND column_name = 'user_a'
      ) THEN
        UPDATE matches
        SET user_a_id = COALESCE(user_a_id, user_a)
        WHERE user_a_id IS NULL;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'matches' AND column_name = 'user_b'
      ) THEN
        UPDATE matches
        SET user_b_id = COALESCE(user_b_id, user_b)
        WHERE user_b_id IS NULL;
      END IF;
    END $$;
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'text',
      photo_url TEXT,
      file_url TEXT,
      file_name TEXT,
      audio_url TEXT,
      audio_duration DOUBLE PRECISION,
      reply_to JSONB,
      location JSONB,
      reactions JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'sent',
      created_at TIMESTAMP DEFAULT NOW(),
      edited_at TIMESTAMP
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_locations (
      user_id TEXT PRIMARY KEY,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS radar_chat_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      sender_name TEXT,
      sender_photo TEXT,
      receiver_name TEXT,
      receiver_photo TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS compatibility_history (
      id TEXT PRIMARY KEY,
      user_a TEXT NOT NULL,
      user_b TEXT NOT NULL,
      score INTEGER,
      strengths JSONB,
      conflicts JSONB,
      icebreakers JSONB,
      first_message TEXT,
      date_idea TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes(swiped_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_matches_usera ON matches(user_a_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_matches_userb ON matches(user_b_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_match ON chat_messages(match_id);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_user_locations_updated ON user_locations(updated_at DESC);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_radar_requests_receiver ON radar_chat_requests(receiver_id, status, created_at DESC);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_radar_requests_sender ON radar_chat_requests(sender_id, created_at DESC);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_compat_a ON compatibility_history(user_a, created_at DESC);`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_compat_b ON compatibility_history(user_b, created_at DESC);`);
}
async function loadExploreXMetaForUsers(userIds) {
  if (!pgPool || userIds.length === 0) {
    return { intentByUser: {}, planByUser: {}, meetupCountByUser: {} };
  }
  const uniqueIds = Array.from(new Set(userIds));
  const [intentRes, planRes, meetupRes] = await Promise.all([
    pgPool.query(
      `SELECT user_id, mode FROM explorex_intents WHERE user_id = ANY($1::text[])`,
      [uniqueIds]
    ),
    pgPool.query(
      `SELECT DISTINCT ON (user_id) user_id, id, title, city, starts_at, expires_at, is_active, updated_at
       FROM explorex_plan_cards
       WHERE user_id = ANY($1::text[]) AND is_active = TRUE
       ORDER BY user_id, updated_at DESC`,
      [uniqueIds]
    ),
    pgPool.query(
      `SELECT uid AS user_id, COUNT(*)::int AS count FROM (
          SELECT user_a_id AS uid FROM explorex_meetups WHERE status = 'completed' AND user_a_id = ANY($1::text[])
          UNION ALL
          SELECT user_b_id AS uid FROM explorex_meetups WHERE status = 'completed' AND user_b_id = ANY($1::text[])
       ) t
       GROUP BY uid`,
      [uniqueIds]
    )
  ]);
  const intentByUser = {};
  for (const row of intentRes.rows) {
    intentByUser[row.user_id] = normalizeIntentMode(row.mode);
  }
  const planByUser = {};
  for (const row of planRes.rows) {
    planByUser[row.user_id] = {
      id: row.id,
      title: row.title,
      city: row.city || void 0,
      startsAt: row.starts_at || void 0,
      expiresAt: row.expires_at || void 0,
      isActive: row.is_active
    };
  }
  const meetupCountByUser = {};
  for (const row of meetupRes.rows) {
    meetupCountByUser[row.user_id] = Number(row.count || 0);
  }
  return { intentByUser, planByUser, meetupCountByUser };
}
function addExploreXProfileFields(profile, meta) {
  const userId = String(profile.id || "");
  const meetupCount = Number(meta.meetupCountByUser[userId] || 0);
  const trustScore = computeTrustScore({
    isTravelVerified: Boolean(profile.is_travel_verified ?? profile.isTravelVerified),
    photos: profile.photos,
    interests: profile.interests,
    bio: profile.bio,
    meetupCount
  });
  return {
    ...profile,
    intent_mode: meta.intentByUser[userId] || "explore_city",
    active_plan: meta.planByUser[userId] || null,
    meetup_count: meetupCount,
    trust_score: trustScore
  };
}
var VAN_BUILD_SYSTEM_PROMPT = `You are an expert van conversion advisor for the ExploreX app. You help van lifers and nomads with:
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
  ensureAuthTables().catch((err) => console.error("[DB] Auth table setup failed:", err));
  ensureExploreXTables().catch((err) => console.error("[DB] ExploreX table setup failed:", err));
  ensureSocialTables().catch((err) => console.error("[DB] Social table setup failed:", err));
  ensureUploadsDir();
  const uploadStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRootDir),
    filename: (req, file, cb) => {
      const category = sanitizeCategory(req.body?.category);
      const ext = path.extname(file.originalname || "") || "";
      const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
      const unique = `${category}_${Date.now()}_${randomBytes(4).toString("hex")}${safeExt}`;
      cb(null, unique);
    }
  });
  const uploadMiddleware = multer({
    storage: uploadStorage,
    limits: { fileSize: 25 * 1024 * 1024 }
  });
  app2.post("/api/uploads", uploadMiddleware.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }
      const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
      const isAbsolute = host.length > 0;
      const relativeUrl = `/uploads/${req.file.filename}`;
      const url = isAbsolute ? `${proto}://${host}${relativeUrl}` : relativeUrl;
      return res.json({
        success: true,
        url,
        fileName: req.file.originalname,
        fileType: req.file.mimetype || "application/octet-stream",
        size: req.file.size
      });
    } catch (error) {
      console.error("Upload failed:", error);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
  app2.post("/api/auth/signup", authRateLimit, async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const name = String(req.body?.name || "").trim();
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Name, email and password are required" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Please enter a valid email" });
      }
      if (!isStrongPassword(password)) {
        return res.status(400).json({ error: "Password must be at least 8 chars and include uppercase, lowercase, number, and symbol" });
      }
      const existing = await pgPool.query("SELECT id FROM app_users WHERE email = $1 LIMIT 1", [email]);
      if (existing.rowCount) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = hashPassword(password);
      const created = await pgPool.query(
        `INSERT INTO app_users (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, created_at`,
        [email, passwordHash, name]
      );
      const user = created.rows[0];
      const profilePayload = {
        id: user.id,
        email: user.email,
        name: user.name || name,
        age: 25,
        bio: "",
        location: "",
        photos: [],
        interests: []
      };
      await pgPool.query(
        `INSERT INTO user_profiles (id, email, name, age, bio, location, photos, interests, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             age = EXCLUDED.age,
             bio = EXCLUDED.bio,
             location = EXCLUDED.location,
             photos = EXCLUDED.photos,
             interests = EXCLUDED.interests,
             updated_at = NOW()`,
        [
          profilePayload.id,
          profilePayload.email,
          profilePayload.name,
          profilePayload.age,
          profilePayload.bio,
          profilePayload.location,
          JSON.stringify(profilePayload.photos),
          JSON.stringify(profilePayload.interests)
        ]
      );
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name || name,
          createdAt: user.created_at
        },
        sessionToken: createSessionToken(String(user.id))
      });
    } catch (error) {
      console.error("Signup failed:", error);
      return res.status(500).json({ error: "Signup failed" });
    }
  });
  app2.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const authKey = getAuthAttemptKey(req, email);
      const lock = getLockState(authKey);
      if (lock.locked) {
        await sleep(300 + Math.floor(Math.random() * 200));
        return res.status(429).json({ error: "Too many login attempts. Please try again later." });
      }
      const result = await pgPool.query(
        "SELECT id, email, name, password_hash, created_at FROM app_users WHERE email = $1 LIMIT 1",
        [email]
      );
      const row = result.rowCount ? result.rows[0] : null;
      const passwordOk = row ? verifyPassword(password, row.password_hash) : false;
      if (!passwordOk) {
        recordFailedLogin(authKey);
        await sleep(300 + Math.floor(Math.random() * 200));
        return res.status(401).json({ error: "Invalid credentials" });
      }
      clearFailedLogins(authKey);
      return res.json({
        user: {
          id: row.id,
          email: row.email,
          name: row.name || row.email.split("@")[0],
          createdAt: row.created_at
        },
        sessionToken: createSessionToken(String(row.id))
      });
    } catch (error) {
      console.error("Login failed:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });
  app2.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "nomad-connect-api" });
  });
  const AI_ADVISOR_ENABLED = process.env.ENABLE_AI_ADVISOR === "true";
  app2.get("/api/ai/ping", async (_req, res) => {
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
    try {
      const reply = await callGroqChat([{ role: "user", content: "ping" }]);
      res.json({ ok: true, response: reply });
    } catch (error) {
      console.error("AI ping error:", error);
      res.status(500).json({ ok: false, error: "Failed to ping AI", detail: error?.message });
    }
  });
  app2.get("/api/ai/chat", (_req, res) => {
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
    res.status(405).json({ error: "Use POST /api/ai/chat with { messages: [...] }" });
  });
  app2.post("/api/ai/chat", async (req, res) => {
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
    res.status(501).json({ error: "Photo analysis is not available in this build." });
  });
  app2.post("/api/ai/estimate-cost", async (req, res) => {
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
    res.status(501).json({ error: "Image generation is not available in this build." });
  });
  app2.get("/api/ai/sessions/:userId", async (req, res) => {
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
    if (!AI_ADVISOR_ENABLED) {
      return res.status(410).json({ error: "AI Advisor is disabled in this build." });
    }
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
  app2.post("/api/activities", requireUserSession((req) => req.body?.user?.id), async (req, res) => {
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
  app2.post("/api/activities/:activityId/join", requireUserSession((req) => req.body?.user?.id), async (req, res) => {
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
  app2.delete("/api/activities/:activityId", requireUserSession((req) => req.body?.userId), async (req, res) => {
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
  app2.get("/api/activities/:activityId/messages", requireUserSession((req) => req.query.userId), async (req, res) => {
    const { activityId } = req.params;
    const userId = Array.isArray(req.query.userId) ? String(req.query.userId[0] || "") : String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id, attendee_ids").eq("id", activityId).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const attendeeIds = Array.isArray(activityRow.attendee_ids) ? activityRow.attendee_ids : [];
      if (String(activityRow.host_id) !== userId && !attendeeIds.includes(userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.post("/api/activities/:activityId/messages", requireUserSession((req) => req.body?.senderId), async (req, res) => {
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
        activityId: String(activityId),
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
  app2.patch("/api/activities/:activityId/messages/:messageId/pin", requireUserSession((req) => req.body?.userId), async (req, res) => {
    const { activityId, messageId } = req.params;
    const { userId, pin } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: modRows, error: modErr } = await sb.from("activity_moderators").select("id").eq("activity_id", activityId).eq("user_id", userId).limit(1);
      if (modErr) throw modErr;
      if (!modRows || modRows.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.put("/api/activities/:activityId/messages/:messageId", requireUserSession((req) => req.body?.userId), async (req, res) => {
    const { messageId } = req.params;
    const { content, userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: ownerRow, error: ownerErr } = await sb.from("activity_chat_messages").select("sender_id").eq("id", messageId).single();
      if (ownerErr) {
        if (ownerErr.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw ownerErr;
      }
      if (String(ownerRow?.sender_id || "") !== String(userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.post("/api/activities/:activityId/messages/:messageId/react", requireUserSession((req) => req.body?.userId), async (req, res) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      return res.status(400).json({ error: "userId and emoji are required" });
    }
    try {
      const sb = getSupabase();
      const { data: msgData, error: getError } = await sb.from("activity_chat_messages").select("reactions, activity_id").eq("id", messageId).single();
      if (getError) {
        if (getError.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw getError;
      }
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id, attendee_ids").eq("id", msgData.activity_id).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const attendeeIds = Array.isArray(activityRow.attendee_ids) ? activityRow.attendee_ids : [];
      const isMember = String(activityRow.host_id) === String(userId) || attendeeIds.includes(String(userId));
      if (!isMember) {
        return res.status(403).json({ error: "Forbidden" });
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
  app2.delete("/api/activities/:activityId/messages/:messageId", requireUserSession((req) => req.query.userId), async (req, res) => {
    const { activityId, messageId } = req.params;
    const userId = Array.isArray(req.query.userId) ? String(req.query.userId[0] || "") : String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: msgRow, error: msgErr } = await sb.from("activity_chat_messages").select("sender_id").eq("id", messageId).single();
      if (msgErr) {
        if (msgErr.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw msgErr;
      }
      let canDelete = String(msgRow?.sender_id || "") === userId;
      if (!canDelete) {
        const { data: modRows, error: modErr } = await sb.from("activity_moderators").select("id").eq("activity_id", activityId).eq("user_id", userId).limit(1);
        if (modErr) throw modErr;
        canDelete = !!(modRows && modRows.length > 0);
      }
      if (!canDelete) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.get("/api/activities/:activityId/moderators", requireUserSession((req) => req.query.userId), async (req, res) => {
    const { activityId } = req.params;
    const userId = Array.isArray(req.query.userId) ? String(req.query.userId[0] || "") : String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id, attendee_ids").eq("id", activityId).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const attendeeIds = Array.isArray(activityRow.attendee_ids) ? activityRow.attendee_ids : [];
      if (String(activityRow.host_id) !== userId && !attendeeIds.includes(userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.post("/api/activities/:activityId/moderators", requireUserSession((req) => req.body?.requesterId), async (req, res) => {
    const { activityId } = req.params;
    const { requesterId, userId, isHost } = req.body;
    if (!requesterId || !userId) {
      return res.status(400).json({ error: "requesterId and userId are required" });
    }
    try {
      const sb = getSupabase();
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id").eq("id", activityId).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (String(activityRow.host_id) !== String(requesterId)) {
        return res.status(403).json({ error: "Only host can manage moderators" });
      }
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
  app2.delete("/api/activities/:activityId/moderators/:userId", requireUserSession((req) => req.query.requesterId), async (req, res) => {
    const { activityId, userId } = req.params;
    const requesterId = Array.isArray(req.query.requesterId) ? String(req.query.requesterId[0] || "") : String(req.query.requesterId || "");
    if (!requesterId) {
      return res.status(400).json({ error: "requesterId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id").eq("id", activityId).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (String(activityRow.host_id) !== String(requesterId)) {
        return res.status(403).json({ error: "Only host can manage moderators" });
      }
      const { error } = await sb.from("activity_moderators").delete().eq("activity_id", activityId).eq("user_id", userId).eq("is_host", false);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove moderator:", error);
      res.status(500).json({ error: "Failed to remove moderator" });
    }
  });
  app2.post("/api/activities/:activityId/init-chat", requireUserSession((req) => req.body?.hostId), async (req, res) => {
    const { activityId } = req.params;
    const { hostId } = req.body;
    if (!hostId) {
      return res.status(400).json({ error: "hostId is required" });
    }
    try {
      const sb = getSupabase();
      const { data: activityRow, error: activityErr } = await sb.from("activities").select("host_id").eq("id", activityId).single();
      if (activityErr || !activityRow) {
        return res.status(404).json({ error: "Activity not found" });
      }
      if (String(activityRow.host_id) !== String(hostId)) {
        return res.status(403).json({ error: "Only host can initialize chat" });
      }
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
                  from_name: "ExploreX SOS",
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
  app2.post("/api/feedback", feedbackRateLimit, async (req, res) => {
    const supportEmail = "nomadconnect611@gmail.com";
    try {
      const { userId, userName, userEmail, message, app: appName } = req.body || {};
      const cleanedMessage = String(message || "").trim();
      if (!cleanedMessage) {
        return res.status(400).json({ error: "Feedback message is required" });
      }
      const subject = `[${appName || "ExploreX"}] User Feedback`;
      const body = [
        `User ID: ${userId || "unknown"}`,
        `Name: ${userName || "unknown"}`,
        `Email: ${userEmail || "unknown"}`,
        "",
        "Message:",
        cleanedMessage
      ].join("\n");
      let sent = false;
      const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
      const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
      const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
      const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;
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
                to_email: supportEmail,
                to_name: "ExploreX Support",
                from_name: userName || "ExploreX User",
                from_email: userEmail || "no-reply@explorex.app",
                subject,
                message: body
              }
            })
          });
          sent = emailResponse.ok;
          if (!sent) {
            const emailError = await emailResponse.text();
            console.error("[feedback] EmailJS failed:", emailError);
          }
        } catch (emailJsError) {
          console.error("[feedback] EmailJS request failed:", emailJsError);
        }
      }
      if (!sent && process.env.RESEND_API_KEY) {
        try {
          const { Resend: Resend2 } = await import("resend");
          const resend = new Resend2(process.env.RESEND_API_KEY);
          const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "ExploreX <onboarding@resend.dev>",
            to: supportEmail,
            subject,
            text: body
          });
          sent = !error;
          if (error) {
            console.error("[feedback] Resend API failed:", error);
          }
        } catch (resendError) {
          console.error("[feedback] Resend API request failed:", resendError);
        }
      }
      if (!sent) {
        try {
          const { getResendClient: getResendClient2 } = await Promise.resolve().then(() => (init_resend(), resend_exports));
          const { client, fromEmail } = await getResendClient2();
          const { error } = await client.emails.send({
            from: `ExploreX <${fromEmail}>`,
            to: supportEmail,
            subject,
            text: body
          });
          sent = !error;
          if (error) {
            console.error("[feedback] Replit Resend connector failed:", error);
          }
        } catch (connectorError) {
          console.error("[feedback] Resend connector unavailable:", connectorError);
        }
      }
      if (!sent) {
        return res.status(500).json({ error: "Failed to deliver feedback email" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });
  app2.post("/api/password-reset/send-otp", passwordResetRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: "Please enter a valid email" });
      }
      let hasAccount = true;
      if (pgPool) {
        const existsRes = await pgPool.query("SELECT 1 FROM app_users WHERE email = $1 LIMIT 1", [normalizedEmail]);
        hasAccount = Number(existsRes.rowCount || 0) > 0;
      }
      const code = Math.floor(1e5 + Math.random() * 9e5).toString();
      if (hasAccount) {
        otpStore.set(normalizedEmail, {
          email: normalizedEmail,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1e3),
          used: false
        });
      }
      let emailSent = !hasAccount;
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
                from_name: "ExploreX"
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
        return res.status(500).json({ error: "Failed to process request" });
      }
      res.json({
        success: true,
        message: "If an account exists for this email, a code has been sent."
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });
  app2.post("/api/password-reset/verify-otp", passwordResetRateLimit, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const storedOtp = otpStore.get(normalizedEmail);
      if (!storedOtp) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      if (storedOtp.expiresAt < /* @__PURE__ */ new Date()) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      if (storedOtp.used) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      if (storedOtp.code !== code.trim()) {
        return res.status(400).json({ error: "Invalid or expired code" });
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
  app2.post("/api/password-reset/update-password", passwordResetRateLimit, async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
        return res.status(400).json({ error: "Email and new password are required" });
      }
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: "Password must be at least 8 chars and include uppercase, lowercase, number, and symbol" });
      }
      const normalizedEmail = normalizeEmail(email);
      const verifiedEntry = otpStore.get(normalizedEmail);
      if (!verifiedEntry || verifiedEntry.used) {
        return res.status(400).json({ error: "Please verify your code first" });
      }
      if (/* @__PURE__ */ new Date() > verifiedEntry.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ error: "Session expired. Please start over." });
      }
      if (!pgPool) {
        return res.status(500).json({ error: "Database is not configured" });
      }
      const nextHash = hashPassword(newPassword);
      const result = await pgPool.query(
        "UPDATE app_users SET password_hash = $1 WHERE email = $2 RETURNING id",
        [nextHash, normalizedEmail]
      );
      if (!result.rowCount) {
        otpStore.delete(normalizedEmail);
        return res.json({ success: true, message: "Password updated successfully" });
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
  app2.post("/api/user-profiles/upsert", requireUserSession((req) => String(req.body?.id || "")), async (req, res) => {
    try {
      const { id, name, age, bio, interests, photos, location, intentMode, activePlan } = req.body;
      if (!id) return res.status(400).json({ error: "User ID is required" });
      if (pgPool) {
        const result = await pgPool.query(
          `INSERT INTO user_profiles (
              id, name, age, bio, interests, photos, location,
              compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp,
              is_visible_on_radar, created_at, updated_at
            ) VALUES (
              $1, COALESCE($2, ''), COALESCE($3, 0), COALESCE($4, ''),
              COALESCE($5::jsonb, '[]'::jsonb), COALESCE($6::jsonb, '[]'::jsonb), COALESCE($7, ''),
              0, 0, $8, true, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              name = COALESCE(EXCLUDED.name, user_profiles.name),
              age = COALESCE(EXCLUDED.age, user_profiles.age),
              bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
              interests = COALESCE(EXCLUDED.interests, user_profiles.interests),
              photos = COALESCE(EXCLUDED.photos, user_profiles.photos),
              location = COALESCE(EXCLUDED.location, user_profiles.location),
              updated_at = NOW()
            RETURNING *`,
          [
            id,
            name ?? null,
            age ?? null,
            bio ?? null,
            interests ? JSON.stringify(interests) : null,
            photos ? JSON.stringify(photos) : null,
            location ?? null,
            Date.now()
          ]
        );
        const normalizedIntent = normalizeIntentMode(intentMode);
        await pgPool.query(
          `INSERT INTO explorex_intents (user_id, mode, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET mode = EXCLUDED.mode, updated_at = NOW()`,
          [id, normalizedIntent]
        );
        if (activePlan && typeof activePlan.title === "string" && activePlan.title.trim().length > 0) {
          await pgPool.query(`UPDATE explorex_plan_cards SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`, [id]);
          await pgPool.query(
            `INSERT INTO explorex_plan_cards (user_id, title, city, starts_at, expires_at, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, TRUE, NOW())`,
            [
              id,
              String(activePlan.title).trim(),
              activePlan.city ? String(activePlan.city).trim() : null,
              activePlan.startsAt ? new Date(activePlan.startsAt) : null,
              activePlan.expiresAt ? new Date(activePlan.expiresAt) : null
            ]
          );
        }
        const meta = await loadExploreXMetaForUsers([id]);
        const enriched = addExploreXProfileFields(result.rows[0], meta);
        return res.json(enriched);
      }
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
      }
      const { data: row, error: getError } = await sb.from("user_profiles").select("*").eq("id", id).single();
      if (getError) throw getError;
      res.json({ ...row, intent_mode: normalizeIntentMode(intentMode), active_plan: activePlan || null });
    } catch (error) {
      console.error("Upsert profile error:", error);
      res.status(500).json({ error: "Failed to upsert profile" });
    }
  });
  app2.get("/api/user-profiles/:userId", async (req, res) => {
    try {
      if (pgPool) {
        const result = await pgPool.query(
          "SELECT * FROM user_profiles WHERE id = $1 LIMIT 1",
          [req.params.userId]
        );
        if (!result.rowCount) {
          return res.status(404).json({ error: "Profile not found" });
        }
        const row = result.rows[0];
        const meta = await loadExploreXMetaForUsers([String(req.params.userId)]);
        return res.json(addExploreXProfileFields(row, meta));
      }
      const sb = getSupabase();
      const { data, error } = await sb.from("user_profiles").select("*").eq("id", req.params.userId).single();
      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ error: "Profile not found" });
        }
        throw error;
      }
      res.json({
        ...data,
        intent_mode: "explore_city",
        active_plan: null,
        meetup_count: 0,
        trust_score: computeTrustScore({
          isTravelVerified: data?.is_travel_verified,
          photos: data?.photos,
          interests: data?.interests,
          bio: data?.bio,
          meetupCount: 0
        })
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });
  app2.post("/api/explorex/intent/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const userId = req.params.userId;
      const mode = normalizeIntentMode(req.body?.mode);
      await pgPool.query(
        `INSERT INTO explorex_intents (user_id, mode, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET mode = EXCLUDED.mode, updated_at = NOW()`,
        [userId, mode]
      );
      return res.json({ success: true, userId, mode });
    } catch (error) {
      console.error("Set intent error:", error);
      return res.status(500).json({ error: "Failed to set intent" });
    }
  });
  app2.get("/api/explorex/intent/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.json({ mode: "explore_city" });
      const userId = req.params.userId;
      const result = await pgPool.query(
        `SELECT mode, updated_at FROM explorex_intents WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (!result.rowCount) return res.json({ mode: "explore_city" });
      return res.json({ mode: normalizeIntentMode(result.rows[0].mode), updatedAt: result.rows[0].updated_at });
    } catch (error) {
      console.error("Get intent error:", error);
      return res.json({ mode: "explore_city" });
    }
  });
  app2.get("/api/explorex/plans/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.json([]);
      const userId = req.params.userId;
      const result = await pgPool.query(
        `SELECT id, title, city, starts_at, expires_at, is_active, created_at, updated_at
         FROM explorex_plan_cards
         WHERE user_id = $1
         ORDER BY is_active DESC, updated_at DESC
         LIMIT 20`,
        [userId]
      );
      return res.json(result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        city: row.city || void 0,
        startsAt: row.starts_at || void 0,
        expiresAt: row.expires_at || void 0,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })));
    } catch (error) {
      console.error("Get plans error:", error);
      return res.json([]);
    }
  });
  app2.post("/api/explorex/plans/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const userId = req.params.userId;
      const title = String(req.body?.title || "").trim();
      const city = String(req.body?.city || "").trim() || null;
      const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
      const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
      const activate = req.body?.isActive !== false;
      if (!title) return res.status(400).json({ error: "Plan title is required" });
      if (activate) {
        await pgPool.query(`UPDATE explorex_plan_cards SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`, [userId]);
      }
      const result = await pgPool.query(
        `INSERT INTO explorex_plan_cards (user_id, title, city, starts_at, expires_at, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, title, city, starts_at, expires_at, is_active, created_at, updated_at`,
        [userId, title, city, startsAt, expiresAt, activate]
      );
      return res.json({
        id: result.rows[0].id,
        title: result.rows[0].title,
        city: result.rows[0].city || void 0,
        startsAt: result.rows[0].starts_at || void 0,
        expiresAt: result.rows[0].expires_at || void 0,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at
      });
    } catch (error) {
      console.error("Create plan error:", error);
      return res.status(500).json({ error: "Failed to create plan" });
    }
  });
  app2.post("/api/explorex/plans/:userId/:planId/activate", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const { userId, planId } = req.params;
      await pgPool.query(`UPDATE explorex_plan_cards SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1`, [userId]);
      await pgPool.query(`UPDATE explorex_plan_cards SET is_active = TRUE, updated_at = NOW() WHERE user_id = $1 AND id = $2`, [userId, planId]);
      return res.json({ success: true });
    } catch (error) {
      console.error("Activate plan error:", error);
      return res.status(500).json({ error: "Failed to activate plan" });
    }
  });
  app2.delete("/api/explorex/plans/:userId/:planId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const { userId, planId } = req.params;
      await pgPool.query(`DELETE FROM explorex_plan_cards WHERE user_id = $1 AND id = $2`, [userId, planId]);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete plan error:", error);
      return res.status(500).json({ error: "Failed to delete plan" });
    }
  });
  app2.post("/api/explorex/chat-starters", async (req, res) => {
    try {
      const intent = normalizeIntentMode(req.body?.intentMode);
      const city = String(req.body?.city || "").trim();
      const local = INTENT_CHAT_PROMPTS[intent] || INTENT_CHAT_PROMPTS.explore_city;
      const starters = city ? local.map((v) => `${v} (${city})`) : local;
      return res.json({ starters: starters.slice(0, 3) });
    } catch {
      return res.json({ starters: INTENT_CHAT_PROMPTS.explore_city });
    }
  });
  app2.post("/api/explorex/meet-now/suggest", async (req, res) => {
    try {
      const { userId, targetUserId } = req.body || {};
      if (!userId || !targetUserId) {
        return res.status(400).json({ error: "userId and targetUserId are required" });
      }
      const sb = getSupabase();
      const { data: locRows } = await sb.from("user_locations").select("user_id, lat, lng").in("user_id", [userId, targetUserId]);
      let midpointLat = null;
      let midpointLng = null;
      if (locRows && locRows.length === 2) {
        const a = locRows.find((row) => row.user_id === userId);
        const b = locRows.find((row) => row.user_id === targetUserId);
        if (a && b) {
          midpointLat = (Number(a.lat) + Number(b.lat)) / 2;
          midpointLng = (Number(a.lng) + Number(b.lng)) / 2;
        }
      }
      const venueName = "Public cafe near midpoint";
      const venueAddress = midpointLat && midpointLng ? `${midpointLat.toFixed(4)}, ${midpointLng.toFixed(4)}` : "Choose a public place between both of you";
      let meetupId = null;
      if (pgPool) {
        const created = await pgPool.query(
          `INSERT INTO explorex_meetups (
              user_a_id, user_b_id, venue_name, venue_address,
              midpoint_lat, midpoint_lng, status, scheduled_at
           ) VALUES ($1,$2,$3,$4,$5,$6,'planned', NOW())
           RETURNING id`,
          [userId, targetUserId, venueName, venueAddress, midpointLat, midpointLng]
        );
        meetupId = created.rows[0]?.id || null;
      }
      return res.json({
        success: true,
        meetupId,
        venueName,
        venueAddress,
        midpointLat,
        midpointLng,
        safetyTips: [
          "Meet in a public place",
          "Share your live location with a trusted contact",
          "Use in-app check-in before and after meetup"
        ]
      });
    } catch (error) {
      console.error("Meet-now suggestion error:", error);
      return res.status(500).json({ error: "Failed to suggest meetup" });
    }
  });
  app2.post("/api/explorex/journey/log", async (req, res) => {
    try {
      if (!pgPool) return res.status(500).json({ error: "Database is not configured" });
      const { userAId, userBId, title, summary, city, metAt } = req.body || {};
      if (!userAId || !userBId || !summary) {
        return res.status(400).json({ error: "userAId, userBId and summary are required" });
      }
      const result = await pgPool.query(
        `INSERT INTO explorex_journey_entries (user_a_id, user_b_id, title, summary, city, met_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, user_a_id, user_b_id, title, summary, city, met_at, created_at`,
        [userAId, userBId, title || null, summary, city || null, metAt ? new Date(metAt) : /* @__PURE__ */ new Date()]
      );
      await pgPool.query(
        `UPDATE explorex_meetups
         SET status='completed', completed_at = NOW()
         WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
        [userAId, userBId]
      );
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Journey log error:", error);
      return res.status(500).json({ error: "Failed to log journey" });
    }
  });
  app2.get("/api/explorex/journey/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      if (!pgPool) return res.json([]);
      const userId = req.params.userId;
      const rows = await pgPool.query(
        `SELECT id, user_a_id, user_b_id, title, summary, city, met_at, created_at
         FROM explorex_journey_entries
         WHERE user_a_id = $1 OR user_b_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      return res.json(rows.rows);
    } catch (error) {
      console.error("Journey list error:", error);
      return res.json([]);
    }
  });
  app2.get("/api/explorex/serendipity/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      const userId = req.params.userId;
      if (!userId) return res.status(400).json({ error: "User ID is required" });
      const today = getDayKey();
      if (pgPool) {
        const existing = await pgPool.query(
          `SELECT target_user_id FROM explorex_daily_serendipity WHERE user_id = $1 AND day_key = $2 LIMIT 1`,
          [userId, today]
        );
        if (existing.rowCount) {
          return res.json({ success: true, targetUserId: existing.rows[0].target_user_id, cached: true });
        }
      }
      const sb = getSupabase();
      const { data: profiles } = await sb.from("user_profiles").select("id").neq("id", userId).limit(50);
      const target = (profiles || [])[Math.floor(Math.random() * Math.max(1, (profiles || []).length))];
      if (!target?.id) {
        return res.json({ success: false, error: "No candidate found" });
      }
      if (pgPool) {
        await pgPool.query(
          `INSERT INTO explorex_daily_serendipity (user_id, day_key, target_user_id)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id, day_key) DO NOTHING`,
          [userId, today, target.id]
        );
      }
      return res.json({ success: true, targetUserId: target.id, cached: false });
    } catch (error) {
      console.error("Serendipity error:", error);
      return res.status(500).json({ error: "Failed to fetch serendipity" });
    }
  });
  app2.get("/api/explorex/city-capsule/:city", async (req, res) => {
    try {
      const city = String(req.params.city || "").trim();
      if (!city) return res.status(400).json({ error: "City is required" });
      const sb = getSupabase();
      const { data: peopleRows } = await sb.from("user_profiles").select("id, name, is_travel_verified, location").ilike("location", `%${city}%`).limit(100);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const { data: activityRows } = await sb.from("activities").select("id, title, date, location, category").ilike("location", `%${city}%`).gte("date", nowIso).order("date", { ascending: true }).limit(20);
      return res.json({
        city,
        activeExplorers: (peopleRows || []).length,
        verifiedExplorers: (peopleRows || []).filter((p) => p.is_travel_verified).length,
        upcomingActivities: activityRows || [],
        trendingIntents: ["explore_city", "coffee_now", "adventure_partner"]
      });
    } catch (error) {
      console.error("City capsule error:", error);
      return res.status(500).json({ error: "Failed to fetch city capsule" });
    }
  });
  const COMPATIBILITY_LIMITS = {
    starter: -1,
    free: -1,
    explorer: -1,
    pro: -1,
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
      if (pgPool) {
        const profileRes = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [userAId]);
        let profile2 = profileRes.rows[0];
        if (!profile2) {
          const now = Date.now();
          await pgPool.query(
            `INSERT INTO user_profiles (
              id, name, age, bio, interests, photos, location,
              compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp,
              is_visible_on_radar, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7,
              0, 0, $8, TRUE, NOW(), NOW()
            )`,
            [
              userAId,
              userAProfile?.name || "",
              userAProfile?.age || 0,
              userAProfile?.bio || "",
              JSON.stringify(userAProfile?.interests || []),
              JSON.stringify(userAProfile?.photos || []),
              userAProfile?.location || "",
              now
            ]
          );
          const fresh = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [userAId]);
          profile2 = fresh.rows[0];
        }
        if (!profile2) {
          return res.status(500).json({ error: "Failed to get or create profile" });
        }
        if (shouldResetDaily(Number(profile2.last_reset_timestamp) || 0)) {
          await pgPool.query(
            `UPDATE user_profiles
             SET compatibility_checks_this_week = 0,
                 radar_scans_this_week = 0,
                 last_reset_timestamp = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [userAId, Date.now()]
          );
          profile2.compatibility_checks_this_week = 0;
        }
        const currentTier2 = tier || "starter";
        const limit2 = COMPATIBILITY_LIMITS[currentTier2] ?? 2;
        if (limit2 !== -1 && (profile2.compatibility_checks_this_week || 0) >= limit2) {
          return res.status(403).json({
            error: "Daily compatibility check limit reached",
            limit: limit2,
            used: profile2.compatibility_checks_this_week,
            tier: currentTier2,
            requiresUpgrade: true
          });
        }
        const oneDayAgo2 = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
        const existingRes = await pgPool.query(
          `SELECT * FROM compatibility_history
           WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
             AND created_at >= $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [userAId, userBId, oneDayAgo2]
        );
        if (Number(existingRes.rowCount || 0) > 0) {
          return res.json({ result: existingRes.rows[0], cached: true });
        }
        const profileA2 = userAProfile || { name: "User A", interests: [], bio: "" };
        const profileB2 = userBProfile || { name: "User B", interests: [], bio: "" };
        const compatPrompt2 = `You are a compatibility analyzer for a travel/nomad dating app. Analyze these two profiles and return ONLY valid JSON (no markdown, no explanation).

Profile A: Name: ${profileA2.name}, Age: ${profileA2.age || "unknown"}, Bio: "${profileA2.bio || "No bio"}", Interests: ${JSON.stringify(profileA2.interests || [])}, Location: "${profileA2.location || "unknown"}"

Profile B: Name: ${profileB2.name}, Age: ${profileB2.age || "unknown"}, Bio: "${profileB2.bio || "No bio"}", Interests: ${JSON.stringify(profileB2.interests || [])}, Location: "${profileB2.location || "unknown"}"

Return ONLY this JSON structure:
{"score":75,"strengths":["shared interest 1","shared interest 2"],"conflicts":["potential conflict 1"],"icebreakers":["conversation starter 1","conversation starter 2"],"first_message":"Hey! I noticed we both...","date_idea":"A cool activity idea based on shared interests"}`;
        const aiReply2 = await callGroqChat([
          { role: "system", content: "You are a compatibility analyzer. Return ONLY valid JSON. No markdown code blocks." },
          { role: "user", content: compatPrompt2 }
        ]);
        let compatResult2;
        try {
          const cleaned = aiReply2.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          compatResult2 = JSON.parse(cleaned);
        } catch {
          compatResult2 = {
            score: 65,
            strengths: ["Both enjoy travel and adventure"],
            conflicts: ["May have different travel paces"],
            icebreakers: ["What's your favorite travel destination?"],
            first_message: "Hey! Looks like we're both on the road!",
            date_idea: "Explore a new hiking trail together"
          };
        }
        const compatId2 = `compat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
        await pgPool.query(
          `INSERT INTO compatibility_history (
             id, user_a, user_b, score, strengths, conflicts, icebreakers, first_message, date_idea, created_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10)`,
          [
            compatId2,
            userAId,
            userBId,
            compatResult2.score,
            JSON.stringify(compatResult2.strengths || []),
            JSON.stringify(compatResult2.conflicts || []),
            JSON.stringify(compatResult2.icebreakers || []),
            compatResult2.first_message || null,
            compatResult2.date_idea || null,
            nowIso2
          ]
        );
        await pgPool.query(
          `UPDATE user_profiles
           SET compatibility_checks_this_week = COALESCE(compatibility_checks_this_week, 0) + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [userAId]
        );
        return res.json({
          result: {
            id: compatId2,
            user_a: userAId,
            user_b: userBId,
            ...compatResult2,
            created_at: nowIso2
          },
          cached: false
        });
      }
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
      const currentTier = tier || "starter";
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
      const userId = req.params.userId;
      if (pgPool) {
        const result = await pgPool.query(
          `SELECT * FROM compatibility_history
           WHERE user_a = $1 OR user_b = $1
           ORDER BY created_at DESC
           LIMIT 20`,
          [userId]
        );
        return res.json(result.rows || []);
      }
      const sb = getSupabase();
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
  app2.post("/api/radar/update-location", requireUserSession((req) => req.body?.userId), async (req, res) => {
    try {
      const { userId, lat, lng } = req.body;
      if (!userId || lat === void 0 || lng === void 0) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (pgPool) {
        await pgPool.query(
          `INSERT INTO user_locations (user_id, lat, lng, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = EXCLUDED.updated_at`,
          [userId, Number(lat), Number(lng), now]
        );
        return res.json({ success: true });
      }
      const sb = getSupabase();
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
  app2.post("/api/radar/scan", requireUserSession((req) => req.body?.userId), async (req, res) => {
    try {
      const { userId, lat, lng, radiusKm, tier } = req.body;
      if (!userId || lat === void 0 || lng === void 0) {
        return res.status(400).json({ error: "userId, lat, and lng are required" });
      }
      if (pgPool) {
        const profileRes = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [userId]);
        let profile2 = profileRes.rows[0];
        if (!profile2) {
          const nowMs = Date.now();
          await pgPool.query(
            `INSERT INTO user_profiles (
              id, name, compatibility_checks_this_week, radar_scans_this_week, last_reset_timestamp,
              is_visible_on_radar, created_at, updated_at
            ) VALUES ($1, '', 0, 0, $2, TRUE, NOW(), NOW())`,
            [userId, nowMs]
          );
          const fresh = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [userId]);
          profile2 = fresh.rows[0];
        }
        if (!profile2) {
          return res.status(500).json({ error: "Failed to get or create profile" });
        }
        if (shouldResetDaily(Number(profile2.last_reset_timestamp) || 0)) {
          await pgPool.query(
            `UPDATE user_profiles
             SET compatibility_checks_this_week = 0,
                 radar_scans_this_week = 0,
                 last_reset_timestamp = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [userId, Date.now()]
          );
          profile2.radar_scans_this_week = 0;
        }
        const currentTier2 = tier || "starter";
        const limit2 = RADAR_LIMITS[currentTier2] ?? 2;
        if (limit2 !== -1 && (profile2.radar_scans_this_week || 0) >= limit2) {
          return res.status(403).json({
            error: "Daily radar scan limit reached",
            limit: limit2,
            used: profile2.radar_scans_this_week,
            tier: currentTier2,
            requiresUpgrade: true
          });
        }
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        await pgPool.query(
          `INSERT INTO user_locations (user_id, lat, lng, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = EXCLUDED.updated_at`,
          [userId, Number(lat), Number(lng), now2]
        );
        const radius2 = Number(radiusKm) > 0 ? Number(radiusKm) : 75;
        const safeCos2 = Math.max(Math.cos(lat * Math.PI / 180), 0.01);
        const latDelta2 = radius2 / 111;
        const lngDelta2 = radius2 / (111 * safeCos2);
        const recentLocationThreshold2 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
        const nearbyLocsRes = await pgPool.query(
          `SELECT user_id, lat, lng, updated_at
           FROM user_locations
           WHERE user_id <> $1
             AND lat BETWEEN $2 AND $3
             AND lng BETWEEN $4 AND $5
             AND updated_at >= $6
           ORDER BY updated_at DESC
           LIMIT 200`,
          [userId, Number(lat) - latDelta2, Number(lat) + latDelta2, Number(lng) - lngDelta2, Number(lng) + lngDelta2, recentLocationThreshold2]
        );
        const nearbyLocs2 = nearbyLocsRes.rows || [];
        const nearbyUserIds2 = nearbyLocs2.map((l) => String(l.user_id));
        let profilesMap2 = {};
        if (nearbyUserIds2.length > 0) {
          const profilesRes = await pgPool.query(
            `SELECT id, name, age, bio, interests, photos, location, is_visible_on_radar
             FROM user_profiles
             WHERE id = ANY($1::text[])`,
            [nearbyUserIds2]
          );
          for (const p of profilesRes.rows) {
            if (p.is_visible_on_radar === false) continue;
            profilesMap2[String(p.id)] = p;
          }
        }
        const nearbyUsers2 = nearbyLocs2.filter((loc) => profilesMap2[String(loc.user_id)]).map((row) => {
          const rowLat = Number(row.lat);
          const rowLng = Number(row.lng);
          if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return null;
          const dLat = (rowLat - Number(lat)) * Math.PI / 180;
          const dLng = (rowLng - Number(lng)) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(Number(lat) * Math.PI / 180) * Math.cos(rowLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const up = profilesMap2[String(row.user_id)];
          return {
            userId: String(row.user_id),
            lat: rowLat,
            lng: rowLng,
            distance: Math.round(distance * 10) / 10,
            name: up?.name || "Nomad",
            age: up?.age,
            bio: up?.bio,
            interests: up?.interests || [],
            photos: up?.photos || [],
            location: up?.location,
            lastSeen: row.updated_at
          };
        }).filter((u) => u && u.distance <= radius2).sort((a, b) => {
          if (a.distance !== b.distance) return a.distance - b.distance;
          return String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
        }).slice(0, 25);
        const actNow2 = (/* @__PURE__ */ new Date()).toISOString();
        const allActivitiesRes = await pgPool.query(
          `SELECT * FROM activities WHERE date >= $1 ORDER BY date ASC LIMIT 50`,
          [actNow2]
        );
        const allActivities2 = allActivitiesRes.rows || [];
        const nearbyActivities2 = allActivities2.filter((act) => {
          if (act.latitude === void 0 || act.longitude === void 0 || act.latitude === null || act.longitude === null) return false;
          const aLat = Number(act.latitude);
          const aLng = Number(act.longitude);
          if (!Number.isFinite(aLat) || !Number.isFinite(aLng)) return false;
          const dLat = (aLat - Number(lat)) * Math.PI / 180;
          const dLng = (aLng - Number(lng)) * Math.PI / 180;
          const a2 = Math.sin(dLat / 2) ** 2 + Math.cos(Number(lat) * Math.PI / 180) * Math.cos(aLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
          act._distance = Math.round(dist * 10) / 10;
          return dist <= radius2;
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
        await pgPool.query(
          `UPDATE user_profiles
           SET radar_scans_this_week = COALESCE(radar_scans_this_week, 0) + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [userId]
        );
        return res.json({
          users: nearbyUsers2,
          activities: nearbyActivities2,
          scansUsed: (profile2.radar_scans_this_week || 0) + 1,
          scansLimit: limit2
        });
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
      const currentTier = tier || "starter";
      const limit = RADAR_LIMITS[currentTier] ?? 2;
      if (limit !== -1 && (profile.radar_scans_this_week || 0) >= limit) {
        return res.status(403).json({
          error: "Daily radar scan limit reached",
          limit,
          used: profile.radar_scans_this_week,
          tier: currentTier,
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
      const radius = Number(radiusKm) > 0 ? Number(radiusKm) : 75;
      const safeCos = Math.max(Math.cos(lat * Math.PI / 180), 0.01);
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * safeCos);
      const recentLocationThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
      const { data: nearbyLocs } = await sb.from("user_locations").select("user_id, lat, lng, updated_at").neq("user_id", userId).gte("lat", lat - latDelta).lte("lat", lat + latDelta).gte("lng", lng - lngDelta).lte("lng", lng + lngDelta).gte("updated_at", recentLocationThreshold).limit(200);
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
        const rowLat = Number(row.lat);
        const rowLng = Number(row.lng);
        if (!Number.isFinite(rowLat) || !Number.isFinite(rowLng)) return null;
        return {
          userId: row.user_id,
          lat: rowLat,
          lng: rowLng,
          distance: Math.round(distance * 10) / 10,
          name: up?.name || "Nomad",
          age: up?.age,
          bio: up?.bio,
          interests: up?.interests || [],
          photos: up?.photos || [],
          location: up?.location,
          lastSeen: row.updated_at
        };
      }).filter((u) => u && u.distance <= radius).sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
      }).slice(0, 25);
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
  app2.post("/api/radar/toggle-visibility", requireUserSession((req) => req.body?.userId), async (req, res) => {
    try {
      const { userId, isVisible } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      if (pgPool) {
        await pgPool.query(`UPDATE user_profiles SET is_visible_on_radar = $2, updated_at = NOW() WHERE id = $1`, [userId, isVisible !== false]);
        return res.json({ success: true, isVisible: isVisible !== false });
      }
      const sb = getSupabase();
      await sb.from("user_profiles").update({ is_visible_on_radar: isVisible !== false }).eq("id", userId);
      res.json({ success: true, isVisible: isVisible !== false });
    } catch (error) {
      console.error("Toggle visibility error:", error);
      res.status(500).json({ error: "Failed to toggle visibility" });
    }
  });
  app2.post("/api/radar/chat-request", requireUserSession((req) => req.body?.senderId), async (req, res) => {
    try {
      const { senderId, receiverId, senderName, senderPhoto, receiverName, receiverPhoto, message } = req.body;
      if (!senderId || !receiverId) {
        return res.status(400).json({ error: "senderId and receiverId are required" });
      }
      const id = `cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const nowStr = (/* @__PURE__ */ new Date()).toISOString();
      if (pgPool) {
        const existingRes = await pgPool.query(
          `SELECT id, status FROM radar_chat_requests
           WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
             AND status IN ('pending', 'accepted')
           ORDER BY created_at DESC
           LIMIT 1`,
          [senderId, receiverId]
        );
        if (Number(existingRes.rowCount || 0) > 0) {
          const existing2 = existingRes.rows[0];
          if (existing2.status === "accepted") {
            return res.json({ alreadyConnected: true, requestId: existing2.id });
          }
          return res.json({ alreadyRequested: true, requestId: existing2.id });
        }
        await pgPool.query(
          `INSERT INTO radar_chat_requests (
             id, sender_id, receiver_id, sender_name, sender_photo, receiver_name, receiver_photo,
             message, status, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)`,
          [id, senderId, receiverId, senderName || "", senderPhoto || "", receiverName || "", receiverPhoto || "", message || "", nowStr, nowStr]
        );
        return res.json({ success: true, requestId: id });
      }
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
  app2.get("/api/radar/chat-requests/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      const userId = req.params.userId;
      if (pgPool) {
        const [receivedRes, sentRes] = await Promise.all([
          pgPool.query(
            `SELECT * FROM radar_chat_requests
             WHERE receiver_id = $1 AND status = 'pending'
             ORDER BY created_at DESC`,
            [userId]
          ),
          pgPool.query(
            `SELECT * FROM radar_chat_requests
             WHERE sender_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [userId]
          )
        ]);
        return res.json({ received: receivedRes.rows || [], sent: sentRes.rows || [] });
      }
      const sb = getSupabase();
      const { data: received } = await sb.from("radar_chat_requests").select("*").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false });
      const { data: sent } = await sb.from("radar_chat_requests").select("*").eq("sender_id", userId).order("created_at", { ascending: false }).limit(20);
      res.json({ received: received || [], sent: sent || [] });
    } catch (error) {
      console.error("Get chat requests error:", error);
      res.json({ received: [], sent: [] });
    }
  });
  app2.post("/api/radar/chat-request/:requestId/respond", requireUserSession((req) => req.body?.responderId), async (req, res) => {
    try {
      const { action, responderId } = req.body;
      if (!["accepted", "declined"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accepted' or 'declined'" });
      }
      if (!responderId) {
        return res.status(400).json({ error: "responderId is required" });
      }
      const requestId = req.params.requestId;
      if (pgPool) {
        const ownershipRes = await pgPool.query(
          `SELECT receiver_id FROM radar_chat_requests WHERE id = $1 LIMIT 1`,
          [requestId]
        );
        if (!ownershipRes.rowCount) {
          return res.status(404).json({ error: "Request not found" });
        }
        if (String(ownershipRes.rows[0].receiver_id) !== String(responderId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        await pgPool.query(
          `UPDATE radar_chat_requests SET status = $2, updated_at = NOW() WHERE id = $1`,
          [requestId, action]
        );
        if (action === "accepted") {
          const reqRes = await pgPool.query(`SELECT * FROM radar_chat_requests WHERE id = $1 LIMIT 1`, [requestId]);
          const request = reqRes.rows[0];
          if (request) {
            const sorted = [String(request.sender_id), String(request.receiver_id)].sort();
            const userA = sorted[0];
            const userB = sorted[1];
            const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            await pgPool.query(
              `INSERT INTO matches (id, user_a_id, user_b_id, created_at)
               VALUES ($1,$2,$3,NOW())
               ON CONFLICT (user_a_id, user_b_id) DO NOTHING`,
              [matchId, userA, userB]
            );
          }
        }
        return res.json({ success: true, status: action });
      }
      const sb = getSupabase();
      const { data: ownershipRows, error: ownershipErr } = await sb.from("radar_chat_requests").select("receiver_id").eq("id", requestId).limit(1);
      if (ownershipErr) throw ownershipErr;
      if (!ownershipRows || ownershipRows.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }
      if (String(ownershipRows[0].receiver_id) !== String(responderId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
      if (pgPool) {
        const result = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [req.params.userId]);
        const profile2 = result.rows[0];
        if (!profile2) {
          return res.json({ compatibilityChecks: 0, radarScans: 0 });
        }
        if (shouldResetDaily(Number(profile2.last_reset_timestamp) || 0)) {
          await pgPool.query(
            `UPDATE user_profiles
             SET compatibility_checks_this_week = 0,
                 radar_scans_this_week = 0,
                 last_reset_timestamp = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [req.params.userId, Date.now()]
          );
          return res.json({ compatibilityChecks: 0, radarScans: 0 });
        }
        return res.json({
          compatibilityChecks: profile2.compatibility_checks_this_week || 0,
          radarScans: profile2.radar_scans_this_week || 0
        });
      }
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
      if (pgPool) {
        const [swipedRes, allProfilesRes] = await Promise.all([
          pgPool.query(`SELECT swiped_id FROM swipes WHERE swiper_id = $1`, [userId]),
          pgPool.query(`SELECT * FROM user_profiles WHERE id <> $1 ORDER BY id`, [userId])
        ]);
        let matchRows = [];
        try {
          const matchRes = await pgPool.query(
            `SELECT user_a_id, user_b_id FROM matches WHERE user_a_id = $1 OR user_b_id = $1`,
            [userId]
          );
          matchRows = matchRes.rows || [];
        } catch {
          const matchResLegacy = await pgPool.query(
            `SELECT user_a AS user_a_id, user_b AS user_b_id FROM matches WHERE user_a = $1 OR user_b = $1`,
            [userId]
          );
          matchRows = matchResLegacy.rows || [];
        }
        const swipedIds2 = swipedRes.rows.map((row) => String(row.swiped_id));
        const matchedIds2 = matchRows.map(
          (row) => String(row.user_a_id) === userId ? String(row.user_b_id) : String(row.user_a_id)
        );
        const excludeIds2 = /* @__PURE__ */ new Set([userId, ...swipedIds2, ...matchedIds2]);
        let filtered2 = allProfilesRes.rows.filter((row) => !excludeIds2.has(String(row.id)));
        let realProfiles2 = filtered2.filter((p) => !String(p.id).startsWith("mock"));
        const mockProfiles2 = filtered2.filter((p) => String(p.id).startsWith("mock"));
        if (realProfiles2.length < 15) {
          const appUsersRes = await pgPool.query(
            `SELECT id, email, name, created_at FROM app_users WHERE id <> $1 ORDER BY created_at DESC LIMIT 100`,
            [userId]
          );
          const existingIds = new Set(realProfiles2.map((p) => String(p.id)));
          const syntheticRows = appUsersRes.rows.filter((u) => !excludeIds2.has(String(u.id)) && !existingIds.has(String(u.id))).map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name || (String(u.email || "").split("@")[0] || "Explorer"),
            age: 25,
            bio: "",
            location: "",
            photos: [],
            interests: [],
            created_at: u.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }));
          realProfiles2 = [...realProfiles2, ...syntheticRows];
          try {
            const sb2 = getSupabase();
            const { data: sbProfiles } = await sb2.from("user_profiles").select("*").neq("id", userId).order("created_at", { ascending: false }).limit(200);
            if (sbProfiles && sbProfiles.length > 0) {
              const existingAfterSynthetic = new Set(realProfiles2.map((p) => String(p.id)));
              const supplemental = sbProfiles.filter((row) => {
                const id = String(row.id);
                return !excludeIds2.has(id) && !existingAfterSynthetic.has(id) && !id.startsWith("mock");
              }).map((row) => ({
                id: row.id,
                email: row.email || "",
                name: row.name || (String(row.email || "").split("@")[0] || "Explorer"),
                age: row.age || 25,
                bio: row.bio || "",
                location: row.location || "",
                photos: row.photos || [],
                interests: row.interests || [],
                created_at: row.created_at || (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: row.updated_at || (/* @__PURE__ */ new Date()).toISOString()
              }));
              realProfiles2 = [...realProfiles2, ...supplemental];
            }
          } catch {
          }
        }
        const shuffle2 = (arr) => {
          const copy = [...arr];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };
        const DISCOVER_TARGET_COUNT2 = 20;
        const shuffledReal2 = shuffle2(realProfiles2);
        const shuffledMock2 = shuffle2(mockProfiles2);
        if (shuffledReal2.length >= DISCOVER_TARGET_COUNT2) {
          filtered2 = shuffledReal2.slice(0, DISCOVER_TARGET_COUNT2);
        } else {
          const neededMocks = Math.max(0, DISCOVER_TARGET_COUNT2 - shuffledReal2.length);
          filtered2 = [...shuffledReal2, ...shuffledMock2.slice(0, neededMocks)];
        }
        const meta2 = await loadExploreXMetaForUsers(filtered2.map((row) => String(row.id)));
        const profiles2 = filtered2.map((row) => {
          const enriched = addExploreXProfileFields(row, meta2);
          return {
            user: {
              id: enriched.id,
              email: enriched.email || "",
              name: enriched.name || "Nomad",
              age: enriched.age || 25,
              bio: enriched.bio || "",
              location: enriched.location || "On the road",
              photos: enriched.photos || [],
              interests: enriched.interests || [],
              vanType: enriched.van_type || void 0,
              travelStyle: enriched.travel_style || void 0,
              isTravelVerified: enriched.is_travel_verified || false,
              travelBadge: enriched.travel_badge || "none",
              intentMode: enriched.intent_mode || "explore_city",
              activePlan: enriched.active_plan || null,
              trustScore: Number(enriched.trust_score || 0),
              meetupCount: Number(enriched.meetup_count || 0),
              createdAt: enriched.created_at || (/* @__PURE__ */ new Date()).toISOString(),
              isMock: String(enriched.id).startsWith("mock")
            },
            distance: Math.floor(Math.random() * 50) + 1
          };
        });
        return res.json(profiles2);
      }
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
      const { data: allProfiles, error } = await sb.from("user_profiles").select("*").neq("id", userId).order("id");
      if (error) throw error;
      let filtered = (allProfiles || []).filter((p) => !excludeIds.has(p.id));
      const realProfiles = filtered.filter((p) => !p.id.startsWith("mock"));
      const mockProfiles = filtered.filter((p) => p.id.startsWith("mock"));
      const shuffle = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      const DISCOVER_TARGET_COUNT = 20;
      const shuffledReal = shuffle(realProfiles);
      const shuffledMock = shuffle(mockProfiles);
      if (shuffledReal.length >= DISCOVER_TARGET_COUNT) {
        filtered = shuffledReal.slice(0, DISCOVER_TARGET_COUNT);
      } else {
        const neededMocks = Math.max(0, DISCOVER_TARGET_COUNT - shuffledReal.length);
        filtered = [...shuffledReal, ...shuffledMock.slice(0, neededMocks)];
      }
      const meta = await loadExploreXMetaForUsers((filtered || []).map((row) => String(row.id)));
      const profiles = filtered.map((row) => {
        const enriched = addExploreXProfileFields(row, meta);
        return {
          user: {
            id: enriched.id,
            email: enriched.email || "",
            name: enriched.name || "Nomad",
            age: enriched.age || 25,
            bio: enriched.bio || "",
            location: enriched.location || "On the road",
            photos: enriched.photos || [],
            interests: enriched.interests || [],
            vanType: enriched.van_type || void 0,
            travelStyle: enriched.travel_style || void 0,
            isTravelVerified: enriched.is_travel_verified || false,
            travelBadge: enriched.travel_badge || "none",
            intentMode: enriched.intent_mode || "explore_city",
            activePlan: enriched.active_plan || null,
            trustScore: Number(enriched.trust_score || 0),
            meetupCount: Number(enriched.meetup_count || 0),
            createdAt: enriched.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            isMock: String(enriched.id).startsWith("mock")
          },
          distance: Math.floor(Math.random() * 50) + 1
        };
      });
      res.json(profiles);
    } catch (error) {
      console.error("Discover profiles error:", error);
      res.json([]);
    }
  });
  app2.post("/api/swipes", requireUserSession((req) => String(req.body?.swiperId || "")), async (req, res) => {
    try {
      const { swiperId, swipedId, direction } = req.body;
      if (!swiperId || !swipedId || !direction) {
        return res.status(400).json({ error: "swiperId, swipedId, and direction are required" });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (pgPool) {
        await pgPool.query(
          `INSERT INTO swipes (id, swiper_id, swiped_id, direction, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (swiper_id, swiped_id)
           DO UPDATE SET direction = EXCLUDED.direction, created_at = EXCLUDED.created_at`,
          [`swipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, swiperId, swipedId, direction, now]
        );
        let match2 = null;
        if (direction === "right") {
          const reverseSwipe = await pgPool.query(
            `SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'right' LIMIT 1`,
            [swipedId, swiperId]
          );
          const shouldInstantMatch = String(swipedId).startsWith("mock") || Number(reverseSwipe.rowCount || 0) > 0;
          if (shouldInstantMatch) {
            const sorted = [String(swiperId), String(swipedId)].sort();
            const userA = sorted[0];
            const userB = sorted[1];
            const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const existing = await pgPool.query(`SELECT id FROM matches WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1`, [userA, userB]);
            const finalMatchId = Number(existing.rowCount || 0) ? String(existing.rows[0].id) : matchId;
            if (!Number(existing.rowCount || 0)) {
              await pgPool.query(`INSERT INTO matches (id, user_a_id, user_b_id, created_at) VALUES ($1, $2, $3, $4)`, [finalMatchId, userA, userB, now]);
            }
            const profileRes = await pgPool.query(`SELECT * FROM user_profiles WHERE id = $1 LIMIT 1`, [swipedId]);
            if (profileRes.rowCount) {
              const meta = await loadExploreXMetaForUsers([String(swipedId)]);
              const enriched = addExploreXProfileFields(profileRes.rows[0], meta);
              match2 = {
                id: finalMatchId,
                matchedUserId: swipedId,
                matchedUser: {
                  id: enriched.id,
                  email: enriched.email || "",
                  name: enriched.name || "Nomad",
                  age: enriched.age || 25,
                  bio: enriched.bio || "",
                  location: enriched.location || "On the road",
                  photos: enriched.photos || [],
                  interests: enriched.interests || [],
                  vanType: enriched.van_type || void 0,
                  travelStyle: enriched.travel_style || void 0,
                  isTravelVerified: enriched.is_travel_verified || false,
                  travelBadge: enriched.travel_badge || "none",
                  intentMode: enriched.intent_mode || "explore_city",
                  activePlan: enriched.active_plan || null,
                  trustScore: Number(enriched.trust_score || 0),
                  meetupCount: Number(enriched.meetup_count || 0),
                  createdAt: enriched.created_at || now
                },
                createdAt: now
              };
            }
          }
        }
        return res.json({ success: true, match: match2 });
      }
      const sb = getSupabase();
      await sb.from("swipes").upsert({
        swiper_id: swiperId,
        swiped_id: swipedId,
        direction,
        created_at: now
      }, { onConflict: "swiper_id,swiped_id" });
      const isMockProfile = swipedId.startsWith("mock");
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
  app2.get("/api/matches/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID is required" });
      if (pgPool) {
        const matchesRes = await pgPool.query(
          `SELECT id, user_a_id, user_b_id, created_at FROM matches
           WHERE user_a_id = $1 OR user_b_id = $1
           ORDER BY created_at DESC`,
          [userId]
        );
        let allMatches2 = matchesRes.rows;
        const twoHoursAgo2 = Date.now() - 2 * 60 * 60 * 1e3;
        const staleIds = allMatches2.filter((m) => new Date(m.created_at).getTime() < twoHoursAgo2).map((m) => String(m.id));
        if (staleIds.length > 0) {
          const msgRes = await pgPool.query(
            `SELECT DISTINCT match_id FROM chat_messages WHERE match_id = ANY($1::text[])`,
            [staleIds]
          );
          const active = new Set(msgRes.rows.map((r) => String(r.match_id)));
          allMatches2 = allMatches2.filter((m) => {
            const isOld = new Date(m.created_at).getTime() < twoHoursAgo2;
            return !isOld || active.has(String(m.id));
          });
        }
        const matchedUserIds2 = allMatches2.map(
          (m) => String(m.user_a_id) === userId ? String(m.user_b_id) : String(m.user_a_id)
        );
        let profilesMap2 = {};
        if (matchedUserIds2.length > 0) {
          const profRes = await pgPool.query(`SELECT * FROM user_profiles WHERE id = ANY($1::text[])`, [matchedUserIds2]);
          profilesMap2 = Object.fromEntries(profRes.rows.map((r) => [String(r.id), r]));
        }
        const meta2 = await loadExploreXMetaForUsers(matchedUserIds2);
        const matchList2 = allMatches2.map((m) => {
          const matchedUserId = String(m.user_a_id) === userId ? String(m.user_b_id) : String(m.user_a_id);
          const row = profilesMap2[matchedUserId] || { id: matchedUserId };
          const enriched = addExploreXProfileFields(row, meta2);
          return {
            id: String(m.id),
            matchedUserId,
            matchedUser: {
              id: matchedUserId,
              email: enriched.email || "",
              name: enriched.name || "Nomad",
              age: enriched.age || 25,
              bio: enriched.bio || "",
              location: enriched.location || "On the road",
              photos: enriched.photos || [],
              interests: enriched.interests || [],
              vanType: enriched.van_type || void 0,
              travelStyle: enriched.travel_style || void 0,
              isTravelVerified: enriched.is_travel_verified || false,
              travelBadge: enriched.travel_badge || "none",
              intentMode: enriched.intent_mode || "explore_city",
              activePlan: enriched.active_plan || null,
              trustScore: Number(enriched.trust_score || 0),
              meetupCount: Number(enriched.meetup_count || 0),
              createdAt: enriched.created_at || (/* @__PURE__ */ new Date()).toISOString()
            },
            createdAt: m.created_at || (/* @__PURE__ */ new Date()).toISOString()
          };
        });
        return res.json(matchList2);
      }
      const sb = getSupabase();
      const { data: matchesA } = await sb.from("matches").select("id, user_a_id, user_b_id, created_at").eq("user_a_id", userId).order("created_at", { ascending: false });
      const { data: matchesB } = await sb.from("matches").select("id, user_a_id, user_b_id, created_at").eq("user_b_id", userId).order("created_at", { ascending: false });
      let allMatches = [...matchesA || [], ...matchesB || []].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1e3;
      const staleCandidates = allMatches.filter((match) => new Date(match.created_at).getTime() < twoHoursAgo).map((match) => match.id);
      if (staleCandidates.length > 0) {
        const { data: existingMessages } = await sb.from("chat_messages").select("match_id").in("match_id", staleCandidates);
        const activeMatchIds = new Set((existingMessages || []).map((row) => row.match_id));
        allMatches = allMatches.filter((match) => {
          const isOld = new Date(match.created_at).getTime() < twoHoursAgo;
          if (!isOld) return true;
          return activeMatchIds.has(match.id);
        });
      }
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
      const meta = await loadExploreXMetaForUsers(matchedUserIds);
      const matchList = allMatches.map((m) => {
        const matchedUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const row = profilesMap[matchedUserId] || {};
        const enriched = addExploreXProfileFields({ ...row, id: matchedUserId }, meta);
        return {
          id: m.id,
          matchedUserId,
          matchedUser: {
            id: matchedUserId,
            email: enriched.email || "",
            name: enriched.name || "Nomad",
            age: enriched.age || 25,
            bio: enriched.bio || "",
            location: enriched.location || "On the road",
            photos: enriched.photos || [],
            interests: enriched.interests || [],
            vanType: enriched.van_type || void 0,
            travelStyle: enriched.travel_style || void 0,
            isTravelVerified: enriched.is_travel_verified || false,
            travelBadge: enriched.travel_badge || "none",
            intentMode: enriched.intent_mode || "explore_city",
            activePlan: enriched.active_plan || null,
            trustScore: Number(enriched.trust_score || 0),
            meetupCount: Number(enriched.meetup_count || 0),
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
  app2.get("/api/swipes/liked/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      const { userId } = req.params;
      if (pgPool) {
        const swipesRes = await pgPool.query(
          `SELECT swiped_id, created_at FROM swipes WHERE swiper_id = $1 AND direction = 'right' ORDER BY created_at DESC`,
          [userId]
        );
        const swipedIds2 = swipesRes.rows.map((s) => String(s.swiped_id));
        if (swipedIds2.length === 0) return res.json([]);
        const matchRes = await pgPool.query(`SELECT user_a_id, user_b_id FROM matches WHERE user_a_id = $1 OR user_b_id = $1`, [userId]);
        const matchedIds2 = new Set(matchRes.rows.map((m) => String(m.user_a_id) === userId ? String(m.user_b_id) : String(m.user_a_id)));
        const filteredIds2 = swipedIds2.filter((id) => !matchedIds2.has(id));
        if (filteredIds2.length === 0) return res.json([]);
        const profilesRes = await pgPool.query(`SELECT * FROM user_profiles WHERE id = ANY($1::text[])`, [filteredIds2]);
        const likedProfiles2 = profilesRes.rows.map((row) => ({
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
        return res.json(likedProfiles2);
      }
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
  app2.post("/api/swipes/reset/:userId", requireUserSession((req) => req.params.userId), async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      if (pgPool) {
        await pgPool.query(`DELETE FROM swipes WHERE swiper_id = $1`, [userId]);
        return res.json({ message: "Swipes reset successfully" });
      }
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
  app2.get("/api/messages/:matchId", requireUserSession((req) => req.query.userId), async (req, res) => {
    const { matchId } = req.params;
    const userId = Array.isArray(req.query.userId) ? String(req.query.userId[0] || "") : String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      if (pgPool) {
        const membership = await pgPool.query(
          `SELECT id FROM matches WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) LIMIT 1`,
          [matchId, userId]
        );
        if (!membership.rowCount) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const result = await pgPool.query(
          `SELECT * FROM chat_messages WHERE match_id = $1 ORDER BY created_at ASC`,
          [matchId]
        );
        return res.json(result.rows || []);
      }
      const sb = getSupabase();
      const { data: memberRows, error: memberError } = await sb.from("matches").select("id").eq("id", matchId).or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`).limit(1);
      if (memberError) throw memberError;
      if (!memberRows || memberRows.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { data, error } = await sb.from("chat_messages").select("*").eq("match_id", matchId).order("created_at", { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Failed to get messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });
  app2.post("/api/messages/:matchId", requireUserSession((req) => req.body?.senderId), async (req, res) => {
    const { matchId } = req.params;
    const { senderId, content, type, photoUrl, fileUrl, fileName, audioUrl, audioDuration, replyTo, location } = req.body;
    if (!senderId) {
      return res.status(400).json({ error: "senderId is required" });
    }
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      if (pgPool) {
        const membership = await pgPool.query(
          `SELECT id FROM matches WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) LIMIT 1`,
          [matchId, senderId]
        );
        if (!membership.rowCount) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const result = await pgPool.query(
          `INSERT INTO chat_messages (
             id, match_id, sender_id, content, type, photo_url, file_url, file_name,
             audio_url, audio_duration, reply_to, location, reactions, status, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15)
           RETURNING *`,
          [
            msgId,
            matchId,
            senderId,
            content || "",
            type || "text",
            photoUrl || null,
            fileUrl || null,
            fileName || null,
            audioUrl || null,
            audioDuration || null,
            replyTo ? JSON.stringify(replyTo) : null,
            location ? JSON.stringify(location) : null,
            JSON.stringify({}),
            "sent",
            now
          ]
        );
        return res.status(201).json(result.rows[0]);
      }
      const sb = getSupabase();
      const { data: memberRows, error: memberError } = await sb.from("matches").select("id").eq("id", matchId).or(`user_a_id.eq.${senderId},user_b_id.eq.${senderId}`).limit(1);
      if (memberError) throw memberError;
      if (!memberRows || memberRows.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.patch("/api/messages/:messageId", requireUserSession((req) => req.body?.userId), async (req, res) => {
    const { messageId } = req.params;
    const { content, userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      if (pgPool) {
        const ownerRes = await pgPool.query(`SELECT sender_id FROM chat_messages WHERE id = $1 LIMIT 1`, [messageId]);
        if (!ownerRes.rowCount) {
          return res.status(404).json({ error: "Message not found" });
        }
        if (String(ownerRes.rows[0].sender_id) !== String(userId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const result = await pgPool.query(
          `UPDATE chat_messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *`,
          [content, messageId]
        );
        if (!result.rowCount) {
          return res.status(404).json({ error: "Message not found" });
        }
        return res.json(result.rows[0]);
      }
      const sb = getSupabase();
      const { data: ownerRow, error: ownerErr } = await sb.from("chat_messages").select("sender_id").eq("id", messageId).single();
      if (ownerErr) {
        if (ownerErr.code === "PGRST116") {
          return res.status(404).json({ error: "Message not found" });
        }
        throw ownerErr;
      }
      if (String(ownerRow?.sender_id || "") !== String(userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.delete("/api/messages/:messageId", requireUserSession((req) => req.query.userId), async (req, res) => {
    const { messageId } = req.params;
    const userId = Array.isArray(req.query.userId) ? String(req.query.userId[0] || "") : String(req.query.userId || "");
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    try {
      if (pgPool) {
        const ownerRes = await pgPool.query(`SELECT sender_id FROM chat_messages WHERE id = $1 LIMIT 1`, [messageId]);
        if (!ownerRes.rowCount) {
          return res.status(404).json({ error: "Message not found" });
        }
        if (String(ownerRes.rows[0].sender_id) !== String(userId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const result = await pgPool.query(`DELETE FROM chat_messages WHERE id = $1 RETURNING id`, [messageId]);
        if (!result.rowCount) {
          return res.status(404).json({ error: "Message not found" });
        }
        return res.json({ success: true });
      }
      const sb = getSupabase();
      const { data: ownerRows, error: ownerError } = await sb.from("chat_messages").select("sender_id").eq("id", messageId).limit(1);
      if (ownerError) throw ownerError;
      if (!ownerRows || ownerRows.length === 0) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (String(ownerRows[0].sender_id) !== String(userId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  app2.patch("/api/messages/:messageId/reactions", requireUserSession((req) => req.body?.userId), async (req, res) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      return res.status(400).json({ error: "userId and emoji are required" });
    }
    try {
      if (pgPool) {
        const msgRes = await pgPool.query(`SELECT reactions, match_id FROM chat_messages WHERE id = $1 LIMIT 1`, [messageId]);
        if (!msgRes.rowCount) {
          return res.status(404).json({ error: "Message not found" });
        }
        const matchId = String(msgRes.rows[0].match_id || "");
        const membership = await pgPool.query(
          `SELECT id FROM matches WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2) LIMIT 1`,
          [matchId, userId]
        );
        if (!membership.rowCount) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const reactions2 = msgRes.rows[0].reactions || {};
        const current2 = new Set(reactions2[emoji] || []);
        if (current2.has(userId)) {
          current2.delete(userId);
        } else {
          current2.add(userId);
        }
        if (current2.size === 0) {
          delete reactions2[emoji];
        } else {
          reactions2[emoji] = Array.from(current2);
        }
        await pgPool.query(`UPDATE chat_messages SET reactions = $1::jsonb WHERE id = $2`, [JSON.stringify(reactions2), messageId]);
        return res.json({ id: messageId, reactions: reactions2 });
      }
      const sb = getSupabase();
      const { data: msgData, error: getError } = await sb.from("chat_messages").select("reactions, match_id").eq("id", messageId).single();
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
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
var log = console.log;
function setupSecurityHeaders(app2) {
  app2.disable("x-powered-by");
  app2.set("trust proxy", 1);
  app2.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  app2.use(
    "/api",
    createRateLimiter({
      windowMs: 6e4,
      max: 240,
      message: "Too many API requests. Slow down and try again."
    })
  );
}
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
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false, limit: "1mb" }));
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
        logLine = logLine.slice(0, 79) + "...";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
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
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
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
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
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
  app2.use("/uploads", express.static(path2.resolve(process.cwd(), "uploads")));
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
  setupSecurityHeaders(app);
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
