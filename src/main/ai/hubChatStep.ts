import { TeamHubClient } from '#/main/teamHub/TeamHubClient';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/aiTools';
import type { ChatStepInput, ChatStepResult, HubLlmModelGroup } from '#/shared/types';

/**
 * Default timeout for hub-proxied LLM completion requests.
 */
const HUB_LLM_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Lists LLM models offered by each configured Team Hub.
 *
 * Hubs that are unreachable or have LLM disabled are skipped silently.
 */
export async function listHubLlmModels(): Promise<HubLlmModelGroup[]> {
  const hubs = listTeamHubs();
  const groups: HubLlmModelGroup[] = [];

  await Promise.all(
    hubs.map(async (hub) => {
      try {
        const client = new TeamHubClient({
          baseUrl: hub.baseUrl,
          token: hub.token,
          requestTimeoutMs: HUB_LLM_REQUEST_TIMEOUT_MS
        });
        const models = await client.listLlmModels();
        if (models.length > 0) {
          groups.push({
            hubId: hub.id,
            hubName: hub.name,
            models
          });
        }
      } catch {
        // Skip hubs that are offline or do not offer LLM access.
      }
    })
  );

  return groups.sort((left, right) => left.hubName.localeCompare(right.hubName));
}

/**
 * Runs one LLM completion step through a configured Team Hub proxy.
 *
 * @param input - Model id, messages, and target hub id from the renderer.
 * @returns Assistant text and/or tool calls for the renderer to execute.
 */
export async function runHubChatCompletionStep(input: ChatStepInput): Promise<ChatStepResult> {
  const hubId = input.hubId?.trim();
  if (!hubId) {
    throw new Error('Team Hub id is required for hub-proxied models.');
  }

  const hub = listTeamHubs().find((entry) => entry.id === hubId);
  if (!hub) {
    throw new Error('Team Hub not found.');
  }

  const client = new TeamHubClient({
    baseUrl: hub.baseUrl,
    token: hub.token,
    requestTimeoutMs: HUB_LLM_REQUEST_TIMEOUT_MS
  });

  return client.completeChatStep({
    model: input.model,
    messages: input.messages,
    tools: AI_TOOL_DEFINITIONS as unknown as Record<string, unknown>[],
    systemPrompt: AI_SYSTEM_PROMPT
  });
}
