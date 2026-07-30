import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setSessionExpiredHandler, tokenStore } from '../api/client';
import type { Preferences, User } from '../api/types';

interface AuthValue {
  user: User | null;
  preferences: Preferences | null;
  stats: { trips: number; savedPlaces: number; placesVisited: number } | null;
  ready: boolean;
  busy: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setPreferences: (next: Preferences) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPrefs] = useState<Preferences | null>(null);
  const [stats, setStats] = useState<AuthValue['stats']>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    const profile = await api.me.profile();
    setUser(profile.user);
    setPrefs(profile.preferences);
    setStats(profile.stats);
  }, []);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setPrefs(null);
    setStats(null);
  }, []);

  // Restore a stored session on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = await tokenStore.load();
        if (tokens && !cancelled) await loadProfile();
      } catch {
        await tokenStore.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // A refresh token that can no longer be rotated ends the session everywhere.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void clearSession();
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setBusy(true);
      try {
        const result = await api.auth.login({ email, password });
        await tokenStore.save(result);
        await loadProfile();
      } finally {
        setBusy(false);
      }
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setBusy(true);
      try {
        const result = await api.auth.register({ name, email, password });
        await tokenStore.save(result);
        await loadProfile();
      } finally {
        setBusy(false);
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const tokens = await tokenStore.load();
    if (tokens) {
      // Best effort: the local session ends regardless of the server's answer.
      await api.auth.logout(tokens.refreshToken).catch(() => undefined);
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      preferences,
      stats,
      ready,
      busy,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signUp,
      signOut,
      refresh: loadProfile,
      setPreferences: setPrefs,
    }),
    [user, preferences, stats, ready, busy, signIn, signUp, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
