import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api, resolveBaseUrl } from '../../src/api/client';
import type { City, Itinerary, Place } from '../../src/api/types';
import { PlaceArtwork, PlaceTile } from '../../src/components/PlaceCard';
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


        {activeTrip ? (() => {
          const completed = activeTrip.stops.filter((stop) => stop.completedAt).length;
          const nextStop = activeTrip.stops.find((stop) => !stop.completedAt) ?? activeTrip.stops[0];
          return (
            <Card
              onPress={() => router.push(`/trips/${activeTrip.id}`)}
              accessibilityLabel={activeTrip.title}
              style={[styles.activeTrip, { padding: 0, overflow: 'hidden' }]}
            >
              {nextStop ? (
                <View style={styles.activeTripHero}>
                  <View style={styles.activeTripArt}>
                    <PlaceArtwork place={nextStop.place} height={72} showGlyph={false} />
                  </View>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={[typography.caption, { color: colors.primary }]}>
                      {t('itinerary.nextStop').toUpperCase()}
                    </Text>
                    <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text, marginTop: 2 }]}>
                      {nextStop.place.name}
                    </Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {activeTrip.title}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textFaint, fontSize: 22, paddingRight: spacing.md }}>›</Text>
                </View>
              ) : null}
              <View style={styles.activeTripFooter}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${activeTrip.stops.length > 0 ? (completed / activeTrip.stops.length) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {completed} / {activeTrip.stops.length}
                </Text>
              </View>
            </Card>
          );
        })() : null}

        <View>
          <SectionTitle title={t('home.quickActions')} />
          <View style={styles.quickActions}>
            <QuickAction
              glyph="✦"
              label={t('home.planVisit')}
              onPress={() => router.push('/planner')}
              tone="primary"
            />
            <QuickAction glyph="🗺" label={t('tabs.explore')} onPress={() => router.push('/(tabs)/explore')} />
            <QuickAction glyph="♡" label={t('tabs.saved')} onPress={() => router.push('/(tabs)/saved')} />
            <QuickAction glyph="🧳" label={t('trips.title')} onPress={() => router.push('/trips')} />
          </View>
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
  tone,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  tone?: 'primary';
}) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        isPrimary && styles.quickActionPrimary,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.quickIcon, isPrimary && styles.quickIconPrimary]}>
        <Text style={{ fontSize: 20, color: isPrimary ? colors.onPrimary : colors.primary }}>
          {glyph}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={[
          typography.small,
          {
            color: isPrimary ? colors.onPrimary : colors.text,
            textAlign: 'center',
            fontWeight: '600',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  activeTrip: { borderColor: colors.primary, borderWidth: 1.5 },
  activeTripHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 0,
  },
  activeTripArt: { width: 72, height: 72, overflow: 'hidden', borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  activeTripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    minHeight: 96,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  carousel: { gap: spacing.md, paddingRight: spacing.lg },
  tripRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
});
