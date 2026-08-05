import { TeamHubClient } from '@harborclient/team-hub-api';
import type { TeamHub } from '@harborclient/core/types';

/**
 * Creates a TeamHubClient instance from hub connection settings.
 *
 * Normalizes tenantId by trimming whitespace and treating blank strings as
 * undefined so the server routes requests to the default tenant.
 *
 * @param hub - Team Hub connection settings with base URL, token, and optional tenantId.
 * @param options - Optional request timeout override.
 * @returns Configured TeamHubClient bound to the hub connection.
 */
export function createTeamHubClient(
  hub: Pick<TeamHub, 'baseUrl' | 'token' | 'tenantId'>,
  options?: { requestTimeoutMs?: number }
): TeamHubClient {
  const trimmedTenant = hub.tenantId?.trim();
  const tenantId = trimmedTenant && trimmedTenant.length > 0 ? trimmedTenant : undefined;

  return new TeamHubClient({
    baseUrl: hub.baseUrl,
    token: hub.token,
    tenantId,
    ...(options?.requestTimeoutMs ? { requestTimeoutMs: options.requestTimeoutMs } : {})
  });
}
