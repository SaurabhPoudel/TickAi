import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { palette } from "@/theme/tokens";

/**
 * The moon fills as your streak grows: new moon on night 0, full on night 7.
 * phase is 0..1 (lit fraction), drawn waxing from the right.
 */
export function Moon({ phase, size = 120, glow = true }: { phase: number; size?: number; glow?: boolean }) {
  const r = size / 2 - (glow ? size * 0.14 : 1);
  const c = size / 2;
  const p = Math.max(0, Math.min(1, phase));
  const rx = r * Math.abs(1 - 2 * p);
  const sweep = p > 0.5 ? 1 : 0;
  const lit = p <= 0.001 ? "" : `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;

  return (
    <Svg width={size} height={size} accessibilityLabel={`Moon, ${Math.round(p * 100)} percent full`}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor={palette.moonglow} stopOpacity={0.28 * p + 0.04} />
          <Stop offset="1" stopColor={palette.moonglow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {glow && <Circle cx={c} cy={c} r={size / 2} fill="url(#halo)" />}
      <Circle cx={c} cy={c} r={r} fill={palette.moonglow} opacity={0.12} />
      {p >= 0.999 ? <Circle cx={c} cy={c} r={r} fill={palette.moonglow} /> : lit ? <Path d={lit} fill={palette.moonglow} /> : null}
    </Svg>
  );
}
