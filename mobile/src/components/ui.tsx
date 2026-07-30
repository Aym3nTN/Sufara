import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing, typography } from '../theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  style,
  tone = 'light',
  edges,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'light' | 'dark';
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}) {
  return (
    <SafeAreaView
      edges={edges ?? ['top', 'left', 'right']}
      style={[
        styles.screen,
        tone === 'dark' && { backgroundColor: colors.primaryDeep },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
  onBack,
  tone = 'light',
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: (() => void) | false;
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const dark = tone === 'dark';
  const goBack = onBack === false ? null : (onBack ?? (() => router.back()));

  return (
    <View style={styles.header}>
      {goBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          hitSlop={10}
          style={[styles.backButton, dark && styles.backButtonDark]}
        >
          <Text style={[styles.backChevron, dark && { color: colors.onPrimary }]}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <View style={styles.headerCentre}>
        <Text
          numberOfLines={1}
          style={[typography.heading, { color: dark ? colors.onPrimary : colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[typography.small, { color: dark ? '#C9DBD2' : colors.textMuted }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={[typography.heading, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[typography.bodyStrong, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inert = disabled || loading;

  const palette: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const tone = palette[variant]!;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      onPress={inert ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: tone.bg },
        tone.border ? { borderWidth: 1, borderColor: tone.border } : null,
        inert && { opacity: 0.5 },
        pressed && !inert && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        <Text
          style={[
            typography.bodyStrong,
            { color: tone.fg },
            size === 'lg' && { fontSize: 16 },
            size === 'sm' && { fontSize: 13 },
          ]}
        >
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tint,
  glyph,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: string;
  glyph?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = tint ?? colors.primary;
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress
        ? {
            accessibilityRole: 'button' as const,
            accessibilityState: { selected: !!selected },
            onPress,
          }
        : {})}
      style={[
        styles.chip,
        selected ? { backgroundColor: accent, borderColor: accent } : null,
        style,
      ]}
    >
      <Text
        style={[
          typography.small,
          { color: selected ? colors.onPrimary : colors.textMuted, fontWeight: '600' },
        ]}
      >
        {glyph ? `${glyph} ` : ''}
        {label}
        {selected ? '  ✓' : ''}
      </Text>
    </Wrapper>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  multiline,
  error,
  hint,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  error?: string | null;
  hint?: string;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { height: 110, textAlignVertical: 'top', paddingTop: spacing.md },
          error ? { borderColor: colors.danger } : null,
        ]}
      />
      {error ? (
        <Text style={[typography.small, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[typography.small, { color: colors.textFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'gold' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: colors.backgroundAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    gold: { bg: colors.goldSoft, fg: colors.gold },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const palette = tones[tone]!;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[typography.small, { color: palette.fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Stat({
  value,
  label,
  align = 'center',
}: {
  value: string | number;
  label: string;
  align?: 'center' | 'left';
}) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', flex: 1 }}>
      <Text style={[typography.title, { color: colors.text }]}>{value}</Text>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={colors.primary} />
      {label ? (
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.md }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  onAction,
  glyph = '🧭',
}: {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  glyph?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40 }}>{glyph}</Text>
      <Text style={[typography.heading, { color: colors.text, marginTop: spacing.md }]}>{title}</Text>
      <Text
        style={[
          typography.small,
          { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, maxWidth: 300 },
        ]}
      >
        {message}
      </Text>
      {action ? (
        <Button label={action} onPress={onAction} variant="secondary" style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export function Notice({
  tone = 'warning',
  children,
}: {
  tone?: 'warning' | 'danger' | 'primary';
  children: ReactNode;
}) {
  const tones = {
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    primary: { bg: colors.primarySoft, fg: colors.primary },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: tones.bg }]}>
      <Text style={[typography.small, { color: tones.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Without flexGrow 0 the row absorbs spare height in a flex column and
      // stretches every chip vertically.
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

/** Multi-line wrap container for chips/tiles in forms and pickers. */
export function Wrap({ children, gap = spacing.sm }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.wrap, { gap }]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerCentre: { flex: 1, alignItems: 'center' },
  headerRight: { minWidth: 36, alignItems: 'flex-end' },
  backSpacer: { width: 36 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonDark: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'transparent' },
  backChevron: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    marginTop: Platform.OS === 'web' ? -2 : -4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardPressed: { opacity: 0.9 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSm: { paddingVertical: 9, paddingHorizontal: spacing.md, minHeight: 36 },
  buttonLg: { paddingVertical: 17, minHeight: 56 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { gap: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  divider: { height: 1, backgroundColor: colors.border },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 2 },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
