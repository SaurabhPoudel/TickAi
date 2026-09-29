import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { BasketIcon, MoonIcon, SunIcon } from "@/components/Icons";
import { fonts } from "@/theme/tokens";
import { useLayout } from "@/lib/layout";

export default function TabsLayout() {
  const t = useTheme();
  const { wide } = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        // Bottom tabs on phones, a sidebar on tablets and desktop browsers.
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
        tabBarStyle: wide
          ? { backgroundColor: t.bg, borderRightColor: t.line, minWidth: 200, paddingTop: 24 }
          // Browsers have no safe-area inset, so give the labels room for descenders.
          : { backgroundColor: t.bg, borderTopColor: t.line, ...(Platform.OS === "web" ? { height: 64, paddingBottom: 8 } : null) },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: wide ? 15 : 12, lineHeight: wide ? 20 : 16 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ color }) => <SunIcon color={String(color)} /> }} />
      <Tabs.Screen name="pantry" options={{ title: "Pantry", tabBarIcon: ({ color }) => <BasketIcon color={String(color)} /> }} />
      <Tabs.Screen name="sky" options={{ title: "Your sky", tabBarIcon: ({ color }) => <MoonIcon color={String(color)} /> }} />
    </Tabs>
  );
}
