import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api/client';
import type { Category, TravelMode, WalkingTolerance } from '../src/api/types';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  Loader,
  Notice,
  Screen,
  Wrap,
} from '../src/components/ui';
import { useAuth } from '../src/state/auth';
import { usePlan } from '../src/state/plan';
import { colors, spacing, typography } from '../src/theme';
import { categoryGlyph, formatDistance } from '../src/utils/format';

const WALKING_DISTANCES = [1000, 2000, 3000, 5000];

export default function PreferencesScreen() {
  const router = useRouter();
  const { preferences, setPreferences } = useAuth();
  const { setDraft } = usePlan();

  const [categories, setCategories] = useState<Category[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [tolerance, setTolerance] = useState<WalkingTolerance>('MEDIUM');
  const [maxWalking, setMaxWalking] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [categoryResult, current] = await Promise.all([
          api.catalog.categories(),
          api.me.preferences(),
        ]);
        setCategories(categoryResult.items);
        setInterests(current.interestCategoryIds);
        setTravelMode(current.travelMode);
        setTolerance(current.walkingTolerance);
        setMaxWalking(current.maxWalkingMeters);
      } catch {
        setError('Could not load your preferences.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.me.savePreferences({
        travelMode,
        walkingTolerance: tolerance,
        maxWalkingMeters: maxWalking,
        interestCategoryIds: interests,
      });
      setPreferences(next);
      // Keep the current planning draft in step with the saved preferences.
      setDraft({
        travelMode: next.travelMode,
        walkingTolerance: next.walkingTolerance,
        interestCategoryIds: next.interestCategoryIds,
      });
      setSaved(true);
    } catch {
      setError('Could not save your preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading preferences…" />;

  return (
    <Screen>
      <AppHeader title="Interests & preferences" subtitle="These shape every itinerary" />

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>What interests you?</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Selected interests are prioritised. Nothing is excluded outright.
          </Text>
          <Wrap>
            {categories.map((category) => {
              const selected = interests.includes(category.id);
              return (
                <Chip
                  key={category.id}
                  label={category.name}
                  glyph={categoryGlyph(category.key)}
                  tint={category.colorHex}
                  selected={selected}
                  onPress={() =>
                    setInterests(
                      selected
                        ? interests.filter((id) => id !== category.id)
                        : [...interests, category.id],
                    )
                  }
                />
              );
            })}
          </Wrap>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={[typography.heading, { color: colors.text }]}>Travel</Text>
          <Wrap>
            <Chip
              label="Walking"
              glyph="🚶"
              selected={travelMode === 'WALKING'}
              onPress={() => setTravelMode('WALKING')}
            />
            <Chip
              label="Driving"
              glyph="🚗"
              selected={travelMode === 'DRIVING'}
              onPress={() => setTravelMode('DRIVING')}
            />
          </Wrap>

          <Text style={[typography.bodyStrong, { color: colors.text, marginTop: spacing.sm }]}>
            Walking tolerance
          </Text>
          <Wrap>
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((option) => (
              <Chip
                key={option}
                label={option.charAt(0) + option.slice(1).toLowerCase()}
                selected={tolerance === option}
                onPress={() => setTolerance(option)}
              />
            ))}
          </Wrap>

          <Text style={[typography.bodyStrong, { color: colors.text, marginTop: spacing.sm }]}>
            Maximum walking distance between stops
          </Text>
          <Wrap>
            {WALKING_DISTANCES.map((distance) => (
              <Chip
                key={distance}
                label={formatDistance(distance)}
                selected={maxWalking === distance}
                onPress={() => setMaxWalking(distance)}
              />
            ))}
          </Wrap>
        </Card>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {saved ? <Notice tone="primary">Preferences saved.</Notice> : null}

        <Button label="Save preferences" size="lg" loading={saving} onPress={save} />

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: 'center' }}>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Currently: {preferences?.interestCategoryIds.length ?? 0} interests ·{' '}
            {preferences?.travelMode === 'WALKING' ? 'walking' : 'driving'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
