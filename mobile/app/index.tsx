import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import Svg, { Defs, G, Path, Stop, LinearGradient as SvgGradient, Rect } from 'react-native-svg';
import { useAuth } from '../src/state/auth';
import { colors, spacing, typography } from '../src/theme';

/**
 * Splash and gate. While the stored session is being restored the brand mark is
 * shown, then the traveller lands either in the app or on onboarding.
 */
export default function Index() {
  const { ready, user } = useAuth();

  if (ready) {
    return <Redirect href={user ? '/(tabs)' : '/(auth)/onboarding'} />;
  }

  return (
    <View style={styles.splash}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 100 160">
        <Defs>
          <SvgGradient id="splashWash" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#14503C" />
            <Stop offset="1" stopColor="#07211A" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="160" fill="url(#splashWash)" />
        <G opacity={0.14}>
          {Array.from({ length: 10 }).map((_, row) =>
            Array.from({ length: 7 }).map((__, column) => (
              <Path
                key={`${row}-${column}`}
                d={octagram(column * 16 + (row % 2 ? 8 : 0), row * 16, 6)}
                stroke="#E9D9A8"
                strokeWidth={0.4}
                fill="none"
              />
            )),
          )}
        </G>
      </Svg>

      <View style={styles.splashBody}>
        <Text style={styles.mark}>✦</Text>
        <Text style={styles.brand}>Sufara</Text>
        <Text style={styles.brandArabic}>سفراء</Text>
        <Text style={styles.tagline}>Discover. Plan.{'\n'}Journey Through Islamic Heritage.</Text>
      </View>

      <Text style={styles.footer}>Preparing your journey…</Text>
    </View>
  );
}

/** Eight-point star outline used for the splash texture. */
function octagram(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    const radius = index % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 8) * index;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.primaryDeep, alignItems: 'center', justifyContent: 'center' },
  splashBody: { alignItems: 'center', gap: spacing.xs },
  mark: { fontSize: 46, color: colors.gold, marginBottom: spacing.sm },
  brand: { fontSize: 40, fontWeight: '700', color: '#FDFBF6', letterSpacing: 1 },
  brandArabic: { fontSize: 20, color: colors.gold, marginBottom: spacing.lg },
  tagline: {
    ...typography.small,
    color: '#BFD3CA',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: { position: 'absolute', bottom: 46, ...typography.small, color: '#7C9389' },
});
