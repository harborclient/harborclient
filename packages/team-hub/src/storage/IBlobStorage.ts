/**
 * Object-store operations used for Team Hub avatar blobs.
 */
export interface IBlobStorage {
  /**
   * Uploads (or overwrites) an object at the given key.
   *
   * @param key - Object key within the configured bucket.
   * @param body - Raw image bytes.
   * @param mime - Content-Type for the object.
   */
  putObject(key: string, body: Buffer, mime: string): Promise<void>;

  /**
   * Deletes an object when present; missing keys are treated as success.
   *
   * @param key - Object key to delete.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Creates a short-lived HTTPS URL that can fetch the object without Team Hub auth.
   *
   * @param key - Object key to sign.
   * @param ttlSeconds - Signature lifetime in seconds.
   * @returns Absolute signed URL.
   */
  getSignedReadUrl(key: string, ttlSeconds: number): Promise<string>;
}
