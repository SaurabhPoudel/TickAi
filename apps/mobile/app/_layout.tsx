import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts, BricolageGrotesque_400Regular, BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { SkyThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { useMe } from "@/hooks/queries";
import { listenForOpens, restoreWebReminder } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
const ONBOARDED_KEY = "hushtick.onboarded";

function Shell() {
  const me = useMe();
  useEffect(() => {
    if (me.data) restoreWebReminder(me.data.bedtime, me.data.name);
  }, [me.data?.bedtime, me.data?.name]);
  return (
    <SkyThemeProvider bedtime={me.data?.bedtime ?? "22:30"}>
      <Screens />
    </SkyThemeProvider>
  );
}

function Screens() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="checkin" options={{ presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => {
      setReady(true);
      SplashScreen.hideAsync();
      if (!v) router.replace("/onboarding");
    });
  }, [fontsLoaded]);

  // Tapping the bedtime notification opens the check-in.
  useEffect(() => listenForOpens((url) => router.push(url as never)), []);

  if (!fontsLoaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
