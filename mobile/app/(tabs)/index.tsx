import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, resolveBaseUrl } from '../../src/api/client';
import type { City, Itinerary, Place } from '../../src/api/types';
import { PatternTile } from '../../src/components/PatternTile';
import { PlaceTile } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Loader,
  Notice,
  SectionTitle,
  Screen,
} from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { usePlan } from '../../src/state/plan';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatDistance, formatMinutes } from '../../src/utils/format';
import { resolveCurrentLocation } from '../../src/utils/location';

export default function Home() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { draft, setDraft } = usePlan();

  const [cities, setCities] = useState<City[]>([]);
  const [recommended, setRecommended] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Until the traveller says where they are, fall back to the best-covered city
  // rather than whichever happens to sort first alphabetically.
  const suggestedCity = useMemo(
    () => [...cities].sort((a, b) => b.placeCount - a.placeCount)[0] ?? null,
    [cities],
  );
  const activeCity = draft.city ?? suggestedCity;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cityResult, tripResult] = await Promise.all([
        api.catalog.cities(),
        api.itineraries.list().catch(() => ({ items: [] as Itinerary[] })),
      ]);
      setCities(cityResult.items);
      setTrips(tripResult.items);
    } catch {
      // Name the endpoint: on a device the usual cause is a build without
      // EXPO_PUBLIC_API_URL, or an API that is not running.
      setError(`Could not reach Sufara at ${resolveBaseUrl()}. Pull to try again.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recommendations follow whichever city is in focus.
  useEffect(() => {
    if (!activeCity) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await api.catalog.places({
          cityId: activeCity.id,
          limit: 8,
          ...(draft.start
            ? { latitude: draft.start.latitude, longitude: draft.start.longitude }
            : {}),
        });
        if (!cancelled) setRecommended(result.items);
      } catch {
        if (!cancelled) setRecommended([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCity, draft.start]);

  const useMyLocation = async () => {
    if (!activeCity) return;
    setLocating(true);
    const resolved = await resolveCurrentLocation({
      latitude: activeCity.latitude,
      longitude: activeCity.longitude,
      label: `Centre of ${activeCity.name}`,
    });
    if (resolved) {
      setDraft({
        start: { latitude: resolved.latitude, longitude: resolved.longitude, label: resolved.label },
      });
    }
    setLocating(false);
  };

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null,
    [trips],
  );

  if (loading) return <Loader label="Loading places…" />;

  return (
    <Screen>
      <AppHeader
        title={`As-salamu alaykum, ${user?.name.split(' ')[0] ?? 'traveller'}`}
        // Never state a location the traveller has not confirmed.
        subtitle={
          draft.city
            ? `${draft.city.name}, ${draft.city.country.name}`
            : 'Where are you travelling today?'
        }
        onBack={false}
        right={
          isAdmin ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open admin console"
              onPress={() => router.push('/admin')}
              hitSlop={8}
            >
              <Badge label="Admin" tone="gold" />
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {/* Primary call to action — planning is what the app is for. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan my visit"
          onPress={() => router.push('/planner')}
        >
          <PatternTile seed="plan-cta" tint={colors.primary} height={168} style={{ borderRadius: radius.xl }}>
            <View style={styles.ctaOverlay}>
              <Text style={[typography.caption, { color: '#D8E6DE' }]}>SMART VISIT PLANNER</Text>
              <Text style={[typography.title, { color: '#FFFFFF', marginTop: 4 }]}>
                Plan My Visit
              </Text>
              <Text style={[typography.small, { color: '#CFE0D8', marginTop: 4, maxWidth: 260 }]}>
                Tell Sufara how long you have. It builds a route that fits.
              </Text>
              <View style={styles.ctaPill}>
                <Text style={[typography.small, { color: colors.primaryDark, fontWeight: '700' }]}>
                  Start planning →
                </Text>
              </View>
            </View>
          </PatternTile>
        </Pressable>

        {activeTrip ? (
          <Card
            onPress={() => router.push(`/trips/${activeTrip.id}`)}
            accessibilityLabel={`Continue ${activeTrip.title}`}
            style={styles.activeTrip}
          >
            <View style={styles.rowBetween}>
              <Badge label="In progress" tone="primary" />
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {activeTrip.stops.filter((stop) => stop.completedAt).length} / {activeTrip.stops.length} done
              </Text>
            </View>
            <Text style={[typography.heading, { color: colors.text, marginTop: spacing.sm }]}>
              {activeTrip.title}
            </Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              Continue your journey →
            </Text>
          </Card>
        ) : null}

        <View style={styles.quickActions}>
          <QuickAction glyph="🗺" label="Explore map" onPress={() => router.push('/(tabs)/explore')} />
          <QuickAction glyph="♡" label="Saved" onPress={() => router.push('/(tabs)/saved')} />
          <QuickAction glyph="🧳" label="My trips" onPress={() => router.push('/trips')} />
          <QuickAction
            glyph={locating ? '…' : '📍'}
            label={draft.start ? 'Location set' : 'Use location'}
            onPress={useMyLocation}
          />
        </View>

        <View>
          <SectionTitle title="Where are you?" />
          <ChipRow>
            {cities.map((city) => (
              <Chip
                key={city.id}
                label={`${city.name} · ${city.placeCount}`}
                selected={activeCity?.id === city.id}
                onPress={() => setDraft({ city, start: null })}
              />
            ))}
          </ChipRow>
        </View>

        <View>
          <SectionTitle
            title={activeCity ? `Highlights of ${activeCity.name}` : 'Highlights'}
            action="See all"
            onAction={() => activeCity && router.push(`/city/${activeCity.id}`)}
          />
          {recommended.length === 0 ? (
            <EmptyState
              title="No places yet"
              message="An administrator has not added places for this city yet."
              glyph="🕌"
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {recommended.map((place) => (
                <PlaceTile key={place.id} place={place} onPress={() => router.push(`/place/${place.id}`)} />
              ))}
            </ScrollView>
          )}
        </View>

        {trips.length > 0 ? (
          <View>
            <SectionTitle title="Recent itineraries" action="All trips" onAction={() => router.push('/trips')} />
            <View style={{ gap: spacing.sm }}>
              {trips.slice(0, 3).map((trip) => (
                <Card
                  key={trip.id}
                  onPress={() => router.push(`/trips/${trip.id}`)}
                  accessibilityLabel={trip.title}
                  style={styles.tripRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>{trip.title}</Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {trip.stops.length} places · {formatMinutes(trip.totals.totalMinutes)} ·{' '}
                      {formatDistance(trip.totals.distanceMeters)}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textFaint, fontSize: 20 }}>›</Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={[typography.bodyStrong, { color: colors.primaryDark }]}>
            Already know where you want to go?
          </Text>
          <Text style={[typography.small, { color: colors.primary, marginTop: 4 }]}>
            Add places to My Visit and Sufara will work out the best order.
          </Text>
          <Button
            label="Browse places"
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            onPress={() => activeCity && router.push(`/city/${activeCity.id}`)}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function QuickAction({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.85 }]}
    >
      <Text style={{ fontSize: 20 }}>{glyph}</Text>
      <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  ctaOverlay: { flex: 1, padding: spacing.lg, justifyContent: 'flex-end' },
  ctaPill: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  activeTrip: { borderColor: colors.primary, borderWidth: 1.5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  carousel: { gap: spacing.md, paddingRight: spacing.lg },
  tripRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
});
