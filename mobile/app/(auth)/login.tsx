import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../src/api/client';
import { Button, Field, Notice, Screen } from '../../src/components/ui';
import { LanguagePicker } from '../../src/components/LanguagePicker';
import { useAuth } from '../../src/state/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn, busy } = useAuth();

  // Never prefill credentials: a password here ships inside the app bundle.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : t('errors.network'),
      );
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topBar}>
          <LanguagePicker compact />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>✦</Text>
          <Text style={[typography.display, { color: colors.text }]}>{t('auth.signInSubtitle')}</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>
            {t('auth.signInTitle')}
          </Text>

          <View style={styles.form}>
            <Field
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              testID="login-email"
            />
            <Field
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              testID="login-password"
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/forgot-password')}
              style={{ alignSelf: 'flex-end' }}
              hitSlop={8}
            >
              <Text style={[typography.small, { color: colors.primary, fontWeight: '600' }]}>
                {t('auth.forgotPassword')}
              </Text>
            </Pressable>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button label={t('auth.signInAction')} size="lg" onPress={submit} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              {t('auth.noAccount')}{' '}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')}>
              <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>
                {t('auth.register')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  body: { padding: spacing.lg, paddingTop: spacing.lg, gap: 0 },
  mark: { fontSize: 34, color: colors.gold, marginBottom: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
