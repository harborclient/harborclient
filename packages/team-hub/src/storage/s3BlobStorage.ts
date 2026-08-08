import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3StorageConfig } from '#/config/storageConfig.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';

/**
 * Optional overrides for constructing an {@link S3BlobStorage} (used in tests).
 */
export interface S3BlobStorageOptions {
  /**
   * Prebuilt S3 client; when omitted a client is created from config.
   */
  client?: S3Client;
}

/**
 * Avatar blob storage backed by Amazon S3 or an S3-compatible endpoint.
 */
export class S3BlobStorage implements IBlobStorage {
  private readonly client: S3Client;

  private readonly bucket: string;

  /**
   * Creates an S3-backed blob store.
   *
   * @param config - Normalized S3 storage configuration.
   * @param options - Optional injected client for tests.
   */
  constructor(config: S3StorageConfig, options: S3BlobStorageOptions = {}) {
    this.bucket = config.bucket;
    if (options.client) {
      this.client = options.client;
      return;
    }

    const clientConfig: S3ClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Uploads avatar bytes to the configured bucket.
   *
   * @param key - Object key within the bucket.
   * @param body - Raw image bytes.
   * @param mime - Content-Type for the object.
   */
  async putObject(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mime
      })
    );
  }

  /**
   * Deletes an avatar object; ignores missing keys.
   *
   * @param key - Object key to delete.
   */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })
    );
  }

  /**
   * Creates a short-lived signed GET URL for the object.
   *
   * @param key - Object key to sign.
   * @param ttlSeconds - Signature lifetime in seconds.
   * @returns Absolute signed URL.
   */
  async getSignedReadUrl(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      }),
      { expiresIn: ttlSeconds }
    );
  }
}
