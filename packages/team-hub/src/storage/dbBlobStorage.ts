import type { IBlobStorage } from '#/storage/IBlobStorage.js';

/**
 * No-op blob storage used when avatars remain in the database.
 *
 * External put/delete/sign paths must not be called for the db driver; this
 * implementation fails loudly if they are.
 */
export class DbBlobStorage implements IBlobStorage {
  /**
   * Rejects uploads because the db driver stores blobs in SQL columns instead.
   */
  async putObject(): Promise<void> {
    throw new Error('DbBlobStorage does not support putObject.');
  }

  /**
   * Rejects deletes because the db driver stores blobs in SQL columns instead.
   */
  async deleteObject(): Promise<void> {
    throw new Error('DbBlobStorage does not support deleteObject.');
  }

  /**
   * Rejects signed URLs because the db driver serves bytes from the API directly.
   */
  async getSignedReadUrl(): Promise<string> {
    throw new Error('DbBlobStorage does not support getSignedReadUrl.');
  }
}
