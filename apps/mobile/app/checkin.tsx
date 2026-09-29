import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics";
import { ForceMode, useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/Txt";
import { Moon } from "@/components/Moon";
import { StarField } from "@/components/StarField";
import { MicButton } from "@/components/MicButton";
import { Button } from "@/components/Button";
import { useVoice } from "@/hooks/useVoice";
import { keys, useMe } from "@/hooks/queries";
import { api, type Closed, type Task } from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/speak";
import { radius, space, type as typeScale } from "@/theme/tokens";

const CHECKIN_MAX = 560;

type ChipTask = Task & { moved?: boolean };

/** Carried tasks leave today's list on the server; keep them visible here, marked as moved. */
function merge(prev: ChipTask[], next: Task[]): ChipTask[] {
  const ids = new Set(next.map((x) => x.id));
  const out: ChipTask[] = prev.map((p) => (ids.has(p.id) ? next.find((n) => n.id === p.id)! : { ...p, moved: true }));
  for (const n of next) if (!prev.some((p) => p.id === n.id)) out.push(n);
  return out;
}

type Phase = "loading" | "speaking" | "listening" | "thinking" | "idle" | "closed" | "asleep";

export default function CheckinScreen() {
  return <ForceMode mode="night"><Checkin /></ForceMode>;
}

/** Tween the moon from last night's phase to tonight's. */
function useTween(target: number, from: number, run: boolean, ms = 1400) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!run) return;
    const start = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(from + (target - from) * eased);
      if (k === 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [run, target, from, ms]);
  return v;
}

function Checkin() {
  const t = useTheme();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const me = useMe();
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [tasks, setTasks] = useState<ChipTask[]>([]);
  const [closed, setClosed] = useState<Closed | null>(null);
  const [muted, setMuted] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Last night's moon; the tween starts here when tonight closes.
  const startPhase = useRef<number | null>(null);
  if (startPhase.current === null && me.data) startPhase.current = me.data.moonPhase;
  const fromPhase = startPhase.current ?? 0;
  const voiceOn = (me.data?.voiceReplies ?? true) && !muted;

  const send = useCallback(async (text: string) => {
    setPhase("thinking");
    setError(null);
    try {
      const res = await api.checkinReply(text);
      setTasks((prev) => merge(prev, res.today));
      if (res.finished && res.closed) return finish(res.closed, res.message);
      say(res.message);
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  const voice = useVoice(send);

  /** Tuck talks, then listens: the check-in works with your phone on the nightstand. */
  const say = useCallback((text: string) => {
    setMessage(text);
    if (!voiceOn) { setPhase("idle"); return; }
    setPhase("speaking");
    speak(text, () => {
      if (voice.available) { setPhase("listening"); voice.start(); } else { setPhase("idle"); setTyping(true); }
    });
  }, [voiceOn, voice]);

  const finish = (c: Closed, goodnight?: string) => {
    stopSpeaking();
    voice.stop();
    setClosed(c);
    setMessage(goodnight ?? "All tucked in.");
    setPhase("closed");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (voiceOn && goodnight) speak(goodnight);
    qc.invalidateQueries({ queryKey: keys.today });
    qc.invalidateQueries({ queryKey: keys.me });
    qc.invalidateQueries({ queryKey: keys.pantry });
    qc.invalidateQueries({ queryKey: keys.nights });
  };

  useEffect(() => {
    if (!voice.available) setTyping(true);
    api.checkinStart()
      .then((res) => {
        setTasks(res.today);
        if (res.finished && res.closed) { setMessage(res.message); setPhase("asleep"); return; }
        say(res.message);
      })
      .catch((e) => { setError((e as Error).message); setPhase("idle"); });
    return () => { stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thatsAll = async () => {
    stopSpeaking(); voice.stop();
    setPhase("thinking");
    try { finish((await api.checkinFinish()).closed); } catch (e) { setError((e as Error).message); setPhase("idle"); }
  };

  const moonTarget = closed?.phase ?? fromPhase;
  const moon = useTween(moonTarget, fromPhase, phase === "closed");
  const shownPhase = phase === "closed" ? moon : fromPhase;
  const doneCount = tasks.filter((x) => x.status === "done").length;

  if (phase === "asleep") return <Asleep message={message} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LinearGradient colors={t.sky} style={StyleSheet.absoluteFill} />
      <StarField earned={doneCount} ambient={46} color={t.star} width={width} height={height * 0.45} seed={3} />

      <View style={[styles.top, { paddingTop: insets.top + space.s }]}>
        <Pressable onPress={() => { stopSpeaking(); voice.stop(); router.back(); }} hitSlop={12}>
          <Txt variant="small" muted>Close</Txt>
        </Pressable>
        {phase !== "closed" && (
          <Pressable onPress={() => { setMuted(!muted); stopSpeaking(); }} hitSlop={12}>
            <Txt variant="small" muted>{muted ? "Voice off" : "Voice on"}</Txt>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 240 + insets.bottom }]}>
        <View style={{ width: "100%", maxWidth: CHECKIN_MAX, alignSelf: "center" }}>
        <View style={styles.moon}><Moon phase={shownPhase} size={phase === "closed" ? 200 : 150} /></View>

        {phase === "loading" ? (
          <Txt variant="spoken" muted style={styles.center}>Looking back at today…</Txt>
        ) : (
          <Animated.View key={message} entering={FadeInDown.springify().damping(18)}>
            <Txt variant="spoken" style={styles.center}>{message}</Txt>
          </Animated.View>
        )}

        {phase === "closed" && closed && <Summary closed={closed} />}

        {phase !== "closed" && (
          <>
            {!!voice.transcript && phase !== "speaking" && (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <Txt variant="heading" muted style={[styles.center, { marginTop: space.l }]}>"{voice.transcript}"</Txt>
              </Animated.View>
            )}
            <Animated.View layout={LinearTransition} style={styles.chips}>
              {tasks.map((task) => <Chip key={task.id} task={task} />)}
            </Animated.View>
          </>
        )}
        {error && <Txt color={t.carry} style={[styles.center, { marginTop: space.l }]}>{error}</Txt>}
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.l }]}>
        {phase === "closed" ? (
          <Button label="Goodnight" onPress={() => { stopSpeaking(); setPhase("asleep"); }} style={{ alignSelf: "stretch" }} />
        ) : typing ? (
          <View style={{ alignSelf: "stretch", gap: space.s }}>
            <TextInput
              autoFocus value={draft} onChangeText={setDraft} placeholder="Did the cake, skipped shopping…"
              placeholderTextColor={t.muted} returnKeyType="send"
              onSubmitEditing={() => { if (draft.trim()) { send(draft); setDraft(""); setTyping(false); } }}
              style={[typeScale.body, styles.input, { color: t.text, backgroundColor: t.surface }]}
            />
            <Button kind="quiet" label="Use voice" onPress={() => setTyping(false)} />
          </View>
        ) : (
          <>
            <Txt variant="small" muted style={{ minHeight: 20 }}>
              {phase === "thinking" ? "Updating your day…" : phase === "listening" ? "Listening. Tap to stop." : phase === "speaking" ? "" : "Tap the mic to answer"}
            </Txt>
            <MicButton
              listening={voice.listening} level={voice.level} busy={phase === "thinking"}
              onPress={() => { stopSpeaking(); voice.toggle(); }}
            />
            <View style={styles.row}>
              <Button kind="quiet" label="Type" onPress={() => { stopSpeaking(); voice.stop(); setTyping(true); }} />
              <Button kind="quiet" label="That's all" onPress={thatsAll} disabled={phase === "thinking"} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Chip({ task }: { task: ChipTask }) {
  const t = useTheme();
  const color = task.status === "done" ? t.done : task.status === "dropped" ? t.muted : task.moved ? t.carry : t.line;
  return (
    <Animated.View layout={LinearTransition} style={[styles.chip, { borderColor: color, backgroundColor: task.status === "done" ? "rgba(123,224,195,0.12)" : "transparent" }]}>
      <Txt variant="small" color={task.status === "open" && !task.moved ? t.text : color} style={task.status === "dropped" ? { textDecorationLine: "line-through" } : undefined}>
        {task.moved ? `${task.title}, tomorrow` : task.title}
      </Txt>
    </Animated.View>
  );
}

function Summary({ closed }: { closed: Closed }) {
  const t = useTheme();
  const { night, user, earnedMoon } = closed;
  const parts = [
    night.doneCount && `${night.doneCount} done`,
    night.carriedCount && `${night.carriedCount} moved to tomorrow`,
    night.droppedCount && `${night.droppedCount} let go`,
  ].filter(Boolean).join(", ");
  return (
    <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.summary}>
      {!!parts && <Txt variant="bodyStrong" style={styles.center}>{parts}</Txt>}
      {!!night.tomorrowPreview && <Txt muted style={styles.center}>{night.tomorrowPreview}</Txt>}
      <View style={[styles.streak, { backgroundColor: t.surface }]}>
        <Txt variant="title" color={t.primary} style={styles.center}>
          {user.streak === 1 ? "First night" : `${user.streak} nights in a row`}
        </Txt>
        <Txt variant="small" muted style={styles.center}>
          {earnedMoon
            ? "Full moon. You earned a grace night: miss one night without losing your streak."
            : night.usedGrace
              ? "A grace night covered the one you missed. Streak safe."
              : `${7 - (((user.streak - 1) % 7) + 1)} more to a full moon`}
        </Txt>
      </View>
    </Animated.View>
  );
}

/** After goodnight, the app gets out of the way. No buttons to keep you up. */
function Asleep({ message }: { message: string }) {
  useEffect(() => {
    const id = setTimeout(() => router.back(), 2600);
    return () => clearTimeout(id);
  }, []);
  return (
    <Animated.View entering={FadeIn.duration(900)} style={styles.asleep}>
      <Moon phase={1} size={70} glow={false} />
      <Txt variant="heading" color="#8D8DBE" style={[styles.center, { marginTop: space.l }]}>
        {message.includes("already") ? message : "Phone down. See you tomorrow."}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.xl },
  content: { paddingHorizontal: space.xl, paddingTop: space.l },
  moon: { alignItems: "center", marginBottom: space.l },
  center: { textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s, marginTop: space.xl },
  chip: { borderWidth: 1.5, borderRadius: radius.chip, paddingHorizontal: space.m, paddingVertical: 6 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: space.xl, maxWidth: CHECKIN_MAX, alignSelf: "center", width: "100%" },
  row: { flexDirection: "row", gap: space.xl, marginTop: -space.l },
  input: { borderRadius: radius.row, padding: space.l },
  summary: { marginTop: space.xl, gap: space.m },
  streak: { borderRadius: radius.row, padding: space.l, gap: space.xs, marginTop: space.s },
  asleep: { flex: 1, backgroundColor: "#06071A", alignItems: "center", justifyContent: "center", padding: space.xxl },
});
