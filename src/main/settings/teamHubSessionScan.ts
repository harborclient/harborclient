import { TeamHubClient, TeamHubClientError } from '@harborclient/team-hub-api';
import type { TeamHub, TeamHubServiceFlags, TeamHubSessionScanResult } from '#/shared/types';

/**
 * Returns hub service flags with every service marked unavailable.
 */
function emptyServices(): TeamHubServiceFlags {
  return {
    storage: false,
    llm: false,
    pluginCatalog: false,
    snippets: false,
    admin: false
  };
}

/**
 * Probes whether the Team Hub server has LLM support configured.
 *
 * @param client - Authenticated Team Hub client.
 * @param managementApi - When true, probes the admin LLM models route.
 * @returns True when the LLM route responds without a 503 status.
 */
async function probeHubLlmEnabled(client: TeamHubClient, managementApi: boolean): Promise<boolean> {
  try {
    return await client.probeLlmServiceEnabled(managementApi);
  } catch {
    return false;
  }
}

/**
 * Probes whether the Team Hub server publishes plugin catalog or trusted URLs.
 *
 * @param client - Authenticated Team Hub client.
 * @returns True when at least one plugin source URL is configured.
 */
async function probePluginCatalogEnabled(client: TeamHubClient): Promise<boolean> {
  try {
    const sources = await client.getPluginSources();
    return sources.catalogs.length > 0 || sources.trusted.length > 0;
  } catch {
    return false;
  }
}

/**
 * Probes whether the Team Hub server exposes snippet storage routes.
 *
 * Snippets are core team hub storage alongside collections and environments.
 * A failed probe usually indicates a server version or base URL mismatch.
 *
 * @param client - Authenticated Team Hub client.
 * @returns True when `GET /snippets` is available on the hub server.
 */
async function probeSnippetsEnabled(client: TeamHubClient): Promise<boolean> {
  try {
    return await client.probeSnippetsServiceEnabled();
  } catch {
    return false;
  }
}

/**
 * Probes one team hub connection for server services and token capabilities.
 *
 * @param hub - Team hub connection to scan.
 * @returns Scan result with service flags, management capability, or a non-throwing error message.
 */
async function scanTeamHubSession(hub: TeamHub): Promise<TeamHubSessionScanResult> {
  const client = new TeamHubClient({ baseUrl: hub.baseUrl, token: hub.token });

  try {
    await client.checkHealth();
    const session = await client.getSession();
    const [llm, pluginCatalog, snippets] = await Promise.all([
      probeHubLlmEnabled(client, session.capabilities.managementApi),
      probePluginCatalogEnabled(client),
      probeSnippetsEnabled(client)
    ]);

    return {
      hubId: hub.id,
      services: {
        storage: true,
        admin: session.capabilities.managementApi,
        llm,
        pluginCatalog,
        snippets
      },
      managementApi: session.capabilities.managementApi
    };
  } catch (err) {
    const message =
      err instanceof TeamHubClientError || err instanceof Error ? err.message : String(err);

    return {
      hubId: hub.id,
      services: emptyServices(),
      managementApi: false,
      error: message
    };
  }
}

/**
 * Probes each configured team hub for server services and admin capabilities in parallel.
 *
 * Individual hub failures do not prevent scanning the rest of the list.
 *
 * @param hubs - Team hub connections to scan.
 * @returns One scan result per hub, in the same order as the input list.
 */
export async function scanTeamHubSessions(hubs: TeamHub[]): Promise<TeamHubSessionScanResult[]> {
  return Promise.all(hubs.map((hub) => scanTeamHubSession(hub)));
}
