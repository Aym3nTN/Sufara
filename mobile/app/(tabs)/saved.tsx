import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Place } from '../../src/api/types';
import { PlaceRow } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Loader,
  Notice,
  Screen,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, spacing, typography } from '../../src/theme';

export default function Saved() {
  const router = useRouter();
  const { addToBasket, inBasket, removeFromBasket } = usePlan();

  const [saved, setSaved] = useState<Array<{ savedAt: string; place: Place }>>([]);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.me.savedPlaces();
      setSaved(result.items);
    } catch {
      setError('Could not load your saved places.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Saving from a place screen should be reflected the moment the tab is opened.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unsave = async (placeId: string) => {
    setSaved((current) => current.filter((entry) => entry.place.id !== placeId));
    try {
      await api.me.unsavePlace(placeId);
    } catch {
      void load();
    }
  };

  const cities = Array.from(new Set(saved.map((entry) => entry.place.city.name)));
  const visible = saved.filter((entry) => {
    const matchesCity = !cityFilter || entry.place.city.name === cityFilter;
    const matchesSearch =
      search.trim().length === 0 ||
      entry.place.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCity && matchesSearch;
  });

  if (loading) return <Loader label="Loading saved places…" />;

  return (
    <Screen>
      <AppHeader title="Saved places" subtitle={`${saved.length} saved`} onBack={false} />

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

        {saved.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            message="Tap Save on any place and it will wait for you here."
            action="Explore places"
            onAction={() => router.push('/(tabs)/explore')}
            glyph="♡"
          />
        ) : (
          <>
            <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search saved places" />

            {cities.length > 1 ? (
              <ChipRow>
                <Chip label="All cities" selected={cityFilter === null} onPress={() => setCityFilter(null)} />
                {cities.map((city) => (
                  <Chip
                    key={city}
                    label={city}
                    selected={cityFilter === city}
                    onPress={() => setCityFilter(city)}
                  />
                ))}
              </ChipRow>
            ) : null}

            <View style={{ gap: spacing.sm }}>
              {visible.map((entry) => (
                <PlaceRow
                  key={entry.place.id}
                  place={entry.place}
                  onPress={() => router.push(`/place/${entry.place.id}`)}
                  right={
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          inBasket(entry.place.id)
                            ? `Remove ${entry.place.name} from my visit`
                            : `Add ${entry.place.name} to my visit`
                        }
                        onPress={() =>
                          inBasket(entry.place.id)
                            ? removeFromBasket(entry.place.id)
                            : addToBasket(entry.place)
                        }
                        style={[styles.action, inBasket(entry.place.id) && styles.actionActive]}
                      >
                        <Text
                          style={{
                            color: inBasket(entry.place.id) ? colors.onPrimary : colors.primary,
                            fontWeight: '700',
                          }}
                        >
                          {inBasket(entry.place.id) ? '✓' : '+'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${entry.place.name} from saved`}
                        onPress={() => unsave(entry.place.id)}
                        style={styles.action}
                      >
                        <Text style={{ color: colors.danger }}>✕</Text>
                      </Pressable>
                    </View>
                  }
                />
              ))}

              {visible.length === 0 ? (
                <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>
                  No saved place matches this filter.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  actions: { gap: 6, paddingRight: 4 },
  action: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
