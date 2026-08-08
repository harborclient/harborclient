import type { StorageConfig } from '#/config/storageConfig.js';
import { DbBlobStorage } from '#/storage/dbBlobStorage.js';
import { GcsBlobStorage } from '#/storage/gcsBlobStorage.js';
import type { IBlobStorage } from '#/storage/IBlobStorage.js';
import { S3BlobStorage } from '#/storage/s3BlobStorage.js';

/**
 * Builds a blob storage client for the configured avatar storage driver.
 *
 * @param config - Normalized storage configuration from server.yaml.
 * @returns Blob storage implementation for the active driver.
 */
export function createBlobStorage(config: StorageConfig): IBlobStorage {
  switch (config.driver) {
    case 's3':
      return new S3BlobStorage(config);
    case 'gcs':
      return new GcsBlobStorage(config);
    case 'db':
    default:
      return new DbBlobStorage();
  }
}
