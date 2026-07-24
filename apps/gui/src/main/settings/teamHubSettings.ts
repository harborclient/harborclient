import { randomUUID } from 'crypto';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { deleteTeamHubToken, getTeamHubToken, storeTeamHubToken } from './teamHubSecrets';
import { parseJson } from '#/shared/parseJson';
import type { TeamHub } from '#/shared/types';

const TEAM_HUBS_KEY = 'teamHubs';

/**
 * Team hub metadata persisted without bearer tokens in the registry JSON blob.
 */
interface StoredTeamHub {
  /**
   * Unique team hub identifier.
   */
  id: string;

  /**
   * User-defined display name.
   */
  name: string;

  /**
   * HarborClient Team Hub base URL.
   */
  baseUrl: string;

  /**
   * Legacy inline bearer token migrated to the encrypted sidecar.
   */
  token?: string;
}

/**
 * Persists team hub metadata to the local registry.
 *
 * @param hubs - Team hub metadata rows without bearer tokens.
 */
function persistTeamHubMetadata(hubs: StoredTeamHub[]): void {
  getLocalDatabase().setSetting(
    TEAM_HUBS_KEY,
    JSON.stringify(hubs.map(({ id, name, baseUrl }) => ({ id, name, baseUrl })))
  );
}

/**
 * Trims fields and removes trailing slashes from the base URL.
 *
 * @param input - Raw team hub from storage or user input.
 * @returns Normalized team hub record with token resolved from the sidecar when omitted.
 */
function normalizeTeamHub(input: StoredTeamHub | TeamHub): TeamHub {
  const id = input.id.trim();
  const inlineToken = 'token' in input ? String(input.token ?? '').trim() : '';
  const token = inlineToken || getTeamHubToken(id) || '';

  return {
    id,
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    token
  };
}

/**
 * Lists all configured team hubs with bearer tokens resolved from encrypted storage.
 *
 * @returns Normalized team hub records from local storage.
 */
export function listTeamHubs(): TeamHub[] {
  const stored = parseJson<StoredTeamHub[]>(getLocalDatabase().getSetting(TEAM_HUBS_KEY), []);
  return stored.map(normalizeTeamHub);
}

/**
 * Creates or updates a team hub and stores its bearer token in encrypted storage.
 *
 * @param input - Team hub to persist; blank id inserts a new record.
 * @returns Updated list of all team hubs.
 */
export function saveTeamHub(input: TeamHub): TeamHub[] {
  const id = input.id.trim() || randomUUID();
  const normalized = normalizeTeamHub({
    ...input,
    id
  });

  if (normalized.token) {
    storeTeamHubToken(id, normalized.token);
  }

  const stored = parseJson<StoredTeamHub[]>(getLocalDatabase().getSetting(TEAM_HUBS_KEY), []);
  const metadata: StoredTeamHub = {
    id: normalized.id,
    name: normalized.name,
    baseUrl: normalized.baseUrl
  };
  const index = stored.findIndex((hub) => hub.id === normalized.id);

  if (index >= 0) {
    stored[index] = metadata;
  } else {
    stored.push(metadata);
  }

  persistTeamHubMetadata(stored);
  return listTeamHubs();
}

/**
 * Deletes a team hub by id and removes its encrypted bearer token.
 *
 * @param id - Team hub id to remove.
 * @returns Updated list of all team hubs.
 * @throws When no team hub matches the given id.
 */
export function deleteTeamHub(id: string): TeamHub[] {
  const stored = parseJson<StoredTeamHub[]>(getLocalDatabase().getSetting(TEAM_HUBS_KEY), []);
  const nextStored = stored.filter((hub) => hub.id !== id);

  if (nextStored.length === stored.length) {
    throw new Error(`Unknown team hub: ${id}`);
  }

  persistTeamHubMetadata(nextStored);
  deleteTeamHubToken(id);
  return listTeamHubs();
}
