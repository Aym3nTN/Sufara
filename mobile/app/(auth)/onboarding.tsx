import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PatternTile } from '../../src/components/PatternTile';
import { Button, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

const SLIDES = [
  {
    glyph: '🕌',
    title: 'Discover with purpose',
    body: 'Mosques, sacred places, battle sites and the locations that shaped Islamic history — gathered in one place.',
    tint: colors.primary,
  },
  {
    glyph: '🧭',
    title: 'Your journey, made meaningful',
    body: 'Tell Sufara where you are and how long you have. It builds a realistic route around the time you actually hold.',
    tint: '#5C6E8A',
  },
  {
    glyph: '📖',
    title: 'Learn as you travel',
    body: 'Every place carries its history, its significance and how long a visit genuinely takes.',
    tint: colors.gold,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
          hitSlop={10}
        >
          <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <PatternTile
          seed={`onboarding-${index}`}
          tint={slide.tint}
          height={280}
          glyph={slide.glyph}
          style={{ borderRadius: radius.xl }}
        />

        <Text style={[typography.display, { color: colors.text, marginTop: spacing.xl }]}>
          {slide.title}
        </Text>
        <Text style={[typography.body, styles.slideBody]}>{slide.body}</Text>

        <View style={styles.dots}>
          {SLIDES.map((_, dot) => (
            <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={last ? 'Get Started' : 'Next'}
          size="lg"
          onPress={() => (last ? router.replace('/(auth)/login') : setIndex(index + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  slideBody: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 22, backgroundColor: colors.primary },
  footer: { padding: spacing.lg, paddingBottom: spacing.xl },
});
