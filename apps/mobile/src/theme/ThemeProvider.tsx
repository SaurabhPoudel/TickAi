import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { themes, type Mode, type Theme } from "./tokens";
import { skyMode } from "@/lib/time";

const ThemeContext = createContext<Theme>(themes.day);

/** The whole app re-themes as the evening goes on. Checked once a minute. */
export function SkyThemeProvider({ bedtime, children }: { bedtime: string; children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => skyMode(bedtime));
  useEffect(() => {
    setMode(skyMode(bedtime));
    const id = setInterval(() => setMode(skyMode(bedtime)), 60_000);
    return () => clearInterval(id);
  }, [bedtime]);
  return <ThemeContext.Provider value={themes[mode]}>{children}</ThemeContext.Provider>;
}

/** Force a mode for one subtree, e.g. the check-in is always night. */
export function ForceMode({ mode, children }: { mode: Mode; children: ReactNode }) {
  return <ThemeContext.Provider value={themes[mode]}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
