import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function ChatBackground() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={
          isDark
            ? ["#2D1B0E", "#3A2014", "#1F1410", "#1A120D"]
            : ["#FFF8F0", "#FFE8D0", "#FFDBB8", "#FFF0E0"]
        }
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id="sunGlow" cx="0.7" cy="0.08" rx="0.5" ry="0.35">
            <Stop
              offset="0"
              stopColor={isDark ? "#F4A261" : "#FFD700"}
              stopOpacity={isDark ? "0.15" : "0.25"}
            />
            <Stop
              offset="0.5"
              stopColor={isDark ? "#E8744F" : "#FFA500"}
              stopOpacity={isDark ? "0.08" : "0.12"}
            />
            <Stop
              offset="1"
              stopColor={isDark ? "#E8744F" : "#FF8C42"}
              stopOpacity="0"
            />
          </RadialGradient>
          <RadialGradient id="warmSpot" cx="0.3" cy="0.5" rx="0.6" ry="0.4">
            <Stop
              offset="0"
              stopColor={isDark ? "#F4A261" : "#FFCC80"}
              stopOpacity={isDark ? "0.06" : "0.15"}
            />
            <Stop
              offset="1"
              stopColor={isDark ? "#F4A261" : "#FFCC80"}
              stopOpacity="0"
            />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={SCREEN_WIDTH * 0.7}
          cy={SCREEN_HEIGHT * 0.08}
          rx={SCREEN_WIDTH * 0.6}
          ry={SCREEN_HEIGHT * 0.35}
          fill="url(#sunGlow)"
        />
        <Ellipse
          cx={SCREEN_WIDTH * 0.3}
          cy={SCREEN_HEIGHT * 0.5}
          rx={SCREEN_WIDTH * 0.6}
          ry={SCREEN_HEIGHT * 0.4}
          fill="url(#warmSpot)"
        />
      </Svg>

      {!isDark && (
        <View style={styles.sunRays}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.ray,
                {
                  top: -20 + i * 8,
                  right: 30 + i * 25,
                  width: 2,
                  height: 60 + i * 15,
                  opacity: 0.06 - i * 0.008,
                  transform: [{ rotate: `${-25 + i * 12}deg` }],
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sunRays: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 200,
    height: 200,
  },
  ray: {
    position: "absolute",
    backgroundColor: "#FFB347",
    borderRadius: 1,
  },
});
