import { useContext } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemeContext } from "@/context/ThemeContext";

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const context = useContext(ThemeContext);
  
  const themeMode = context?.themeMode ?? "system";
  const customTheme = context?.customTheme ?? null;
  
  const isDark = false;
    
  const baseTheme = isDark ? Colors.dark : Colors.light;
  
  const theme = customTheme
    ? {
        ...baseTheme,
        primary: customTheme.primary,
        accent: customTheme.accent,
      }
    : baseTheme;

  return {
    theme,
    isDark,
  };
}
