import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PatternTile } from '../../src/components/PatternTile';
import { Button, Screen } from '../../src/components/ui';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function Onboarding() {
  const router = useRouter();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const slides = [
    { glyph: '🕌', titleKey: 'onboarding.feature1Title', bodyKey: 'onboarding.feature1Body', tint: colors.primary },
    { glyph: '🧭', titleKey: 'onboarding.feature2Title', bodyKey: 'onboarding.feature2Body', tint: '#5C6E8A' },
    { glyph: '📖', titleKey: 'onboarding.feature3Title', bodyKey: 'onboarding.feature3Body', tint: colors.gold },
  ] as const;

  const slide = slides[index]!;
  const last = index === slides.length - 1;

  return (
    <Screen>
      <View style={styles.top}>
        <LanguagePicker compact />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
          hitSlop={10}
        >
          <Text style={[typography.bodyStrong, { color: colors.textMuted }]}>{t('common.next')}</Text>
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
          {t(slide.titleKey)}
        </Text>
        <Text style={[typography.body, styles.slideBody]}>{t(slide.bodyKey)}</Text>

        <View style={styles.dots}>
          {slides.map((_, dot) => (
            <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={last ? t('onboarding.getStarted') : t('common.next')}
          size="lg"
          onPress={() => (last ? router.replace('/(auth)/login') : setIndex(index + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  slideBody: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 22, backgroundColor: colors.primary },
  footer: { padding: spacing.lg, paddingBottom: spacing.xl },
});
