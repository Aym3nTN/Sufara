import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { StorageProvider, StoredObject } from './types.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL for reads: the r2.dev domain or a custom domain. */
  publicBaseUrl: string;
}

/**
 * Cloudflare R2 storage.
 *
 * R2 is S3-compatible, so this is the standard S3 client pointed at the R2
 * endpoint with the region fixed to "auto". It exists because a container
 * filesystem is recycled on every deploy — traveller and admin uploads need to
 * outlive the instance that received them.
 *
 * Objects are written without ACLs: R2 buckets are private by default and
 * exposed for reading through a public bucket domain or a custom domain, which
 * is what `publicBaseUrl` points at.
 */
export class R2Storage implements StorageProvider {
  readonly name = 'r2';

  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Content-addressed keys never change, so they are safe to cache hard.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, url: this.urlFor(key) };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  urlFor(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
