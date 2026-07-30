import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * A "contains" filter that matches case-insensitively on **both** providers.
 *
 * SQLite's `LIKE` is already case-insensitive for ASCII, but PostgreSQL's is
 * not — so moving to Neon would silently stop "quba" matching "Quba Mosque".
 * Prisma rejects the `mode` argument on SQLite, so it is attached only when the
 * configured provider supports it. Every user-facing search goes through here.
 */
export function containsInsensitive(value: string): Prisma.StringFilter {
  // The generated client types reflect the *development* datasource (SQLite),
  // which has no `mode` argument — but the identical code runs against
  // PostgreSQL in production, where the argument is both valid and required for
  // this to stay case-insensitive. Hence the narrow cast.
  const filter =
    env.DATABASE_PROVIDER === 'postgresql'
      ? { contains: value, mode: 'insensitive' }
      : { contains: value };

  return filter as Prisma.StringFilter;
}
