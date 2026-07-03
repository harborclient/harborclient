import { TeamHubClient } from '@harborclient/team-hub-api';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS } from '#/shared/aiTools';
import type { ChatStepInput, ChatStepResult, HubLlmModelGroup } from '#/shared/types';

/**
 * Optional runtime controls for one hub chat step.
 */
interface HubChatStepOptions {
  /**
   * Aborts the in-flight hub request when the user stops generation.
   */
  signal?: AbortSignal;
}

/**
 * Default timeout for hub-proxied LLM completion requests.
 */
const HUB_LLM_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Team Hub connection fields needed for abortable chat step requests.
 */
interface HubConnection {
  /**
   * Hub base URL without trailing slash.
   */
  baseUrl: string;

  /**
   * Bearer token for hub API access.
   */
  token: string;
}

/**
 * Returns whether an error represents a user-initiated request abort.
 *
 * @param error - Error thrown by fetch or the hub client.
 */
function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Parses a failed hub response into a human-readable error message.
 *
 * @param response - Non-success fetch response.
 */
async function parseHubErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const json = (await response.json()) as { error?: string };
      if (typeof json.error === 'string' && json.error.length > 0) {
        return json.error;
      }
    } catch {
      // Fall through to status-based message.
    }
  }
  return `Request failed with status ${response.status}`;
}

/**
 * Runs one hub-proxied chat step with an external abort signal wired into fetch.
 *
 * @param hub - Target hub connection details.
 * @param input - Model and conversation messages for the step.
 * @param signal - Abort signal from the chat step tracker.
 */
async function fetchHubChatStep(
  hub: HubConnection,
  input: ChatStepInput,
  signal: AbortSignal
): Promise<ChatStepResult> {
  const combinedSignal = AbortSignal.any([AbortSignal.timeout(HUB_LLM_REQUEST_TIMEOUT_MS), signal]);

  let response: Response;
  try {
    response = await fetch(`${hub.baseUrl}/llm/chat/step`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hub.token}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        tools: AI_TOOL_DEFINITIONS,
        systemPrompt: AI_SYSTEM_PROMPT
      }),
      signal: combinedSignal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const message =
      error instanceof Error && error.name === 'TimeoutError'
        ? `Request timed out after ${HUB_LLM_REQUEST_TIMEOUT_MS} ms`
        : error instanceof Error
          ? error.message
          : 'Unknown network error';
    throw new Error(message);
  }

  if (!response.ok) {
    throw new Error(await parseHubErrorMessage(response));
  }

  const json = (await response.json()) as ChatStepResult;
  return {
    content: json.content ?? null,
    ...(json.toolCalls && json.toolCalls.length > 0 ? { toolCalls: json.toolCalls } : {})
  };
}

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
 * @param options - Optional abort signal for user cancellation.
 * @returns Assistant text and/or tool calls for the renderer to execute.
 */
export async function runHubChatCompletionStep(
  input: ChatStepInput,
  options?: HubChatStepOptions
): Promise<ChatStepResult> {
  const hubId = input.hubId?.trim();
  if (!hubId) {
    throw new Error('Team Hub id is required for hub-proxied models.');
  }

  const hub = listTeamHubs().find((entry) => entry.id === hubId);
  if (!hub) {
    throw new Error('Team Hub not found.');
  }

  const connection: HubConnection = {
    baseUrl: hub.baseUrl.replace(/\/+$/, ''),
    token: hub.token
  };

  if (options?.signal) {
    return fetchHubChatStep(connection, input, options.signal);
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
