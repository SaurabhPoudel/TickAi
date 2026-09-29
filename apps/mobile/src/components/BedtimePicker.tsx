import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "@/lib/haptics";
import { Txt } from "./Txt";
import { formatTime, shiftTime } from "@/lib/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

export function BedtimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const step = (m: number) => { Haptics.selectionAsync(); onChange(shiftTime(value, m)); };
  return (
    <View style={styles.row}>
      <Pressable onPress={() => step(-15)} style={[styles.btn, { backgroundColor: t.raised }]} accessibilityLabel="Earlier">
        <Txt variant="title">−</Txt>
      </Pressable>
      <Txt variant="display" style={styles.value} accessibilityLiveRegion="polite">{formatTime(value)}</Txt>
      <Pressable onPress={() => step(15)} style={[styles.btn, { backgroundColor: t.raised }]} accessibilityLabel="Later">
        <Txt variant="title">+</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xl },
  btn: { width: 56, height: 56, borderRadius: radius.round, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 150, textAlign: "center" },
});
