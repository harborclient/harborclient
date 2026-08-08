import type { StorageSection } from '#/config/serverConfig.schema.js';

/**
 * Default object-key prefix for avatar blobs in external storage.
 */
export const DEFAULT_STORAGE_PREFIX = 'avatars';

/**
 * Default signed URL lifetime for avatar redirect responses (15 minutes).
 */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

/**
 * In-database avatar blob storage (default).
 */
export interface DbStorageConfig {
  /**
   * Stores avatar bytes as base64 in the database.
   */
  driver: 'db';

  /**
   * Unused for the db driver; retained for a stable config shape.
   */
  prefix: string;

  /**
   * Unused for the db driver; retained for a stable config shape.
   */
  signedUrlTtlSeconds: number;
}

/**
 * S3 or S3-compatible object storage for avatar blobs.
 */
export interface S3StorageConfig {
  /**
   * Amazon S3 or compatible endpoint (MinIO, etc.).
   */
  driver: 's3';

  /**
   * Target bucket name.
   */
  bucket: string;

  /**
   * AWS region (or compatible region string).
   */
  region: string;

  /**
   * Optional custom endpoint for S3-compatible stores.
   */
  endpoint?: string;

  /**
   * Access key id for signing requests.
   */
  accessKeyId: string;

  /**
   * Secret access key for signing requests.
   */
  secretAccessKey: string;

  /**
   * Key prefix under the bucket (for example `avatars`).
   */
  prefix: string;

  /**
   * Lifetime of signed read URLs returned via avatar GET redirects.
   */
  signedUrlTtlSeconds: number;
}

/**
 * Google Cloud Storage for avatar blobs.
 */
export interface GcsStorageConfig {
  /**
   * Google Cloud Storage driver.
   */
  driver: 'gcs';

  /**
   * Target GCS bucket name.
   */
  bucket: string;

  /**
   * Optional GCP project id; ADC often supplies this implicitly.
   */
  projectId?: string;

  /**
   * Optional path to a service-account JSON key file.
   */
  keyFilename?: string;

  /**
   * Key prefix under the bucket (for example `avatars`).
   */
  prefix: string;

  /**
   * Lifetime of signed read URLs returned via avatar GET redirects.
   */
  signedUrlTtlSeconds: number;
}

/**
 * Normalized avatar blob storage configuration from server.yaml.
 */
export type StorageConfig = DbStorageConfig | S3StorageConfig | GcsStorageConfig;

/**
 * Default storage settings applied when the `storage` section is omitted.
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  driver: 'db',
  prefix: DEFAULT_STORAGE_PREFIX,
  signedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS
};

/**
 * Returns true when avatar bytes should be written to an external object store.
 *
 * @param config - Normalized storage configuration.
 */
export function isExternalBlobStorage(config: StorageConfig): boolean {
  return config.driver === 's3' || config.driver === 'gcs';
}

/**
 * Parses and validates signed URL TTL from a YAML section.
 *
 * @param value - Raw TTL seconds from config.
 * @returns Positive integer TTL.
 */
function normalizeSignedUrlTtlSeconds(value: number | undefined): number {
  if (value == null) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error('storage.signedUrlTtlSeconds must be a positive integer.');
  }

  return value;
}

/**
 * Converts a validated YAML storage section into normalized runtime config.
 *
 * @param section - Parsed storage section from server.yaml, when present.
 * @returns Normalized storage config with defaults for omitted fields.
 * @throws {Error} When a driver is missing required fields.
 */
export function normalizeStorageConfig(section?: StorageSection): StorageConfig {
  const driver = section?.driver?.trim().toLowerCase() || 'db';
  const prefix =
    section?.prefix != null && section.prefix.trim().length > 0
      ? section.prefix.trim().replace(/^\/+|\/+$/g, '')
      : DEFAULT_STORAGE_PREFIX;
  const signedUrlTtlSeconds = normalizeSignedUrlTtlSeconds(section?.signedUrlTtlSeconds);

  if (driver === 'db') {
    return {
      driver: 'db',
      prefix,
      signedUrlTtlSeconds
    };
  }

  if (driver === 's3') {
    const bucket = section?.bucket?.trim();
    const region = section?.region?.trim();
    const accessKeyId = section?.accessKeyId?.trim();
    const secretAccessKey = section?.secretAccessKey?.trim();

    if (!bucket) {
      throw new Error('storage.bucket is required when storage.driver is "s3".');
    }
    if (!region) {
      throw new Error('storage.region is required when storage.driver is "s3".');
    }
    if (!accessKeyId) {
      throw new Error('storage.accessKeyId is required when storage.driver is "s3".');
    }
    if (!secretAccessKey) {
      throw new Error('storage.secretAccessKey is required when storage.driver is "s3".');
    }

    const endpoint = section?.endpoint?.trim();
    return {
      driver: 's3',
      bucket,
      region,
      ...(endpoint ? { endpoint } : {}),
      accessKeyId,
      secretAccessKey,
      prefix,
      signedUrlTtlSeconds
    };
  }

  if (driver === 'gcs') {
    const bucket = section?.bucket?.trim();
    if (!bucket) {
      throw new Error('storage.bucket is required when storage.driver is "gcs".');
    }

    const projectId = section?.projectId?.trim();
    const keyFilename = section?.keyFilename?.trim();
    return {
      driver: 'gcs',
      bucket,
      ...(projectId ? { projectId } : {}),
      ...(keyFilename ? { keyFilename } : {}),
      prefix,
      signedUrlTtlSeconds
    };
  }

  throw new Error(`Unsupported storage.driver "${section?.driver}". Use "db", "s3", or "gcs".`);
}
