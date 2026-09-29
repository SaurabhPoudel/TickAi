import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { ForceMode, useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/Txt";
import { Button } from "@/components/Button";
import { Moon } from "@/components/Moon";
import { StarField } from "@/components/StarField";
import { BedtimePicker } from "@/components/BedtimePicker";
import { CaptureSheet } from "@/components/CaptureSheet";
import { api } from "@/lib/api";
import { scheduleBedtime } from "@/lib/notifications";
import { formatTime, timezone } from "@/lib/time";
import { keys } from "@/hooks/queries";
import { useLayout } from "@/lib/layout";
import { radius, space, type as typeScale } from "@/theme/tokens";

const ONBOARDED_KEY = "tuck.onboarded";

/**
 * Four quick steps, and the third one is the product itself:
 * the user says their plans out loud and watches them turn into tasks.
 */
export default function Onboarding() {
  return <ForceMode mode="night"><Flow /></ForceMode>;
}

function Flow() {
  const t = useTheme();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useLayout();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bedtime, setBedtime] = useState("22:30");
  const [capturing, setCapturing] = useState(false);

  const next = () => setStep((s) => s + 1);

  const saveProfile = async () => {
    await api.updateMe({ name: name.trim() || undefined, bedtime, timezone: timezone() }).catch(() => {});
    qc.invalidateQueries({ queryKey: keys.me });
    next();
  };

  const finish = async (withReminder: boolean) => {
    if (withReminder) await scheduleBedtime(bedtime, name.trim());
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LinearGradient colors={t.sky} style={StyleSheet.absoluteFill} />
      <StarField earned={0} ambient={90} color={t.star} width={width} height={height * 0.7} seed={11} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.page, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <View style={{ alignItems: "center" }}><Moon phase={[0.15, 0.4, 0.7, 1][step] ?? 1} size={140} /></View>

        <Animated.View key={step} entering={FadeInDown.springify().damping(18)} exiting={FadeOut} style={styles.step}>
          {step === 0 && (
            <>
              <Txt variant="display">Plan out loud. Sleep with a clear head.</Txt>
              <Txt muted>Tell Tuck what's on your plate. At bedtime it asks how the day went, carries over what's left, and remembers what you buy.</Txt>
              <Button label="Get started" onPress={next} />
            </>
          )}
          {step === 1 && (
            <>
              <Txt variant="title">What should I call you?</Txt>
              <TextInput autoFocus value={name} onChangeText={setName} placeholder="Your first name" placeholderTextColor={t.muted}
                returnKeyType="next" onSubmitEditing={next}
                style={[typeScale.heading, styles.input, { color: t.text, backgroundColor: t.surface }]} />
              <Button label="Next" onPress={next} />
            </>
          )}
          {step === 2 && (
            <>
              <Txt variant="title">When do you usually go to bed?</Txt>
              <Txt muted>That's when I'll check in. Your day ends when you do, even if that's after midnight.</Txt>
              <BedtimePicker value={bedtime} onChange={setBedtime} />
              <Button label="Next" onPress={saveProfile} />
            </>
          )}
          {step === 3 && (
            <>
              <Txt variant="title">Try it. What's on for today or tomorrow?</Txt>
              <Txt muted>Say it all in one breath, like "get groceries, bake a cake and meet Rahul at 6."</Txt>
              <Button label="Tap to talk" onPress={() => setCapturing(true)} />
              <Button kind="quiet" label="Skip for now" onPress={next} />
            </>
          )}
          {step === 4 && (
            <>
              <Txt variant="title">See you at {formatTime(bedtime)}</Txt>
              <Txt muted>One gentle reminder a night, and nothing after. Your first check-in starts your moon.</Txt>
              <Button label="Remind me at bedtime" onPress={() => finish(true)} />
              <Button kind="quiet" label="Not now" onPress={() => finish(false)} />
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      <CaptureSheet visible={capturing} onClose={() => { setCapturing(false); setStep(4); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: space.xl, justifyContent: "space-between" },
  step: { gap: space.l },
  input: { borderRadius: radius.row, padding: space.l },
});
