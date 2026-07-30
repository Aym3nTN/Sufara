import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setError(`${t('errors.network')} (${resolveBaseUrl()})`);
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
      label: activeCity.name,
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

  if (loading) return <Loader label={t('common.loading')} />;

  const firstName = user?.name.split(' ')[0];

  return (
    <Screen>
      <AppHeader
        title={firstName ? t('home.greeting', { name: firstName }) : t('home.greetingAnon')}
        // Never state a location the traveller has not confirmed.
        subtitle={
          draft.city
            ? `${draft.city.name}, ${draft.city.country.name}`
            : t('home.prompt')
        }
        onBack={false}
        right={
          isAdmin ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.adminConsole')}
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
          accessibilityLabel={t('home.planVisit')}
          onPress={() => router.push('/planner')}
        >
          <PatternTile seed="plan-cta" tint={colors.primary} height={168} style={{ borderRadius: radius.xl }}>
            <View style={styles.ctaOverlay}>
              <Text style={[typography.caption, { color: '#D8E6DE' }]}>
                {t('onboarding.feature1Title').toUpperCase()}
              </Text>
              <Text style={[typography.title, { color: '#FFFFFF', marginTop: 4 }]}>
                {t('home.planVisit')}
              </Text>
              <Text style={[typography.small, { color: '#CFE0D8', marginTop: 4, maxWidth: 260 }]}>
                {t('onboarding.feature1Body')}
              </Text>
              <View style={styles.ctaPill}>
                <Text style={[typography.small, { color: colors.primaryDark, fontWeight: '700' }]}>
                  {t('home.planVisit')} →
                </Text>
              </View>
            </View>
          </PatternTile>
        </Pressable>

        {activeTrip ? (
          <Card
            onPress={() => router.push(`/trips/${activeTrip.id}`)}
            accessibilityLabel={activeTrip.title}
            style={styles.activeTrip}
          >
            <View style={styles.rowBetween}>
              <Badge label={t('trips.resume')} tone="primary" />
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {activeTrip.stops.filter((stop) => stop.completedAt).length} / {activeTrip.stops.length}
              </Text>
            </View>
            <Text style={[typography.heading, { color: colors.text, marginTop: spacing.sm }]}>
              {activeTrip.title}
            </Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {t('trips.resume')} →
            </Text>
          </Card>
        ) : null}

        <View style={styles.quickActions}>
          <QuickAction glyph="🗺" label={t('tabs.explore')} onPress={() => router.push('/(tabs)/explore')} />
          <QuickAction glyph="♡" label={t('tabs.saved')} onPress={() => router.push('/(tabs)/saved')} />
          <QuickAction glyph="🧳" label={t('trips.title')} onPress={() => router.push('/trips')} />
          <QuickAction
            glyph={locating ? '…' : '📍'}
            label={draft.start ? t('planner.usingLocation') : t('home.prompt')}
            onPress={useMyLocation}
          />
        </View>

        <View>
          <SectionTitle title={t('planner.stepDestination')} />
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
            title={activeCity ? `${t('home.nearbyPlaces')} — ${activeCity.name}` : t('home.nearbyPlaces')}
            action={t('home.seeAll')}
            onAction={() => activeCity && router.push(`/city/${activeCity.id}`)}
          />
          {recommended.length === 0 ? (
            <EmptyState
              title={t('saved.empty')}
              message={t('planner.noCityAvailable')}
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
            <SectionTitle title={t('home.recentTrips')} action={t('home.seeAll')} onAction={() => router.push('/trips')} />
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
                      {trip.stops.length} · {formatMinutes(trip.totals.totalMinutes)} ·{' '}
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
            {t('home.browseCities')}
          </Text>
          <Text style={[typography.small, { color: colors.primary, marginTop: 4 }]}>
            {t('planner.modeIChooseBody')}
          </Text>
          <Button
            label={t('saved.browsePlaces')}
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
