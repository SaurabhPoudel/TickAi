import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import * as Haptics from "@/lib/haptics";
import { CheckIcon } from "./Icons";
import { Txt } from "./Txt";
import { ActionSheet, type SheetAction } from "./ActionSheet";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { formatTime } from "@/lib/time";
import type { Item, Task } from "@/lib/api";

function meta(task: Task) {
  const bits: string[] = [];
  if (task.startTime) bits.push(formatTime(task.startTime));
  if (task.person && !task.title.includes(task.person)) bits.push(`with ${task.person}`);
  if (task.location) bits.push(task.location);
  if (task.kind === "shopping" && task.items.length) {
    const left = task.items.filter((i) => !i.checked).length;
    bits.push(left ? `${left} of ${task.items.length} left to get` : "Everything's in the basket");
  }
  return bits.join(", ");
}

function qty(i: Item) {
  if (i.qty == null) return "";
  const n = Number.isInteger(i.qty) ? i.qty : i.qty.toFixed(1);
  return i.unit ? `${n} ${i.unit}` : `${n}`;
}

export function TaskRow({ task, onToggle, onCheckItem, onMove, onDrop, onDelete }: {
  task: Task;
  onToggle: () => void;
  onCheckItem: (item: Item) => void;
  onMove?: () => void;
  onDrop?: () => void;
  onDelete?: () => void;
}) {
  const t = useTheme();
  const done = task.status === "done";
  const [open, setOpen] = useState(task.kind === "shopping" && !done);
  const pop = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const toggle = () => {
    pop.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
    Haptics.notificationAsync(done ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    onToggle();
  };

  const [menu, setMenu] = useState(false);
  const actions: SheetAction[] = [
    onMove && { label: "Move to tomorrow", onPress: onMove },
    onDrop && { label: "Not doing it", onPress: onDrop },
    onDelete && { label: "Delete", onPress: onDelete, destructive: true },
  ].filter(Boolean) as SheetAction[];
  const more = () => { Haptics.selectionAsync(); setMenu(true); };

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} entering={FadeIn} style={[styles.card, { backgroundColor: t.surface }]}>
      <Pressable onPress={() => task.items.length && setOpen(!open)} onLongPress={more} style={styles.row}>
        <Pressable onPress={toggle} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={task.title}>
          <Animated.View style={[styles.check, { borderColor: done ? t.done : t.line, backgroundColor: done ? t.done : "transparent" }, checkStyle]}>
            {done && <CheckIcon color={t.mode === "night" ? t.bg : "#fff"} />}
          </Animated.View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" style={done ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}>{task.title}</Txt>
          {!!meta(task) && <Txt variant="small" muted>{meta(task)}</Txt>}
          {task.carryCount >= 2 && !done && (
            <Txt variant="small" color={t.carry}>Moved {task.carryCount} times</Txt>
          )}
        </View>
        {/* Long-press opens the menu on phones; the web gets a visible button too. */}
        {Platform.OS === "web" && actions.length > 0 && (
          <Pressable onPress={more} hitSlop={8} accessibilityLabel={`More options for ${task.title}`} style={styles.more}>
            <Txt variant="heading" muted>⋯</Txt>
          </Pressable>
        )}
      </Pressable>
      <ActionSheet title={task.title} actions={actions} visible={menu} onClose={() => setMenu(false)} />

      {open && task.items.length > 0 && (
        <View style={[styles.items, { borderTopColor: t.line }]}>
          {task.items.map((i) => (
            <Pressable key={i.id} onPress={() => { Haptics.selectionAsync(); onCheckItem(i); }} style={styles.item} accessibilityRole="checkbox" accessibilityState={{ checked: i.checked }}>
              <View style={[styles.itemBox, { borderColor: i.checked ? t.done : t.line, backgroundColor: i.checked ? t.done : "transparent" }]}>
                {i.checked && <CheckIcon size={12} color={t.mode === "night" ? t.bg : "#fff"} />}
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="body" style={i.checked ? { opacity: 0.45, textDecorationLine: "line-through" } : undefined}>
                  {i.name}{qty(i) ? <Txt variant="body" muted>{`  ${qty(i)}`}</Txt> : null}
                </Txt>
                {!!i.suggestionReason && !i.checked && <Txt variant="small" muted>{i.suggestionReason}</Txt>}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.row, marginBottom: space.s, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.m, padding: space.l },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: -1 },
  items: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.l, paddingBottom: space.s, paddingLeft: 56 },
  item: { flexDirection: "row", gap: space.m, paddingVertical: space.s, alignItems: "flex-start" },
  more: { paddingHorizontal: space.s, marginTop: -4 },
  itemBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
