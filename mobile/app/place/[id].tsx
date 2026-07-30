import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api/client';
import type { Place } from '../../src/api/types';
import { MapCanvas } from '../../src/components/map';
import { ImportanceBadge, PlaceArtwork, PlaceTile } from '../../src/components/PlaceCard';
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Loader,
  Notice,
  Screen,
  SectionTitle,
  Wrap,
} from '../../src/components/ui';
import { usePlan } from '../../src/state/plan';
import { colors, radius, spacing, typography } from '../../src/theme';
import { categoryGlyph, formatDistance, formatMinutes, formatOpeningHours } from '../../src/utils/format';
import { externalNavigationUrl } from '../../src/utils/location';

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { draft, inBasket, addToBasket, removeFromBasket } = usePlan();

  const [place, setPlace] = useState<Place | null>(null);
  const [nearby, setNearby] = useState<Place[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await api.catalog.place(
          id,
          draft.start ? { latitude: draft.start.latitude, longitude: draft.start.longitude } : undefined,
        );
        if (cancelled) return;
        setPlace(result.place);
        setSaved(!!result.place.isSaved);

        const around = await api.catalog.nearby({
          latitude: result.place.latitude,
          longitude: result.place.longitude,
          radiusMeters: 12_000,
          limit: 7,
        });
        if (!cancelled) {
          setNearby(around.items.filter((entry) => entry.id !== result.place.id).slice(0, 6));
        }
      } catch {
        if (!cancelled) setError('Could not load this place.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, draft.start]);

  const toggleSave = async () => {
    if (!place) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) await api.me.savePlace(place.id);
      else await api.me.unsavePlace(place.id);
    } catch {
      setSaved(!next);
    }
  };

  const navigate = () => {
    if (!place) return;
    const url = externalNavigationUrl(
      { latitude: place.latitude, longitude: place.longitude },
      draft.travelMode,
    );
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else void Linking.openURL(url);
  };

  if (error) {
    return (
      <Screen>
        <AppHeader title="Place" />
        <View style={{ padding: spacing.lg }}>
          <Notice tone="danger">{error}</Notice>
        </View>
      </Screen>
    );
  }

  if (!place) return <Loader label="Loading place…" />;

  const added = inBasket(place.id);

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View>
          <PlaceArtwork place={place} height={280} />
          <View style={styles.heroOverlay}>
            <Wrap>
              <Badge label={place.primaryCategory.name} tone="primary" />
              <ImportanceBadge score={place.importanceScore} />
            </Wrap>
            <Text style={[typography.display, { color: '#FFFFFF', marginTop: spacing.sm }]}>
              {place.name}
            </Text>
            <Text style={[typography.small, { color: '#E4EDE8' }]}>
              📍 {place.city.name}, {place.country.name}
              {place.distanceMeters !== null ? ` · ${formatDistance(place.distanceMeters)} away` : ''}
            </Text>
          </View>

          <View style={styles.heroBack}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.circleButton}
            >
              <Text style={{ fontSize: 22, color: colors.text, marginTop: -3 }}>‹</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this place'}
              onPress={toggleSave}
              style={styles.circleButton}
            >
              <Text style={{ fontSize: 16, color: saved ? colors.danger : colors.text }}>
                {saved ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Card style={styles.facts}>
            <Fact glyph="⏱" label="Typical visit" value={formatMinutes(place.estimatedVisitDurationMinutes)} />
            <Divider />
            <Fact glyph="🕐" label="Opening hours" value={formatOpeningHours(place.openingHours)} />
            {place.historicalPeriod ? (
              <>
                <Divider />
                <Fact glyph="📜" label="Period" value={place.historicalPeriod} />
              </>
            ) : null}
          </Card>

          <Text style={[typography.body, { color: colors.text, lineHeight: 23 }]}>
            {place.description}
          </Text>

          {place.religiousSignificance ? (
            <Card style={{ backgroundColor: colors.goldSoft, borderColor: colors.goldSoft }}>
              <Text style={[typography.caption, { color: colors.warning }]}>SIGNIFICANCE</Text>
              <Text style={[typography.body, { color: '#6A5320', marginTop: 6, lineHeight: 22 }]}>
                {place.religiousSignificance}
              </Text>
            </Card>
          ) : null}

          {place.categories.length > 1 ? (
            <Wrap>
              {place.categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  glyph={categoryGlyph(category.key)}
                  tint={category.colorHex}
                />
              ))}
            </Wrap>
          ) : null}

          <View>
            <SectionTitle title="Location" />
            <MapCanvas
              markers={[
                {
                  id: place.id,
                  coordinate: { latitude: place.latitude, longitude: place.longitude },
                  glyph: categoryGlyph(place.primaryCategory.key),
                  tint: place.primaryCategory.colorHex,
                  title: place.name,
                },
              ]}
              height={200}
            />
            {place.address ? (
              <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
                {place.address}
              </Text>
            ) : null}
          </View>

          {place.photos.length > 1 ? (
            <View>
              <SectionTitle title="Photos" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {place.photos.map((photo) => (
                  <View key={photo.id} style={styles.galleryItem}>
                    <PlaceArtwork place={{ ...place, primaryPhotoUrl: photo.url }} height={110} showGlyph={false} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {nearby.length > 0 ? (
            <View>
              <SectionTitle title="Nearby places" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
                {nearby.map((entry) => (
                  <PlaceTile
                    key={entry.id}
                    place={entry}
                    onPress={() => router.push(`/place/${entry.id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {/* Navigate stays the single filled action so the primary intent reads clearly. */}
        <Button
          label={added ? 'In My Visit ✓' : 'Add to visit'}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => (added ? removeFromBasket(place.id) : addToBasket(place))}
        />
        <Button label="Navigate" icon="➤" style={{ flex: 1 }} onPress={navigate} />
      </View>
    </Screen>
  );
}

function Fact({ glyph, label, value }: { glyph: string; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={{ width: 24, fontSize: 15 }}>{glyph}</Text>
      <Text style={[typography.small, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[typography.bodyStrong, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(10,32,25,0.55)',
  },
  heroBack: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.lg, gap: spacing.lg },
  facts: { gap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  carousel: { gap: spacing.md, paddingRight: spacing.lg },
  galleryItem: { width: 150, height: 110, borderRadius: radius.md, overflow: 'hidden' },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
