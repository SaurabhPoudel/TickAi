import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SkyHeader } from "@/components/SkyHeader";
import { TaskRow } from "@/components/TaskRow";
import { Txt } from "@/components/Txt";
import { MicButton } from "@/components/MicButton";
import { CaptureSheet } from "@/components/CaptureSheet";
import { GearIcon, MoonIcon } from "@/components/Icons";
import { keys, useCheckItem, useMe, useSetStatus, useToday } from "@/hooks/queries";
import { api, type Task } from "@/lib/api";
import { formatTime, greeting, minutesToBedtime } from "@/lib/time";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MicIcon } from "@/components/Icons";
import { useLayout } from "@/lib/layout";

function addDay(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const me = useMe();
  const today = useToday();
  const setStatus = useSetStatus();
  const checkItem = useCheckItem();
  const [capture, setCapture] = useState<null | "listening" | "typing">(null);
  const idle = useSharedValue(0);
  const { wide } = useLayout();

  const tasks = today.data?.today ?? [];
  const tomorrow = today.data?.tomorrow ?? [];
  const done = tasks.filter((x) => x.status === "done");
  const open = tasks.filter((x) => x.status === "open");
  const bedtime = me.data?.bedtime ?? "22:30";
  const toBed = minutesToBedtime(bedtime);
  const tuckedIn = me.data?.lastClosedDay === today.data?.day;
  const nearBed = !tuckedIn && toBed <= 90;

  const headline = useMemo(() => {
    if (!tasks.length) return "A clear day.";
    if (!open.length) return "All done. Nice.";
    return `${done.length} of ${tasks.length} done`;
  }, [tasks.length, open.length, done.length]);

  const rowProps = (task: Task) => ({
    task,
    onToggle: () => setStatus.mutate({ id: task.id, status: task.status === "done" ? "open" : "done" }),
    onCheckItem: (i: Task["items"][number]) => checkItem.mutate({ id: i.id, checked: !i.checked }),
    onMove: () => api.updateTask(task.id, { day: addDay(task.day, 1) }).then(() => qc.invalidateQueries({ queryKey: keys.today })),
    onDrop: () => setStatus.mutate({ id: task.id, status: "dropped" }),
    onDelete: () => api.deleteTask(task.id).then(() => qc.invalidateQueries({ queryKey: keys.today })),
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: wide ? space.xxl : 200 }}
        refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={() => today.refetch()} tintColor={t.muted} />}
      >
        <SkyHeader
          earned={done.length}
          height={wide ? 190 : 230}
          maxWidth={wide ? 1040 : undefined}
          moonPhase={me.data?.moonPhase}
          topLeft={
            <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={{ padding: space.xs }} accessibilityLabel="Settings">
              <GearIcon color={t.mode === "day" ? t.text : "#fff"} />
            </Pressable>
          }
        >
          <Txt variant="small" color={t.mode === "day" ? t.muted : "rgba(255,255,255,0.75)"}>
            {greeting()}{me.data?.name ? `, ${me.data.name}` : ""}
          </Txt>
          <Txt variant="display" color={t.mode === "day" ? t.text : "#fff"}>{headline}</Txt>
        </SkyHeader>

        <View style={[styles.body, wide ? styles.bodyWide : styles.bodyNarrow]}>
          <View style={wide ? { flex: 1.7 } : undefined}>
          {wide && (
            <View style={[styles.captureBar, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Pressable onPress={() => setCapture("typing")} style={{ flex: 1, paddingVertical: space.l }} accessibilityRole="button">
                <Txt muted>Add to your day. Try "groceries, bake a cake, meet Rahul at 6"</Txt>
              </Pressable>
              <Pressable onPress={() => setCapture("listening")} style={[styles.captureMic, { backgroundColor: t.primary }]} accessibilityLabel="Tap to talk">
                <MicIcon color={t.onPrimary} size={22} />
              </Pressable>
            </View>
          )}
          {nearBed && (
            <Animated.View entering={FadeIn}>
              <Pressable onPress={() => router.push("/checkin")} style={[styles.tuck, { backgroundColor: t.mode === "day" ? t.primary : "#1E2154" }]}>
                <MoonIcon color="#F3DE8A" />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong" color="#fff">Ready to tuck in?</Txt>
                  <Txt variant="small" color="rgba(255,255,255,0.75)">One minute to close out today.</Txt>
                </View>
              </Pressable>
            </Animated.View>
          )}

          {today.isLoading && <Txt muted>Loading your day…</Txt>}
          {today.error && <Txt color={t.carry}>{(today.error as Error).message}</Txt>}

          {!today.isLoading && !tasks.length && (
            <Pressable onPress={() => setCapture("listening")} style={[styles.empty, { borderColor: t.line }]}>
              <Txt variant="heading">Nothing planned yet</Txt>
              <Txt muted>Tap the mic and say everything at once, like "buy groceries, bake a cake, and meet Rahul at 6."</Txt>
            </Pressable>
          )}

          {(today.data?.events ?? []).map((e) => (
            <View key={e.id} style={[styles.event, { borderLeftColor: t.primary }]}>
              <Txt variant="small" muted>{e.allDay ? "All day" : formatTime(e.start?.slice(11, 16) ?? null)}</Txt>
              <Txt variant="bodyStrong">{e.title}</Txt>
            </View>
          ))}

          {tasks.filter((x) => x.status !== "dropped").map((task) => <TaskRow key={task.id} {...rowProps(task)} />)}
          </View>

          {tomorrow.length > 0 && (
            <View style={wide ? [styles.side, { backgroundColor: t.surface }] : { marginTop: space.xl }}>
              <Txt variant="heading" style={{ marginBottom: space.m }}>Tomorrow</Txt>
              {tomorrow.map((task) => (
                <Txt key={task.id} muted style={{ marginBottom: space.xs }}>
                  {task.startTime ? `${formatTime(task.startTime)}  ` : ""}{task.title}
                </Txt>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {!wide && (
        <View style={styles.dock} pointerEvents="box-none">
          <LinearGradient pointerEvents="none" colors={[`${t.bg}00`, t.bg, t.bg]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <MicButton listening={false} level={idle} onPress={() => setCapture("listening")} />
          <Pressable onPress={() => setCapture("typing")} hitSlop={8} style={{ marginTop: -space.xl, paddingBottom: space.s }}>
            <Txt variant="small" muted>or type</Txt>
          </Pressable>
        </View>
      )}

      <CaptureSheet visible={capture !== null} startWith={capture ?? "listening"} onClose={() => setCapture(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.l, paddingTop: space.l, width: "100%", alignSelf: "center" },
  bodyNarrow: { maxWidth: 680 },
  bodyWide: { maxWidth: 1040, flexDirection: "row", gap: space.xl, alignItems: "flex-start" },
  side: { flex: 1, padding: space.xl, borderRadius: 16 },
  tuck: { flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.row, marginBottom: space.l },
  empty: { borderWidth: 2, borderStyle: "dashed", borderRadius: radius.row, padding: space.xl, gap: space.s },
  event: { borderLeftWidth: 3, paddingLeft: space.m, paddingVertical: space.xs, marginBottom: space.m, marginLeft: space.xs },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingTop: space.xl },
  captureBar: { flexDirection: "row", alignItems: "center", gap: space.m, paddingLeft: space.l, paddingRight: space.s, borderRadius: radius.round, borderWidth: 1, marginBottom: space.l },
  captureMic: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
