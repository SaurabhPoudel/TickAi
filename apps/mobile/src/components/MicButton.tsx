import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring, type SharedValue } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { MicIcon, StopIcon } from "./Icons";
import { useTheme } from "@/theme/ThemeProvider";

const SIZE = 78;

/** The mic is the app's front door. Its rings breathe with your voice while listening. */
export function MicButton({ listening, level, onPress, busy }: {
  listening: boolean; level: SharedValue<number>; onPress: () => void; busy?: boolean;
}) {
  const t = useTheme();
  const outer = useAnimatedStyle(() => ({
    opacity: listening ? 0.14 + level.value * 0.16 : 0,
    transform: [{ scale: withSpring(listening ? 1.13 + level.value * 0.9 : 0.9, { damping: 14 }) }],
  }));
  const inner = useAnimatedStyle(() => ({
    opacity: listening ? 0.2 + level.value * 0.25 : 0,
    transform: [{ scale: withSpring(listening ? 1.08 + level.value * 0.55 : 0.9, { damping: 14 }) }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, { backgroundColor: t.primary }, outer]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { backgroundColor: t.primary }, inner]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop listening" : "Tap to talk"}
        disabled={busy}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
        style={({ pressed }) => [styles.button, { backgroundColor: t.primary, opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        {listening ? <StopIcon color={t.onPrimary} /> : <MicIcon color={t.onPrimary} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE * 1.9, height: SIZE * 1.9, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE },
  button: {
    width: SIZE, height: SIZE, borderRadius: SIZE, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
});
