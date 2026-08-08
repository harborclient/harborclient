import { TeamHubClientError, type TeamHubClient } from '@harborclient/team-hub-api';
import { createTeamHubClient } from './teamHubClient';
import { getTeamHubDeviceEnrollmentStatus } from './teamHubDeviceEnrollment';
import { setHubOpenAiCapability } from '#/main/ai/hubCapabilities';
import type {
  TeamHub,
  TeamHubServiceFlags,
  TeamHubSessionScanResult
} from '@harborclient/core/types';

/**
 * Returns hub service flags with every service marked unavailable.
 */
function emptyServices(): TeamHubServiceFlags {
  return {
    storage: false,
    llm: false,
    openai: false,
    pluginCatalog: false,
    snippets: false,
    liveServers: false,
    livePages: false,
    communication: false,
    admin: false
  };
}

/**
 * Probes hub LLM availability and OpenAI capability flags.
 *
 * @param client - Authenticated Team Hub client.
 * @param managementApi - When true, probes the admin LLM models route.
 */
async function probeHubLlmCapabilities(
  client: TeamHubClient,
  managementApi: boolean
): Promise<{ llm: boolean; openai: boolean }> {
  try {
    const listing = managementApi
      ? await client.listAdminLlmModels()
      : await client.listLlmModels();
    return {
      llm: true,
      openai: listing.capabilities.openai
    };
  } catch {
    return { llm: false, openai: false };
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
 * Probes provider-backed live-server and live-page route availability.
 *
 * @param client - Authenticated Team Hub client.
 * @returns Route support flags for storage pickers.
 */
async function probeLiveEntityServices(
  client: TeamHubClient
): Promise<{ liveServers: boolean; livePages: boolean }> {
  const [liveServers, livePages] = await Promise.all([
    client
      .listLiveServers()
      .then(() => true)
      .catch(() => false),
    client
      .listLivePages()
      .then(() => true)
      .catch(() => false)
  ]);
  return { liveServers, livePages };
}

/**
 * Probes whether the Team Hub server exposes discussion routes.
 *
 * @param client - Authenticated Team Hub client.
 * @param sessionFlag - Communication capability reported by session introspection.
 */
async function probeCommunicationEnabled(
  client: TeamHubClient,
  sessionFlag: boolean | undefined
): Promise<boolean> {
  if (sessionFlag === true) {
    return true;
  }
  if (sessionFlag === false) {
    return false;
  }

  try {
    return await client.probeCommunicationServiceEnabled();
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
  const client = createTeamHubClient(hub);

  try {
    await client.checkHealth();
    const session = await client.getSession();
    const [llmCapabilities, pluginCatalog, snippets, liveEntities, communication] =
      await Promise.all([
        session.capabilities.llm || session.capabilities.managementApi
          ? probeHubLlmCapabilities(client, session.capabilities.managementApi)
          : Promise.resolve({ llm: false, openai: false }),
        probePluginCatalogEnabled(client),
        probeSnippetsEnabled(client),
        probeLiveEntityServices(client),
        probeCommunicationEnabled(client, session.capabilities.communication)
      ]);

    setHubOpenAiCapability(hub.id, llmCapabilities.openai);

    let deviceEnrolled: boolean | undefined;
    if (session.capabilities.discussionE2ee === true) {
      try {
        const enrollment = await getTeamHubDeviceEnrollmentStatus(hub);
        deviceEnrolled = enrollment.isActiveEnrollment;
      } catch {
        deviceEnrolled = false;
      }
    }

    return {
      hubId: hub.id,
      services: {
        storage: true,
        admin: session.capabilities.managementApi,
        llm: llmCapabilities.llm,
        openai: llmCapabilities.openai,
        pluginCatalog,
        snippets,
        communication,
        ...liveEntities
      },
      managementApi: session.capabilities.managementApi,
      communicationAccess: session.capabilities.communication === true,
      discussionE2ee: session.capabilities.discussionE2ee === true,
      ...(deviceEnrolled != null ? { deviceEnrolled } : {}),
      user: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        ...(session.user.avatarInitials ? { avatarInitials: session.user.avatarInitials } : {}),
        ...(session.user.avatarColor ? { avatarColor: session.user.avatarColor } : {}),
        ...(session.user.avatarImageUrl ? { avatarImageUrl: session.user.avatarImageUrl } : {})
      },
      ...(session.hub
        ? {
            hubAvatar: {
              name: session.hub.name,
              initials: session.hub.initials,
              color: session.hub.color
            }
          }
        : {})
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
