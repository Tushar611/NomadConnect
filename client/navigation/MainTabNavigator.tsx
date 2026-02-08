import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import DiscoverScreen from "@/screens/DiscoverScreen";
import MatchesScreen from "@/screens/MatchesScreen";
import ActivitiesScreen from "@/screens/ActivitiesScreen";
import AIAdvisorScreen from "@/screens/AIAdvisorScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { Icon } from "@/components/Icon";
import { AppColors } from "@/constants/theme";

export type MainTabParamList = {
  DiscoverTab: undefined;
  ConnectionsTab: undefined;
  AIAdvisorTab: undefined;
  ActivitiesTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  const AITabIcon = ({ focused, size }: { focused: boolean; size: number }) => {
    if (focused) {
      return (
        <View style={styles.aiIconContainer}>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiIconGradient}
          >
            <Icon name="cpu" size={size - 4} color="#FFF" />
          </LinearGradient>
        </View>
      );
    }
    return <Icon name="cpu" size={size} color={theme.primary} />;
  };

  return (
    <Tab.Navigator
      initialRouteName="DiscoverTab"
      screenOptions={{
        headerTitleAlign: "center",
        headerTransparent: true,
        headerTintColor: theme.text,
        headerStyle: {
          backgroundColor: Platform.select({
            ios: "transparent",
            android: isDark ? "#1F1B18" : "#FFF8F4",
            web: isDark ? "#1F1B18" : "#FFF8F4",
          }),
        },
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: isDark ? "#7A7A7A" : "#9E9E9E",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: isDark ? "#1F1B18" : "#FFF8F4",
            web: isDark ? "#1F1B18" : "#FFF8F4",
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverScreen}
        options={{
          title: "Discover",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ConnectionsTab"
        component={MatchesScreen}
        options={{
          title: "Connect",
          headerTitle: "Connections",
          tabBarIcon: ({ color, size }) => (
            <Icon name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AIAdvisorTab"
        component={AIAdvisorScreen}
        options={{
          title: "AI Advisor",
          headerTitle: "AI Van Build Advisor",
          tabBarIcon: ({ focused, size }) => (
            <AITabIcon focused={focused} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ActivitiesTab"
        component={ActivitiesScreen}
        options={{
          title: "Activities",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: "Profile",
          headerTitle: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Icon name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  aiIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  aiIconGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
