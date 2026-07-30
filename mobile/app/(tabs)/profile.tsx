import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Divider,
  Screen,
  Stat,
} from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, stats, isAdmin, signOut, refresh } = useAuth();

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const rows: Array<{ label: string; glyph: string; href: string }> = [
    { label: t('tabs.saved'), glyph: '♡', href: '/(tabs)/saved' },
    { label: t('trips.title'), glyph: '🧳', href: '/trips' },
    { label: t('profile.preferences'), glyph: '⚙', href: '/preferences' },
    { label: t('profile.settings'), glyph: '☰', href: '/settings' },
  ];

  return (
    <Screen>
      <AppHeader title={t('profile.title')} onBack={false} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <Text style={[typography.title, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>{user?.email}</Text>
          {isAdmin ? <Badge label="Administrator" tone="gold" style={{ marginTop: spacing.sm }} /> : null}
        </View>

        <Card style={styles.stats}>
          <Stat value={stats?.trips ?? 0} label={t('profile.tripCount')} />
          <Divider style={styles.vDivider} />
          <Stat value={stats?.placesVisited ?? 0} label={t('profile.visitedCount')} />
          <Divider style={styles.vDivider} />
          <Stat value={stats?.savedPlaces ?? 0} label={t('profile.savedCount')} />
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map((row, index) => (
            <View key={row.href}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={row.label}
                onPress={() => router.push(row.href as never)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
              >
                <Text style={{ fontSize: 16, width: 26 }}>{row.glyph}</Text>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{row.label}</Text>
                <Text style={{ color: colors.textFaint, fontSize: 20 }}>›</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        {isAdmin ? (
          <Card style={{ backgroundColor: colors.goldSoft, borderColor: colors.goldSoft }}>
            <Text style={[typography.bodyStrong, { color: colors.warning }]}>{t('profile.adminConsole')}</Text>
            <Text style={[typography.small, { color: colors.warning, marginTop: 4 }]}>
              {t('admin.places')} · {t('admin.cities')} · {t('admin.categories')} · {t('admin.users')}
            </Text>
            <Button
              label={t('profile.adminConsole')}
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              onPress={() => router.push('/admin')}
            />
          </Card>
        ) : null}

        <Button
          label={t('common.signOut')}
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  identity: { alignItems: 'center', gap: 4, paddingVertical: spacing.md },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { ...typography.title, color: colors.primary },
  stats: { flexDirection: 'row', alignItems: 'center' },
  vDivider: { width: 1, height: 34, backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
});
