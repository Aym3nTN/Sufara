import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { City, Place } from '../../src/api/types';
import { PlaceArtwork } from '../../src/components/PlaceCard';
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Loader,
  Notice,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatMinutes } from '../../src/utils/format';

const STATUSES = ['ACTIVE', 'DRAFT', 'INACTIVE'] as const;

export default function AdminPlaces() {
  const router = useRouter();

  const [places, setPlaces] = useState<Place[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await api.admin.cities();
      setCities(result.items);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.admin.places({
        page,
        limit: 10,
        search: search.trim() || undefined,
        cityId: cityId ?? undefined,
        status: status ?? undefined,
      });
      setPlaces(result.items);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch {
      setError('Could not load places.');
    } finally {
      setLoading(false);
    }
  }, [page, search, cityId, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleStatus = async (place: Place) => {
    const next = place.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.admin.updatePlace(place.id, { status: next });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change the status.');
    }
  };

  const remove = async (place: Place) => {
    try {
      await api.admin.deletePlace(place.id);
      await load();
    } catch (caught) {
      // The API refuses to delete places referenced by saved itineraries.
      setError(caught instanceof ApiError ? caught.message : 'Could not delete that place.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.headerRow}>
        <Text style={[typography.heading, { color: colors.text }]}>Places ({total})</Text>
        <Button label="+ Add" size="sm" onPress={() => router.push('/admin/place-form')} />
      </View>

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search by name" />

      <ChipRow>
        <Chip label="All cities" selected={cityId === null} onPress={() => setCityId(null)} />
        {cities.map((city) => (
          <Chip
            key={city.id}
            label={city.name}
            selected={cityId === city.id}
            onPress={() => {
              setPage(1);
              setCityId(city.id);
            }}
          />
        ))}
      </ChipRow>

      <ChipRow>
        <Chip label="Any status" selected={status === null} onPress={() => setStatus(null)} />
        {STATUSES.map((entry) => (
          <Chip
            key={entry}
            label={entry.toLowerCase()}
            selected={status === entry}
            onPress={() => {
              setPage(1);
              setStatus(entry);
            }}
          />
        ))}
      </ChipRow>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <Loader />
      ) : places.length === 0 ? (
        <EmptyState title="No places found" message="Adjust the filters, or add a new place." glyph="🕌" />
      ) : (
        places.map((place) => (
          <Card key={place.id} style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <View style={styles.art}>
                <PlaceArtwork place={place} height={56} showGlyph={false} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{place.name}</Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {place.city.name}, {place.country.name} · {place.primaryCategory.name}
                </Text>
                <Text style={[typography.small, { color: colors.textFaint }]}>
                  Score {place.importanceScore} · {formatMinutes(place.estimatedVisitDurationMinutes)} ·{' '}
                  {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                </Text>
              </View>
              <Badge
                label={place.status.toLowerCase()}
                tone={place.status === 'ACTIVE' ? 'primary' : place.status === 'DRAFT' ? 'warning' : 'neutral'}
              />
            </View>

            <View style={styles.actions}>
              <Button
                label="Edit"
                size="sm"
                variant="secondary"
                onPress={() => router.push(`/admin/place-form?id=${place.id}`)}
              />
              <Button
                label={place.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                size="sm"
                variant="ghost"
                onPress={() => void toggleStatus(place)}
              />
              <View style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${place.name}`}
                onPress={() => void remove(place)}
                hitSlop={8}
              >
                <Text style={[typography.small, { color: colors.danger, fontWeight: '600' }]}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {totalPages > 1 ? (
        <View style={styles.pager}>
          <Button
            label="‹ Previous"
            size="sm"
            variant="secondary"
            disabled={page === 1}
            onPress={() => setPage(page - 1)}
          />
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Page {page} of {totalPages}
          </Text>
          <Button
            label="Next ›"
            size="sm"
            variant="secondary"
            disabled={page === totalPages}
            onPress={() => setPage(page + 1)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  art: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md },
});
