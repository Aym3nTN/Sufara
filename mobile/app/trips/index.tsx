import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Itinerary } from '../../src/api/types';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Loader,
  Notice,
  Screen,
} from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { formatDate, formatDistance, formatMinutes } from '../../src/utils/format';

const STATUS_TONE = {
  DRAFT: 'neutral',
  PLANNED: 'gold',
  IN_PROGRESS: 'primary',
  COMPLETED: 'neutral',
} as const;

export default function Trips() {
  const router = useRouter();
  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.itineraries.list();
      setTrips(result.items);
    } catch {
      setError('Could not load your trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const duplicate = async (id: string) => {
    try {
      await api.itineraries.duplicate(id);
      await load();
    } catch {
      setError('Could not duplicate that trip.');
    }
  };

  const remove = async (id: string) => {
    setTrips((current) => current.filter((trip) => trip.id !== id));
    try {
      await api.itineraries.remove(id);
    } catch {
      await load();
    }
  };

  if (loading) return <Loader label="Loading your trips…" />;

  return (
    <Screen>
      <AppHeader title="My trips" subtitle={`${trips.length} saved`} />

      <ScrollView contentContainerStyle={styles.body}>
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {trips.length === 0 ? (
          <EmptyState
            title="No trips saved yet"
            message="Plan a visit and save it — your itineraries will be waiting here."
            action="Plan my visit"
            onAction={() => router.push('/planner')}
            glyph="🧳"
          />
        ) : (
          trips.map((trip) => {
            const done = trip.stops.filter((stop) => stop.completedAt).length;
            return (
              <Card key={trip.id}>
                {/* Only the summary is tappable — the action buttons below are
                    siblings, never nested inside another button. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={trip.title}
                  onPress={() => router.push(`/trips/${trip.id}`)}
                >
                  <View style={styles.rowBetween}>
                    <Badge
                      label={trip.status.replace('_', ' ').toLowerCase()}
                      tone={STATUS_TONE[trip.status]}
                    />
                    <Text style={[typography.small, { color: colors.textFaint }]}>
                      {formatDate(trip.createdAt)}
                    </Text>
                  </View>

                  <Text style={[typography.heading, { color: colors.text, marginTop: spacing.sm }]}>
                    {trip.title}
                  </Text>
                  <Text style={[typography.small, { color: colors.textMuted, marginTop: 2 }]}>
                    {trip.cityName ?? 'Multiple cities'} · {trip.stops.length} places ·{' '}
                    {formatMinutes(trip.totals.totalMinutes)} ·{' '}
                    {formatDistance(trip.totals.distanceMeters)}
                  </Text>
                </Pressable>

                {done > 0 ? (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round((done / trip.stops.length) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {done}/{trip.stops.length}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    label="Open"
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/trips/${trip.id}`)}
                  />
                  <Button label="Duplicate" size="sm" variant="ghost" onPress={() => void duplicate(trip.id)} />
                  <View style={{ flex: 1 }} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${trip.title}`}
                    onPress={() => void remove(trip.id)}
                    hitSlop={8}
                  >
                    <Text style={[typography.small, { color: colors.danger, fontWeight: '600' }]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.backgroundAlt },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
});
