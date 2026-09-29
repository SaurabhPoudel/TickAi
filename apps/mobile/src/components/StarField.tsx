import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

/** Same seed, same sky: star positions are stable between renders. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function Star({ size, color }: { size: number; color: string }) {
  const s = size;
  const d = `M ${s / 2} 0 Q ${s * 0.56} ${s * 0.44} ${s} ${s / 2} Q ${s * 0.56} ${s * 0.56} ${s / 2} ${s} Q ${s * 0.44} ${s * 0.56} 0 ${s / 2} Q ${s * 0.44} ${s * 0.44} ${s / 2} 0 Z`;
  return <Svg width={s} height={s}><Path d={d} fill={color} /></Svg>;
}

/**
 * Every finished task becomes a star in the header.
 * `earned` stars are bright and sparkle in when added; `ambient` ones are faint background.
 */
export function StarField({ earned, ambient = 0, color, width, height, seed = 1 }: {
  earned: number; ambient?: number; color: string; width: number; height: number; seed?: number;
}) {
  const stars = [];
  for (let i = 0; i < ambient; i++) {
    stars.push(
      <View key={`a${i}`} style={{ position: "absolute", left: rand(seed + i) * width, top: rand(seed + i + 500) * height, width: 2, height: 2, borderRadius: 1, backgroundColor: color, opacity: 0.25 + rand(i) * 0.3 }} />,
    );
  }
  for (let i = 0; i < earned; i++) {
    const size = 12 + rand(seed * 3 + i) * 10;
    stars.push(
      <Animated.View key={`e${i}`} entering={ZoomIn.springify().damping(9)} style={{ position: "absolute", left: 12 + rand(seed * 7 + i) * (width - 40), top: 8 + rand(seed * 11 + i) * (height - 36) }}>
        <Star size={size} color={color} />
      </Animated.View>,
    );
  }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>{stars}</View>;
}
