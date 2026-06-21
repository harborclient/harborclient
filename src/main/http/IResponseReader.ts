/**
 * Result of reading a response body with size limits applied.
 */
export type ReadResponseBodyResult = { body: string; sizeBytes: number } | { error: string };

/**
 * Response body reading with configurable and hard size limits.
 */
export interface IResponseReader {
  /**
   * Resolves the effective response size limit in megabytes.
   *
   * @param maxResponseSizeMb - User setting; 0 means no configurable limit.
   */
  resolveMaxResponseSizeMb(maxResponseSizeMb: number): number;

  /**
   * Reads a response body, enforcing a max size in megabytes.
   *
   * @param response - Fetch response to read.
   * @param maxResponseSizeMb - Maximum body size in MB; 0 uses the hard cap only.
   */
  read(response: Response, maxResponseSizeMb: number): Promise<ReadResponseBodyResult>;
}
