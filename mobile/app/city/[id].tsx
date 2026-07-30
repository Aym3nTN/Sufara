import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Category, City, Place } from '../../src/api/types';
import { MapCanvas, type MapMarkerSpec } from '../../src/components/map';
import { PlacePreviewCard, PlaceRow } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Button,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Loader,
  Notice,
  Screen,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, radius, spacing, typography } from '../../src/theme';
import { categoryGlyph } from '../../src/utils/format';

type Sort = 'relevance' | 'distance' | 'name';

export default function CityPlaces() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { draft, setDraft, inBasket, addToBasket, removeFromBasket, basket } = usePlan();

  const [city, setCity] = useState<City | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('relevance');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cityResult, categoryResult] = await Promise.all([
        api.catalog.cities(),
        api.catalog.categories(),
      ]);
      const match = cityResult.items.find((entry) => entry.id === id) ?? null;
      setCity(match);
      setCategories(categoryResult.items);

      // Browsing a city makes it the planning context, so anything started from
      // here (including "build route from my picks") has a real origin.
      if (match && draft.city?.id !== match.id) setDraft({ city: match });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.catalog.places({
        cityId: id,
        categoryId: categoryId ?? undefined,
        search: search.trim() || undefined,
        sort,
        limit: 100,
        ...(draft.start ? { latitude: draft.start.latitude, longitude: draft.start.longitude } : {}),
      });
      setPlaces(result.items);
    } catch {
      setError('Could not load places for this city.');
    } finally {
      setLoading(false);
    }
  }, [id, categoryId, search, sort, draft.start]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const markers = useMemo<MapMarkerSpec[]>(
    () =>
      places.map((place) => ({
        id: place.id,
        coordinate: { latitude: place.latitude, longitude: place.longitude },
        glyph: categoryGlyph(place.primaryCategory.key),
        tint: place.primaryCategory.colorHex,
        title: place.name,
        subtitle: place.primaryCategory.name,
      })),
    [places],
  );

  const selected = places.find((place) => place.id === selectedId) ?? null;

  return (
    <Screen>
      <AppHeader
        title={city?.name ?? 'City'}
        subtitle={city ? `${city.country.name} · ${places.length} places` : undefined}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === 'list' ? 'Show map' : 'Show list'}
            onPress={() => setView(view === 'list' ? 'map' : 'list')}
            hitSlop={8}
          >
            <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>
              {view === 'list' ? 'Map' : 'List'}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.filters}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search places in this city" />
        </View>

        <ChipRow>
          <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              glyph={categoryGlyph(category.key)}
              tint={category.colorHex}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </ChipRow>

        <ChipRow>
          <Chip label="Most significant" selected={sort === 'relevance'} onPress={() => setSort('relevance')} />
          <Chip
            label="Nearest"
            selected={sort === 'distance'}
            onPress={() => {
              if (!draft.start && city) {
                setDraft({
                  start: {
                    latitude: city.latitude,
                    longitude: city.longitude,
                    label: `Centre of ${city.name}`,
                  },
                });
              }
              setSort('distance');
            }}
          />
          <Chip label="A–Z" selected={sort === 'name'} onPress={() => setSort('name')} />
        </ChipRow>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Notice tone="danger">{error}</Notice>
        </View>
      ) : null}

      {loading ? (
        <Loader />
      ) : places.length === 0 ? (
        <EmptyState
          title="No places found"
          message="Try a different category or clear your search."
          glyph="🔍"
        />
      ) : view === 'map' ? (
        <>
          <View style={styles.mapWrap}>
            <MapCanvas
              markers={markers}
              height="100%"
              selectedMarkerId={selectedId}
              onMarkerPress={setSelectedId}
            />
          </View>
          {selected ? (
            <View style={styles.preview}>
              <PlacePreviewCard
                place={selected}
                onOpen={() => router.push(`/place/${selected.id}`)}
                added={inBasket(selected.id)}
                onAdd={() =>
                  inBasket(selected.id) ? removeFromBasket(selected.id) : addToBasket(selected)
                }
              />
            </View>
          ) : null}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {places.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              onPress={() => router.push(`/place/${place.id}`)}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    inBasket(place.id)
                      ? `Remove ${place.name} from my visit`
                      : `Add ${place.name} to my visit`
                  }
                  onPress={() => (inBasket(place.id) ? removeFromBasket(place.id) : addToBasket(place))}
                  style={[styles.add, inBasket(place.id) && styles.addActive]}
                >
                  <Text
                    style={{
                      color: inBasket(place.id) ? colors.onPrimary : colors.primary,
                      fontWeight: '700',
                    }}
                  >
                    {inBasket(place.id) ? '✓' : '+'}
                  </Text>
                </Pressable>
              }
            />
          ))}
        </ScrollView>
      )}

      {basket.length > 0 ? (
        <View style={styles.footer}>
          <Button
            label={`Build route from ${basket.length} ${basket.length === 1 ? 'place' : 'places'}`}
            onPress={() => router.push('/(tabs)/journey')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xxl },
  mapWrap: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  preview: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  add: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  addActive: { backgroundColor: colors.primary },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
