import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { User } from "@/types";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (email: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_KEY = "@nomad_profile";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getHostFromUri = (uri?: string): string | null => {
    if (!uri) return null;
    const withoutScheme = uri.replace(/^\w+:\/\//, "");
    const host = withoutScheme.split("/")[0];
    const hostname = host.split(":")[0];
    return hostname || null;
  };

  const getApiBaseUrl = (): string => {
    if (process.env.EXPO_PUBLIC_DOMAIN) {
      return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    }

    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.location.origin;
    }

    const debuggerHost = (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
    const hostUri = Constants.expoConfig?.hostUri;
    const host = getHostFromUri(hostUri || debuggerHost || undefined);

    return host ? `http://${host}:5000` : "";
  };

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id, session.user);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const buildDefaultProfile = (authUser: SupabaseUser): User => {
    const email = authUser.email?.toLowerCase() || "";
    const fallbackName = email ? email.split("@")[0] : "Nomad";
    return {
      id: authUser.id,
      email,
      name: (authUser.user_metadata?.name as string) || fallbackName,
      age: 25,
      bio: "",
      location: "",
      photos: [],
      interests: [],
      createdAt: new Date().toISOString(),
    };
  };

  const loadProfile = async (userId: string, fallbackUser?: SupabaseUser): Promise<User | null> => {
    try {
      const stored = await AsyncStorage.getItem(`${PROFILE_KEY}_${userId}`);
      let profile: User;
      if (stored) {
        profile = JSON.parse(stored) as User;
      } else if (fallbackUser) {
        profile = buildDefaultProfile(fallbackUser);
      } else {
        setIsLoading(false);
        return null;
      }

      try {
        const { getApiUrl } = await import("@/lib/query-client");
        const baseUrl = getApiUrl();
        const url = new URL(`/api/verification/status/${userId}`, baseUrl);
        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          profile.isTravelVerified = data.isVerified || false;
          profile.travelBadge = data.badge || undefined;
        }
      } catch {}

      setUser(profile);
      await saveProfile(profile);
      return profile;
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }

    return null;
  };

  const saveProfile = async (profile: User) => {
    try {
      await AsyncStorage.setItem(`${PROFILE_KEY}_${profile.id}`, JSON.stringify(profile));
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await loadProfile(data.user.id, data.user);
        try {
          const { identifyUser } = await import("@/services/revenuecat");
          await identifyUser(data.user.id);
        } catch {}
        return { success: true };
      }

      return { success: false, error: "Login failed" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const newUser: User = {
          id: data.user.id,
          email: email.toLowerCase(),
          name,
          age: 25,
          bio: "",
          location: "",
          photos: [],
          interests: [],
          createdAt: new Date().toISOString(),
        };

        setUser(newUser);
        await saveProfile(newUser);
        try {
          const { identifyUser } = await import("@/services/revenuecat");
          await identifyUser(data.user.id);
        } catch {}
        return { success: true };
      }

      return { success: false, error: "Signup failed" };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      try {
        const { logoutUser } = await import("@/services/revenuecat");
        await logoutUser();
      } catch {}
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const baseUrl = getApiUrl();

      const profileUrl = new URL(`/api/user-profiles/${user.id}`, baseUrl);
      const profileRes = await fetch(profileUrl.toString());
      let serverProfile: Partial<User> = {};
      if (profileRes.ok) {
        const data = await profileRes.json();
        serverProfile = {
          name: data.name || user.name,
          bio: data.bio || user.bio,
          age: data.age || user.age,
          location: data.location || user.location,
          vanType: data.van_type || data.vanType || user.vanType,
          photos: data.photos || user.photos,
          interests: data.interests || user.interests,
          lookingFor: data.looking_for || data.lookingFor || user.lookingFor,
          travelStyle: data.travel_style || data.travelStyle || user.travelStyle,
        };
      }

      let verificationData: Partial<User> = {};
      try {
        const verUrl = new URL(`/api/verification/status/${user.id}`, baseUrl);
        const verRes = await fetch(verUrl.toString());
        if (verRes.ok) {
          const vData = await verRes.json();
          verificationData = {
            isTravelVerified: vData.isVerified || false,
            travelBadge: vData.badge || undefined,
          };
        }
      } catch {}

      const refreshed = { ...user, ...serverProfile, ...verificationData };
      setUser(refreshed);
      await saveProfile(refreshed);
    } catch (error) {
      console.error("Refresh profile error:", error);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      await saveProfile(updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase());

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Reset password error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  };

  const sendPasswordResetOTP = async (email: string): Promise<{ success: boolean; error?: string; devCode?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/send-otp`
        : "/api/password-reset/send-otp";
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to send verification code" };
      }

      return { success: true };
    } catch (error) {
      console.error("Send OTP error:", error);
      return { success: false, error: "Failed to send verification code" };
    }
  };

  const verifyOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/verify-otp`
        : "/api/password-reset/verify-otp";
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Invalid code" };
      }

      return { success: true };
    } catch (error) {
      console.error("Verify OTP error:", error);
      return { success: false, error: "Verification failed" };
    }
  };

  const updatePassword = async (email: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const baseUrl = getApiBaseUrl();
      const apiUrl = baseUrl
        ? `${baseUrl}/api/password-reset/update-password`
        : "/api/password-reset/update-password";
      
      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update password" };
      }

      return { success: true };
    } catch (error) {
      console.error("Update password error:", error);
      return { success: false, error: "Failed to update password" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!session && !!user,
        login,
        signup,
        logout,
        updateProfile,
        refreshProfile,
        resetPassword,
        sendPasswordResetOTP,
        verifyOTP,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
