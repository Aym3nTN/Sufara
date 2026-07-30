import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
import { LanguagePicker } from '../src/components/LanguagePicker';
import { useAuth } from '../src/state/auth';
import { colors, spacing, typography } from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const { t } = useTranslation();
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
      setMessage(t('settings.profileUpdated'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('settings.profileUpdateFailed'));
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
      setMessage(t('settings.passwordChanged'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('settings.passwordChangeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={t('settings.title')} />

      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ gap: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>{t('settings.account')}</Text>
          <Field label={t('settings.nameLabel')} value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label={t('settings.emailLabel')} value={user?.email ?? ''} onChangeText={() => undefined} hint={t('settings.emailImmutable')} />
          <Button label={t('settings.saveProfile')} size="sm" loading={busy} onPress={saveProfile} />
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>{t('settings.changePassword')}</Text>
          <Field
            label={t('settings.currentPassword')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Field
            label={t('settings.newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint={t('settings.newPasswordHint')}
          />
          <Button
            label={t('settings.updatePassword')}
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={currentPassword.length === 0 || newPassword.length < 8}
            onPress={changePassword}
          />
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.md }]}>
            {t('settings.language').toUpperCase()}
          </Text>
          <LanguagePicker />
        </View>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Toggle
            label={t('settings.notifications')}
            hint={t('settings.notificationsHint')}
            value={notifications}
            onChange={setNotifications}
          />
          <Divider />
          <Toggle
            label={t('settings.metricUnits')}
            hint={metric ? t('settings.distancesKm') : t('settings.distancesMi')}
            value={metric}
            onChange={setMetric}
          />
          <Divider />
          <Row label={t('settings.mapNav')} value={t('settings.mapNavValue')} onPress={() => router.push('/preferences')} />
          <Divider />
          <Row
            label={t('settings.locationPermission')}
            value={Platform.OS === 'web' ? t('settings.locationBrowser') : t('settings.locationAsked')}
          />
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row label={t('settings.privacy')} value={t('settings.privacyValue')} />
          <Divider />
          <Row label={t('settings.helpSupport')} value="support@sufara.app" />
          <Divider />
          <Row label={t('settings.apiEndpoint')} value={resolveBaseUrl()} />
          <Divider />
          <Row label={t('settings.about')} value={t('settings.version')} />
        </Card>

        {message ? <Notice tone="primary">{message}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <Button
          label={t('settings.signOut')}
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
