import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import {
  AI_TOOL_NAMES,
  type AiToolName,
  type GetActiveResponseToolArgs,
  type ListRequestsToolArgs,
  type QueryResponseBodyToolArgs,
  type SendActiveRequestToolArgs,
  type SetActiveEnvironmentToolArgs
} from '#/shared/aiTools';
import {
  DEFAULT_RESPONSE_BODY_CHARS,
  formatHttpResponseForAgent,
  queryJsonForAgent,
  type AgentHttpResponse,
  type FormatHttpResponseOptions,
  type QueryResponseBodyError,
  type QueryResponseBodyResult
} from '#/shared/aiChatContext';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  selectActiveEnvironmentId,
  selectActiveTab,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectResponse,
  selectSelectedCollectionId,
  selectTestResults
} from '#/renderer/src/store/selectors';
import { isTabDirty } from '#/renderer/src/store/drafts';
import type { RootState } from '#/renderer/src/store/redux';
import { sendRequest } from '#/renderer/src/store/thunks/requests';
import type { AuthConfig, KeyValue, Variable } from '#/shared/types';

/**
 * Context passed to tool handlers for reading state and dispatching actions.
 */
export interface AiToolContext {
  /**
   * Reads the current Redux root state.
   */
  getState: () => RootState;

  /**
   * Dispatches Redux actions and thunks.
   */
  dispatch: ThunkDispatch<RootState, unknown, UnknownAction>;
}

/**
 * Returns whether a string is a known AI tool name.
 *
 * @param name - Tool name from the model.
 */
function isAiToolName(name: string): name is AiToolName {
  return (AI_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Parses tool arguments JSON from the model.
 *
 * @param raw - Raw JSON string from a tool call.
 */
function parseToolArgs(raw: string): unknown {
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}

/**
 * Executes a Harbor app-state tool and returns a JSON string for the model.
 *
 * @param name - Tool name from the assistant message.
 * @param args - Parsed tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
export async function executeAiTool(
  name: string,
  args: unknown,
  ctx: AiToolContext
): Promise<string> {
  if (!isAiToolName(name)) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    switch (name) {
      case 'get_selected_collection':
        return JSON.stringify(getSelectedCollection(ctx.getState()));
      case 'list_collections':
        return JSON.stringify(listCollections(ctx.getState()));
      case 'list_requests':
        return JSON.stringify(await listRequests(args));
      case 'list_environments':
        return JSON.stringify(listEnvironments(ctx.getState()));
      case 'get_sidebar_request':
        return JSON.stringify(getSidebarRequest(ctx.getState()));
      case 'get_active_request':
        return JSON.stringify(getActiveRequest(ctx.getState()));
      case 'get_active_request_details':
        return JSON.stringify(getActiveRequestDetails(ctx.getState()));
      case 'get_active_response_summary':
        return JSON.stringify(getActiveResponseSummary(ctx.getState()));
      case 'get_active_response':
        return JSON.stringify(getActiveResponse(ctx.getState(), args));
      case 'query_response_body':
        return JSON.stringify(queryResponseBody(ctx.getState(), args));
      case 'send_active_request':
        return JSON.stringify(await sendActiveRequest(ctx, args));
      case 'set_active_environment':
        return JSON.stringify(setActiveEnvironment(args, ctx));
      default: {
        const exhaustive: never = name;
        return JSON.stringify({ error: `Unhandled tool: ${String(exhaustive)}` });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed.';
    return JSON.stringify({ error: message });
  }
}

/**
 * Executes a tool by name, parsing raw JSON arguments from the model.
 *
 * @param name - Tool name from the assistant message.
 * @param rawArgs - Raw JSON arguments string.
 * @param ctx - Redux getState and dispatch.
 */
export async function executeAiToolCall(
  name: string,
  rawArgs: string,
  ctx: AiToolContext
): Promise<string> {
  try {
    const args = parseToolArgs(rawArgs);
    return await executeAiTool(name, args, ctx);
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments JSON.' });
  }
}

/**
 * Returns the sidebar-selected collection summary.
 *
 * @param state - Current Redux root state.
 */
function getSelectedCollection(state: RootState): { id: number; name: string } | null {
  const selectedId = selectSelectedCollectionId(state);
  if (selectedId == null) return null;
  const collection = selectCollections(state).find((entry) => entry.id === selectedId);
  if (!collection) return null;
  return { id: collection.id, name: collection.name };
}

/**
 * Returns all collections with full configuration and selection flag.
 *
 * @param state - Current Redux root state.
 */
function listCollections(state: RootState): Array<{
  id: number;
  name: string;
  variables: Variable[];
  headers: KeyValue[];
  auth: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  isSelected: boolean;
}> {
  const selectedId = selectSelectedCollectionId(state);
  return selectCollections(state).map((collection) => ({
    id: collection.id,
    name: collection.name,
    variables: collection.variables,
    headers: collection.headers,
    auth: collection.auth,
    pre_request_script: collection.pre_request_script,
    post_request_script: collection.post_request_script,
    isSelected: collection.id === selectedId
  }));
}

/**
 * Returns saved requests for a collection.
 *
 * @param args - Tool arguments containing collectionId.
 */
async function listRequests(args: unknown): Promise<
  Array<{
    id: number;
    name: string;
    method: string;
    url: string;
    folderId: number | null;
  }>
> {
  const parsed = args as ListRequestsToolArgs;
  if (typeof parsed?.collectionId !== 'number') {
    throw new Error('collectionId is required.');
  }
  const requests = await window.api.listRequests(parsed.collectionId);
  return requests.map((request) => ({
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    folderId: request.folder_id
  }));
}

/**
 * Returns all environments with variables and active flag.
 *
 * @param state - Current Redux root state.
 */
function listEnvironments(state: RootState): Array<{
  id: number;
  name: string;
  variables: Variable[];
  isActive: boolean;
}> {
  const activeId = selectActiveEnvironmentId(state);
  return selectEnvironments(state).map((environment) => ({
    id: environment.id,
    name: environment.name,
    variables: environment.variables,
    isActive: environment.id === activeId
  }));
}

/**
 * Returns the saved request highlighted in the sidebar from the active tab draft.
 *
 * @param state - Current Redux root state.
 */
function getSidebarRequest(state: RootState): {
  id: number;
  name: string;
  collectionId: number | undefined;
  folderId: number | null | undefined;
} | null {
  const draft = selectDraft(state);
  if (draft.id == null) return null;
  return {
    id: draft.id,
    name: draft.name,
    collectionId: draft.collection_id,
    folderId: draft.folder_id
  };
}

/**
 * Returns summary info for the active editor tab request.
 *
 * @param state - Current Redux root state.
 */
function getActiveRequest(state: RootState):
  | {
    tabId: string;
    name: string;
    method: string;
    url: string;
    savedRequestId: number | null;
    isDirty: boolean;
  }
  | { error: string } {
  const tab = selectActiveTab(state);
  if (!tab) {
    return { error: 'No active request tab.' };
  }
  const draft = tab.draft;
  return {
    tabId: tab.tabId,
    name: draft.name,
    method: draft.method,
    url: draft.url,
    savedRequestId: draft.id ?? null,
    isDirty: isTabDirty(tab)
  };
}

/**
 * Returns the full draft of the active editor request.
 *
 * @param state - Current Redux root state.
 */
function getActiveRequestDetails(state: RootState):
  | {
    method: string;
    url: string;
    headers: KeyValue[];
    params: KeyValue[];
    auth: AuthConfig;
    body: string;
    body_type: string;
    pre_request_script: string;
    post_request_script: string;
    comment: string;
  }
  | { error: string } {
  const tab = selectActiveTab(state);
  if (!tab) {
    return { error: 'No active request tab.' };
  }
  const draft = tab.draft;
  return {
    method: draft.method,
    url: draft.url,
    headers: draft.headers,
    params: draft.params,
    auth: draft.auth,
    body: draft.body,
    body_type: draft.body_type,
    pre_request_script: draft.pre_request_script,
    post_request_script: draft.post_request_script,
    comment: draft.comment
  };
}

/**
 * Resolves maxBodyChars from get_active_response tool arguments with a safe default.
 *
 * @param args - Parsed tool arguments from the model.
 */
function resolveMaxBodyChars(args: unknown): number {
  const parsed = args as GetActiveResponseToolArgs;
  if (typeof parsed?.maxBodyChars === 'number' && parsed.maxBodyChars > 0) {
    return parsed.maxBodyChars;
  }
  return DEFAULT_RESPONSE_BODY_CHARS;
}

/**
 * Resolves response formatting for send_active_request: summary by default, capped body when requested.
 *
 * @param args - Parsed tool arguments from the model.
 */
function resolveSendResponseFormatOptions(args: unknown): FormatHttpResponseOptions {
  const parsed = args as SendActiveRequestToolArgs;
  if (typeof parsed?.maxBodyChars === 'number' && parsed.maxBodyChars > 0) {
    return { maxBodyChars: parsed.maxBodyChars };
  }
  return { mode: 'summary' };
}

/**
 * Returns a compact summary of the last HTTP response for the active tab.
 *
 * @param state - Current Redux root state.
 */
function getActiveResponseSummary(state: RootState): AgentHttpResponse | null {
  const response = selectResponse(state);
  if (!response) return null;
  return formatHttpResponseForAgent(response, selectTestResults(state), { mode: 'summary' });
}

/**
 * Returns the last HTTP response for the active tab with a capped body.
 *
 * @param state - Current Redux root state.
 * @param args - Optional maxBodyChars limit.
 */
function getActiveResponse(state: RootState, args: unknown): AgentHttpResponse | null {
  const response = selectResponse(state);
  if (!response) return null;
  return formatHttpResponseForAgent(response, selectTestResults(state), {
    maxBodyChars: resolveMaxBodyChars(args)
  });
}

/**
 * Evaluates a JMESPath expression against the active tab JSON response body.
 *
 * @param state - Current Redux root state.
 * @param args - Tool arguments with expression and optional maxResultChars.
 */
function queryResponseBody(
  state: RootState,
  args: unknown
): QueryResponseBodyResult | QueryResponseBodyError {
  const parsed = args as QueryResponseBodyToolArgs;
  if (typeof parsed?.expression !== 'string' || !parsed.expression.trim()) {
    return { error: 'expression is required.' };
  }

  const response = selectResponse(state);
  if (!response) {
    return { error: 'No HTTP response available. Send the request first.' };
  }

  const maxResultChars =
    typeof parsed.maxResultChars === 'number' && parsed.maxResultChars > 0
      ? parsed.maxResultChars
      : undefined;

  return queryJsonForAgent(
    response.body,
    parsed.expression.trim(),
    maxResultChars,
    response.headers['content-type'] ?? response.headers['Content-Type']
  );
}

/**
 * Sends the active tab request and returns a summary or capped full response.
 *
 * @param ctx - Redux getState and dispatch.
 * @param args - Optional maxBodyChars to include a capped body instead of summary-only output.
 */
async function sendActiveRequest(
  ctx: AiToolContext,
  args: unknown
): Promise<AgentHttpResponse | { error: string }> {
  const state = ctx.getState();
  const tab = selectActiveTab(state);
  if (!tab) {
    return { error: 'No active request tab.' };
  }
  if (tab.sending) {
    return { error: 'A request is already in progress.' };
  }

  await ctx.dispatch(sendRequest()).unwrap();

  const nextState = ctx.getState();
  const response = selectResponse(nextState);
  if (!response) {
    return { error: 'Request finished without a response.' };
  }

  return formatHttpResponseForAgent(
    response,
    selectTestResults(nextState),
    resolveSendResponseFormatOptions(args)
  );
}

/**
 * Sets the global active environment by id or name.
 *
 * @param args - Tool arguments with environmentId and/or name.
 * @param ctx - Redux getState and dispatch.
 */
function setActiveEnvironment(
  args: unknown,
  ctx: AiToolContext
): { activeEnvironmentId: number | null; name: string | null } {
  const parsed = args as SetActiveEnvironmentToolArgs;
  const environments = selectEnvironments(ctx.getState());

  if (parsed?.environmentId === null) {
    ctx.dispatch(setActiveEnvironmentId(null));
    return { activeEnvironmentId: null, name: null };
  }

  if (typeof parsed?.environmentId === 'number') {
    const match = environments.find((environment) => environment.id === parsed.environmentId);
    if (!match) {
      throw new Error(`Environment id ${parsed.environmentId} not found.`);
    }
    ctx.dispatch(setActiveEnvironmentId(match.id));
    return { activeEnvironmentId: match.id, name: match.name };
  }

  if (typeof parsed?.name === 'string' && parsed.name.trim()) {
    const target = parsed.name.trim().toLowerCase();
    const match = environments.find(
      (environment) => environment.name.trim().toLowerCase() === target
    );
    if (!match) {
      throw new Error(`Environment "${parsed.name}" not found.`);
    }
    ctx.dispatch(setActiveEnvironmentId(match.id));
    return { activeEnvironmentId: match.id, name: match.name };
  }

  throw new Error('Provide environmentId or name.');
}
