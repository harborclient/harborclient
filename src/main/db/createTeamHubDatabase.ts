import { join } from 'path';
import { TeamHubDatabase } from '#/main/db/TeamHubDatabase';
import { TeamHubIdMap } from '#/main/db/TeamHubIdMap';
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
 * Creates and initializes a {@link TeamHubDatabase} for the given hub.
 *
 * @param hub - Team hub connection settings.
 * @param userDataPath - Electron userData directory for the id map file.
 */
export async function createTeamHubDatabase(
  hub: TeamHub,
  userDataPath: string
): Promise<TeamHubDatabase> {
  const idMap = new TeamHubIdMap(teamHubIdMapPath(userDataPath, hub.id));
  idMap.init();
  const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });
  const db = new TeamHubDatabase(client, idMap);
  await db.init();
  return db;
}
