import { TeamHubClient } from '#/main/teamHub/TeamHubClient';
import { TeamHubClientError } from '#/main/teamHub/TeamHubClientError';
import type { TeamHub, TeamHubSessionScanResult } from '#/shared/types';

/**
 * Probes one team hub token for session capabilities.
 *
 * @param hub - Team hub connection to scan.
 * @returns Scan result with management capability or a non-throwing error message.
 */
async function scanTeamHubSession(hub: TeamHub): Promise<TeamHubSessionScanResult> {
  const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });

  try {
    const session = await client.getSession();
    return {
      hubId: hub.id,
      managementApi: session.capabilities.managementApi
    };
  } catch (err) {
    const message =
      err instanceof TeamHubClientError || err instanceof Error ? err.message : String(err);

    return {
      hubId: hub.id,
      managementApi: false,
      error: message
    };
  }
}

/**
 * Probes each configured team hub for admin capabilities in parallel.
 *
 * Individual hub failures do not prevent scanning the rest of the list.
 *
 * @param hubs - Team hub connections to scan.
 * @returns One scan result per hub, in the same order as the input list.
 */
export async function scanTeamHubSessions(hubs: TeamHub[]): Promise<TeamHubSessionScanResult[]> {
  return Promise.all(hubs.map((hub) => scanTeamHubSession(hub)));
}
