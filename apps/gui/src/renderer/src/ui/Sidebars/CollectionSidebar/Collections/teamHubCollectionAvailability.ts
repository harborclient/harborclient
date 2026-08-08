import type { TeamHub } from '@harborclient/core/types';

/**
 * Whether a collection row belongs to a configured Team Hub connection.
 *
 * @param connectionId - Resolved provider connection id for the collection row.
 * @param teamHubs - Configured team hubs from IPC.
 */
export function isTeamHubCollectionConnection(connectionId: string, teamHubs: TeamHub[]): boolean {
  return teamHubs.some((hub) => hub.id === connectionId);
}

/**
 * Whether a Team Hub collection should appear unavailable in the sidebar.
 *
 * Mirrors the rail avatar semantics: soft-disconnected hubs and hubs that are
 * connected but not currently reachable (no green online dot) are treated as
 * unavailable.
 *
 * @param connectionId - Resolved provider connection id for the collection row.
 * @param teamHubs - Configured team hubs from IPC.
 * @param hubStorageOnlineById - Storage service probe results keyed by hub id.
 */
export function isUnavailableTeamHubCollection(
  connectionId: string,
  teamHubs: TeamHub[],
  hubStorageOnlineById: Record<string, boolean>
): boolean {
  const hub = teamHubs.find((entry) => entry.id === connectionId);
  if (!hub) {
    return false;
  }
  if (hub.connected === false) {
    return true;
  }
  return hubStorageOnlineById[connectionId] !== true;
}

/**
 * Whether the user should be offered a soft-connect prompt for this collection.
 *
 * @param connectionId - Resolved provider connection id for the collection row.
 * @param teamHubs - Configured team hubs from IPC.
 */
export function isSoftDisconnectedTeamHubCollection(
  connectionId: string,
  teamHubs: TeamHub[]
): boolean {
  const hub = teamHubs.find((entry) => entry.id === connectionId);
  return hub?.connected === false;
}
