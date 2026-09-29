import { useWindowDimensions } from "react-native";

/** Phones get the full width; tablets and desktop browsers get a centered reading column. */
export const CONTENT_MAX = 680;
export const WIDE_AT = 900;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_AT;
  return { width, height, wide, column: Math.min(width, CONTENT_MAX) };
}

export const column = { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" } as const;
