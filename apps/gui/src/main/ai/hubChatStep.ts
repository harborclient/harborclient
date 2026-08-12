import { readAiChatStreamBody, TEAM_HUB_TENANT_HEADER } from '@harborclient/team-hub-api';
import { createTeamHubClient } from '#/main/settings/teamHubClient';
import { getHubOpenAiCapability, setHubOpenAiCapability } from './hubCapabilities';
import { logVerbose } from '#/main/logger';
import { mergeMcpClientTools } from '#/main/mcp/mergeMcpClientTools';
import { listConnectedTeamHubs } from '#/main/settings/teamHubSettings';
import { pushAiChatStreamMessage } from './pushAiChatStreamMessage';
import { resolveChatStepMode } from '@harborclient/core/ai/chatStepMode';
import type {
  AiChatStreamContext,
  ChatStepInput,
  ChatStepResult,
  HubLlmModelGroup
} from '@harborclient/core/types';

/**
 * Optional runtime controls for one hub chat step.
 */
interface HubChatStepOptions {
  /**
   * Aborts the in-flight hub request when the user stops generation.
   */
  signal?: AbortSignal;

  /**
   * Desktop routing metadata that enables canonical Team Hub streaming.
   */
  streamContext?: AiChatStreamContext;
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

  /**
   * Tenant identifier for multitenancy mode.
   *
   * When omitted or blank, requests route to the default tenant.
   */
  tenantId?: string;
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
 * Logs each tool call's name and arguments in verbose mode (`-v`) so hub-proxied
 * tool usage can be inspected in the terminal without opening DevTools.
 *
 * @param result - Chat step result returned by the hub proxy.
 */
function logToolCalls(result: ChatStepResult): void {
  for (const call of result.toolCalls ?? []) {
    logVerbose('[ai-tool-call]', call.name, call.arguments);
  }
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
 * @param streamContext - Optional desktop routing metadata enabling SSE.
 */
async function fetchHubChatStep(
  hub: HubConnection,
  input: ChatStepInput,
  signal: AbortSignal,
  streamContext?: AiChatStreamContext
): Promise<ChatStepResult> {
  const combinedSignal = AbortSignal.any([AbortSignal.timeout(HUB_LLM_REQUEST_TIMEOUT_MS), signal]);
  const hubId = input.hubId?.trim();
  const stepMode = resolveChatStepMode(input, {
    hubHasOpenAi: hubId ? getHubOpenAiCapability(hubId) : undefined
  });
  const tools = mergeMcpClientTools(stepMode);

  const headers: Record<string, string> = {
    'Accept': streamContext ? 'text/event-stream' : 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${hub.token}`
  };

  if (hub.tenantId) {
    headers[TEAM_HUB_TENANT_HEADER] = hub.tenantId;
  }

  let response: Response;
  try {
    response = await fetch(
      `${hub.baseUrl}${streamContext ? '/llm/chat/stream' : '/llm/chat/step'}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: input.model,
          messages: stepMode.messages,
          tools,
          systemPrompt: stepMode.systemPrompt,
          ...(streamContext
            ? { turnId: streamContext.turnId, stepIndex: streamContext.stepIndex }
            : {})
        }),
        signal: combinedSignal
      }
    );
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

  if (streamContext) {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      throw new Error('Response Content-Type is not text/event-stream');
    }
    if (!response.body) {
      throw new Error('AI chat stream response has no body');
    }

    const result = await readAiChatStreamBody(
      response.body,
      {
        onEvent: (event) => pushAiChatStreamMessage(streamContext.chatId, event)
      },
      combinedSignal
    );
    logToolCalls(result);
    return result;
  }

  const json = (await response.json()) as ChatStepResult;
  const result: ChatStepResult = {
    content: json.content ?? null,
    ...(json.toolCalls && json.toolCalls.length > 0 ? { toolCalls: json.toolCalls } : {})
  };
  logToolCalls(result);
  return result;
}

/**
 * Lists LLM models offered by each configured Team Hub.
 *
 * Hubs that are unreachable or have LLM disabled are skipped silently.
 */
export async function listHubLlmModels(): Promise<HubLlmModelGroup[]> {
  const hubs = listConnectedTeamHubs();
  const groups: HubLlmModelGroup[] = [];

  await Promise.all(
    hubs.map(async (hub) => {
      try {
        const client = createTeamHubClient(hub, {
          requestTimeoutMs: HUB_LLM_REQUEST_TIMEOUT_MS
        });
        const listing = await client.listLlmModels();
        setHubOpenAiCapability(hub.id, listing.capabilities.openai);
        if (listing.models.length > 0) {
          groups.push({
            hubId: hub.id,
            hubName: hub.name,
            models: listing.models,
            hasOpenAi: listing.capabilities.openai
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

  const hub = listConnectedTeamHubs().find((entry) => entry.id === hubId);
  if (!hub) {
    throw new Error('Team Hub is not connected.');
  }

  const connection: HubConnection = {
    baseUrl: hub.baseUrl.replace(/\/+$/, ''),
    token: hub.token,
    tenantId: hub.tenantId
  };

  if (options?.signal) {
    return fetchHubChatStep(connection, input, options.signal, options.streamContext);
  }

  const client = createTeamHubClient(hub, {
    requestTimeoutMs: HUB_LLM_REQUEST_TIMEOUT_MS
  });

  const stepMode = resolveChatStepMode(input, {
    hubHasOpenAi: getHubOpenAiCapability(hubId)
  });
  const tools = mergeMcpClientTools(stepMode);

  const request = {
    model: input.model,
    messages: stepMode.messages,
    tools: tools as unknown as Record<string, unknown>[],
    systemPrompt: stepMode.systemPrompt
  };
  const streamContext = options?.streamContext;
  const result = streamContext
    ? await client.completeChatStepStream(
        {
          ...request,
          turnId: streamContext.turnId,
          stepIndex: streamContext.stepIndex
        },
        {
          onEvent: (event) => pushAiChatStreamMessage(streamContext.chatId, event)
        }
      )
    : await client.completeChatStep(request);
  logToolCalls(result);
  return result;
}
