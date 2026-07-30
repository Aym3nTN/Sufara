import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Itinerary } from '../../src/api/types';
import { MapCanvas, type MapMarkerSpec } from '../../src/components/map';
import { PlaceArtwork } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Divider,
  Loader,
  Notice,
  Screen,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, radius, spacing, typography } from '../../src/theme';
import { clockAfter, formatDistance, formatMinutes } from '../../src/utils/format';

/** A saved trip, replayed from stored stops — the planner is not re-run. */
export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setPlan } = usePlan();

  const [trip, setTrip] = useState<Itinerary | null>(null);
  const [busyStopId, setBusyStopId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const result = await api.itineraries.get(id);
        setTrip(result.itinerary);
      } catch {
        setError('Could not load this trip.');
      }
    })();
  }, [id]);

  const toggleStop = async (stopId: string, completed: boolean) => {
    if (!trip) return;
    setBusyStopId(stopId);
    try {
      const result = await api.itineraries.setStopCompleted(trip.id, stopId, completed);
      setTrip(result.itinerary);
    } catch {
      setError('Could not update that stop.');
    } finally {
      setBusyStopId(null);
    }
  };

  /** Rehydrate the planner context so the map and navigation screens can reuse it. */
  const openRoute = (target: '/route-map' | '/navigate') => {
    if (!trip) return;
    setPlan({
      start: trip.start,
      end: trip.end,
      cityId: trip.cityId,
      travelMode: trip.travelMode,
      availableMinutes: trip.availableMinutes,
      stops: trip.stops.map((stop) => ({
        order: stop.order,
        place: stop.place,
        estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
        estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
        travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
        distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
      })),
      totals: {
        ...trip.totals,
        targetBufferMinutes: trip.totals.bufferMinutes,
        overBudgetMinutes: 0,
      },
      route: {
        coordinates: [
          { latitude: trip.start.latitude, longitude: trip.start.longitude },
          ...trip.stops.map((stop) => ({
            latitude: stop.place.latitude,
            longitude: stop.place.longitude,
          })),
        ],
        distanceMeters: trip.totals.distanceMeters,
        durationMinutes: trip.totals.travelMinutes,
      },
      notes: [],
      warnings: [],
      dropped: [],
    });
    router.push(target);
  };

  if (error && !trip) {
    return (
      <Screen>
        <AppHeader title="Trip" />
        <View style={{ padding: spacing.lg }}>
          <Notice tone="danger">{error}</Notice>
        </View>
      </Screen>
    );
  }

  if (!trip) return <Loader label="Loading trip…" />;

  const done = trip.stops.filter((stop) => stop.completedAt).length;
  const nextStop = trip.stops.find((stop) => !stop.completedAt) ?? null;

  const markers: MapMarkerSpec[] = [
    {
      id: '__start__',
      coordinate: { latitude: trip.start.latitude, longitude: trip.start.longitude },
      label: '★',
      kind: 'start',
      title: trip.start.label,
    },
    ...trip.stops.map((stop) => ({
      id: stop.place.id,
      coordinate: { latitude: stop.place.latitude, longitude: stop.place.longitude },
      label: String(stop.order),
      tint: stop.completedAt ? colors.textFaint : stop.place.primaryCategory.colorHex,
      title: stop.place.name,
    })),
  ];

  return (
    <Screen>
      <AppHeader
        title={trip.title}
        subtitle={`${trip.stops.length} stops · ${formatMinutes(trip.totals.totalMinutes)}`}
      />

      <ScrollView contentContainerStyle={styles.body}>
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Card>
          <View style={styles.rowBetween}>
            <Badge
              label={trip.status.replace('_', ' ').toLowerCase()}
              tone={trip.status === 'IN_PROGRESS' ? 'primary' : 'gold'}
            />
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {done} of {trip.stops.length} completed
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((done / Math.max(1, trip.stops.length)) * 100)}%` },
              ]}
            />
          </View>

          {nextStop ? (
            <View style={styles.nextStop}>
              <View style={styles.nextArt}>
                <PlaceArtwork place={nextStop.place} height={54} showGlyph={false} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textFaint }]}>NEXT STOP</Text>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {nextStop.place.name}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {formatDistance(nextStop.distanceFromPreviousMeters)} ·{' '}
                  {formatMinutes(nextStop.travelTimeFromPreviousMinutes)} ·{' '}
                  {formatMinutes(nextStop.estimatedVisitDurationMinutes)} visit
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[typography.small, { color: colors.primary, marginTop: spacing.md }]}>
              Journey complete. May your visits be accepted.
            </Text>
          )}
        </Card>

        <MapCanvas
          markers={markers}
          polyline={[
            { latitude: trip.start.latitude, longitude: trip.start.longitude },
            ...trip.stops.map((stop) => ({
              latitude: stop.place.latitude,
              longitude: stop.place.longitude,
            })),
          ]}
          height={220}
        />

        <View style={{ gap: spacing.sm }}>
          {trip.stops.map((stop) => (
            <Card key={stop.id} style={[styles.stopCard, !!stop.completedAt && styles.stopDone]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!stop.completedAt }}
                accessibilityLabel={`Mark ${stop.place.name} ${stop.completedAt ? 'not visited' : 'visited'}`}
                onPress={() => void toggleStop(stop.id, !stop.completedAt)}
                disabled={busyStopId === stop.id}
                style={[styles.check, !!stop.completedAt && styles.checkDone]}
              >
                <Text style={{ color: stop.completedAt ? colors.onPrimary : colors.textFaint }}>
                  {stop.completedAt ? '✓' : String(stop.order)}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${stop.place.name}`}
                onPress={() => router.push(`/place/${stop.place.id}`)}
                style={{ flex: 1 }}
              >
                <Text
                  style={[
                    typography.bodyStrong,
                    { color: colors.text },
                    !!stop.completedAt && styles.strikethrough,
                  ]}
                >
                  {stop.place.name}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  Arrive {clockAfter(stop.estimatedArrivalOffsetMinutes, new Date(trip.startedAt ?? trip.createdAt))}{' '}
                  · {formatMinutes(stop.estimatedVisitDurationMinutes)} visit
                </Text>
              </Pressable>
            </Card>
          ))}
        </View>

        <Card style={styles.totals}>
          <Total label="Visiting" value={formatMinutes(trip.totals.visitMinutes)} />
          <Divider style={styles.vDivider} />
          <Total label="Travelling" value={formatMinutes(trip.totals.travelMinutes)} />
          <Divider style={styles.vDivider} />
          <Total label="Distance" value={formatDistance(trip.totals.distanceMeters)} />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="View route"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => openRoute('/route-map')}
        />
        <Button label="Navigate" icon="➤" style={{ flex: 1 }} onPress={() => openRoute('/navigate')} />
      </View>
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted, fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundAlt,
    marginTop: spacing.md,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  nextStop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  nextArt: { width: 54, height: 54, borderRadius: radius.md, overflow: 'hidden' },
  stopCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  stopDone: { backgroundColor: colors.surfaceMuted },
  strikethrough: { textDecorationLine: 'line-through', color: colors.textMuted },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  totals: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  vDivider: { width: 1, height: 28, backgroundColor: colors.border },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
