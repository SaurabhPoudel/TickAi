import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import * as Haptics from "@/lib/haptics";
import { Txt } from "./Txt";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

export function Button({ label, onPress, kind = "primary", disabled, style }: {
  label: string; onPress: () => void; kind?: "primary" | "quiet"; disabled?: boolean; style?: ViewStyle;
}) {
  const t = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.base,
        primary ? { backgroundColor: t.primary } : { backgroundColor: "transparent" },
        { opacity: disabled ? 0.4 : pressed ? 0.8 : hovered ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <Txt variant="bodyStrong" color={primary ? t.onPrimary : t.muted}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, paddingHorizontal: space.xl, borderRadius: radius.round, alignItems: "center", justifyContent: "center" },
});
