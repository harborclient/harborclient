import { Storage, type Bucket } from '@google-cloud/storage';
import type { GcsStorageConfig } from '#/config/storageConfig.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';

/**
 * Optional overrides for constructing a {@link GcsBlobStorage} (used in tests).
 */
export interface GcsBlobStorageOptions {
  /**
   * Prebuilt bucket handle; when omitted a client is created from config.
   */
  bucket?: Bucket;
}

/**
 * Avatar blob storage backed by Google Cloud Storage.
 */
export class GcsBlobStorage implements IBlobStorage {
  private readonly bucket: Bucket;

  /**
   * Creates a GCS-backed blob store.
   *
   * @param config - Normalized GCS storage configuration.
   * @param options - Optional injected bucket for tests.
   */
  constructor(config: GcsStorageConfig, options: GcsBlobStorageOptions = {}) {
    if (options.bucket) {
      this.bucket = options.bucket;
      return;
    }

    const storage = new Storage({
      ...(config.projectId ? { projectId: config.projectId } : {}),
      ...(config.keyFilename ? { keyFilename: config.keyFilename } : {})
    });
    this.bucket = storage.bucket(config.bucket);
  }

  /**
   * Uploads avatar bytes to the configured bucket.
   *
   * @param key - Object key within the bucket.
   * @param body - Raw image bytes.
   * @param mime - Content-Type for the object.
   */
  async putObject(key: string, body: Buffer, mime: string): Promise<void> {
    const file = this.bucket.file(key);
    await file.save(body, {
      contentType: mime,
      resumable: false
    });
  }

  /**
   * Deletes an avatar object; ignores missing keys.
   *
   * @param key - Object key to delete.
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.bucket.file(key).delete({ ignoreNotFound: true });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: number | string }).code
          : undefined;
      if (code === 404 || code === '404') {
        return;
      }
      throw error;
    }
  }

  /**
   * Creates a short-lived signed GET URL for the object.
   *
   * @param key - Object key to sign.
   * @param ttlSeconds - Signature lifetime in seconds.
   * @returns Absolute signed URL.
   */
  async getSignedReadUrl(key: string, ttlSeconds: number): Promise<string> {
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000
    });
    return url;
  }
}
