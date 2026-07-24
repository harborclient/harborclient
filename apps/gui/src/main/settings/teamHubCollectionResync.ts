import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import { scanTeamHubSessions } from './teamHubSessionScan';
import type { TeamHub } from '#/shared/types';

/**
 * Normalizes a team hub base URL for sibling connection matching.
 *
 * @param baseUrl - Team hub base URL from settings.
 */
function normalizeTeamHubBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Re-syncs user-token team hub connections that share a server with an admin hub.
 *
 * Called after server-side user create/update so collection access changes appear
 * in HarborClient sidebars without restarting the app.
 *
 * @param router - Mounted routing storage instance.
 * @param adminHubId - Admin-token hub connection used for the management action.
 * @param hubs - All configured team hub connections.
 */
export async function resyncUserTeamHubsSharingServer(
  router: RoutingStorage,
  adminHubId: string,
  hubs: TeamHub[]
): Promise<void> {
  const adminHub = hubs.find((hub) => hub.id === adminHubId);
  if (!adminHub) {
    return;
  }

  const normalizedAdminUrl = normalizeTeamHubBaseUrl(adminHub.baseUrl);
  const sessionScans = await scanTeamHubSessions(hubs);
  const adminHubIds = new Set(
    sessionScans.filter((scan) => scan.managementApi).map((scan) => scan.hubId)
  );

  for (const hub of hubs) {
    if (hub.id === adminHubId) continue;
    if (adminHubIds.has(hub.id)) continue;
    if (normalizeTeamHubBaseUrl(hub.baseUrl) !== normalizedAdminUrl) continue;
    if (!router.isConnectionMounted(hub.id)) continue;
    await router.syncTeamHub(hub.id);
  }
}
