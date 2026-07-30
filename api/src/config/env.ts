import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),

  DATABASE_URL: z.string().default('file:./dev.db'),
  /**
   * Which Prisma datasource the running database uses. SQLite locally and in
   * tests, PostgreSQL (Neon) in production. Query behaviour differs in one
   * place — see `lib/search.ts`.
   */
  DATABASE_PROVIDER: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  /** Unpooled Neon URL, used by `prisma migrate deploy` only. */
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(8).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  ROUTING_PROVIDER: z.enum(['haversine', 'osrm']).default('haversine'),
  OSRM_BASE_URL: z.string().default('https://router.project-osrm.org'),

  // --- Storage: local disk in development, Cloudflare R2 in production -------
  STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Public base URL for the bucket (r2.dev domain or your custom domain). */
  R2_PUBLIC_BASE_URL: z.string().optional(),

  PLANNER_BUFFER_RATIO: z.coerce.number().min(0).max(0.5).default(0.08),
  PLANNER_MIN_BUFFER_MINUTES: z.coerce.number().int().min(0).default(10),
  PLANNER_MAX_BUFFER_MINUTES: z.coerce.number().int().min(0).default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (isProduction) {
  const weak = ['dev-access-secret-change-me', 'dev-refresh-secret-change-me'];
  if (weak.includes(env.JWT_ACCESS_SECRET) || weak.includes(env.JWT_REFRESH_SECRET)) {
    throw new Error('Refusing to start in production with default JWT secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
  }

  // Fail at boot rather than on the first upload, and fail loudly rather than
  // writing traveller uploads to a container filesystem that will be recycled.
  if (env.STORAGE_PROVIDER === 'r2') {
    const missing = (
      [
        ['R2_ACCOUNT_ID', env.R2_ACCOUNT_ID],
        ['R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID],
        ['R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY],
        ['R2_BUCKET', env.R2_BUCKET],
        ['R2_PUBLIC_BASE_URL', env.R2_PUBLIC_BASE_URL],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`STORAGE_PROVIDER=r2 requires: ${missing.join(', ')}`);
    }
  } else {
    console.warn(
      '[sufara] STORAGE_PROVIDER is "local" in production. Uploaded photos will be lost whenever the instance restarts. Set STORAGE_PROVIDER=r2.',
    );
  }
}
