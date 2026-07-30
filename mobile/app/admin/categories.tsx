import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Category } from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  Field,
  Loader,
  Notice,
  SectionTitle,
} from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';
import { categoryGlyph } from '../../src/utils/format';

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#1F6F54');

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.admin.categories();
      setCategories(result.items);
    } catch {
      setError('Could not load categories.');
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

  if (loading) return <Loader label="Loading categories…" />;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <View>
        <SectionTitle title={`Categories (${categories.length})`} />
        <Card style={{ gap: spacing.md }}>
          {categories.map((category) => (
            <View key={category.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: category.colorHex }]}>
                <Text style={{ fontSize: 14 }}>{categoryGlyph(category.key)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{category.name}</Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>
                  {category.key} · {category.placeCount ?? 0} places · {category.colorHex}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`}
                onPress={() =>
                  void guard(() => api.admin.updateCategory(category.id, { isActive: !category.isActive }))
                }
                hitSlop={8}
              >
                <Badge
                  label={category.isActive === false ? 'inactive' : 'active'}
                  tone={category.isActive === false ? 'neutral' : 'primary'}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${category.name}`}
                onPress={() => void guard(() => api.admin.deleteCategory(category.id))}
                hitSlop={8}
              >
                <Text style={[typography.small, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text style={[typography.heading, { color: colors.text }]}>Add a category</Text>
        <Field
          label="Key"
          value={key}
          onChangeText={(text) => setKey(text.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
          placeholder="CARAVANSERAI"
          hint="Stable machine key, letters and underscores."
        />
        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Caravanserai" />
        <Field
          label="Colour"
          value={colorHex}
          onChangeText={setColorHex}
          placeholder="#1F6F54"
          hint="Used for map pins and chips."
        />
        <Button
          label="Create category"
          size="sm"
          disabled={key.length < 2 || name.trim().length < 2 || !/^#[0-9a-fA-F]{6}$/.test(colorHex)}
          onPress={() =>
            void guard(async () => {
              await api.admin.createCategory({
                key,
                name: name.trim(),
                colorHex,
                sortOrder: categories.length + 1,
              });
              setKey('');
              setName('');
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
  swatch: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
