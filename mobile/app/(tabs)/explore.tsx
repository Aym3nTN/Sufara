import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Category, City, Place } from '../../src/api/types';
import { MapCanvas, type MapMarkerSpec } from '../../src/components/map';
import { PlacePreviewCard } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Chip,
  ChipRow,
  EmptyState,
  Loader,
  Notice,
  Screen,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, spacing, typography } from '../../src/theme';
import { categoryGlyph } from '../../src/utils/format';

export default function Explore() {
  const router = useRouter();
  const { draft, setDraft, basket, inBasket, addToBasket, removeFromBasket } = usePlan();

  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const city = draft.city ?? cities[0] ?? null;

  useEffect(() => {
    (async () => {
      try {
        const [cityResult, categoryResult] = await Promise.all([
          api.catalog.cities(),
          api.catalog.categories(),
        ]);
        setCities(cityResult.items);
        setCategories(categoryResult.items);
      } catch {
        setError('Could not load the map data.');
      }
    })();
  }, []);

  const loadPlaces = useCallback(async () => {
    if (!city) return;
    setLoading(true);
    try {
      const result = await api.catalog.places({
        cityId: city.id,
        categoryId: categoryId ?? undefined,
        limit: 100,
        ...(draft.start ? { latitude: draft.start.latitude, longitude: draft.start.longitude } : {}),
      });
      setPlaces(result.items);
      setSelectedId(null);
    } catch {
      setError('Could not load places for this city.');
    } finally {
      setLoading(false);
    }
  }, [city, categoryId, draft.start]);

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const pins: MapMarkerSpec[] = places.map((place) => ({
      id: place.id,
      coordinate: { latitude: place.latitude, longitude: place.longitude },
      glyph: categoryGlyph(place.primaryCategory.key),
      tint: place.primaryCategory.colorHex,
      title: place.name,
      subtitle: place.primaryCategory.name,
      kind: 'place',
    }));

    if (draft.start) {
      pins.push({
        id: '__start__',
        coordinate: { latitude: draft.start.latitude, longitude: draft.start.longitude },
        label: '★',
        title: draft.start.label,
        kind: 'start',
      });
    }
    return pins;
  }, [places, draft.start]);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  return (
    <Screen>
      <AppHeader
        title="Explore map"
        subtitle={city ? `${places.length} places in ${city.name}` : undefined}
        onBack={false}
      />

      <View style={styles.filters}>
        <ChipRow>
          {cities.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.name}
              selected={city?.id === entry.id}
              onPress={() => setDraft({ city: entry })}
            />
          ))}
        </ChipRow>
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
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Notice tone="danger">{error}</Notice>
        </View>
      ) : null}

      <View style={styles.mapWrap}>
        {loading ? (
          <Loader />
        ) : places.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            message="No places match this filter yet."
            glyph="🗺"
          />
        ) : (
          <MapCanvas
            markers={markers}
            height="100%"
            selectedMarkerId={selectedId}
            onMarkerPress={(id) => setSelectedId(id === '__start__' ? null : id)}
          />
        )}
      </View>

      <View style={styles.bottom}>
        {selected ? (
          <PlacePreviewCard
            place={selected}
            onOpen={() => router.push(`/place/${selected.id}`)}
            added={inBasket(selected.id)}
            onAdd={() =>
              inBasket(selected.id) ? removeFromBasket(selected.id) : addToBasket(selected)
            }
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
            {categories.map((category) => (
              <View key={category.id} style={styles.legendItem}>
                <Text>{categoryGlyph(category.key)}</Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>{category.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {basket.length > 0 ? (
          <Text style={[typography.small, styles.basketHint]}>
            {basket.length} {basket.length === 1 ? 'place' : 'places'} in My Visit — open the My Visit
            tab to build a route.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingLeft: spacing.lg, paddingBottom: spacing.sm },
  mapWrap: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  legend: { gap: spacing.lg, paddingRight: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  basketHint: { color: colors.primary, textAlign: 'center' },
});
