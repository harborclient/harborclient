import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';

const TEAM_HUB_CONNECTION_STATE_KEY = 'teamHubConnectionState';

/**
 * Persisted soft-connection state for one Team Hub.
 */
interface TeamHubConnectionStateEntry {
  /**
   * When true, the hub's storage backend should be mounted and synced.
   */
  connected: boolean;

  /**
   * Last known authenticated user display name from session introspection.
   */
  userName?: string;
}

/**
 * Map of team hub connection id to soft-connection state.
 */
type TeamHubConnectionStateMap = Record<string, TeamHubConnectionStateEntry>;

/**
 * Reads the persisted Team Hub connection-state map from the registry.
 *
 * @returns Connection state keyed by hub id.
 */
function readConnectionState(): TeamHubConnectionStateMap {
  const parsed = parseJson(getLocalDatabase().getSetting(TEAM_HUB_CONNECTION_STATE_KEY), {});
  if (!isPlainObject(parsed)) {
    return {};
  }
  return parsed as TeamHubConnectionStateMap;
}

/**
 * Persists the Team Hub connection-state map to the registry.
 *
 * @param state - Connection state keyed by hub id.
 */
function writeConnectionState(state: TeamHubConnectionStateMap): void {
  getLocalDatabase().setSetting(TEAM_HUB_CONNECTION_STATE_KEY, JSON.stringify(state));
}

/**
 * Returns whether a Team Hub should be treated as connected.
 *
 * Unknown hub ids default to connected so existing hubs remain mounted after
 * upgrade before any explicit disconnect.
 *
 * @param hubId - Team hub connection id.
 * @returns True when the hub should be mounted.
 */
export function isTeamHubConnected(hubId: string): boolean {
  const entry = readConnectionState()[hubId];
  return entry?.connected ?? true;
}

/**
 * Persists the soft-connected flag for a Team Hub.
 *
 * @param hubId - Team hub connection id.
 * @param connected - Whether the hub should be mounted.
 */
export function setTeamHubConnected(hubId: string, connected: boolean): void {
  const all = readConnectionState();
  const previous = all[hubId];
  all[hubId] = {
    connected,
    ...(previous?.userName ? { userName: previous.userName } : {})
  };
  writeConnectionState(all);
}

/**
 * Persists the last known authenticated user display name for a Team Hub.
 *
 * Used for rail avatar initials when the hub is offline or disconnected.
 *
 * @param hubId - Team hub connection id.
 * @param userName - Authenticated user display name from session introspection.
 */
export function setTeamHubUserName(hubId: string, userName: string): void {
  const trimmed = userName.trim();
  if (!trimmed) {
    return;
  }

  const all = readConnectionState();
  const previous = all[hubId];
  all[hubId] = {
    connected: previous?.connected ?? true,
    userName: trimmed
  };
  writeConnectionState(all);
}

/**
 * Returns the last known authenticated user display name for a Team Hub.
 *
 * @param hubId - Team hub connection id.
 * @returns Persisted user name, or undefined when none is stored.
 */
export function getTeamHubUserName(hubId: string): string | undefined {
  const userName = readConnectionState()[hubId]?.userName?.trim();
  return userName || undefined;
}

/**
 * Removes soft-connection state for a Team Hub (for example after delete).
 *
 * @param hubId - Team hub connection id.
 */
export function removeTeamHubConnectionState(hubId: string): void {
  const all = readConnectionState();
  if (!all[hubId]) {
    return;
  }
  delete all[hubId];
  writeConnectionState(all);
}
