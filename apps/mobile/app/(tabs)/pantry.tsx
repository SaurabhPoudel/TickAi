import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics";
import { useState } from "react";
import { Txt } from "@/components/Txt";
import { keys, usePantry } from "@/hooks/queries";
import { api, type PantryItem } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { column } from "@/lib/layout";

/** Grocery memory: what you buy, how much, and when you'll likely run out. */
export default function PantryScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pantry = usePantry();
  const items = pantry.data?.items ?? [];
  const low = items.filter((i) => i.daysLeft != null && i.daysLeft <= 2);
  const rest = items.filter((i) => !(i.daysLeft != null && i.daysLeft <= 2));

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[column, { paddingTop: insets.top + space.xl, paddingHorizontal: space.l, paddingBottom: space.xxl }]}>
      <Txt variant="title" style={{ paddingHorizontal: space.s }}>Pantry</Txt>
      <Txt muted style={{ paddingHorizontal: space.s, marginBottom: space.xl }}>
        Tuck remembers what you buy and how long it lasts, so your next list writes itself.
      </Txt>

      {pantry.isLoading && <Txt muted>Loading…</Txt>}
      {!pantry.isLoading && !items.length && (
        <View style={[styles.empty, { borderColor: t.line }]}>
          <Txt variant="heading">Nothing remembered yet</Txt>
          <Txt muted>Tick items off a shopping list, or tell Tuck what you bought at bedtime. It learns from there.</Txt>
        </View>
      )}

      {low.length > 0 && <Txt variant="heading" style={styles.section}>Running low</Txt>}
      {low.map((i) => <Row key={i.id} item={i} urgent />)}
      {rest.length > 0 && <Txt variant="heading" style={styles.section}>Stocked</Txt>}
      {rest.map((i) => <Row key={i.id} item={i} />)}
    </ScrollView>
  );
}

function Row({ item, urgent }: { item: PantryItem; urgent?: boolean }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [added, setAdded] = useState(false);
  const left = item.daysLeft != null && item.avgIntervalDays ? Math.max(0, Math.min(1, item.daysLeft / item.avgIntervalDays)) : null;

  const add = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdded(true);
    await api.addToList(item.name, item.lastQty, item.unit);
    qc.invalidateQueries({ queryKey: keys.today });
  };

  return (
    <View style={[styles.row, { backgroundColor: t.surface }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{item.name}</Txt>
        <Txt variant="small" muted>{item.summary || `Bought ${item.timesBought} times`}</Txt>
        {left != null && (
          <View style={[styles.track, { backgroundColor: t.raised }]}>
            <View style={{ width: `${left * 100}%`, height: "100%", borderRadius: 3, backgroundColor: urgent ? t.carry : t.done }} />
          </View>
        )}
      </View>
      <Pressable onPress={add} disabled={added} style={[styles.add, { backgroundColor: added ? "transparent" : urgent ? t.primary : t.raised }]} accessibilityRole="button">
        <Txt variant="small" color={added ? t.done : urgent ? t.onPrimary : t.text}>{added ? "On the list" : "Add to list"}</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.l, marginBottom: space.m, paddingHorizontal: space.s },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.row, marginBottom: space.s },
  track: { height: 6, borderRadius: 3, marginTop: space.s, overflow: "hidden", maxWidth: 180 },
  add: { paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.round },
  empty: { borderWidth: 2, borderStyle: "dashed", borderRadius: radius.row, padding: space.xl, gap: space.s },
});
