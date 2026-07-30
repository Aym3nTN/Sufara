import React, { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../state/language';
import type { SupportedLanguage } from '../i18n';
import { colors, radius, shadow, spacing, typography } from '../theme';

interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

const OPTIONS: readonly LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
];

/**
 * `compact` renders a small pill (for onboarding). Full renders an inline
 * three-row picker (for settings).
 */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, change } = useLanguage();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = OPTIONS.find((option) => option.code === language) ?? OPTIONS[0]!;

  const handleSelect = async (code: SupportedLanguage) => {
    setOpen(false);
    if (code === language) return;
    const { needsRestart } = await change(code);
    if (needsRestart) {
      // Web flips layout instantly via the CSS dir attribute; native needs a
      // full JS bundle reload for I18nManager.forceRTL to take effect.
      if (Platform.OS !== 'web') {
        Alert.alert(t('settings.languageChanged'), t('settings.restartRequired'));
      }
    }
  };

  if (compact) {
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.language')}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
          hitSlop={6}
        >
          <Text style={styles.pillFlag}>{current.flag}</Text>
          <Text style={styles.pillLabel}>{current.nativeLabel}</Text>
          <Text style={styles.pillChevron}>▾</Text>
        </Pressable>

        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.sheet}>
              <Text style={[typography.heading, { color: colors.text, marginBottom: spacing.md }]}>
                {t('onboarding.chooseLanguage')}
              </Text>
              {OPTIONS.map((option) => (
                <Pressable
                  key={option.code}
                  accessibilityRole="button"
                  onPress={() => handleSelect(option.code)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Text style={styles.rowFlag}>{option.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text }]}>{option.nativeLabel}</Text>
                    <Text style={[typography.small, { color: colors.textMuted }]}>{option.label}</Text>
                  </View>
                  {option.code === language ? (
                    <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <View style={styles.list}>
      {OPTIONS.map((option, i) => (
        <Pressable
          key={option.code}
          accessibilityRole="button"
          onPress={() => handleSelect(option.code)}
          style={({ pressed }) => [
            styles.row,
            i > 0 && styles.rowDivider,
            pressed && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text style={styles.rowFlag}>{option.flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text }]}>{option.nativeLabel}</Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>{option.label}</Text>
          </View>
          {option.code === language ? (
            <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  pillFlag: { fontSize: 14 },
  pillLabel: { ...typography.small, color: colors.text, fontWeight: '600' },
  pillChevron: { color: colors.textMuted, fontSize: 12 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 61, 46, 0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.raised,
  },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowFlag: { fontSize: 22 },
});
