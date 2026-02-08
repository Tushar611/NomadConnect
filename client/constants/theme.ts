import { Platform } from "react-native";

export const AppColors = {
  primary: "#E8744F",
  accent: "#F4A261",
  backgroundWarm: "#FDFCFB",
  surface: "#FFFFFF",
  surfaceDark: "#2C2C2E",
  textPrimary: "#1C1C1E",
  textSecondary: "#6C6C70",
  border: "#E5E5EA",
  success: "#4CAF50",
  danger: "#D4503A",
  gradientStart: "#E8744F",
  gradientEnd: "#F4A261",

  sunsetRose: "#E85D75",
  sunsetCoral: "#E8744F",
  sunsetAmber: "#F4A261",
  sunsetGold: "#FFB347",
  sunsetDeep: "#D4503A",
  sunsetWarm: "#F07C5A",
};

export const GradientPresets = {
  discoverLight: ["#FFF5EE", "#FDE8D8", "#F9DCC4", "#FDE8D8", "#FFF5EE"] as const,
  discoverDark: ["#1F1B18", "#2A1F1A", "#33241C", "#2A1F1A", "#1F1B18"] as const,
  connectLight: ["#FFF8F2", "#FCEEE2", "#F9E4D4", "#FFF0E6"] as const,
  connectDark: ["#1F1B18", "#261E19", "#2E221B", "#261E19"] as const,
  activitiesLight: ["#FFF5EE", "#FCE9D8", "#F5DCCA", "#FCEEE0"] as const,
  activitiesDark: ["#1F1B18", "#28201A", "#30261E", "#28201A"] as const,
  profileLight: ["#FFF8F4", "#FDF0E6", "#F8E2D0", "#FDF0E6", "#FFF8F4"] as const,
  profileDark: ["#1F1B18", "#271F1A", "#2F241C", "#271F1A", "#1F1B18"] as const,
  aiLight: ["#FFF3EC", "#FCE4D2", "#F5D4BC", "#FCE4D2", "#FFF3EC"] as const,
  aiDark: ["#1F1B18", "#2C211A", "#34281E", "#2C211A", "#1F1B18"] as const,
  forumLight: ["#FFF6F0", "#FDEADC", "#F7DCCB", "#FDEADC"] as const,
  forumDark: ["#1F1B18", "#291F1A", "#31261E", "#291F1A"] as const,
};

const tintColorLight = AppColors.primary;
const tintColorDark = "#FF8A65";

export const Colors = {
  light: {
    text: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorLight,
    link: AppColors.primary,
    backgroundRoot: AppColors.backgroundWarm,
    backgroundDefault: "#F5F5F5",
    backgroundSecondary: "#EEEEEE",
    backgroundTertiary: "#E0E0E0",
    primary: AppColors.primary,
    accent: AppColors.accent,
    surface: AppColors.surface,
    border: AppColors.border,
    success: AppColors.success,
    danger: AppColors.danger,
    cardBackground: "#FFFFFF",
    inputBackground: "#F8F8F8",
    inputBorder: "#E5E5EA",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6C6C70",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    backgroundRoot: "#1F1B18",
    backgroundDefault: "#29231F",
    backgroundSecondary: "#332C27",
    backgroundTertiary: "#3D352F",
    primary: tintColorDark,
    accent: "#FFB88C",
    surface: "#29231F",
    border: "#3D352F",
    success: "#66BB6A",
    danger: "#F07C5A",
    cardBackground: "#29231F",
    inputBackground: "#332C27",
    inputBorder: "#3D352F",
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};
