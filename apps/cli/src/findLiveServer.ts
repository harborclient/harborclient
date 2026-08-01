import type { LiveServer } from '@harborclient/core/types';

/**
 * Finds a saved live server by uuid or case-insensitive name.
 *
 * Uuid match wins over name so a uuid string that happens to equal another
 * server's display name still resolves uniquely.
 *
 * @param servers - Saved live servers from the registry.
 * @param ref - Display name or uuid.
 * @returns Matching server, or undefined.
 */
export function findLiveServer(servers: LiveServer[], ref: string): LiveServer | undefined {
  const trimmed = ref.trim();
  return (
    servers.find((server) => server.uuid === trimmed) ??
    servers.find((server) => server.name.toLowerCase() === trimmed.toLowerCase())
  );
}
