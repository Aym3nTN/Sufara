import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';
import { categoryGlyph } from '../utils/format';

interface InterestGridProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * A 3-column grid of category tiles matching the design brief.
 *
 * Each tile carries its own tinted icon well and shows a check pill in the
 * bottom-right corner when selected — the visual language the reference
 * mockup uses for interest picking. Larger and calmer than a chip row, so
 * a step whose whole purpose is a single choice looks like one.
 */
export function InterestGrid({ categories, selectedIds, onToggle }: InterestGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = selectedIds.includes(category.id);
        const tint = category.colorHex ?? colors.primary;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected }}
            onPress={() => onToggle(category.id)}
            style={({ pressed }) => [
              styles.tile,
              selected && { borderColor: tint, backgroundColor: withAlpha(tint, 0.08) },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.iconWell, { backgroundColor: withAlpha(tint, 0.15) }]}>
              <Text style={styles.icon}>{categoryGlyph(category.key)}</Text>
            </View>
            <Text
              numberOfLines={2}
              style={[
                typography.small,
                styles.label,
                selected && { color: colors.text, fontWeight: '700' },
              ]}
            >
              {category.name}
            </Text>
            {selected ? (
              <View style={[styles.check, { backgroundColor: tint }]}>
                <Text style={styles.checkGlyph}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Turn a #RRGGBB hex into an rgba() with the given alpha, so a category tint
 * can be used at low opacity for the icon well and the selected background
 * without doubling the palette. Non-hex inputs pass straight through.
 */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    // Three across at the reference width (~120px each after gaps).
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 108,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  label: { color: colors.textMuted, textAlign: 'center' },
  check: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
