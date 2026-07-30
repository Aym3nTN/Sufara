import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError, resolveBaseUrl } from '../src/api/client';
import {
  AppHeader,
  Button,
  Card,
  Divider,
  Field,
  Notice,
  Screen,
} from '../src/components/ui';
import { useAuth } from '../src/state/auth';
import { colors, spacing, typography } from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Local-only display preferences; server-side settings live in /preferences.
  const [notifications, setNotifications] = useState(true);
  const [metric, setMetric] = useState(true);

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.me.update({ name: name.trim() });
      await refresh();
      setMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update your profile.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.me.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed. Other devices have been signed out.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ gap: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>Account</Text>
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Email" value={user?.email ?? ''} onChangeText={() => undefined} hint="Email cannot be changed here." />
          <Button label="Save profile" size="sm" loading={busy} onPress={saveProfile} />
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>Change password</Text>
          <Field
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint="At least 8 characters."
          />
          <Button
            label="Update password"
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={currentPassword.length === 0 || newPassword.length < 8}
            onPress={changePassword}
          />
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Toggle
            label="Notifications"
            hint="Reminders about your upcoming visits"
            value={notifications}
            onChange={setNotifications}
          />
          <Divider />
          <Toggle
            label="Metric units"
            hint={metric ? 'Distances in kilometres' : 'Distances in miles'}
            value={metric}
            onChange={setMetric}
          />
          <Divider />
          <Row label="Language" value="English" />
          <Divider />
          <Row label="Map & navigation" value="Interests & preferences" onPress={() => router.push('/preferences')} />
          <Divider />
          <Row
            label="Location permission"
            value={Platform.OS === 'web' ? 'Browser controlled' : 'Asked when planning'}
          />
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row label="Privacy" value="Your trips stay on your account" />
          <Divider />
          <Row label="Help & support" value="support@sufara.app" />
          <Divider />
          <Row label="API endpoint" value={resolveBaseUrl()} />
          <Divider />
          <Row label="About Sufara" value="Version 1.0.0 (MVP)" />
        </Card>

        {message ? <Notice tone="primary">{message}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Button
          label="Log out"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.small, { color: colors.textMuted }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
      />
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Text numberOfLines={1} style={[typography.small, { color: colors.textMuted, maxWidth: 180 }]}>
        {value}
      </Text>
      {onPress ? <Text style={{ color: colors.textFaint, fontSize: 18 }}> ›</Text> : null}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
