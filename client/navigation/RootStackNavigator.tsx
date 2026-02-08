import React, { useState, useCallback, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthScreen from "@/screens/AuthScreen";
import ChatScreen from "@/screens/ChatScreen";
import ActivityChatScreen from "@/screens/ActivityChatScreen";
import AIAdvisorScreen from "@/screens/AIAdvisorScreen";
import AIChatScreen from "@/screens/AIChatScreen";
import AIPhotoAnalysisScreen from "@/screens/AIPhotoAnalysisScreen";
import AICostEstimatorScreen from "@/screens/AICostEstimatorScreen";
import ExpertMarketplaceScreen from "@/screens/ExpertMarketplaceScreen";
import ApplyAsExpertScreen from "@/screens/ApplyAsExpertScreen";
import ExpertStatusScreen from "@/screens/ExpertStatusScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import CustomerCenterScreen from "@/screens/CustomerCenterScreen";
import SocialRadarScreen from "@/screens/SocialRadarScreen";
import SplashScreen from "@/screens/SplashScreen";
import TravelVerificationScreen from "@/screens/TravelVerificationScreen";
import { SOSButton } from "@/components/SOSButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const AI_SCREENS = ["AIAdvisor", "AIChat", "AIPhotoAnalysis", "AICostEstimator", "ExpertMarketplace", "ApplyAsExpert", "ExpertStatus"];
const CHAT_SCREENS = ["Chat", "ActivityChat"];
const AI_TAB = "AIAdvisorTab";
const DISCOVER_TAB = "DiscoverTab";

function getActiveRouteName(state: any): string | null {
  if (!state || !state.routes) return null;
  const route = state.routes[state.index];
  if (!route) return null;
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  Chat: { matchId: string; matchName: string; matchPhoto?: string };
  ActivityChat: { activityId: string; activityTitle: string };
  AIAdvisor: undefined;
  AIChat: undefined;
  AIPhotoAnalysis: undefined;
  AICostEstimator: undefined;
  ExpertMarketplace: undefined;
  ApplyAsExpert: undefined;
  ExpertStatus: undefined;
  Subscription: undefined;
  CustomerCenter: undefined;
  SocialRadar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const [currentRoute, setCurrentRoute] = useState<string>("Main");
  const [showSplash, setShowSplash] = useState(true);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      checkVerificationStatus();
    } else {
      setIsVerified(null);
    }
  }, [isAuthenticated, user?.id]);

  const checkVerificationStatus = async () => {
    if (!user?.id) return;
    setCheckingVerification(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/verification/status/${user.id}`, baseUrl);
      const response = await fetch(url.toString());
      const data = await response.json();
      setIsVerified(data.isVerified || false);
    } catch {
      setIsVerified(false);
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleVerified = async (badge?: string) => {
    setIsVerified(true);
    const validBadge = (badge || "nomad") as "nomad" | "adventurer" | "explorer";
    await updateProfile({
      isTravelVerified: true,
      travelBadge: validBadge,
    });
  };

  const handleStateChange = useCallback((e: any) => {
    const state = e?.data?.state;
    if (state) {
      const activeRoute = getActiveRouteName(state);
      if (activeRoute) {
        setCurrentRoute(activeRoute);
      }
    }
  }, []);


  if (showSplash) {
    return (
      <SplashScreen onAnimationComplete={() => setShowSplash(false)} />
    );
  }

  if (isLoading || (isAuthenticated && checkingVerification)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (isAuthenticated && isVerified === false) {
    return <TravelVerificationScreen onVerified={handleVerified} />;
  }

  const isAIScreen = AI_SCREENS.includes(currentRoute) || currentRoute === AI_TAB;
  const isChatScreen = CHAT_SCREENS.includes(currentRoute);
  const isDiscoverScreen = currentRoute === DISCOVER_TAB;
  const showSOS = isAuthenticated && !isAIScreen && !isChatScreen;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator 
        screenOptions={screenOptions}
        screenListeners={{
          state: handleStateChange,
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                headerTitle: "",
                headerBackTitle: "Back",
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerTintColor: "#000000",
                headerShadowVisible: false,
              })}
            />
            <Stack.Screen
              name="ActivityChat"
              component={ActivityChatScreen}
              options={({ route }) => ({
                headerTitle: route.params.activityTitle,
                headerBackTitle: "Back",
                headerTransparent: true,
                headerStyle: { backgroundColor: "transparent" },
                headerTintColor: "#000000",
                headerTitleStyle: { color: "#000000" },
                headerShadowVisible: false,
              })}
            />
            <Stack.Screen
              name="AIAdvisor"
              component={AIAdvisorScreen}
              options={{
                headerTitle: "AI Van Build Advisor",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="AIChat"
              component={AIChatScreen}
              options={{
                headerTitle: "AI Chat",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="AIPhotoAnalysis"
              component={AIPhotoAnalysisScreen}
              options={{
                headerTitle: "Photo Analysis",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="AICostEstimator"
              component={AICostEstimatorScreen}
              options={{
                headerTitle: "Cost Estimator",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="ExpertMarketplace"
              component={ExpertMarketplaceScreen}
              options={{
                headerTitle: "Expert Marketplace",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="ApplyAsExpert"
              component={ApplyAsExpertScreen}
              options={{
                headerTitle: "Become an Expert",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="ExpertStatus"
              component={ExpertStatusScreen}
              options={{
                headerTitle: "Application Status",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="CustomerCenter"
              component={CustomerCenterScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="SocialRadar"
              component={SocialRadarScreen}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
      <SOSButton visible={showSOS} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
