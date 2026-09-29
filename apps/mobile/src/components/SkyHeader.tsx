import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StarField } from "./StarField";
import { Moon } from "./Moon";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";
import { column } from "@/lib/layout";
import type { ReactNode } from "react";

/**
 * The signature element. A sky that follows your evening:
 * each task you finish today adds a star; near bedtime the moon rises.
 */
export function SkyHeader({ earned, moonPhase, children, topLeft, height = 230, maxWidth }: {
  earned: number; moonPhase?: number; children?: ReactNode; topLeft?: ReactNode; height?: number; maxWidth?: number;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const h = height + insets.top;
  const showMoon = t.mode !== "day" && moonPhase != null;
  return (
    <View style={{ height: h }}>
      <LinearGradient colors={t.sky} style={StyleSheet.absoluteFill} />
      <StarField earned={earned} ambient={t.mode === "day" ? 0 : 28} color={t.star} width={width} height={h * 0.62} seed={7} />
      {showMoon && (
        <View style={{ position: "absolute", right: space.l, top: insets.top + space.s }}>
          <Moon phase={moonPhase!} size={86} />
        </View>
      )}
      {topLeft && <View style={{ position: "absolute", left: space.l, top: insets.top + space.s }}>{topLeft}</View>}
      <View style={[column, maxWidth ? { maxWidth } : null, { flex: 1, justifyContent: "flex-end", paddingHorizontal: space.xl, paddingBottom: space.xl }]}>{children}</View>
    </View>
  );
}
