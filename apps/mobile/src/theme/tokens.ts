/**
 * Hushtick's look follows the sky. The app is bright and crisp during the day,
 * warms into dusk as bedtime approaches, and turns fully to night for the check-in.
 */
export const palette = {
  midnightInk: "#121436",
  nightfall: "#1E2154",
  nightRaised: "#2B2F6E",
  moonglow: "#F3DE8A",
  seaGlass: "#7BE0C3",
  ember: "#FFB36B",
  daybreak: "#EEF1FF",
  ultraviolet: "#4636E3",
  ink: "#141538",
  white: "#FFFFFF",
} as const;

export type Mode = "day" | "dusk" | "night";

export type Theme = {
  mode: Mode;
  bg: string;
  surface: string;
  raised: string;
  text: string;
  muted: string;
  line: string;
  primary: string;
  onPrimary: string;
  done: string;
  carry: string;
  sky: readonly [string, string, string];
  star: string;
  statusBar: "light" | "dark";
};

export const themes: Record<Mode, Theme> = {
  day: {
    mode: "day",
    bg: palette.daybreak,
    surface: palette.white,
    raised: "#E2E6FF",
    text: palette.ink,
    muted: "#5D5F8F",
    line: "#D5DAF5",
    primary: palette.ultraviolet,
    onPrimary: palette.white,
    done: "#12A57F",
    carry: "#C9711A",
    sky: ["#B9C6FF", "#D9E0FF", palette.daybreak],
    star: palette.ultraviolet,
    statusBar: "dark",
  },
  dusk: {
    mode: "dusk",
    bg: "#F4EEFB",
    surface: palette.white,
    raised: "#EADFF7",
    text: palette.ink,
    muted: "#6A5C8C",
    line: "#E0D3F0",
    primary: "#5A3FD0",
    onPrimary: palette.white,
    done: "#12A57F",
    carry: "#C9711A",
    sky: ["#3A2E7A", "#9A6AB8", "#F4EEFB"],
    star: palette.moonglow,
    statusBar: "light",
  },
  night: {
    mode: "night",
    bg: palette.midnightInk,
    surface: palette.nightfall,
    raised: palette.nightRaised,
    text: "#F2F0FF",
    muted: "#9C9CCB",
    line: "#2E3270",
    primary: palette.moonglow,
    onPrimary: palette.midnightInk,
    done: palette.seaGlass,
    carry: palette.ember,
    sky: ["#0B0C27", palette.midnightInk, palette.nightfall],
    star: palette.white,
    statusBar: "light",
  },
};

export const fonts = {
  regular: "BricolageGrotesque_400Regular",
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_800ExtraBold",
} as const;

/** Type scale on a 1.25 ratio from 15. */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  spoken: { fontFamily: fonts.medium, fontSize: 26, lineHeight: 34, letterSpacing: -0.3 },
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 36 } as const;
/** Radii follow hierarchy: small controls are tight, sheets are soft. */
export const radius = { chip: 10, row: 16, sheet: 28, round: 999 } as const;
