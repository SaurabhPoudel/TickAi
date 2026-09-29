import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { Txt } from "./Txt";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { CONTENT_MAX } from "@/lib/layout";

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean };

/** A small menu that looks and works the same on iOS, Android and the web. */
export function ActionSheet({ title, actions, visible, onClose }: {
  title?: string; actions: SheetAction[]; visible: boolean; onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(22)} style={[styles.sheet, { backgroundColor: t.surface }]}>
          {title && <Txt variant="small" muted style={styles.title} numberOfLines={2}>{title}</Txt>}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => { onClose(); a.onPress(); }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.action, { borderTopColor: t.line, backgroundColor: pressed || hovered ? t.raised : "transparent" }]}
            >
              <Txt variant="bodyStrong" color={a.destructive ? "#E0475B" : t.text}>{a.label}</Txt>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={[styles.action, { borderTopColor: t.line }]} accessibilityRole="button">
            <Txt variant="body" muted>Cancel</Txt>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,40,0.45)" },
  anchor: { flex: 1, justifyContent: "flex-end", alignItems: "center", padding: space.m },
  sheet: { width: "100%", maxWidth: CONTENT_MAX - 200, borderRadius: radius.sheet - 8, overflow: "hidden", marginBottom: space.l },
  title: { textAlign: "center", padding: space.l },
  action: { paddingVertical: space.l, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth },
});
