import { createHash } from 'node:crypto';

/**
 * Derives a stable RFC 4122-style UUID for one marketplace snippet entry.
 *
 * Teammates who install the same bundle get identical UUIDs so Team Hub script
 * references resolve consistently across machines.
 *
 * @param catalogId - Marketplace bundle id from snippets.json.
 * @param key - Stable per-snippet key, usually the manifest entry name.
 * @returns Deterministic UUID string.
 */
export function deriveMarketplaceSnippetUuid(catalogId: string, key: string): string {
  const digest = createHash('sha256').update(`snippet:${catalogId}:${key}`).digest();
  const bytes = Uint8Array.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Resolves the stable UUID for one marketplace snippet manifest entry.
 *
 * @param catalogId - Marketplace bundle id from snippets.json.
 * @param entryUuid - Optional explicit UUID from the manifest entry.
 * @param entryName - Manifest entry name used as the fallback derivation key.
 * @returns Stable snippet UUID for database upsert and script references.
 */
export function resolveMarketplaceSnippetUuid(
  catalogId: string,
  entryUuid: string | undefined,
  entryName: string
): string {
  const explicit = entryUuid?.trim();
  if (explicit) {
    return explicit;
  }
  return deriveMarketplaceSnippetUuid(catalogId, entryName);
}
