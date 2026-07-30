import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../src/api/client';
import type { Itinerary } from '../../src/api/types';
import { PlaceArtwork } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
  SectionTitle,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, radius, spacing, typography } from '../../src/theme';
import { formatDistance, formatMinutes } from '../../src/utils/format';

/**
 * "My Visit" — the traveller's own selection (Mode B) plus any journey that is
 * currently under way.
 */
export default function Journey() {
  const router = useRouter();
  const { t } = useTranslation();
  const { basket, removeFromBasket, reorderBasket, clearBasket, optimizeBasket, planning, planError } =
    usePlan();

  const [active, setActive] = useState<Itinerary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.itineraries.list();
        setActive(result.items.find((trip) => trip.status === 'IN_PROGRESS') ?? null);
      } catch {
        setActive(null);
      }
    })();
  }, []);

  const optimise = async () => {
    const plan = await optimizeBasket();
    if (plan) router.push('/itinerary');
  };

  const totalVisitMinutes = basket.reduce(
    (sum, place) => sum + place.estimatedVisitDurationMinutes,
    0,
  );

  return (
    <Screen>
      <AppHeader
        title={t('tabs.journey')}
        subtitle={basket.length > 0 ? `${basket.length}` : undefined}
        onBack={false}
        right={
          basket.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={clearBasket} hitSlop={8}>
              <Text style={[typography.small, { color: colors.danger, fontWeight: '600' }]}>
                {t('common.remove')}
              </Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        {active ? (
          <View>
            <SectionTitle title={t('trips.resume')} />
            <Card>
              <View style={styles.rowBetween}>
                <Badge label={t('trips.resume')} tone="primary" />
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {active.stops.filter((stop) => stop.completedAt).length} / {active.stops.length}
                </Text>
              </View>
              <Text style={[typography.heading, { color: colors.text, marginTop: spacing.sm }]}>
                {active.title}
              </Text>
              <Button
                label={t('trips.resume')}
                size="sm"
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                onPress={() => router.push(`/trips/${active.id}`)}
              />
            </Card>
          </View>
        ) : null}

        <View>
          <SectionTitle title={t('planner.chosenPlaces')} />

          {basket.length === 0 ? (
            <EmptyState
              title={t('saved.empty')}
              message={t('planner.modeIChooseBody')}
              action={t('saved.browsePlaces')}
              onAction={() => router.push('/(tabs)/explore')}
              glyph="⚑"
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {basket.map((place, index) => (
                <View key={place.id} style={styles.stopRow}>
                  <View style={styles.orderBadge}>
                    <Text style={[typography.small, { color: colors.onPrimary, fontWeight: '700' }]}>
                      {index + 1}
                    </Text>
                  </View>

                  <View style={styles.stopArt}>
                    <PlaceArtwork place={place} height={52} showGlyph={false} />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${place.name}`}
                    onPress={() => router.push(`/place/${place.id}`)}
                    style={{ flex: 1 }}
                  >
                    <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                      {place.name}
                    </Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>
                      ⏱ {formatMinutes(place.estimatedVisitDurationMinutes)} · {place.primaryCategory.name}
                    </Text>
                  </Pressable>

                  <View style={styles.stopActions}>
                    <IconButton
                      label={`Move ${place.name} up`}
                      glyph="↑"
                      disabled={index === 0}
                      onPress={() => reorderBasket(index, index - 1)}
                    />
                    <IconButton
                      label={`Move ${place.name} down`}
                      glyph="↓"
                      disabled={index === basket.length - 1}
                      onPress={() => reorderBasket(index, index + 1)}
                    />
                    <IconButton
                      label={`Remove ${place.name}`}
                      glyph="✕"
                      tone="danger"
                      onPress={() => removeFromBasket(place.id)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {basket.length > 0 ? (
          <>
            <Card style={{ backgroundColor: colors.surfaceMuted }}>
              <Text style={[typography.small, { color: colors.textMuted }]}>
                {t('itinerary.visitTime')}
              </Text>
              <Text style={[typography.title, { color: colors.text, marginTop: 2 }]}>
                {formatMinutes(totalVisitMinutes)}
              </Text>
              <Text style={[typography.small, { color: colors.textFaint, marginTop: 4 }]}>
                {t('itinerary.travelBy')} · {t('itinerary.optimize')}
              </Text>
            </Card>

            {planError ? <Notice tone="danger">{planError}</Notice> : null}

            <Button
              label={t('itinerary.optimize')}
              size="lg"
              icon="✦"
              loading={planning}
              onPress={optimise}
            />
            <Button
              label={t('planner.addPlace')}
              variant="secondary"
              onPress={() => router.push('/(tabs)/explore')}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function IconButton({
  glyph,
  label,
  onPress,
  disabled,
  tone,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      hitSlop={6}
      style={[styles.iconButton, disabled && { opacity: 0.3 }]}
    >
      <Text style={{ color: tone === 'danger' ? colors.danger : colors.textMuted, fontSize: 14 }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopArt: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden' },
  stopActions: { gap: 2 },
  iconButton: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
