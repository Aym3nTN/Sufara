import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { badRequest } from '../../lib/errors.js';
import type { StorageProvider, StoredObject } from './types.js';

/** Development storage: files on disk, served read-only by the API. */
export class LocalDiskStorage implements StorageProvider {
  readonly name = 'local';

  constructor(
    private readonly directory: string,
    private readonly publicBaseUrl: string,
  ) {}

  async put(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.urlFor(key) };
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      // Already gone — deleting an absent object is not an error.
    }
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/uploads/${key}`;
  }

  /** Guards against `../` traversal in a caller-supplied key. */
  private resolve(key: string): string {
    const root = path.resolve(this.directory);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw badRequest('Invalid storage key');
    }
    return target;
  }
}
