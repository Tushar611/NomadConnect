import { useContext } from "react";
import { Colors } from "@/constants/theme";
import { ThemeContext } from "@/context/ThemeContext";

export function useTheme() {
  const context = useContext(ThemeContext);

  const customTheme = context?.customTheme ?? null;
  const isDark = false;
  const baseTheme = Colors.light;
  
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
