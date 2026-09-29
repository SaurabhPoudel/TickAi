import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "@/lib/haptics";
import { Txt } from "./Txt";
import { Button } from "./Button";
import { MicButton } from "./MicButton";
import { useVoice } from "@/hooks/useVoice";
import { keys, useMe } from "@/hooks/queries";
import { api, type Task } from "@/lib/api";
import { formatTime } from "@/lib/time";
import { CONTENT_MAX, useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space, type as typeScale } from "@/theme/tokens";

type Phase = "listening" | "typing" | "thinking" | "done";

/** Talk (or type) a brain dump; Tuck splits it into tasks and shows what it made. */
export function CaptureSheet({ visible, onClose, startWith = "listening" }: { visible: boolean; onClose: () => void; startWith?: "listening" | "typing" }) {
  const t = useTheme();
  const qc = useQueryClient();
  const me = useMe();
  const { wide } = useLayout();
  const onCalendar = Boolean(me.data?.calendar.connected);
  const [phase, setPhase] = useState<Phase>(startWith);
  const [text, setText] = useState("");
  const [created, setCreated] = useState<Task[]>([]);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (said: string) => {
    if (!said.trim()) return;
    setPhase("thinking");
    setError(null);
    try {
      const res = await api.capture(said);
      setCreated((prev) => [...prev, ...res.created]);
      setFollowUp(res.followUp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: keys.today });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("typing");
      setText(said);
    }
  };

  const voice = useVoice(submit);

  useEffect(() => {
    if (!visible) return;
    setCreated([]); setFollowUp(null); setError(null); setText("");
    const first = voice.available ? startWith : "typing";
    setPhase(first);
    if (first === "listening") voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => { if (voice.error) { setError(voice.error); setPhase("typing"); } }, [voice.error]);

  const close = () => { voice.stop(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.anchor} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.sheet, { backgroundColor: t.bg }, wide && styles.sheetWide]}>
          {phase === "listening" && (
            <View style={styles.center}>
              <Txt variant="spoken" style={styles.live}>{voice.transcript || "Tell me what's on your plate…"}</Txt>
              <Txt variant="small" muted style={{ marginBottom: space.m }}>Say it all in one go. Tap the mic when you're done.</Txt>
              <MicButton listening={voice.listening} level={voice.level} onPress={voice.toggle} />
              <Button kind="quiet" label="Type instead" onPress={() => { voice.stop(); setPhase("typing"); }} />
            </View>
          )}

          {phase === "typing" && (
            <View>
              <TextInput
                autoFocus value={text} onChangeText={setText} multiline
                placeholder="Go shopping, bake a cake, meet Rahul at 6…" placeholderTextColor={t.muted}
                style={[typeScale.heading, styles.input, { color: t.text, backgroundColor: t.surface }]}
                returnKeyType="done" blurOnSubmit onSubmitEditing={() => submit(text)}
              />
              {error && <Txt variant="small" color={t.carry} style={{ marginTop: space.s }}>{error}</Txt>}
              <Button label="Add to my day" onPress={() => submit(text)} disabled={!text.trim()} style={{ marginTop: space.l }} />
            </View>
          )}

          {phase === "thinking" && (
            <View style={styles.center}>
              <Txt variant="spoken" style={styles.live} muted>{voice.transcript || text}</Txt>
              <Animated.View entering={FadeIn.delay(150)}><Txt variant="bodyStrong" color={t.primary}>Sorting it into tasks…</Txt></Animated.View>
            </View>
          )}

          {phase === "done" && (
            <View>
              <Txt variant="title" style={{ marginBottom: space.l }}>
                {created.length === 1 ? "Added 1 thing" : `Added ${created.length} things`}
              </Txt>
              {created.map((c, i) => (
                <Animated.View key={c.id} entering={FadeInDown.delay(i * 90).springify()} style={[styles.made, { backgroundColor: t.surface }]}>
                  <Txt variant="bodyStrong">{c.title}</Txt>
                  <Txt variant="small" muted>
                    {[c.startTime && formatTime(c.startTime), c.items.length ? `${c.items.length} things on the list` : "", c.startTime && onCalendar ? "Added to your calendar" : ""]
                      .filter(Boolean).join(", ") || "No set time"}
                  </Txt>
                </Animated.View>
              ))}
              {followUp && (
                <View style={[styles.follow, { borderColor: t.primary }]}>
                  <Txt variant="bodyStrong">{followUp}</Txt>
                  <View style={{ flexDirection: "row", gap: space.s, marginTop: space.s }}>
                    <Button label="Answer" onPress={() => { setPhase("listening"); voice.start(); }} style={{ flex: 1 }} />
                    <Button kind="quiet" label="Later" onPress={() => setFollowUp(null)} />
                  </View>
                </View>
              )}
              {!followUp && <Button label="Done" onPress={close} style={{ marginTop: space.l }} />}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,40,0.45)" },
  anchor: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheetWide: { borderRadius: radius.sheet, marginBottom: 48, paddingBottom: space.xl },
  sheet: { width: "100%", maxWidth: CONTENT_MAX, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, paddingBottom: space.xxl + space.l, minHeight: 360 },
  center: { alignItems: "center", gap: space.s },
  live: { textAlign: "center", minHeight: 102, marginBottom: space.s },
  input: { minHeight: 120, borderRadius: radius.row, padding: space.l, textAlignVertical: "top" },
  made: { padding: space.l, borderRadius: radius.row, marginBottom: space.s },
  follow: { marginTop: space.l, padding: space.l, borderRadius: radius.row, borderWidth: 2 },
});
