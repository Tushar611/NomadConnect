#!/bin/bash

# ============================================
# Nomad Connect - Dependency Installation
# ============================================
# Run this script to install all dependencies
# Usage: bash install-dependencies.sh
# ============================================

echo "Installing Nomad Connect dependencies..."

# --- Production Dependencies ---

npm install \
  @expo-google-fonts/nunito@^0.4.2 \
  @expo/vector-icons@^15.0.3 \
  @react-native-async-storage/async-storage@2.2.0 \
  @react-native-community/datetimepicker@^8.4.4 \
  @react-native-community/slider@^5.0.1 \
  @react-navigation/bottom-tabs@^7.12.0 \
  @react-navigation/elements@^2.9.5 \
  @react-navigation/native@^7.1.28 \
  @react-navigation/native-stack@^7.12.0 \
  @stardazed/streams-text-encoding@^1.0.2 \
  @supabase/supabase-js@^2.95.3 \
  @tanstack/react-query@^5.83.0 \
  @types/multer@^2.0.0 \
  @ungap/structured-clone@^1.3.0 \
  babel-plugin-module-resolver@^5.0.2 \
  base64-arraybuffer@^1.0.2 \
  drizzle-orm@^0.39.3 \
  drizzle-zod@^0.7.0 \
  expo@~54.0.33 \
  expo-audio@^1.1.1 \
  expo-blur@~15.0.8 \
  expo-constants@~18.0.11 \
  expo-document-picker@^14.0.8 \
  expo-file-system@^19.0.21 \
  expo-font@~14.0.10 \
  expo-glass-effect@~0.1.4 \
  expo-haptics@~15.0.8 \
  expo-image@~3.0.11 \
  expo-image-picker@~17.0.9 \
  expo-linear-gradient@~15.0.8 \
  expo-linking@~8.0.10 \
  expo-location@~19.0.8 \
  expo-media-library@^18.2.1 \
  expo-router@~6.0.23 \
  expo-sensors@^15.0.8 \
  expo-sharing@^14.0.8 \
  expo-sms@^14.0.8 \
  expo-splash-screen@~31.0.12 \
  expo-status-bar@~3.0.9 \
  expo-symbols@~1.0.8 \
  expo-system-ui@~6.0.9 \
  expo-video@^3.0.15 \
  expo-web-browser@~15.0.10 \
  express@^5.0.1 \
  http-proxy-middleware@^3.0.5 \
  lottie-react-native@^7.3.5 \
  multer@^2.0.2 \
  openai@^6.18.0 \
  pg@^8.16.3 \
  react@19.1.0 \
  react-dom@19.1.0 \
  react-native@0.81.5 \
  react-native-gesture-handler@~2.28.0 \
  react-native-keyboard-controller@^1.18.5 \
  react-native-maps@1.18.0 \
  react-native-purchases@^9.7.6 \
  react-native-purchases-ui@^9.7.6 \
  react-native-reanimated@~4.1.1 \
  react-native-safe-area-context@~5.6.0 \
  react-native-screens@~4.16.0 \
  react-native-svg@15.12.1 \
  react-native-web@^0.21.0 \
  react-native-worklets@0.5.1 \
  resend@^6.9.1 \
  tsx@^4.20.6 \
  ws@^8.18.0 \
  zod@^3.24.2 \
  zod-validation-error@^3.4.0

# --- Dev Dependencies ---

npm install --save-dev \
  @babel/core@^7.25.2 \
  @expo/ngrok@^4.1.0 \
  @types/express@^5.0.0 \
  @types/react@~19.1.10 \
  babel-plugin-react-compiler@^19.0.0-beta-e993439-20250117 \
  drizzle-kit@^0.31.4 \
  eslint@^9.31.0 \
  eslint-config-expo@~10.0.0 \
  patch-package@^8.0.0 \
  typescript@~5.9.2

echo ""
echo "All dependencies installed successfully!"
echo ""
echo "--- Next Steps ---"
echo "1. Set up your environment variables / secrets:"
echo "   - DATABASE_URL              -> Used in: server/routes.ts, drizzle.config.ts"
echo "   - EXPO_PUBLIC_SUPABASE_URL  -> Used in: client/lib/supabase.ts"
echo "   - EXPO_PUBLIC_SUPABASE_ANON_KEY -> Used in: client/lib/supabase.ts"
echo "   - SUPABASE_SERVICE_ROLE_KEY -> Used in: server/routes.ts"
echo "   - GROQ_API_KEY              -> Used in: server/routes.ts"
echo "   - EXPO_PUBLIC_REVENUECAT_API_KEY     -> Used in: client/services/revenuecat.ts"
echo "   - EXPO_PUBLIC_REVENUECAT_IOS_KEY     -> Used in: client/services/revenuecat.ts"
echo "   - EXPO_PUBLIC_REVENUECAT_ANDROID_KEY -> Used in: client/services/revenuecat.ts"
echo "   - EMAILJS_PUBLIC_KEY        -> Used in: server/routes.ts"
echo "   - EMAILJS_PRIVATE_KEY       -> Used in: server/routes.ts"
echo "   - EMAILJS_SERVICE_ID        -> Used in: server/routes.ts"
echo "   - EMAILJS_TEMPLATE_ID       -> Used in: server/routes.ts"
echo "   - SESSION_SECRET            -> Used in: server/index.ts (session config)"
echo ""
echo "2. Push database schema:"
echo "   npm run db:push"
echo ""
echo "3. Start the app:"
echo "   npm run server:dev   (backend)"
echo "   npm run expo:dev     (frontend)"
