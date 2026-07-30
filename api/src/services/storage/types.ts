export interface StoredObject {
  key: string;
  url: string;
}

/**
 * Object storage contract. Implementations live beside this file; nothing
 * outside `services/storage` knows which one is in use.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  remove(key: string): Promise<void>;
  urlFor(key: string): string;
}
