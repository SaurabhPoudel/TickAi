import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Txt } from "@/components/Txt";
import { Button } from "@/components/Button";
import { BedtimePicker } from "@/components/BedtimePicker";
import { keys, useMe } from "@/hooks/queries";
import { api } from "@/lib/api";
import { scheduleBedtime } from "@/lib/notifications";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space, type as typeScale } from "@/theme/tokens";

export default function Settings() {
  const t = useTheme();
  const qc = useQueryClient();
  const me = useMe();
  const [name, setName] = useState("");
  const [bedtime, setBedtime] = useState("22:30");
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    if (!me.data) return;
    setName(me.data.name ?? "");
    setBedtime(me.data.bedtime);
    setVoice(me.data.voiceReplies);
  }, [me.data]);

  const save = async () => {
    await api.updateMe({ name: name.trim() || undefined, bedtime, voiceReplies: voice });
    await scheduleBedtime(bedtime, name.trim());
    qc.invalidateQueries({ queryKey: keys.me });
    router.back();
  };

  const [calError, setCalError] = useState<string | null>(null);
  const connectCalendar = async () => {
    setCalError(null);
    try {
      if (Platform.OS === "web") {
        // On the web, Google sends the whole tab back to /settings when it's done.
        const { url } = await api.googleConnectUrl(`${window.location.origin}/settings`);
        window.location.assign(url);
        return;
      }
      const { url } = await api.googleConnectUrl(Linking.createURL("settings"));
      const result = await WebBrowser.openAuthSessionAsync(url, Linking.createURL("settings"));
      if (result.type === "success" && result.url.includes("calendar=connected")) {
        qc.invalidateQueries({ queryKey: keys.me });
        qc.invalidateQueries({ queryKey: keys.today });
      }
    } catch (e) {
      setCalError(`Couldn't connect Google Calendar. ${(e as Error).message}`);
    }
  };

  const cal = me.data?.calendar;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.page}>
      <Txt variant="title">Settings</Txt>

      <View style={styles.group}>
        <Txt variant="heading">Your name</Txt>
        <TextInput value={name} onChangeText={setName} placeholder="What Hushtick calls you" placeholderTextColor={t.muted}
          style={[typeScale.body, styles.input, { color: t.text, backgroundColor: t.surface }]} />
      </View>

      <View style={styles.group}>
        <Txt variant="heading">Bedtime check-in</Txt>
        <Txt muted>Hushtick nudges you once, at this time. Your day ends when you check in, not at midnight.</Txt>
        <BedtimePicker value={bedtime} onChange={setBedtime} />
      </View>

      <View style={[styles.group, styles.switchRow]}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">Hushtick talks back</Txt>
          <Txt muted>Hear the check-in out loud, so you can answer without looking.</Txt>
        </View>
        <Switch value={voice} onValueChange={setVoice} trackColor={{ true: t.primary }} />
      </View>

      <View style={styles.group}>
        <Txt variant="heading">Google Calendar</Txt>
        {cal?.connected ? (
          <Txt muted>Connected. Tasks with a time go on your calendar, and your events show up in Today.</Txt>
        ) : cal?.available ? (
          <>
            <Txt muted>Put timed tasks on your calendar and see your events next to your to-dos.</Txt>
            <Button kind="primary" label="Connect Google Calendar" onPress={connectCalendar} />
            {calError && <Txt variant="small" color={t.carry}>{calError}</Txt>}
          </>
        ) : (
          <Txt muted>Calendar sync isn't set up on this server yet.</Txt>
        )}
      </View>

      <Button label="Save" onPress={save} style={{ marginTop: space.l }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 680, alignSelf: "center", padding: space.xl, paddingTop: space.xxl, gap: space.xl, paddingBottom: space.xxl * 2 },
  group: { gap: space.m },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.l },
  input: { borderRadius: radius.row, padding: space.l },
});
