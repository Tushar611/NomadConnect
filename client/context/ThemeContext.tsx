import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "@/hooks/useColorScheme";

export interface CustomTheme {
  primary: string;
  accent: string;
  backgroundRoot: string;
  cardBackground: string;
}

interface ThemeContextType {
  themeMode: "light" | "dark" | "system";
  customTheme: CustomTheme | null;
  isDark: boolean;
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  setCustomTheme: (theme: CustomTheme | null) => void;
  resetToDefault: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_MODE_KEY = "@nomad_theme_mode";
const CUSTOM_THEME_KEY = "@nomad_custom_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<"light" | "dark" | "system">("system");
  const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadThemeSettings();
  }, []);

  const loadThemeSettings = async () => {
    try {
      const [modeStr, themeStr] = await Promise.all([
        AsyncStorage.getItem(THEME_MODE_KEY),
        AsyncStorage.getItem(CUSTOM_THEME_KEY),
      ]);

      if (modeStr) {
        setThemeModeState(modeStr as "light" | "dark" | "system");
      }
      if (themeStr) {
        setCustomThemeState(JSON.parse(themeStr));
      }
    } catch (error) {
      console.error("Failed to load theme settings:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: "light" | "dark" | "system") => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_MODE_KEY, mode);
  };

  const setCustomTheme = async (theme: CustomTheme | null) => {
    setCustomThemeState(theme);
    if (theme) {
      await AsyncStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));
    } else {
      await AsyncStorage.removeItem(CUSTOM_THEME_KEY);
    }
  };

  const resetToDefault = async () => {
    setThemeModeState("system");
    setCustomThemeState(null);
    await AsyncStorage.multiRemove([THEME_MODE_KEY, CUSTOM_THEME_KEY]);
  };

  const isDark = false;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        customTheme,
        isDark,
        setThemeMode,
        setCustomTheme,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}
