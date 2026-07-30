import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { EmptyState, Loader, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

const SECTIONS = [
  { label: 'Dashboard', href: '/admin', prefixes: ['/admin'] },
  // The add/edit form belongs to Places, so the tab stays lit while editing.
  { label: 'Places', href: '/admin/places', prefixes: ['/admin/places', '/admin/place-form'] },
  { label: 'Cities', href: '/admin/geography', prefixes: ['/admin/geography'] },
  { label: 'Categories', href: '/admin/categories', prefixes: ['/admin/categories'] },
  { label: 'Users', href: '/admin/users', prefixes: ['/admin/users'] },
] as const;

/**
 * Admin shell with its own navigation, separate from the traveller tabs.
 *
 * The guard here is convenience only — every admin endpoint is authorised on the
 * server, so hiding this UI is never the security boundary.
 */
export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, user, isAdmin } = useAuth();

  if (!ready) return <Loader />;
  if (!user) return <Redirect href="/(auth)/login" />;

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState
          title="Administrators only"
          message="This area manages the content of Sufara and is limited to administrator accounts."
          action="Back to the app"
          onAction={() => router.replace('/(tabs)')}
          glyph="🔒"
        />
      </Screen>
    );
  }

  // Most specific matching prefix wins, so /admin/place-form lights up Places
  // rather than falling back to Dashboard.
  const active = SECTIONS.reduce((best, section) => {
    const hit = section.prefixes.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix),
    );
    return hit && hit.length > best.length ? hit : best;
  }, '/admin');

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave admin console"
          onPress={() => router.replace('/(tabs)')}
          hitSlop={8}
        >
          <Text style={[typography.small, { color: colors.textMuted }]}>‹ Exit</Text>
        </Pressable>
        <Text style={[typography.heading, { color: colors.text }]}>Sufara Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* flexGrow 0 stops the nav row from claiming the column's spare height,
          which would stretch each pill into a tall capsule. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.nav}
      >
        {SECTIONS.map((section) => (
          <Pressable
            key={section.href}
            accessibilityRole="button"
            accessibilityLabel={section.label}
            onPress={() => router.replace(section.href as never)}
            style={[styles.navItem, section.prefixes.some((p) => p === active) && styles.navItemActive]}
          >
            <Text
              style={[
                typography.small,
                {
                  color: section.prefixes.some((p) => p === active) ? colors.onPrimary : colors.textMuted,
                  fontWeight: '600',
                },
              ]}
            >
              {section.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  nav: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  navItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
