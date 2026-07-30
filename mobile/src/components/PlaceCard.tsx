import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { categoryGlyph, formatDistance, formatMinutes } from '../utils/format';
import type { Place } from '../api/types';
import { PatternTile } from './PatternTile';
import { Badge } from './ui';

/** Artwork for a place: its photo when one exists, otherwise its pattern. */
export function PlaceArtwork({
  place,
  height,
  showGlyph = true,
}: {
  place: Place;
  height: number;
  showGlyph?: boolean;
}) {
  if (place.primaryPhotoUrl) {
    return (
      <Image
        source={{ uri: place.primaryPhotoUrl }}
        style={{ height, width: '100%' }}
        resizeMode="cover"
        accessibilityLabel={place.name}
      />
    );
  }

  return (
    <PatternTile
      seed={place.id}
      tint={place.primaryCategory.colorHex}
      height={height}
      glyph={showGlyph ? categoryGlyph(place.primaryCategory.key) : undefined}
    />
  );
}

/** Wide tile used in horizontal carousels on the home screen. */
export function PlaceTile({ place, onPress }: { place: Place; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={place.name}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}
    >
      <PlaceArtwork place={place} height={96} />
      <View style={styles.tileBody}>
        <Text numberOfLines={2} style={[typography.bodyStrong, { color: colors.text }]}>
          {place.name}
        </Text>
        <Text style={[typography.small, { color: colors.textMuted }]}>
          {place.distanceMeters !== null
            ? `📍 ${formatDistance(place.distanceMeters)}`
            : place.city.name}
        </Text>
      </View>
    </Pressable>
  );
}

/** List row used on city, search, saved and picker screens. */
export function PlaceRow({
  place,
  onPress,
  right,
  subtitle,
}: {
  place: Place;
  onPress?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  // The row itself is a plain container: `right` routinely holds its own
  // buttons, and nesting a button inside a button is invalid on web and
  // ambiguous for screen readers.
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={place.name}
        onPress={onPress}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.rowArt}>
          <PlaceArtwork place={place} height={64} />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
            {place.name}
          </Text>
          <Text numberOfLines={1} style={[typography.small, { color: colors.textMuted }]}>
            {subtitle ?? `${place.primaryCategory.name} · ${place.city.name}`}
          </Text>
          <View style={styles.rowMeta}>
            <Text style={[typography.small, { color: colors.textFaint }]}>
              ⏱ {formatMinutes(place.estimatedVisitDurationMinutes)}
            </Text>
            {place.distanceMeters !== null ? (
              <Text style={[typography.small, { color: colors.textFaint }]}>
                📍 {formatDistance(place.distanceMeters)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      {right ?? <Text style={styles.rowChevron}>›</Text>}
    </View>
  );
}

/** Compact preview shown when a map pin is tapped. */
export function PlacePreviewCard({
  place,
  onOpen,
  onAdd,
  added,
}: {
  place: Place;
  onOpen: () => void;
  onAdd?: () => void;
  added?: boolean;
}) {
  return (
    <View style={styles.preview}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.name}`}
        onPress={onOpen}
        style={styles.previewMain}
      >
        <View style={styles.previewArt}>
          <PlaceArtwork place={place} height={58} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
            {place.name}
          </Text>
          <Text numberOfLines={1} style={[typography.small, { color: colors.textMuted }]}>
            {place.primaryCategory.name} · ⏱ {formatMinutes(place.estimatedVisitDurationMinutes)}
            {place.distanceMeters !== null ? ` · ${formatDistance(place.distanceMeters)}` : ''}
          </Text>
        </View>
      </Pressable>

      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={added ? `Remove ${place.name} from my visit` : `Add ${place.name} to my visit`}
          onPress={onAdd}
          style={[styles.previewAdd, added && { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: added ? colors.onPrimary : colors.primary, fontWeight: '700' }}>
            {added ? '✓' : '+'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ImportanceBadge({ score }: { score: number }) {
  const tone = score >= 85 ? 'gold' : score >= 65 ? 'primary' : 'neutral';
  const label = score >= 85 ? 'Must see' : score >= 65 ? 'Highly regarded' : 'Worth a stop';
  return <Badge label={label} tone={tone} />;
}

const styles = StyleSheet.create({
  tile: {
    width: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  tileBody: { padding: spacing.md, gap: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  rowArt: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden' },
  rowMeta: { flexDirection: 'row', gap: spacing.md },
  rowChevron: { fontSize: 22, color: colors.textFaint, paddingHorizontal: spacing.sm },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadow.raised,
  },
  previewMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  previewArt: { width: 58, height: 58, borderRadius: radius.md, overflow: 'hidden' },
  previewAdd: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
});
