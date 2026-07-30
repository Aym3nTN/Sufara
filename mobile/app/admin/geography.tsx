import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { City, Country } from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  Chip,
  Field,
  Loader,
  Notice,
  SectionTitle,
  Wrap,
} from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

/** Countries and cities: the controlled hierarchy every place hangs from. */
export default function Geography() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<City & { isActive: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');

  const [cityName, setCityName] = useState('');
  const [cityCountryId, setCityCountryId] = useState<string | null>(null);
  const [cityLatitude, setCityLatitude] = useState('');
  const [cityLongitude, setCityLongitude] = useState('');
  const [cityTimezone, setCityTimezone] = useState('UTC');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [countryResult, cityResult] = await Promise.all([
        api.admin.countries(),
        api.admin.cities(),
      ]);
      setCountries(countryResult.items);
      setCities(cityResult.items);
      setCityCountryId((current) => current ?? countryResult.items[0]?.id ?? null);
    } catch {
      setError('Could not load countries and cities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const guard = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change could not be applied.');
    }
  };

  if (loading) return <Loader label="Loading geography…" />;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <View>
        <SectionTitle title={`Countries (${countries.length})`} />
        <Card style={{ gap: spacing.md }}>
          {countries.map((country) => (
            <View key={country.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {country.name} · {country.code}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {country.cityCount ?? 0} cities · {country.placeCount ?? 0} places
                </Text>
              </View>
              <Badge
                label={country.isActive === false ? 'inactive' : 'active'}
                tone={country.isActive === false ? 'neutral' : 'primary'}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${country.name}`}
                onPress={() => void guard(() => api.admin.deleteCountry(country.id))}
                hitSlop={8}
              >
                <Text style={[typography.small, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.heading, { color: colors.text }]}>Add a country</Text>
        <Field label="Name" value={countryName} onChangeText={setCountryName} autoCapitalize="words" />
        <Field
          label="ISO code (2 letters)"
          value={countryCode}
          onChangeText={(text) => setCountryCode(text.toUpperCase().slice(0, 2))}
          placeholder="SA"
        />
        <Button
          label="Create country"
          size="sm"
          disabled={countryName.trim().length < 2 || countryCode.length !== 2}
          onPress={() =>
            void guard(async () => {
              await api.admin.createCountry({ name: countryName.trim(), code: countryCode });
              setCountryName('');
              setCountryCode('');
            })
          }
        />
      </Card>

      <View>
        <SectionTitle title={`Cities (${cities.length})`} />
        <Card style={{ gap: spacing.md }}>
          {cities.map((city) => (
            <View key={city.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{city.name}</Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {city.country.name} · {city.placeCount} places · {city.timezone}
                </Text>
                <Text style={[typography.small, { color: colors.textFaint }]}>
                  {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${city.isActive ? 'Deactivate' : 'Activate'} ${city.name}`}
                onPress={() => void guard(() => api.admin.updateCity(city.id, { isActive: !city.isActive }))}
                hitSlop={8}
              >
                <Badge
                  label={city.isActive ? 'active' : 'inactive'}
                  tone={city.isActive ? 'primary' : 'neutral'}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${city.name}`}
                onPress={() => void guard(() => api.admin.deleteCity(city.id))}
                hitSlop={8}
              >
                <Text style={[typography.small, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.heading, { color: colors.text }]}>Add a city</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>COUNTRY</Text>
        <Wrap>
          {countries.map((country) => (
            <Chip
              key={country.id}
              label={country.name}
              selected={cityCountryId === country.id}
              onPress={() => setCityCountryId(country.id)}
            />
          ))}
        </Wrap>

        <Field label="City name" value={cityName} onChangeText={setCityName} autoCapitalize="words" />
        <View style={styles.pair}>
          <View style={{ flex: 1 }}>
            <Field
              label="Latitude"
              value={cityLatitude}
              onChangeText={setCityLatitude}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Longitude"
              value={cityLongitude}
              onChangeText={setCityLongitude}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Field
          label="Timezone"
          value={cityTimezone}
          onChangeText={setCityTimezone}
          placeholder="Asia/Riyadh"
          hint="Used to check opening hours in local time."
        />

        <Button
          label="Create city"
          size="sm"
          disabled={
            !cityCountryId ||
            cityName.trim().length < 2 ||
            !Number.isFinite(Number(cityLatitude)) ||
            cityLatitude.length === 0 ||
            !Number.isFinite(Number(cityLongitude)) ||
            cityLongitude.length === 0
          }
          onPress={() =>
            void guard(async () => {
              await api.admin.createCity({
                name: cityName.trim(),
                countryId: cityCountryId,
                latitude: Number(cityLatitude),
                longitude: Number(cityLongitude),
                timezone: cityTimezone.trim() || 'UTC',
              });
              setCityName('');
              setCityLatitude('');
              setCityLongitude('');
            })
          }
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.md },
});
