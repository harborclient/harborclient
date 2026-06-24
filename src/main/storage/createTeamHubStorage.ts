import { join } from 'path';
import { TeamHubStorage } from '#/main/storage/TeamHubStorage';
import { TeamHubIdMap } from '#/main/storage/TeamHubIdMap';
import { TeamHubClient } from '#/main/teamHub/TeamHubClient';
import type { TeamHub } from '#/shared/types';

/**
 * Returns the SQLite path for a team hub id map file.
 *
 * @param userDataPath - Electron userData directory.
 * @param hubId - Team hub connection id.
 */
export function teamHubIdMapPath(userDataPath: string, hubId: string): string {
  return join(userDataPath, `team-hub-${hubId}.db`);
}

/**
 * Creates and initializes a {@link TeamHubStorage} for the given hub.
 *
 * @param hub - Team hub connection settings.
 * @param userDataPath - Electron userData directory for the id map file.
 */
export async function createTeamHubStorage(
  hub: TeamHub,
  userDataPath: string
): Promise<TeamHubStorage> {
  const idMap = new TeamHubIdMap(teamHubIdMapPath(userDataPath, hub.id));
  idMap.init();
  const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
  const db = new TeamHubStorage(client, idMap);
  await db.init();
  return db;
}
