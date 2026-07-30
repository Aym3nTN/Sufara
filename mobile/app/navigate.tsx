import React, { useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapCanvas } from '../src/components/map';
import { PlaceArtwork } from '../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
} from '../src/components/ui';
import { usePlan } from '../src/state/plan';
import { colors, radius, spacing, typography } from '../src/theme';
import { clockAfter, formatDistance, formatMinutes } from '../src/utils/format';
import { externalNavigationUrl } from '../src/utils/location';

/**
 * Guides the traveller to the next stop.
 *
 * Turn-by-turn is delegated to the platform maps app for the MVP — building a
 * navigation engine is not what makes this product useful, and the handoff keeps
 * live traffic and voice guidance for free.
 */
export default function Navigate() {
  const router = useRouter();
  const { plan } = usePlan();
  const [currentIndex, setCurrentIndex] = useState(0);

  const stop = plan?.stops[currentIndex] ?? null;
  const previous = currentIndex === 0 ? null : plan?.stops[currentIndex - 1] ?? null;

  const polyline = useMemo(() => {
    if (!plan || !stop) return [];
    const from = previous
      ? { latitude: previous.place.latitude, longitude: previous.place.longitude }
      : { latitude: plan.start.latitude, longitude: plan.start.longitude };
    return [from, { latitude: stop.place.latitude, longitude: stop.place.longitude }];
  }, [plan, stop, previous]);

  if (!plan || !stop) {
    return (
      <Screen>
        <AppHeader title="Navigation" />
        <EmptyState
          title="Nothing to navigate to"
          message="Build an itinerary first, then Sufara will guide you stop by stop."
          action="Plan my visit"
          onAction={() => router.replace('/planner')}
          glyph="➤"
        />
      </Screen>
    );
  }

  const openExternal = () => {
    const url = externalNavigationUrl(
      { latitude: stop.place.latitude, longitude: stop.place.longitude },
      plan.travelMode,
    );
    if (Platform.OS === 'web') {
      globalThis.open?.(url, '_blank');
    } else {
      void Linking.openURL(url);
    }
  };

  const last = currentIndex === plan.stops.length - 1;

  return (
    <Screen>
      <AppHeader
        title="Navigation"
        subtitle={`Stop ${stop.order} of ${plan.stops.length}`}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.banner}>
          <Text style={[typography.caption, { color: '#BFD8CC' }]}>NEXT STOP</Text>
          <Text style={[typography.title, { color: '#FFFFFF', marginTop: 2 }]}>{stop.place.name}</Text>
          <Text style={[typography.small, { color: '#CFE0D8', marginTop: 4 }]}>
            {formatDistance(stop.distanceFromPreviousMeters)} ·{' '}
            {formatMinutes(stop.travelTimeFromPreviousMinutes)}{' '}
            {plan.travelMode === 'WALKING' ? 'on foot' : 'by car'} · arriving around{' '}
            {clockAfter(stop.estimatedArrivalOffsetMinutes)}
          </Text>
        </Card>

        <MapCanvas
          markers={[
            {
              id: 'from',
              coordinate: polyline[0]!,
              label: previous ? String(previous.order) : '★',
              kind: previous ? 'place' : 'start',
              title: previous?.place.name ?? plan.start.label,
            },
            {
              id: 'to',
              coordinate: polyline[1]!,
              label: String(stop.order),
              tint: stop.place.primaryCategory.colorHex,
              title: stop.place.name,
            },
          ]}
          polyline={polyline}
          height={260}
        />

        <Card style={styles.stopCard}>
          <View style={styles.stopArt}>
            <PlaceArtwork place={stop.place} height={72} showGlyph={false} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{stop.place.name}</Text>
            <Text numberOfLines={2} style={[typography.small, { color: colors.textMuted }]}>
              {stop.place.shortDescription}
            </Text>
            <Badge label={`Plan ${formatMinutes(stop.estimatedVisitDurationMinutes)} here`} tone="primary" />
          </View>
        </Card>

        <Button label="Open turn-by-turn directions" icon="➤" size="lg" onPress={openExternal} />

        <Notice tone="primary">
          Sufara hands turn-by-turn over to your maps app, then keeps your place in the itinerary.
        </Notice>

        <View style={{ gap: spacing.sm }}>
          <Button
            label={last ? 'Finish journey' : 'I have arrived — next stop'}
            variant="secondary"
            onPress={() => (last ? router.replace('/(tabs)') : setCurrentIndex(currentIndex + 1))}
          />
          {currentIndex > 0 ? (
            <Button
              label="Previous stop"
              variant="ghost"
              onPress={() => setCurrentIndex(currentIndex - 1)}
            />
          ) : null}
        </View>

        <View style={styles.upcoming}>
          <Text style={[typography.caption, { color: colors.textFaint }]}>REMAINING STOPS</Text>
          {plan.stops.slice(currentIndex + 1).map((entry) => (
            <View key={entry.place.id} style={styles.upcomingRow}>
              <Text style={[typography.small, styles.upcomingOrder]}>{entry.order}</Text>
              <Text numberOfLines={1} style={[typography.small, { color: colors.text, flex: 1 }]}>
                {entry.place.name}
              </Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {clockAfter(entry.estimatedArrivalOffsetMinutes)}
              </Text>
            </View>
          ))}
          {currentIndex === plan.stops.length - 1 ? (
            <Text style={[typography.small, { color: colors.textMuted }]}>
              This is your final stop.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  banner: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  stopCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  stopArt: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' },
  upcoming: { gap: 6 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upcomingOrder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundAlt,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '700',
  },
});
