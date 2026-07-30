import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { InterestGrid } from '../src/components/InterestGrid';
import { usePlan } from '../src/state/plan';
import { useAuth } from '../src/state/auth';
import { colors, radius, spacing, typography } from '../src/theme';
import { categoryGlyph, formatMinutes, TIME_PRESETS } from '../src/utils/format';
import { resolveCurrentLocation } from '../src/utils/location';

const STEP_COUNT = 6;

export default function Planner() {
  const router = useRouter();
  const { t } = useTranslation();
  const { preferences } = useAuth();
  const { draft, setDraft, generate, planning, planError } = usePlan();

  const [step, setStep] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [customMinutes, setCustomMinutes] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const stepLabels = [
    t('planner.stepDestination'),
    t('planner.stepTime'),
    t('planner.usingLocation'),
    t('planner.stepInterests'),
    t('itinerary.travelBy'),
    t('planner.stepReview'),
  ];

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
      label: draft.city.name,
    });

    if (resolved) {
      setDraft({
        start: { latitude: resolved.latitude, longitude: resolved.longitude, label: resolved.label },
      });
      if (!resolved.precise) {
        setLocationNote(t('planner.usingLocation'));
      }
    }
    setLocating(false);
  };

  const submit = async () => {
    const plan = await generate();
    if (plan) router.replace('/itinerary');
  };

  if (loading) return <Loader label={t('common.loading')} />;

  return (
    <Screen>
      <AppHeader
        title={t('planner.title')}
        subtitle={`${step + 1} / ${STEP_COUNT} · ${stepLabels[step]}`}
        onBack={() => (step === 0 ? router.back() : setStep(step - 1))}
      />

      <View style={styles.progress}>
        {Array.from({ length: STEP_COUNT }, (_, index) => (
          <View
            key={index}
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
              title={t('planner.chooseCity')}
              hint={t('planner.chooseCityHint')}
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
                      {city.country.name} · {city.placeCount}
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
              title={t('planner.stepTime')}
              hint={t('planner.interestsHint')}
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
                label={t('planner.availableTime')}
                value={customMinutes}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  setCustomMinutes(digits);
                  const minutes = Number(digits);
                  if (minutes >= 15 && minutes <= 960) setDraft({ availableMinutes: minutes });
                }}
                placeholder="150"
                keyboardType="numeric"
                hint={t('planner.invalidTime')}
              />
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {formatMinutes(draft.availableMinutes)}
              </Text>
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <StepHeading
              title={t('planner.stepDestination')}
              hint={t('planner.usingLocation')}
            />

            <Button
              label={locating ? t('common.loading') : t('planner.usingLocation')}
              icon="📍"
              onPress={useMyLocation}
              loading={locating}
            />
            <Button
              label={draft.city ? draft.city.name : t('planner.chooseCity')}
              variant="secondary"
              onPress={() =>
                draft.city &&
                setDraft({
                  start: {
                    latitude: draft.city.latitude,
                    longitude: draft.city.longitude,
                    label: draft.city.name,
                  },
                })
              }
            />

            {locationNote ? <Notice tone="warning">{locationNote}</Notice> : null}

            {draft.city ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('itinerary.viewOnMap').toUpperCase()}
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
                    setDraft({ start: { ...coordinate, label: t('itinerary.startFrom') } })
                  }
                />
                {draft.start ? (
                  <Text style={[typography.small, { color: colors.primary }]}>
                    {t('itinerary.startFrom')}: {draft.start.label}
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <StepHeading
              title={t('planner.chooseInterests')}
              hint={t('planner.interestsHint')}
            />
            <InterestGrid
              categories={categories}
              selectedIds={draft.interestCategoryIds}
              onToggle={(id) => {
                const selected = draft.interestCategoryIds.includes(id);
                setDraft({
                  interestCategoryIds: selected
                    ? draft.interestCategoryIds.filter((existing) => existing !== id)
                    : [...draft.interestCategoryIds, id],
                });
              }}
            />
            {draft.interestCategoryIds.length === 0 ? (
              <Notice tone="primary">{t('planner.interestsHint')}</Notice>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <StepHeading title={t('itinerary.travelBy')} hint={t('planner.interestsHint')} />
            <Wrap>
              <Chip
                label={t('itinerary.walk')}
                glyph="🚶"
                selected={draft.travelMode === 'WALKING'}
                onPress={() => setDraft({ travelMode: 'WALKING' })}
              />
              <Chip
                label={t('itinerary.drive')}
                glyph="🚗"
                selected={draft.travelMode === 'DRIVING'}
                onPress={() => setDraft({ travelMode: 'DRIVING' })}
              />
            </Wrap>

            {draft.travelMode === 'WALKING' ? (
              <Card style={{ gap: spacing.md }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t('preferences.walkingTolerance')}
                </Text>
                <Wrap>
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tolerance) => (
                    <Chip
                      key={tolerance}
                      label={
                        tolerance === 'LOW'
                          ? '1.2 km'
                          : tolerance === 'MEDIUM'
                            ? '2.5 km'
                            : '5 km'
                      }
                      selected={draft.walkingTolerance === tolerance}
                      onPress={() => setDraft({ walkingTolerance: tolerance })}
                    />
                  ))}
                </Wrap>
                <Text style={[typography.small, { color: colors.textFaint }]}>
                  {t('preferences.walkingHint')}
                </Text>
              </Card>
            ) : null}

            <Card style={{ gap: spacing.md }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{t('common.stops')}</Text>
              <Wrap>
                <Chip
                  label={t('common.notSet')}
                  selected={draft.maxPlaces === undefined}
                  onPress={() => setDraft({ maxPlaces: undefined })}
                />
                {[2, 3, 4, 5, 6].map((count) => (
                  <Chip
                    key={count}
                    label={`${count}`}
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
              title={t('planner.stepReview')}
              hint={t('planner.interestsHint')}
            />

            <Card style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
              <ReviewRow label={t('planner.chooseCity')} value={draft.city?.name ?? '—'} onEdit={() => setStep(0)} editLabel={t('common.edit')} />
              <ReviewRow
                label={t('planner.availableTime')}
                value={formatMinutes(draft.availableMinutes)}
                onEdit={() => setStep(1)}
                editLabel={t('common.edit')}
              />
              <ReviewRow
                label={t('itinerary.startFrom')}
                value={draft.start?.label ?? t('common.notSet')}
                onEdit={() => setStep(2)}
                editLabel={t('common.edit')}
              />
              <ReviewRow
                label={t('preferences.interests')}
                value={
                  draft.interestCategoryIds.length === 0
                    ? t('common.notSet')
                    : categories
                        .filter((category) => draft.interestCategoryIds.includes(category.id))
                        .map((category) => category.name)
                        .join(', ')
                }
                onEdit={() => setStep(3)}
                editLabel={t('common.edit')}
              />
              <ReviewRow
                label={t('itinerary.travelBy')}
                value={draft.travelMode === 'WALKING' ? t('itinerary.walk') : t('itinerary.drive')}
                onEdit={() => setStep(4)}
                editLabel={t('common.edit')}
                last
              />
            </Card>

            {planError ? <Notice tone="danger">{planError}</Notice> : null}

            <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>
              {t('planner.generating')}
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step === STEP_COUNT - 1 ? (
          <Button
            label={t('planner.generate')}
            icon="✦"
            size="lg"
            loading={planning}
            disabled={!draft.start || !draft.city}
            onPress={submit}
          />
        ) : (
          <Button
            label={t('common.continue')}
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
  editLabel,
  last,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.reviewRow, !last && styles.reviewRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={editLabel} onPress={onEdit} hitSlop={8}>
        <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>{editLabel}</Text>
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
