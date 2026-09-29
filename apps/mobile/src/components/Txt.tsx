import { Text, type TextProps } from "react-native";
import { type } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeProvider";

type Variant = keyof typeof type;

export function Txt({ variant = "body", muted, color, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const t = useTheme();
  return <Text {...rest} style={[type[variant], { color: color ?? (muted ? t.muted : t.text) }, style]} />;
}
