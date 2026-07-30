import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {
  AdminStats,
  Category,
  City,
  Country,
  Itinerary,
  Paginated,
  Place,
  Plan,
  PlanRequest,
  Preferences,
  Profile,
  User,
} from './types';

const ACCESS_KEY = 'sufara.accessToken';
const REFRESH_KEY = 'sufara.refreshToken';

/**
 * Resolves the API origin.
 *
 * `EXPO_PUBLIC_API_URL` wins. Otherwise, on a device the Metro host is the
 * developer's machine, so the API is assumed to sit on port 4000 of the same
 * host — which is what makes "open on my phone" work without configuration.
 */
export type ApiUrlSource = 'env' | 'metro-host' | 'fallback';

export function resolveApiOrigin(): { url: string; source: ApiUrlSource } {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return { url: explicit.replace(/\/$/, ''), source: 'env' };

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { hostUri?: string } }).expoGoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost') {
    return { url: `http://${host}:4000/api/v1`, source: 'metro-host' };
  }

  return { url: 'http://localhost:4000/api/v1', source: 'fallback' };
}

export function resolveBaseUrl(): string {
  return resolveApiOrigin().url;
}

/**
 * A standalone build has no Metro host to borrow, so an unset
 * `EXPO_PUBLIC_API_URL` leaves it pointing at the phone itself — where nothing
 * is listening. That looks like "the app is broken" rather than "the app was
 * built without an API URL", so say so once, loudly.
 */
if (!__DEV__ && resolveApiOrigin().source === 'fallback') {
  console.warn(
    '[sufara] No EXPO_PUBLIC_API_URL was set at build time, so this build points at localhost and cannot reach an API. Rebuild with EXPO_PUBLIC_API_URL set (see docs/DEPLOYMENT.md).',
  );
}

// SecureStore has no web implementation; localStorage is the web equivalent.
const storage = {
  async get(key: string) {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* private browsing */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* private browsing */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const tokenStore = {
  async load(): Promise<Tokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      storage.get(ACCESS_KEY),
      storage.get(REFRESH_KEY),
    ]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  async save(tokens: Tokens) {
    await Promise.all([
      storage.set(ACCESS_KEY, tokens.accessToken),
      storage.set(REFRESH_KEY, tokens.refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
  },
};

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Set false for endpoints that must never carry credentials. */
  auth?: boolean;
  signal?: AbortSignal;
}

let inFlightRefresh: Promise<Tokens | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${resolveBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function refreshTokens(): Promise<Tokens | null> {
  // Collapse concurrent 401s into a single refresh, or rotation would race
  // itself and invalidate the token it just issued.
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const tokens = await tokenStore.load();
      if (!tokens) return null;

      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        await tokenStore.clear();
        return null;
      }

      const next = (await response.json()) as Tokens;
      await tokenStore.save(next);
      return next;
    })().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const send = async (accessToken: string | null): Promise<Response> =>
    fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const tokens = auth ? await tokenStore.load() : null;
  let response = await send(tokens?.accessToken ?? null);

  if (response.status === 401 && auth && tokens) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await send(refreshed.accessToken);
    } else {
      onSessionExpired?.();
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const error = payload.error as
      | { code?: string; message?: string; details?: Array<{ field: string; message: string }> }
      | undefined;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  auth: {
    register: (body: { name: string; email: string; password: string }) =>
      request<{ user: User } & Tokens>('/auth/register', { method: 'POST', body, auth: false }),
    login: (body: { email: string; password: string }) =>
      request<{ user: User } & Tokens>('/auth/login', { method: 'POST', body, auth: false }),
    logout: (refreshToken: string) =>
      request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
    forgotPassword: (email: string) =>
      request<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        auth: false,
      }),
    resetPassword: (body: { token: string; password: string }) =>
      request<{ message: string }>('/auth/reset-password', { method: 'POST', body, auth: false }),
    me: () => request<{ user: User }>('/auth/me'),
  },

  catalog: {
    countries: () => request<{ items: Country[] }>('/countries', { auth: false }),
    cities: (query?: { countryId?: string; search?: string }) =>
      request<{ items: City[] }>('/cities', { query, auth: false }),
    categories: () => request<{ items: Category[] }>('/categories', { auth: false }),
    places: (query?: {
      cityId?: string;
      countryId?: string;
      categoryId?: string;
      search?: string;
      latitude?: number;
      longitude?: number;
      sort?: 'relevance' | 'distance' | 'name';
      page?: number;
      limit?: number;
    }) => request<Paginated<Place>>('/places', { query }),
    nearby: (query: { latitude: number; longitude: number; radiusMeters?: number; limit?: number }) =>
      request<{ items: Place[] }>('/places/nearby', { query }),
    place: (id: string, origin?: { latitude: number; longitude: number }) =>
      request<{ place: Place }>(`/places/${id}`, { query: origin }),
  },

  me: {
    profile: () => request<Profile>('/me'),
    update: (body: { name?: string; avatarUrl?: string | null }) =>
      request<{ user: User }>('/me', { method: 'PUT', body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>('/me/change-password', { method: 'POST', body }),
    preferences: () => request<Preferences>('/me/preferences'),
    savePreferences: (body: Partial<Omit<Preferences, 'interests'>>) =>
      request<Preferences>('/me/preferences', { method: 'PUT', body }),
    savedPlaces: (query?: { cityId?: string; search?: string }) =>
      request<{ items: Array<{ savedAt: string; note: string | null; place: Place }> }>(
        '/me/saved-places',
        { query },
      ),
    savePlace: (placeId: string, note?: string) =>
      request<{ saved: boolean }>('/me/saved-places', { method: 'POST', body: { placeId, note } }),
    unsavePlace: (placeId: string) =>
      request<void>(`/me/saved-places/${placeId}`, { method: 'DELETE' }),
  },

  planner: {
    generate: (body: PlanRequest) => request<{ plan: Plan }>('/planner/generate', { method: 'POST', body }),
    optimize: (body: PlanRequest & { selectedPlaceIds: string[] }) =>
      request<{ plan: Plan }>('/planner/optimize', { method: 'POST', body }),
    preview: (body: PlanRequest & { selectedPlaceIds: string[] }) =>
      request<{ plan: Plan }>('/planner/preview', { method: 'POST', body }),
  },

  itineraries: {
    list: () => request<{ items: Itinerary[] }>('/itineraries'),
    get: (id: string) => request<{ itinerary: Itinerary }>(`/itineraries/${id}`),
    create: (body: Record<string, unknown>) =>
      request<{ itinerary: Itinerary }>('/itineraries', { method: 'POST', body }),
    update: (id: string, body: Record<string, unknown>) =>
      request<{ itinerary: Itinerary }>(`/itineraries/${id}`, { method: 'PUT', body }),
    duplicate: (id: string) =>
      request<{ itinerary: Itinerary }>(`/itineraries/${id}/duplicate`, { method: 'POST' }),
    setStopCompleted: (id: string, stopId: string, completed: boolean) =>
      request<{ itinerary: Itinerary }>(`/itineraries/${id}/stops/${stopId}`, {
        method: 'PATCH',
        body: { completed },
      }),
    remove: (id: string) => request<void>(`/itineraries/${id}`, { method: 'DELETE' }),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    places: (query?: {
      page?: number;
      limit?: number;
      search?: string;
      cityId?: string;
      countryId?: string;
      status?: string;
    }) => request<Paginated<Place>>('/admin/places', { query }),
    place: (id: string) => request<{ place: Place }>(`/admin/places/${id}`),
    createPlace: (body: Record<string, unknown>) =>
      request<{ place: Place }>('/admin/places', { method: 'POST', body }),
    updatePlace: (id: string, body: Record<string, unknown>) =>
      request<{ place: Place }>(`/admin/places/${id}`, { method: 'PUT', body }),
    deletePlace: (id: string) => request<void>(`/admin/places/${id}`, { method: 'DELETE' }),

    countries: () => request<{ items: Country[] }>('/admin/countries'),
    createCountry: (body: { name: string; code: string }) =>
      request<{ country: Country }>('/admin/countries', { method: 'POST', body }),
    updateCountry: (id: string, body: Record<string, unknown>) =>
      request<{ country: Country }>(`/admin/countries/${id}`, { method: 'PUT', body }),
    deleteCountry: (id: string) => request<void>(`/admin/countries/${id}`, { method: 'DELETE' }),

    cities: (query?: { countryId?: string }) =>
      request<{ items: Array<City & { isActive: boolean }> }>('/admin/cities', { query }),
    createCity: (body: Record<string, unknown>) =>
      request<{ city: City }>('/admin/cities', { method: 'POST', body }),
    updateCity: (id: string, body: Record<string, unknown>) =>
      request<{ city: City }>(`/admin/cities/${id}`, { method: 'PUT', body }),
    deleteCity: (id: string) => request<void>(`/admin/cities/${id}`, { method: 'DELETE' }),

    categories: () => request<{ items: Category[] }>('/admin/categories'),
    createCategory: (body: Record<string, unknown>) =>
      request<{ category: Category }>('/admin/categories', { method: 'POST', body }),
    updateCategory: (id: string, body: Record<string, unknown>) =>
      request<{ category: Category }>(`/admin/categories/${id}`, { method: 'PUT', body }),
    deleteCategory: (id: string) => request<void>(`/admin/categories/${id}`, { method: 'DELETE' }),

    users: (query?: { page?: number; limit?: number; search?: string }) =>
      request<Paginated<User & { isActive: boolean }>>('/admin/users', { query }),
    updateUser: (id: string, body: { role?: string; isActive?: boolean }) =>
      request<{ user: User & { isActive: boolean } }>(`/admin/users/${id}`, { method: 'PUT', body }),
  },
};
