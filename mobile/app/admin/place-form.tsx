import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Category, City, Country } from '../../src/api/types';
import { MapCanvas } from '../../src/components/map';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  Field,
  Loader,
  Notice,
  Screen,
  Wrap,
} from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { categoryGlyph, formatMinutes } from '../../src/utils/format';

const STATUSES = ['ACTIVE', 'DRAFT', 'INACTIVE'] as const;
const DURATIONS = [15, 20, 30, 45, 60, 90, 120, 150];

/**
 * Admin create/edit form.
 *
 * Country -> city is a controlled hierarchy: choosing a country narrows the city
 * list, and the API independently rejects a mismatched pair.
 */
export default function PlaceForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const editing = !!id;

  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<City & { isActive: boolean }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [countryId, setCountryId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [duration, setDuration] = useState(30);
  const [importance, setImportance] = useState('50');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [address, setAddress] = useState('');
  const [historicalPeriod, setHistoricalPeriod] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [countryResult, cityResult, categoryResult] = await Promise.all([
          api.admin.countries(),
          api.admin.cities(),
          api.admin.categories(),
        ]);
        setCountries(countryResult.items);
        setCities(cityResult.items);
        setCategories(categoryResult.items);

        if (editing && id) {
          const { place } = await api.admin.place(id);
          setName(place.name);
          setShortDescription(place.shortDescription);
          setDescription(place.description);
          setCountryId(place.country.id);
          setCityId(place.city.id);
          setPrimaryCategoryId(place.primaryCategory.id);
          setCategoryIds(place.categories.map((category) => category.id));
          setLatitude(String(place.latitude));
          setLongitude(String(place.longitude));
          setDuration(place.estimatedVisitDurationMinutes);
          setImportance(String(place.importanceScore));
          setStatus(place.status);
          setAddress(place.address ?? '');
          setHistoricalPeriod(place.historicalPeriod ?? '');
        } else {
          setCountryId(countryResult.items[0]?.id ?? null);
          setPrimaryCategoryId(categoryResult.items[0]?.id ?? null);
        }
      } catch {
        setError('Could not load the form data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  const citiesForCountry = useMemo(
    () => cities.filter((city) => !countryId || city.country.id === countryId),
    [cities, countryId],
  );

  const coordinate = useMemo(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return null;
    return { latitude: lat, longitude: lon };
  }, [latitude, longitude]);

  const mapCentre = useMemo(() => {
    if (coordinate) return coordinate;
    const city = citiesForCountry.find((entry) => entry.id === cityId) ?? citiesForCountry[0];
    return city ? { latitude: city.latitude, longitude: city.longitude } : null;
  }, [coordinate, citiesForCountry, cityId]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      countryId,
      cityId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      primaryCategoryId,
      categoryIds,
      estimatedVisitDurationMinutes: duration,
      importanceScore: Number(importance),
      status,
      address: address.trim() || null,
      historicalPeriod: historicalPeriod.trim() || null,
    };

    try {
      if (editing && id) await api.admin.updatePlace(id, payload);
      else await api.admin.createPlace(payload);
      router.replace('/admin/places');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        if (caught.details?.length) {
          setFieldErrors(
            Object.fromEntries(caught.details.map((detail) => [detail.field, detail.message])),
          );
        }
      } else {
        setError('Could not save this place.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading form…" />;

  return (
    <Screen>
      <AppHeader
        title={editing ? 'Edit place' : 'Add a place'}
        subtitle={editing ? name : 'New heritage site'}
        onBack={() => router.replace('/admin/places')}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>Basic information</Text>
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" error={fieldErrors.name} />
          <Field
            label="Short description"
            value={shortDescription}
            onChangeText={setShortDescription}
            placeholder="One sentence shown in lists"
            error={fieldErrors.shortDescription}
          />
          <Field
            label="Full description"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="History, significance and what a visitor sees"
            error={fieldErrors.description}
          />
          <Field
            label="Historical period"
            value={historicalPeriod}
            onChangeText={setHistoricalPeriod}
            placeholder="e.g. Umayyad (691 CE)"
          />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>Country & city</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            A place belongs to exactly one country and one city.
          </Text>

          <Text style={[typography.caption, { color: colors.textMuted }]}>COUNTRY</Text>
          <Wrap>
            {countries.map((country) => (
              <Chip
                key={country.id}
                label={country.name}
                selected={countryId === country.id}
                onPress={() => {
                  setCountryId(country.id);
                  setCityId(null);
                }}
              />
            ))}
          </Wrap>

          <Text style={[typography.caption, { color: colors.textMuted }]}>CITY</Text>
          <Wrap>
            {citiesForCountry.map((city) => (
              <Chip
                key={city.id}
                label={city.name}
                selected={cityId === city.id}
                onPress={() => {
                  setCityId(city.id);
                  if (!coordinate) {
                    setLatitude(String(city.latitude));
                    setLongitude(String(city.longitude));
                  }
                }}
              />
            ))}
          </Wrap>
          {citiesForCountry.length === 0 ? (
            <Notice tone="warning">
              This country has no cities yet. Add one under Cities first.
            </Notice>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>Location</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Tap the map to place the pin, or type coordinates directly.
          </Text>

          {mapCentre ? (
            <MapCanvas
              height={240}
              markers={
                coordinate
                  ? [{ id: 'pin', coordinate, label: '★', kind: 'start', title: name || 'New place' }]
                  : [{ id: 'centre', coordinate: mapCentre, glyph: '·', title: 'City centre' }]
              }
              onMapPress={(next) => {
                setLatitude(next.latitude.toFixed(6));
                setLongitude(next.longitude.toFixed(6));
              }}
            />
          ) : null}

          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Field
                label="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="decimal-pad"
                error={fieldErrors.latitude}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="decimal-pad"
                error={fieldErrors.longitude}
              />
            </View>
          </View>

          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>Categories</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>PRIMARY CATEGORY</Text>
          <Wrap>
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                glyph={categoryGlyph(category.key)}
                tint={category.colorHex}
                selected={primaryCategoryId === category.id}
                onPress={() => setPrimaryCategoryId(category.id)}
              />
            ))}
          </Wrap>

          <Text style={[typography.caption, { color: colors.textMuted }]}>ALSO APPEARS UNDER</Text>
          <Wrap>
            {categories.map((category) => {
              const selected = categoryIds.includes(category.id);
              return (
                <Chip
                  key={`extra-${category.id}`}
                  label={category.name}
                  selected={selected}
                  onPress={() =>
                    setCategoryIds(
                      selected
                        ? categoryIds.filter((entry) => entry !== category.id)
                        : [...categoryIds, category.id],
                    )
                  }
                />
              );
            })}
          </Wrap>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>Planning data</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            These two values drive the Smart Visit Planner directly.
          </Text>

          <Text style={[typography.caption, { color: colors.textMuted }]}>
            ESTIMATED VISIT DURATION — {formatMinutes(duration)}
          </Text>
          <Wrap>
            {DURATIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={formatMinutes(minutes)}
                selected={duration === minutes}
                onPress={() => setDuration(minutes)}
              />
            ))}
          </Wrap>

          <Field
            label="Importance score (1–100)"
            value={importance}
            onChangeText={(text) => setImportance(text.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="numeric"
            hint="Higher scores are prioritised when a traveller has little time. Should be backed by verified sources."
            error={fieldErrors.importanceScore}
          />

          <Text style={[typography.caption, { color: colors.textMuted }]}>STATUS</Text>
          <Wrap>
            {STATUSES.map((entry) => (
              <Chip
                key={entry}
                label={entry.toLowerCase()}
                selected={status === entry}
                onPress={() => setStatus(entry)}
              />
            ))}
          </Wrap>
        </Card>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Button
          label={editing ? 'Save changes' : 'Create place'}
          size="lg"
          loading={saving}
          disabled={!cityId || !countryId || !primaryCategoryId}
          onPress={submit}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.replace('/admin/places')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  pair: { flexDirection: 'row', gap: spacing.md },
});
