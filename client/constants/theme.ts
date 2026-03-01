import { Platform } from "react-native";

export const AppColors = {
  primary: "#246BFD",
  accent: "#2CC3FF",
  backgroundWarm: "#F4F8FF",
  surface: "#FFFFFF",
  surfaceDark: "#0E1A34",
  textPrimary: "#0A1328",
  textSecondary: "#5E6B84",
  border: "#D7E2F2",
  success: "#2E9D62",
  danger: "#C74B5A",
  gradientStart: "#246BFD",
  gradientEnd: "#2CC3FF",

  sunsetRose: "#EF4444",
  sunsetCoral: "#F97316",
  sunsetAmber: "#FB7185",
  sunsetGold: "#F59E0B",
  sunsetDeep: "#7F1D1D",
  sunsetWarm: "#EA580C",
};

export const GradientPresets = {
  discoverLight: ["#F5F9FF", "#EEF5FF", "#E5EEFF", "#EEF5FF", "#F5F9FF"] as const,
  discoverDark: ["#0A1226", "#0D1830", "#122149", "#0D1830", "#0A1226"] as const,
  connectLight: ["#F5F9FF", "#EDF4FF", "#E4EEFF", "#EDF4FF"] as const,
  connectDark: ["#0A1226", "#0E1934", "#13224A", "#0E1934"] as const,
  activitiesLight: ["#F5F9FF", "#ECF3FF", "#E3ECFF", "#ECF3FF"] as const,
  activitiesDark: ["#0A1226", "#0E1934", "#142550", "#0E1934"] as const,
  profileLight: ["#F5F9FF", "#ECF3FF", "#E3ECFF", "#ECF3FF", "#F5F9FF"] as const,
  profileDark: ["#0A1226", "#0E1934", "#122149", "#0E1934", "#0A1226"] as const,
  aiLight: ["#F5F9FF", "#ECF3FF", "#E3ECFF", "#ECF3FF", "#F5F9FF"] as const,
  aiDark: ["#0A1226", "#0E1934", "#122149", "#0E1934", "#0A1226"] as const,
  forumLight: ["#F5F9FF", "#ECF3FF", "#E3ECFF", "#ECF3FF"] as const,
  forumDark: ["#0A1226", "#0E1934", "#122149", "#0E1934"] as const,
};

const tintColorLight = AppColors.primary;
const tintColorDark = "#6BA3FF";

export const Colors = {
  light: {
    text: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: "#93A0B8",
    tabIconSelected: tintColorLight,
    link: AppColors.primary,
    backgroundRoot: AppColors.backgroundWarm,
    backgroundDefault: "#EEF4FF",
    backgroundSecondary: "#E7EFFB",
    backgroundTertiary: "#DDE7F5",
    primary: AppColors.primary,
    accent: AppColors.accent,
    surface: AppColors.surface,
    border: AppColors.border,
    success: AppColors.success,
    danger: AppColors.danger,
    cardBackground: "#FFFFFF",
    inputBackground: "#FFFFFF",
    inputBorder: "#CEDBED",
  },
  dark: {
    text: "#EAF1FF",
    textSecondary: "#A7B5D0",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6E7EA1",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    backgroundRoot: "#0A1226",
    backgroundDefault: "#0F1B38",
    backgroundSecondary: "#122149",
    backgroundTertiary: "#162955",
    primary: "#6BA3FF",
    accent: "#89D6FF",
    surface: "#101E40",
    border: "#21355C",
    success: "#5BC986",
    danger: "#EC7685",
    cardBackground: "#101E40",
    inputBackground: "#13244A",
    inputBorder: "#26406A",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 52,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 7,
  },
};
