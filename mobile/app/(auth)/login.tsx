import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/client';
import { Button, Field, Notice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, spacing, typography } from '../../src/theme';

export default function Login() {
  const router = useRouter();
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
          : 'Could not reach Sufara. Check your connection and try again.',
      );
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.mark}>✦</Text>
          <Text style={[typography.display, { color: colors.text }]}>Welcome back</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>
            Sign in to continue your journey.
          </Text>

          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              testID="login-email"
            />
            <Field
              label="Password"
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
                Forgot password?
              </Text>
            </Pressable>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <Button label="Log in" size="lg" onPress={submit} loading={busy} />
          </View>

          <View style={styles.footer}>
            <Text style={[typography.small, { color: colors.textMuted }]}>
              Don’t have an account?{' '}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')}>
              <Text style={[typography.small, { color: colors.primary, fontWeight: '700' }]}>
                Sign up
              </Text>
            </Pressable>
          </View>

          {__DEV__ ? (
            <Notice tone="primary">
              Demo accounts: traveler@sufara.app and admin@sufara.app. The seed prints their
              password once when it creates them — or set SEED_PASSWORD before seeding.
            </Notice>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingTop: spacing.xxl, gap: 0 },
  mark: { fontSize: 34, color: colors.gold, marginBottom: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
