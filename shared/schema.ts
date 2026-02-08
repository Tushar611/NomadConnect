import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, doublePrecision, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const passwordResetOtps = pgTable("password_reset_otps", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: text("used").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull().default("New Chat"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  hostId: varchar("host_id").notNull(),
  hostData: jsonb("host_data").notNull(),
  attendeeIds: jsonb("attendee_ids").notNull().default([]),
  attendeesData: jsonb("attendees_data").notNull().default([]),
  maxAttendees: text("max_attendees"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityParticipants = pgTable("activity_participants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id").notNull(),
  userId: varchar("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const activityChatMessages = pgTable("activity_chat_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderPhoto: text("sender_photo"),
  type: text("type").notNull().default("text"),
  content: text("content").notNull(),
  photoUrl: text("photo_url"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  audioUrl: text("audio_url"),
  audioDuration: text("audio_duration"),
  replyTo: jsonb("reply_to"),
  location: jsonb("location"),
  isPinned: text("is_pinned").default("false"),
  isModeratorMessage: text("is_moderator_message").default("false"),
  reactions: jsonb("reactions").default({}),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey(),
  name: text("name"),
  age: integer("age"),
  bio: text("bio"),
  interests: jsonb("interests").default([]),
  photos: jsonb("photos").default([]),
  location: text("location"),
  vanType: text("van_type"),
  travelStyle: text("travel_style"),
  email: text("email"),
  compatibilityChecksThisWeek: integer("compatibility_checks_this_week").default(0),
  radarScansThisWeek: integer("radar_scans_this_week").default(0),
  lastResetTimestamp: bigint("last_reset_timestamp", { mode: "number" }).default(0),
  isVisibleOnRadar: boolean("is_visible_on_radar").default(true),
  isTravelVerified: boolean("is_travel_verified").default(false),
  travelBadge: text("travel_badge"),
  isExpert: boolean("is_expert").default(false),
  expertBadge: text("expert_badge"),
  expertRating: doublePrecision("expert_rating").default(0),
  reviewsCount: integer("reviews_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const travelVerification = pgTable("travel_verification", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  travelPhotoUrl: text("travel_photo_url"),
  secondaryPhotoUrl: text("secondary_photo_url"),
  answer1: text("answer1"),
  answer2: text("answer2"),
  answer3: text("answer3"),
  photoScore: integer("photo_score"),
  travelExperienceScore: integer("travel_experience_score"),
  finalTravelScore: integer("final_travel_score"),
  badge: text("badge"),
  verdict: text("verdict"),
  reasons: jsonb("reasons").default([]),
  advice: text("advice"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const compatibilityHistory = pgTable("compatibility_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userA: varchar("user_a").notNull(),
  userB: varchar("user_b").notNull(),
  score: integer("score").notNull(),
  strengths: jsonb("strengths").default([]),
  conflicts: jsonb("conflicts").default([]),
  icebreakers: jsonb("icebreakers").default([]),
  firstMessage: text("first_message"),
  dateIdea: text("date_idea"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const swipes = pgTable("swipes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  swiperId: varchar("swiper_id").notNull(),
  swipedId: varchar("swiped_id").notNull(),
  direction: text("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userAId: varchar("user_a_id").notNull(),
  userBId: varchar("user_b_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expertApplications = pgTable("expert_applications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  resumeUrl: text("resume_url"),
  resumeText: text("resume_text"),
  portfolioUrls: jsonb("portfolio_urls").default([]),
  specialization: text("specialization"),
  experienceYears: integer("experience_years"),
  skills: jsonb("skills").default([]),
  projectDescriptions: jsonb("project_descriptions").default([]),
  introVideoUrl: text("intro_video_url"),
  hourlyRate: doublePrecision("hourly_rate"),
  status: text("status").default("pending"),
  aiScore: integer("ai_score"),
  expertBadge: text("expert_badge"),
  reasons: jsonb("reasons").default([]),
  advice: text("advice"),
  portfolioScore: integer("portfolio_score"),
  resumeScore: integer("resume_score"),
  skillAlignmentScore: integer("skill_alignment_score"),
  experienceScore: integer("experience_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userLocations = pgTable("user_locations", {
  userId: varchar("user_id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const consultationBookings = pgTable("consultation_bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  expertId: varchar("expert_id").notNull(),
  expertApplicationId: varchar("expert_application_id"),
  status: text("status").default("pending"),
  hourlyRate: doublePrecision("hourly_rate"),
  durationMinutes: integer("duration_minutes").default(60),
  totalAmount: doublePrecision("total_amount"),
  platformFee: doublePrecision("platform_fee"),
  paymentStatus: text("payment_status").default("pending"),
  revenuecatTransactionId: text("revenuecat_transaction_id"),
  notes: text("notes"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AiChatSession = typeof aiChatSessions.$inferSelect;
export type DbActivity = typeof activities.$inferSelect;
export type ActivityParticipant = typeof activityParticipants.$inferSelect;
export type ActivityChatMessage = typeof activityChatMessages.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type CompatibilityResult = typeof compatibilityHistory.$inferSelect;
export type UserLocation = typeof userLocations.$inferSelect;
export type TravelVerification = typeof travelVerification.$inferSelect;
export type ExpertApplication = typeof expertApplications.$inferSelect;
export type ConsultationBooking = typeof consultationBookings.$inferSelect;
