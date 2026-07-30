import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapCanvas, type MapMarkerSpec } from '../src/components/map';
import { PlacePreviewCard } from '../src/components/PlaceCard';
import { AppHeader, Button, Card, EmptyState, Screen } from '../src/components/ui';
import { usePlan } from '../src/state/plan';
import { colors, spacing, typography } from '../src/theme';
import { formatDistance, formatMinutes } from '../src/utils/format';

export default function RouteMap() {
  const router = useRouter();
  const { plan } = usePlan();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!plan || plan.stops.length === 0) {
    return (
      <Screen>
        <AppHeader title="Route map" />
        <EmptyState
          title="No route to draw"
          message="Generate an itinerary and its route will be mapped here."
          action="Plan my visit"
          onAction={() => router.replace('/planner')}
          glyph="🗺"
        />
      </Screen>
    );
  }

  const markers: MapMarkerSpec[] = [
    {
      id: '__start__',
      coordinate: { latitude: plan.start.latitude, longitude: plan.start.longitude },
      label: '★',
      title: plan.start.label,
      kind: 'start',
    },
    ...plan.stops.map((stop) => ({
      id: stop.place.id,
      coordinate: { latitude: stop.place.latitude, longitude: stop.place.longitude },
      label: String(stop.order),
      tint: stop.place.primaryCategory.colorHex,
      title: stop.place.name,
      subtitle: `Stop ${stop.order} · ${formatMinutes(stop.estimatedVisitDurationMinutes)}`,
      kind: 'place' as const,
    })),
  ];

  const selected = plan.stops.find((stop) => stop.place.id === selectedId) ?? null;

  return (
    <Screen>
      <AppHeader
        title="Route map"
        subtitle={`${plan.stops.length} stops · ${formatDistance(plan.totals.distanceMeters)}`}
      />

      <View style={styles.mapWrap}>
        <MapCanvas
          markers={markers}
          polyline={plan.route.coordinates}
          height="100%"
          selectedMarkerId={selectedId}
          onMarkerPress={(id) => setSelectedId(id === '__start__' ? null : id)}
        />
      </View>

      {/* flexGrow 0 keeps the panel to its content so the map takes the slack. */}
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.bottom}>
        {selected ? (
          <PlacePreviewCard
            place={selected.place}
            onOpen={() => router.push(`/place/${selected.place.id}`)}
          />
        ) : (
          <Card style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.small, { color: colors.textMuted }]}>Total distance</Text>
              <Text style={[typography.heading, { color: colors.text }]}>
                {formatDistance(plan.totals.distanceMeters)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.small, { color: colors.textMuted }]}>Total time</Text>
              <Text style={[typography.heading, { color: colors.text }]}>
                {formatMinutes(plan.totals.totalMinutes)}
              </Text>
            </View>
          </Card>
        )}

        <View style={styles.legs}>
          {plan.stops.map((stop) => (
            <View key={stop.place.id} style={styles.legRow}>
              <Text style={[typography.small, styles.legOrder]}>{stop.order}</Text>
              <Text numberOfLines={1} style={[typography.small, { color: colors.text, flex: 1 }]}>
                {stop.place.name}
              </Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {formatMinutes(stop.travelTimeFromPreviousMinutes)} ·{' '}
                {formatDistance(stop.distanceFromPreviousMeters)}
              </Text>
            </View>
          ))}
        </View>

        <Button label="Start navigation" size="lg" icon="➤" onPress={() => router.push('/navigate')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md, minHeight: 240 },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  summary: { flexDirection: 'row', gap: spacing.lg },
  legs: { gap: 6 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legOrder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 20,
  },
});
