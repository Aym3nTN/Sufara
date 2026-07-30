import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/client';
import { AppHeader, Button, Field, Notice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function Register() {
  const router = useRouter();
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
      setFieldErrors({ confirm: 'The two passwords do not match' });
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
      setError(caught instanceof ApiError ? caught.message : 'Could not create your account.');
    }
  };

  return (
    <Screen>
      <AppHeader title="Create your account" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Save places, keep your itineraries and travel with your own preferences.
          </Text>

          <View style={styles.form}>
            <Field
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              error={fieldErrors.name}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={fieldErrors.email}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              error={fieldErrors.password}
              hint="Use at least 8 characters."
            />
            <Field
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat your password"
              secureTextEntry
              error={fieldErrors.confirm}
            />

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button label="Create account" size="lg" onPress={submit} loading={busy} />
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
