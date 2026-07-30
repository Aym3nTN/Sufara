import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api/client';
import type { User } from '../../src/api/types';
import {
  Badge,
  Button,
  Card,
  Field,
  Loader,
  Notice,
  SectionTitle,
} from '../../src/components/ui';
import { useAuth } from '../../src/state/auth';
import { colors, spacing, typography } from '../../src/theme';
import { formatDate } from '../../src/utils/format';

export default function AdminUsers() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState<Array<User & { isActive: boolean }>>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.admin.users({ page, limit: 10, search: search.trim() || undefined });
      setUsers(result.items);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch {
      setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const guard = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change could not be applied.');
    }
  };

  if (loading) return <Loader label="Loading users…" />;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <SectionTitle title={`Users (${total})`} />
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search by name or email" />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {users.map((user) => {
        const isSelf = user.id === me?.id;
        return (
          <Card key={user.id} style={{ gap: spacing.md }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {user.name}
                  {isSelf ? ' (you)' : ''}
                </Text>
                <Text style={[typography.small, { color: colors.textMuted }]}>{user.email}</Text>
                <Text style={[typography.small, { color: colors.textFaint }]}>
                  Joined {formatDate(user.createdAt)}
                </Text>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <Badge label={user.role.toLowerCase()} tone={user.role === 'ADMIN' ? 'gold' : 'neutral'} />
                <Badge
                  label={user.isActive ? 'active' : 'disabled'}
                  tone={user.isActive ? 'primary' : 'danger'}
                />
              </View>
            </View>

            {isSelf ? (
              <Text style={[typography.small, { color: colors.textFaint }]}>
                You cannot change your own role or status.
              </Text>
            ) : (
              <View style={styles.actions}>
                <Button
                  label={user.role === 'ADMIN' ? 'Make user' : 'Make admin'}
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    void guard(() =>
                      api.admin.updateUser(user.id, { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' }),
                    )
                  }
                />
                <Button
                  label={user.isActive ? 'Disable' : 'Enable'}
                  size="sm"
                  variant={user.isActive ? 'danger' : 'ghost'}
                  onPress={() =>
                    void guard(() => api.admin.updateUser(user.id, { isActive: !user.isActive }))
                  }
                />
              </View>
            )}
          </Card>
        );
      })}

      {totalPages > 1 ? (
        <View style={styles.pager}>
          <Button
            label="‹ Previous"
            size="sm"
            variant="secondary"
            disabled={page === 1}
            onPress={() => setPage(page - 1)}
          />
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Page {page} of {totalPages}
          </Text>
          <Button
            label="Next ›"
            size="sm"
            variant="secondary"
            disabled={page === totalPages}
            onPress={() => setPage(page + 1)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md },
});
