import { randomUUID } from 'crypto';
import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { parseJson } from '#/shared/parseJson';
import type { TeamHub } from '#/shared/types';

const TEAM_HUBS_KEY = 'teamHubs';

/**
 * Persists the team hub list to the local registry.
 *
 * @param hubs - Team hubs to store.
 */
function persistTeamHubs(hubs: TeamHub[]): void {
  getLocalRegistry().setSetting(TEAM_HUBS_KEY, JSON.stringify(hubs));
}

/**
 * Trims fields and removes trailing slashes from the base URL.
 *
 * @param input - Raw team hub from storage or user input.
 * @returns Normalized team hub record.
 */
function normalizeTeamHub(input: TeamHub): TeamHub {
  return {
    id: input.id.trim(),
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    token: input.token.trim()
  };
}

/**
 * Lists all configured team hubs.
 *
 * @returns Normalized team hub records from local storage.
 */
export function listTeamHubs(): TeamHub[] {
  const stored = parseJson<TeamHub[]>(getLocalRegistry().getSetting(TEAM_HUBS_KEY), []);
  return stored.map(normalizeTeamHub);
}

/**
 * Creates or updates a team hub.
 *
 * @param input - Team hub to persist; blank id inserts a new record.
 * @returns Updated list of all team hubs.
 */
export function saveTeamHub(input: TeamHub): TeamHub[] {
  const normalized = normalizeTeamHub({
    ...input,
    id: input.id.trim() || randomUUID()
  });
  const hubs = listTeamHubs();
  const index = hubs.findIndex((hub) => hub.id === normalized.id);

  if (index >= 0) {
    hubs[index] = normalized;
  } else {
    hubs.push(normalized);
  }

  persistTeamHubs(hubs);
  return hubs;
}

/**
 * Deletes a team hub by id.
 *
 * @param id - Team hub id to remove.
 * @returns Updated list of all team hubs.
 * @throws When no team hub matches the given id.
 */
export function deleteTeamHub(id: string): TeamHub[] {
  const hubs = listTeamHubs();
  const nextHubs = hubs.filter((hub) => hub.id !== id);

  if (nextHubs.length === hubs.length) {
    throw new Error(`Unknown team hub: ${id}`);
  }

  persistTeamHubs(nextHubs);
  return nextHubs;
}
