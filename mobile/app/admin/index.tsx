import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { AdminStats } from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  Divider,
  Loader,
  Notice,
  SectionTitle,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatDate } from '../../src/utils/format';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await api.admin.stats());
    } catch {
      setError('Could not load dashboard statistics.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (error) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Notice tone="danger">{error}</Notice>
      </View>
    );
  }

  if (!stats) return <Loader label="Loading dashboard…" />;

  const maxCategoryCount = Math.max(1, ...stats.placesByCategory.map((entry) => entry.count));

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.tiles}>
        <Tile value={stats.totals.places} label="Places" />
        <Tile value={stats.totals.cities} label="Cities" />
        <Tile value={stats.totals.countries} label="Countries" />
        <Tile value={stats.totals.users} label="Users" />
      </View>

      {stats.totals.placesAwaitingReview > 0 ? (
        <Notice tone="warning">
          {stats.totals.placesAwaitingReview} place
          {stats.totals.placesAwaitingReview === 1 ? '' : 's'} still in draft and awaiting review.
        </Notice>
      ) : null}

      <View style={styles.quick}>
        <Button label="Add a place" size="sm" onPress={() => router.push('/admin/place-form')} />
        <Button
          label="Manage cities"
          size="sm"
          variant="secondary"
          onPress={() => router.replace('/admin/geography')}
        />
      </View>

      <View>
        <SectionTitle title="Recently added" action="All places" onAction={() => router.replace('/admin/places')} />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {stats.recentPlaces.map((place, index) => (
            <View key={place.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{place.name}</Text>
                  <Text style={[typography.small, { color: colors.textMuted }]}>
                    {place.cityName} · {place.categoryName} · {formatDate(place.createdAt)}
                  </Text>
                </View>
                <Badge
                  label={place.status.toLowerCase()}
                  tone={place.status === 'ACTIVE' ? 'primary' : place.status === 'DRAFT' ? 'warning' : 'neutral'}
                />
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionTitle title="Places by category" />
        <Card style={{ gap: spacing.md }}>
          {stats.placesByCategory.map((entry) => (
            <View key={entry.id} style={{ gap: 4 }}>
              <View style={styles.barLabel}>
                <Text style={[typography.small, { color: colors.text }]}>{entry.name}</Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>{entry.count}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((entry.count / maxCategoryCount) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionTitle title="Recent users" action="All users" onAction={() => router.replace('/admin/users')} />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {stats.recentUsers.map((user, index) => (
            <View key={user.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{user.name}</Text>
                  <Text style={[typography.small, { color: colors.textMuted }]}>{user.email}</Text>
                </View>
                <Badge label={user.role.toLowerCase()} tone={user.role === 'ADMIN' ? 'gold' : 'neutral'} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <Card style={styles.tile}>
      <Text style={[typography.display, { color: colors.primary }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, minWidth: 140, alignItems: 'flex-start', gap: 2 },
  quick: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.backgroundAlt },
  barFill: { height: 8, borderRadius: radius.sm, backgroundColor: colors.primary },
});
