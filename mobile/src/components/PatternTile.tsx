import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Decorative header artwork for places that have no photograph yet.
 *
 * Rather than a grey box or a stock image that misrepresents a real site, each
 * place gets a deterministic eight-point star tessellation (girih) tinted from
 * its category colour. It reads as intentional, and it never claims to be a
 * photograph of somewhere sacred.
 */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

  const r = clamp(((num >> 16) & 0xff) * (1 + amount));
  const g = clamp(((num >> 8) & 0xff) * (1 + amount));
  const b = clamp((num & 0xff) * (1 + amount));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** One eight-point star centred on (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 8) * index - Math.PI / 8;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

export function PatternTile({
  seed,
  tint = colors.primary,
  height = 160,
  glyph,
  style,
  children,
  density,
}: {
  seed: string;
  tint?: string;
  height?: number;
  glyph?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  density?: number;
}) {
  const art = useMemo(() => {
    const hash = hashString(seed);
    const columns = density ?? 3 + (hash % 3);
    const cell = 100 / columns;
    const stars: string[] = [];

    for (let row = 0; row * cell < 100 + cell; row += 1) {
      for (let column = 0; column < columns + 1; column += 1) {
        const offset = row % 2 === 0 ? 0 : cell / 2;
        stars.push(starPath(column * cell + offset, row * cell, cell * 0.42, cell * 0.19));
      }
    }

    return { stars, rotate: (hash % 4) * 12 };
  }, [seed, density]);

  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: shade(tint, -0.35) }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="tileWash" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={shade(tint, 0.22)} stopOpacity="1" />
            <Stop offset="1" stopColor={shade(tint, -0.55)} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="100" height="100" fill="url(#tileWash)" />

        {/* An explicit transform string keeps react-native-svg from emitting a
            `transform-origin` DOM attribute that React rejects on web. */}
        <G transform={`rotate(${art.rotate} 50 50)`}>
          {art.stars.map((path, index) => (
            <Path
              key={index}
              d={path}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={index % 3 === 0 ? 0.22 : 0.12}
              strokeWidth={0.7}
            />
          ))}
        </G>

        <Circle cx="50" cy="50" r="46" fill="none" stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={0.6} />
      </Svg>

      {glyph ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={patternStyles.glyphWrap}>
            <View style={patternStyles.glyphCircle}>
              <Text style={patternStyles.glyph}>{glyph}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {children}
    </View>
  );
}

const patternStyles = StyleSheet.create({
  glyphWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glyphCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 26 },
});
