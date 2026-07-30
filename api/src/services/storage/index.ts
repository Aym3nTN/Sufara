import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { LocalDiskStorage } from './local.js';
import { R2Storage } from './r2.js';
import type { StorageProvider } from './types.js';

export type { StorageProvider, StoredObject } from './types.js';
export { LocalDiskStorage } from './local.js';
export { R2Storage, type R2Config } from './r2.js';

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;

  if (env.STORAGE_PROVIDER === 'r2') {
    // Presence of every R2 setting is validated at boot in config/env.ts.
    instance = new R2Storage({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET!,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL!,
    });
  } else {
    instance = new LocalDiskStorage(env.UPLOAD_DIR, env.API_BASE_URL);
  }

  return instance;
}

export function setStorageProvider(provider: StorageProvider | null): void {
  instance = provider;
}

/** Content-addressed key so identical uploads do not multiply in the bucket. */
export function buildStorageKey(prefix: string, body: Buffer, extension: string): string {
  const digest = createHash('sha256').update(body).digest('hex').slice(0, 16);
  return `${prefix}/${digest}-${randomUUID().slice(0, 8)}.${extension}`;
}
