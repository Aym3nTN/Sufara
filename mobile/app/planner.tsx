import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api/client';
import type { Category, City } from '../src/api/types';
import { MapCanvas } from '../src/components/map';
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
} from '../src/components/ui';
import { usePlan } from '../src/state/plan';
import { useAuth } from '../src/state/auth';
import { colors, radius, spacing, typography } from '../src/theme';
import { categoryGlyph, formatMinutes, TIME_PRESETS } from '../src/utils/format';
import { resolveCurrentLocation } from '../src/utils/location';

const STEPS = ['Destination', 'Time', 'Starting point', 'Interests', 'Travel', 'Review'] as const;

export default function Planner() {
  const router = useRouter();
  const { preferences } = useAuth();
  const { draft, setDraft, generate, planning, planError } = usePlan();

  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [customMinutes, setCustomMinutes] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cityResult, categoryResult] = await Promise.all([
        api.catalog.cities(),
        api.catalog.categories(),
      ]);
      setCities(cityResult.items);
      setCategories(categoryResult.items);

      // Seed the draft from saved preferences the first time through.
      setDraft({
        travelMode: draft.travelMode ?? preferences?.travelMode ?? 'DRIVING',
        walkingTolerance: draft.walkingTolerance ?? preferences?.walkingTolerance ?? 'MEDIUM',
        interestCategoryIds:
          draft.interestCategoryIds.length > 0
            ? draft.interestCategoryIds
            : preferences?.interestCategoryIds ?? [],
      });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return draft.city !== null;
      case 1:
        return draft.availableMinutes >= 15;
      case 2:
        return draft.start !== null;
      default:
        return true;
    }
  }, [step, draft]);

  const useMyLocation = async () => {
    if (!draft.city) return;
    setLocating(true);
    setLocationNote(null);

    const resolved = await resolveCurrentLocation({
      latitude: draft.city.latitude,
      longitude: draft.city.longitude,
      label: `Centre of ${draft.city.name}`,
    });

    if (resolved) {
      setDraft({
        start: { latitude: resolved.latitude, longitude: resolved.longitude, label: resolved.label },
      });
      if (!resolved.precise) {
        setLocationNote(
          'Location permission was not granted, so planning starts from the city centre. You can drop a pin instead.',
        );
      }
    }
    setLocating(false);
  };

  const submit = async () => {
    const plan = await generate();
    if (plan) router.replace('/itinerary');
  };

  if (loading) return <Loader label="Preparing the planner…" />;

  return (
    <Screen>
      <AppHeader
        title="Plan your visit"
        subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
        onBack={() => (step === 0 ? router.back() : setStep(step - 1))}
      />

      <View style={styles.progress}>
        {STEPS.map((label, index) => (
          <View
            key={label}
            style={[
              styles.progressSegment,
              index <= step && { backgroundColor: colors.primary },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <StepHeading
              title="Where would you like to go?"
              hint="Choose the city you are visiting."
            />
            <View style={{ gap: spacing.sm }}>
              {cities.map((city) => (
                <Card
                  key={city.id}
                  onPress={() => setDraft({ city, start: null })}
                  accessibilityLabel={city.name}
                  style={[
                    styles.optionCard,
                    draft.city?.id === city.id && styles.optionCardSelected,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>{city.name}</Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      {city.country.name} · {city.placeCount} places
                    </Text>
                  </View>
                  {draft.city?.id === city.id ? (
                    <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <StepHeading
              title="How much time do you have?"
              hint="Sufara keeps a buffer so a small delay does not break your schedule."
            />
            <Wrap>
              {TIME_PRESETS.map((preset) => (
                <Chip
                  key={preset.minutes}
                  label={preset.label}
                  selected={draft.availableMinutes === preset.minutes && customMinutes === ''}
                  onPress={() => {
                    setCustomMinutes('');
                    setDraft({ availableMinutes: preset.minutes });
                  }}
                />
              ))}
            </Wrap>

            <Card style={{ gap: spacing.md }}>
              <Field
                label="Custom (minutes)"
                value={customMinutes}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  setCustomMinutes(digits);
                  const minutes = Number(digits);
                  if (minutes >= 15 && minutes <= 960) setDraft({ availableMinutes: minutes });
                }}
                placeholder="e.g. 150"
                keyboardType="numeric"
                hint="Between 15 minutes and 16 hours."
              />
              <Text style={[typography.small, { color: colors.textMuted }]}>
                Planning for {formatMinutes(draft.availableMinutes)}
              </Text>
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <StepHeading
              title="Where are you starting from?"
              hint="Use your location, or drop a pin on the map."
            />

            <Button
              label={locating ? 'Finding you…' : 'Use my current location'}
              icon="📍"
              onPress={useMyLocation}
              loading={locating}
            />
            <Button
              label="Start from the city centre"
              variant="secondary"
              onPress={() =>
                draft.city &&
                setDraft({
                  start: {
                    latitude: draft.city.latitude,
                    longitude: draft.city.longitude,
                    label: `Centre of ${draft.city.name}`,
                  },
                })
              }
            />

            {locationNote ? <Notice tone="warning">{locationNote}</Notice> : null}

            {draft.city ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  OR TAP THE MAP TO DROP A PIN
                </Text>
                <MapCanvas
                  height={230}
                  markers={
                    draft.start
                      ? [
                          {
                            id: 'start',
                            coordinate: {
                              latitude: draft.start.latitude,
                              longitude: draft.start.longitude,
                            },
                            label: '★',
                            kind: 'start',
                            title: draft.start.label,
                          },
                        ]
                      : [
                          {
                            id: 'city',
                            coordinate: {
                              latitude: draft.city.latitude,
                              longitude: draft.city.longitude,
                            },
                            glyph: '·',
                            title: draft.city.name,
                          },
                        ]
                  }
                  onMapPress={(coordinate) =>
                    setDraft({ start: { ...coordinate, label: 'Pin on the map' } })
                  }
                />
                {draft.start ? (
                  <Text style={[typography.small, { color: colors.primary }]}>
                    Starting at {draft.start.label} ({draft.start.latitude.toFixed(4)},{' '}
                    {draft.start.longitude.toFixed(4)})
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <StepHeading
              title="What would you like to explore?"
              hint="Interests guide the choice. Nothing is excluded outright."
            />
            <Wrap>
              {categories.map((category) => {
                const selected = draft.interestCategoryIds.includes(category.id);
                return (
                  <Chip
                    key={category.id}
                    label={category.name}
                    glyph={categoryGlyph(category.key)}
                    tint={category.colorHex}
                    selected={selected}
                    onPress={() =>
                      setDraft({
                        interestCategoryIds: selected
                          ? draft.interestCategoryIds.filter((id) => id !== category.id)
                          : [...draft.interestCategoryIds, category.id],
                      })
                    }
                  />
                );
              })}
            </Wrap>
            {draft.interestCategoryIds.length === 0 ? (
              <Notice tone="primary">
                With nothing selected, Sufara recommends the most significant places overall.
              </Notice>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <StepHeading title="How will you travel?" hint="This changes the travel times used." />
            <Wrap>
              <Chip
                label="Walking"
                glyph="🚶"
                selected={draft.travelMode === 'WALKING'}
                onPress={() => setDraft({ travelMode: 'WALKING' })}
              />
              <Chip
                label="Driving"
                glyph="🚗"
                selected={draft.travelMode === 'DRIVING'}
                onPress={() => setDraft({ travelMode: 'DRIVING' })}
              />
            </Wrap>

            {draft.travelMode === 'WALKING' ? (
              <Card style={{ gap: spacing.md }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>Walking tolerance</Text>
                <Wrap>
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tolerance) => (
                    <Chip
                      key={tolerance}
                      label={
                        tolerance === 'LOW'
                          ? 'Low · up to 1.2 km'
                          : tolerance === 'MEDIUM'
                            ? 'Medium · up to 2.5 km'
                            : 'High · up to 5 km'
                      }
                      selected={draft.walkingTolerance === tolerance}
                      onPress={() => setDraft({ walkingTolerance: tolerance })}
                    />
                  ))}
                </Wrap>
                <Text style={[typography.small, { color: colors.textFaint }]}>
                  Sufara will not put a stop farther than this on foot.
                </Text>
              </Card>
            ) : null}

            <Card style={{ gap: spacing.md }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Maximum stops</Text>
              <Wrap>
                <Chip
                  label="No limit"
                  selected={draft.maxPlaces === undefined}
                  onPress={() => setDraft({ maxPlaces: undefined })}
                />
                {[2, 3, 4, 5, 6].map((count) => (
                  <Chip
                    key={count}
                    label={`${count} places`}
                    selected={draft.maxPlaces === count}
                    onPress={() => setDraft({ maxPlaces: count })}
                  />
                ))}
              </Wrap>
            </Card>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <StepHeading
              title={`Let’s plan your ${formatMinutes(draft.availableMinutes)} in ${draft.city?.name ?? ''}`}
              hint="Check the details, then Sufara builds the route."
            />

            <Card style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
              <ReviewRow label="Destination" value={draft.city?.name ?? '—'} onEdit={() => setStep(0)} />
              <ReviewRow
                label="Available time"
                value={formatMinutes(draft.availableMinutes)}
                onEdit={() => setStep(1)}
              />
              <ReviewRow
                label="Starting point"
                value={draft.start?.label ?? 'Not set'}
                onEdit={() => setStep(2)}
              />
              <ReviewRow
                label="Interests"
                value={
                  draft.interestCategoryIds.length === 0
                    ? 'Most significant places'
                    : categories
                        .filter((category) => draft.interestCategoryIds.includes(category.id))
                        .map((category) => category.name)
                        .join(', ')
                }
                onEdit={() => setStep(3)}
              />
              <ReviewRow
                label="Travel mode"
                value={draft.travelMode === 'WALKING' ? 'Walking' : 'Driving'}
                onEdit={() => setStep(4)}
                last
              />
            </Card>

            {planError ? <Notice tone="danger">{planError}</Notice> : null}

            <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Sufara weighs each place’s significance, your interests, travel time and how long a
              visit really takes — then keeps a buffer.
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step === STEPS.length - 1 ? (
          <Button
            label="Create my itinerary"
            icon="✦"
            size="lg"
            loading={planning}
            disabled={!draft.start || !draft.city}
            onPress={submit}
          />
        ) : (
          <Button
            label="Continue"
            size="lg"
            disabled={!canAdvance}
            onPress={() => setStep(step + 1)}
          />
        )}
      </View>
    </Screen>
  );
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.small, { color: colors.textMuted }]}>{hint}</Text>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
  last,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.reviewRow, !last && styles.reviewRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Change ${label}`} onPress={onEdit} hitSlop={8}>
        <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>Change</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  body: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  optionCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  optionCardSelected: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  reviewRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
