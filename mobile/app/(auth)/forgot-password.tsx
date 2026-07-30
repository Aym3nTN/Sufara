import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import { AppHeader, Button, Field, Notice, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestReset = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.forgotPassword(email.trim());
      setMessage(result.message);
      // Until a mail provider is wired up the API hands the token back in
      // development so the flow can be completed end to end.
      if (result.devResetToken) setToken(result.devResetToken);
      setStage('reset');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send a reset link.');
    } finally {
      setBusy(false);
    }
  };

  const applyReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.auth.resetPassword({ token: token.trim(), password });
      router.replace('/(auth)/login');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Reset password" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 'request' ? (
          <>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              Enter the email address on your account and we will send a reset link.
            </Text>
            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
              />
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <Button label="Send reset link" size="lg" onPress={requestReset} loading={busy} />
            </View>
          </>
        ) : (
          <>
            {message ? <Notice tone="primary">{message}</Notice> : null}
            <View style={styles.form}>
              <Field
                label="Reset token"
                value={token}
                onChangeText={setToken}
                placeholder="Paste the token from your email"
              />
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
              />
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <Button label="Set new password" size="lg" onPress={applyReset} loading={busy} />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.md },
});
