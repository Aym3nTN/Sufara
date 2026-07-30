import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../src/api/client';
import { AppHeader, Button, Field, Notice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function Register() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signUp, busy } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm: t('auth.passwordTooShort') });
      return;
    }

    try {
      await signUp(name.trim(), email.trim(), password);
      router.replace('/(tabs)');
    } catch (caught) {
      if (caught instanceof ApiError && caught.details?.length) {
        setFieldErrors(
          Object.fromEntries(caught.details.map((detail) => [detail.field, detail.message])),
        );
      }
      setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
    }
  };

  return (
    <Screen>
      <AppHeader title={t('auth.registerTitle')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {t('auth.registerSubtitle')}
          </Text>

          <View style={styles.form}>
            <Field
              label={t('auth.name')}
              value={name}
              onChangeText={setName}
              placeholder={t('auth.namePlaceholder')}
              autoCapitalize="words"
              error={fieldErrors.name}
            />
            <Field
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              error={fieldErrors.email}
            />
            <Field
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
              error={fieldErrors.password}
              hint={t('auth.passwordPlaceholder')}
            />
            <Field
              label={t('auth.password')}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
              error={fieldErrors.confirm}
            />

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button label={t('auth.registerAction')} size="lg" onPress={submit} loading={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
});
