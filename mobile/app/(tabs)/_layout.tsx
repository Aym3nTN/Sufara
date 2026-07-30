import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/state/auth';
import { usePlan } from '../../src/state/plan';
import { Loader } from '../../src/components/ui';
import { colors } from '../../src/theme';

const GLYPHS = {
  home: '⌂',
  map: '◈',
  journey: '⚑',
  saved: '♡',
  profile: '☺',
} as const;

export default function TabsLayout() {
  const { ready, user } = useAuth();
  const { basket } = usePlan();
  const { t } = useTranslation();

  if (!ready) return <Loader label={t('common.loading')} />;
  if (!user) return <Redirect href="/(auth)/onboarding" />;

  const icon =
    (glyph: string) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Text style={{ color, fontSize: size - 2 }}>{glyph}</Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Tall enough that the label is never clipped above the home indicator.
          height: 74,
          paddingBottom: 14,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon(GLYPHS.home) }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore'), tabBarIcon: icon(GLYPHS.map) }} />
      <Tabs.Screen
        name="journey"
        options={{
          title: t('tabs.journey'),
          tabBarIcon: icon(GLYPHS.journey),
          tabBarBadge: basket.length > 0 ? basket.length : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="saved" options={{ title: t('tabs.saved'), tabBarIcon: icon(GLYPHS.saved) }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon(GLYPHS.profile) }} />
    </Tabs>
  );
}
