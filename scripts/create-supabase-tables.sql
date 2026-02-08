-- Nomad Connect Database Schema
-- Paste this entire script in the Supabase SQL Editor and click "Run"

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT,
  age INTEGER DEFAULT 0,
  bio TEXT DEFAULT '',
  interests JSONB DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  location TEXT DEFAULT '',
  van_type TEXT,
  travel_style TEXT,
  is_travel_verified BOOLEAN DEFAULT false,
  travel_badge TEXT,
  is_expert BOOLEAN DEFAULT false,
  expert_badge TEXT,
  expert_rating NUMERIC,
  reviews_count INTEGER DEFAULT 0,
  compatibility_checks_this_week INTEGER DEFAULT 0,
  radar_scans_this_week INTEGER DEFAULT 0,
  last_reset_timestamp BIGINT DEFAULT 0,
  is_visible_on_radar BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'other',
  date TIMESTAMPTZ,
  location TEXT DEFAULT '',
  latitude TEXT,
  longitude TEXT,
  host_id TEXT,
  host_data JSONB,
  attendee_ids JSONB DEFAULT '[]'::jsonb,
  attendees_data JSONB DEFAULT '[]'::jsonb,
  max_attendees INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_chat_messages (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT DEFAULT '',
  sender_photo TEXT DEFAULT '',
  type TEXT DEFAULT 'text',
  content TEXT DEFAULT '',
  photo_url TEXT,
  file_url TEXT,
  file_name TEXT,
  audio_url TEXT,
  audio_duration TEXT,
  reply_to JSONB,
  location JSONB,
  is_pinned TEXT DEFAULT 'false',
  is_moderator_message TEXT DEFAULT 'false',
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_locations (
  user_id TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS swipes (
  id TEXT DEFAULT gen_random_uuid()::text,
  swiper_id TEXT NOT NULL,
  swiped_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (swiper_id, swiped_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compatibility_history (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  score INTEGER,
  strengths JSONB DEFAULT '[]'::jsonb,
  conflicts JSONB DEFAULT '[]'::jsonb,
  icebreakers JSONB DEFAULT '[]'::jsonb,
  first_message TEXT,
  date_idea TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_verification (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  photo_url TEXT,
  secondary_photo_url TEXT,
  answer1 TEXT,
  answer2 TEXT,
  answer3 TEXT,
  status TEXT DEFAULT 'pending',
  badge_type TEXT,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expert_applications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  resume_url TEXT,
  resume_text TEXT,
  portfolio_urls JSONB DEFAULT '[]'::jsonb,
  specialization TEXT,
  experience_years INTEGER,
  skills JSONB DEFAULT '[]'::jsonb,
  project_descriptions JSONB DEFAULT '[]'::jsonb,
  intro_video_url TEXT,
  hourly_rate NUMERIC,
  status TEXT DEFAULT 'pending',
  ai_score NUMERIC,
  expert_badge TEXT,
  reasons JSONB,
  advice TEXT,
  portfolio_score NUMERIC,
  resume_score NUMERIC,
  skill_alignment_score NUMERIC,
  experience_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultation_bookings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  expert_application_id INTEGER,
  hourly_rate NUMERIC DEFAULT 0,
  duration_minutes INTEGER DEFAULT 60,
  total_amount NUMERIC DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  revenuecat_transaction_id TEXT,
  notes TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activity_messages_activity ON activity_chat_messages(activity_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes(swiped_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches(user_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches(user_b_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_coords ON user_locations(lat, lng);
CREATE INDEX IF NOT EXISTS idx_compatibility_users ON compatibility_history(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_travel_verification_user ON travel_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_apps_user ON expert_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_user ON consultation_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_expert ON consultation_bookings(expert_id);

-- Insert sample mock profiles for the Discover feature
INSERT INTO user_profiles (id, name, age, bio, interests, photos, location, van_type, travel_style, is_travel_verified, travel_badge)
VALUES 
  ('mock_sarah', 'Sarah', 28, 'Full-time van lifer exploring the west coast. Love hiking, photography, and meeting fellow nomads!', '["hiking", "photography", "cooking", "yoga"]'::jsonb, '["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"]'::jsonb, 'California', 'Sprinter Van', 'slow_travel', true, 'explorer'),
  ('mock_jake', 'Jake', 32, 'Digital nomad and surfer. Working remote while chasing waves across the coast.', '["surfing", "coding", "camping", "music"]'::jsonb, '["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"]'::jsonb, 'Oregon', 'School Bus', 'adventure', true, 'adventurer'),
  ('mock_luna', 'Luna', 26, 'Artist and free spirit. Painting my way across national parks.', '["painting", "hiking", "meditation", "wildlife"]'::jsonb, '["https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400"]'::jsonb, 'Colorado', 'VW Bus', 'slow_travel', true, 'nomad'),
  ('mock_alex', 'Alex', 30, 'Adventure photographer documenting van life communities across America.', '["photography", "climbing", "travel", "storytelling"]'::jsonb, '["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"]'::jsonb, 'Utah', 'Ford Transit', 'adventure', false, null),
  ('mock_maya', 'Maya', 27, 'Yoga teacher and wellness coach living the nomad dream. Teaching classes at campgrounds!', '["yoga", "wellness", "cooking", "hiking"]'::jsonb, '["https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400"]'::jsonb, 'Arizona', 'Sprinter Van', 'slow_travel', true, 'explorer')
ON CONFLICT (id) DO NOTHING;
