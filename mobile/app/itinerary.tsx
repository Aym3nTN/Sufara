import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import { PlaceArtwork } from '../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Notice,
  Screen,
} from '../src/components/ui';
import { usePlan } from '../src/state/plan';
import { colors, radius, spacing, typography } from '../src/theme';
import { clockAfter, formatDistance, formatMinutes } from '../src/utils/format';

/**
 * The generated itinerary: totals, an ordered timeline, the reasoning behind the
 * selection, and the editing actions the brief calls for (remove, add, reorder,
 * regenerate, change time).
 */
export default function ItineraryScreen() {
  const router = useRouter();
  const { plan, setPlan, draft, planning, generate, previewOrder } = usePlan();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(false);

  if (!plan) {
    return (
      <Screen>
        <AppHeader title="Your itinerary" />
        <EmptyState
          title="No itinerary yet"
          message="Plan a visit and your route will appear here."
          action="Plan my visit"
          onAction={() => router.replace('/planner')}
          glyph="✦"
        />
      </Screen>
    );
  }

  const over = plan.totals.overBudgetMinutes > 0;

  const removeStop = async (placeId: string) => {
    const remaining = plan.stops.filter((stop) => stop.place.id !== placeId).map((stop) => stop.place.id);
    if (remaining.length === 0) {
      setPlan({ ...plan, stops: [], totals: { ...plan.totals, totalMinutes: 0 } });
      return;
    }
    await previewOrder(remaining);
  };

  const moveStop = async (index: number, direction: -1 | 1) => {
    const order = plan.stops.map((stop) => stop.place.id);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const moved = order[index]!;
    order.splice(index, 1);
    order.splice(target, 0, moved);
    await previewOrder(order);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const cityName = plan.stops[0]?.place.city.name ?? 'Visit';
      const result = await api.itineraries.create({
        title: `${cityName} — ${formatMinutes(plan.availableMinutes)}`,
        cityId: plan.cityId ?? undefined,
        startLabel: plan.start.label,
        startLatitude: plan.start.latitude,
        startLongitude: plan.start.longitude,
        availableMinutes: plan.availableMinutes,
        travelMode: plan.travelMode,
        totalTravelMinutes: plan.totals.travelMinutes,
        totalVisitMinutes: plan.totals.visitMinutes,
        totalDistanceMeters: plan.totals.distanceMeters,
        bufferMinutes: plan.totals.bufferMinutes,
        stops: plan.stops.map((stop) => ({
          placeId: stop.place.id,
          order: stop.order,
          estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
          estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
          travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
          distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
        })),
      });
      router.replace(`/trips/${result.itinerary.id}`);
    } catch (caught) {
      setSaveError(caught instanceof ApiError ? caught.message : 'Could not save this itinerary.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Your itinerary"
        subtitle={`${plan.stops.length} stops · ${plan.stops[0]?.place.city.name ?? ''}`}
        onBack={() => router.replace('/(tabs)')}
        right={
          <Pressable accessibilityRole="button" onPress={() => void generate()} hitSlop={8}>
            <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>Redo</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.totals}>
          <Total label="Total time" value={formatMinutes(plan.totals.totalMinutes)} emphasis />
          <Divider style={styles.vDivider} />
          <Total label="Visiting" value={formatMinutes(plan.totals.visitMinutes)} />
          <Divider style={styles.vDivider} />
          <Total label="Travelling" value={formatMinutes(plan.totals.travelMinutes)} />
          <Divider style={styles.vDivider} />
          <Total
            label={over ? 'Over' : 'Buffer'}
            value={formatMinutes(Math.abs(plan.totals.bufferMinutes))}
            tone={over ? 'danger' : 'primary'}
          />
        </Card>

        {plan.warnings.map((warning, index) => (
          <Notice key={index} tone={over ? 'danger' : 'warning'}>
            {warning}
          </Notice>
        ))}

        {over ? (
          <View style={styles.overActions}>
            <Button
              label="Optimise again"
              size="sm"
              variant="secondary"
              loading={planning}
              onPress={() => void generate()}
            />
            <Button
              label="Remove last stop"
              size="sm"
              variant="danger"
              onPress={() => {
                const last = plan.stops[plan.stops.length - 1];
                if (last) void removeStop(last.place.id);
              }}
            />
          </View>
        ) : null}

        {/* Timeline */}
        <View>
          <View style={styles.startRow}>
            <View style={styles.startDot} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{plan.start.label}</Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                Departing {clockAfter(0)}
              </Text>
            </View>
          </View>

          {plan.stops.map((stop, index) => (
            <View key={stop.place.id}>
              <View style={styles.legRow}>
                <View style={styles.legLine} />
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  ↓ {formatMinutes(stop.travelTimeFromPreviousMinutes)}{' '}
                  {plan.travelMode === 'WALKING' ? 'walk' : 'drive'} ·{' '}
                  {formatDistance(stop.distanceFromPreviousMeters)}
                </Text>
              </View>

              <Card style={styles.stopCard}>
                <View style={styles.stopHead}>
                  <View style={styles.stopNumber}>
                    <Text style={[typography.small, { color: colors.onPrimary, fontWeight: '700' }]}>
                      {stop.order}
                    </Text>
                  </View>
                  <View style={styles.stopArt}>
                    <PlaceArtwork place={stop.place} height={56} showGlyph={false} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${stop.place.name}`}
                    onPress={() => router.push(`/place/${stop.place.id}`)}
                    style={{ flex: 1 }}
                  >
                    <Text numberOfLines={2} style={[typography.bodyStrong, { color: colors.text }]}>
                      {stop.place.name}
                    </Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {stop.place.primaryCategory.name}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.stopMeta}>
                  <Badge label={`Visit ${formatMinutes(stop.estimatedVisitDurationMinutes)}`} tone="primary" />
                  <Badge label={`Arrive ${clockAfter(stop.estimatedArrivalOffsetMinutes)}`} />
                </View>

                <View style={styles.stopActions}>
                  <Button
                    label="↑"
                    variant="secondary"
                    size="sm"
                    style={styles.moveButton}
                    disabled={index === 0}
                    onPress={() => void moveStop(index, -1)}
                  />
                  <Button
                    label="↓"
                    variant="secondary"
                    size="sm"
                    style={styles.moveButton}
                    disabled={index === plan.stops.length - 1}
                    onPress={() => void moveStop(index, 1)}
                  />
                  <Text style={[typography.small, { color: colors.textFaint, flex: 1 }]}>
                    Reorder
                  </Text>
                  <Button
                    label="Remove"
                    variant="danger"
                    size="sm"
                    onPress={() => void removeStop(stop.place.id)}
                  />
                </View>
              </Card>
            </View>
          ))}
        </View>

        {/* Why these places? */}
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowReasons(!showReasons)}
            style={styles.rowBetween}
          >
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Why these places?</Text>
            <Text style={{ color: colors.textFaint, fontSize: 18 }}>{showReasons ? '⌃' : '⌄'}</Text>
          </Pressable>

          {showReasons ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {plan.notes.map((note, index) => (
                <Text key={index} style={[typography.small, { color: colors.textMuted }]}>
                  • {note}
                </Text>
              ))}
              {plan.dropped.length > 0 ? (
                <>
                  <Divider style={{ marginVertical: spacing.sm }} />
                  <Text style={[typography.caption, { color: colors.textFaint }]}>LEFT OUT</Text>
                  {plan.dropped.slice(0, 5).map((entry) => (
                    <Text key={entry.placeId} style={[typography.small, { color: colors.textMuted }]}>
                      • {entry.name} —{' '}
                      {entry.reason === 'NO_TIME'
                        ? 'would not fit your available time'
                        : entry.reason === 'CLOSED'
                          ? 'closed at that time'
                          : 'too far for your travel mode'}
                    </Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Button label="Change available time" variant="secondary" onPress={() => router.push('/planner')} />
          <Button label="Add another place" variant="secondary" onPress={() => router.push('/(tabs)/explore')} />
        </View>

        {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="View on map"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push('/route-map')}
        />
        <Button
          label="Save & start"
          style={{ flex: 1 }}
          loading={saving}
          disabled={plan.stops.length === 0}
          onPress={save}
        />
      </View>
      {draft.city ? null : null}
    </Screen>
  );
}

function Total({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'danger' | 'primary';
}) {
  const color = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.primary : colors.text;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[emphasis ? typography.heading : typography.bodyStrong, { color }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted, fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  totals: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  vDivider: { width: 1, height: 30, backgroundColor: colors.border },
  overActions: { flexDirection: 'row', gap: spacing.sm },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: 3 },
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.goldSoft,
  },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  legLine: { width: 2, height: 26, backgroundColor: colors.border, marginLeft: 6 },
  stopCard: { gap: spacing.md },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stopNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopArt: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
  stopMeta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moveButton: { width: 42, paddingHorizontal: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
