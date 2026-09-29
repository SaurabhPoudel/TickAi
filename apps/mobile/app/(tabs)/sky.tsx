import { ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ForceMode, useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/Txt";
import { Moon } from "@/components/Moon";
import { Button } from "@/components/Button";
import { useMe, useNights } from "@/hooks/queries";
import { space } from "@/theme/tokens";
import { column } from "@/lib/layout";
import type { Night } from "@/lib/api";
import { localDay } from "@/lib/time";

export default function SkyScreen() {
  return <ForceMode mode="night"><Sky /></ForceMode>;
}

function addDay(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Your record of nights, drawn as a sky: brighter stars for fuller days. */
function Sky() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const nights = useNights();
  const byDay = new Map((nights.data?.nights ?? []).map((n) => [n.day, n]));
  const today = localDay();
  const days = Array.from({ length: 35 }, (_, i) => addDay(today, i - 34));
  const u = me.data;
  const tuckedIn = u?.lastClosedDay === today;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <LinearGradient colors={t.sky} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[column, { paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: space.xxl, alignItems: "center" }]}>
        <Moon phase={u?.moonPhase ?? 0} size={220} />
        <Txt variant="display" style={{ textAlign: "center", marginTop: space.s }}>
          {u?.streak ? `${u.streak} ${u.streak === 1 ? "night" : "nights"}` : "New moon"}
        </Txt>
        <Txt muted style={{ textAlign: "center", marginTop: space.xs }}>
          {u?.streak ? "tucked in, in a row" : "Close out tonight to start your streak."}
        </Txt>

        <View style={styles.stats}>
          <Stat value={u?.fullMoons ?? 0} label={u?.fullMoons === 1 ? "full moon" : "full moons"} />
          <Stat value={u?.graceNights ?? 0} label={u?.graceNights === 1 ? "grace night" : "grace nights"} />
          <Stat value={u?.bestStreak ?? 0} label="best streak" />
        </View>
        <Txt variant="small" muted style={{ textAlign: "center", maxWidth: 300 }}>
          Every seven nights fills the moon and saves a grace night, so one missed evening never breaks your streak.
        </Txt>

        <Txt variant="heading" style={{ alignSelf: "flex-start", marginTop: space.xxl, marginBottom: space.m }}>The last five weeks</Txt>
        <View style={styles.grid}>
          {days.map((d) => <Dot key={d} night={byDay.get(d)} isToday={d === today} />)}
        </View>

        {!tuckedIn && <Button label="Tuck in now" onPress={() => router.push("/checkin")} style={{ alignSelf: "stretch", marginTop: space.xxl }} />}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Txt variant="title" color={t.primary}>{value}</Txt>
      <Txt variant="small" muted>{label}</Txt>
    </View>
  );
}

function Dot({ night, isToday }: { night?: Night; isToday: boolean }) {
  const t = useTheme();
  const closed = Boolean(night?.closedAt);
  const size = closed ? 10 + Math.min(night!.doneCount, 6) * 2.5 : 5;
  return (
    <View style={styles.cell}>
      <View style={{
        width: size, height: size, borderRadius: size,
        backgroundColor: closed ? t.primary : t.line,
        borderWidth: night?.usedGrace || isToday ? 1.5 : 0, borderColor: isToday ? t.text : t.muted,
        opacity: closed ? 0.55 + Math.min(night!.doneCount, 6) * 0.075 : 1,
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", alignSelf: "stretch", marginTop: space.xl, marginBottom: space.m },
  grid: { flexDirection: "row", flexWrap: "wrap", alignSelf: "stretch", maxWidth: 420 },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
});
