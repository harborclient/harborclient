import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import {
  applyRequestDraftUpdate,
  applyScriptUpdate,
  hasRequestUpdateFields,
  mergeKeyValues,
  type KeyValueListMode,
  type ScriptUpdateMode,
  type UpdateActiveRequestToolArgs
} from '#/shared/ai/requestUpdate';
import {
  AI_TOOL_NAMES,
  type AiToolName,
  type GetActiveResponseToolArgs,
  type ListRequestsToolArgs,
  type QueryResponseBodyToolArgs,
  type SearchDocsToolArgs,
  type SendActiveRequestToolArgs,
  type SetActiveEnvironmentToolArgs,
  type UpdateRequestScriptToolArgs
} from '#/shared/ai/tools';
import {
  DEFAULT_RESPONSE_BODY_CHARS,
  formatHttpResponseForAgent,
  queryJsonForAgent,
  type AgentHttpResponse,
  type FormatHttpResponseOptions,
  type QueryResponseBodyError,
  type QueryResponseBodyResult
} from '#/shared/ai/chatContext';
import { isMcpPrefixedToolName } from '#/shared/mcpToolNames';
import { hostFromUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/cookieHost';
import { isRequestTab, isTabDirty } from '#/renderer/src/store/drafts';
import { mirrorLegacyScriptString, resolveScriptSourceCode } from '#/shared/scriptRefs';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { setActiveDraft } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectActiveEnvironmentId,
  selectActiveTab,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectResponse,
  selectSelectedCollectionId,
  selectSnippets,
  selectTestResults
} from '#/renderer/src/store/selectors';
import type { RootState } from '#/renderer/src/store/redux';
import { sendRequest } from '#/renderer/src/store/thunks/requests';
import type {
  AuthConfig,
  BodyType,
  HttpMethod,
  KeyValue,
  ScriptRef,
  Snippet,
  Variable
} from '#/shared/types';

/**
 * Supported HTTP methods for update_active_request validation.
 */
const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
];

/**
 * Supported body types for update_active_request validation.
 */
const BODY_TYPES: readonly BodyType[] = ['none', 'json', 'text', 'multipart', 'urlencoded'];

/**
 * Supported list merge modes for update_active_request validation.
 */
const KEY_VALUE_MODES: readonly KeyValueListMode[] = ['merge', 'replace'];

/**
 * Supported script update modes for update_active_request validation.
 */
const SCRIPT_MODES: readonly ScriptUpdateMode[] = ['replace', 'append'];

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
  if (isMcpPrefixedToolName(name)) {
    try {
      return await window.api.mcpCallTool(name, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MCP tool execution failed.';
      return JSON.stringify({ error: message });
    }
  }

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
        return JSON.stringify(await getActiveRequestDetails(ctx.getState()));
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
      case 'update_active_request':
        return JSON.stringify(await updateActiveRequest(args, ctx));
      case 'update_request_script':
        return JSON.stringify(updateRequestScript(args, ctx));
      case 'search_docs':
        return await window.api.searchDocs(args as SearchDocsToolArgs);
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
  if (!tab || !isRequestTab(tab)) {
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
 * Compact script row summary for agent tool responses.
 */
interface AgentScriptSummary {
  /**
   * 1-based index matching @ref syntax.
   */
  index: number;

  /**
   * Optional display name for the script row.
   */
  name?: string;

  /**
   * Script source kind.
   */
  kind: ScriptRef['kind'];

  /**
   * Resolved JavaScript source (inline code or linked snippet body).
   */
  code: string;
}

/**
 * Formats script references for agent read tools with 1-based indices.
 *
 * @param scripts - Ordered script references for one phase.
 * @param snippets - Snippet library for resolving snippet-linked rows.
 * @returns Compact script summaries for the model.
 */
function formatScriptsForAgent(scripts: ScriptRef[], snippets: Snippet[]): AgentScriptSummary[] {
  return scripts.map((script, index) => ({
    index: index + 1,
    ...(script.name?.trim() ? { name: script.name.trim() } : {}),
    kind: script.kind,
    code: resolveScriptSourceCode(script, snippets)
  }));
}

/**
 * Returns the full draft of the active editor request including cookies for the URL host.
 *
 * @param state - Current Redux root state.
 */
async function getActiveRequestDetails(state: RootState): Promise<
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
      pre_request_scripts: AgentScriptSummary[];
      post_request_scripts: AgentScriptSummary[];
      comment: string;
      cookies: KeyValue[];
    }
  | { error: string }
> {
  const tab = selectActiveTab(state);
  if (!tab || !isRequestTab(tab)) {
    return { error: 'No active request tab.' };
  }
  const draft = tab.draft;
  const host = hostFromUrl(draft.url);
  const cookies = host ? await window.api.getCookies(host) : [];
  const snippets = selectSnippets(state);

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
    pre_request_scripts: formatScriptsForAgent(draft.pre_request_scripts, snippets),
    post_request_scripts: formatScriptsForAgent(draft.post_request_scripts, snippets),
    comment: draft.comment,
    cookies
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
  if (!tab || !isRequestTab(tab)) {
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

/**
 * Validates update_active_request tool arguments from the model.
 *
 * @param args - Parsed tool arguments.
 * @returns Normalized update arguments.
 */
function parseUpdateActiveRequestArgs(args: unknown): UpdateActiveRequestToolArgs {
  if (args == null || typeof args !== 'object') {
    throw new Error('Invalid update arguments.');
  }

  const parsed = args as UpdateActiveRequestToolArgs;

  if (!hasRequestUpdateFields(parsed)) {
    throw new Error('Provide at least one field to update.');
  }

  if (parsed.method !== undefined && !HTTP_METHODS.includes(parsed.method)) {
    throw new Error(`Invalid method: ${String(parsed.method)}`);
  }

  if (parsed.body_type !== undefined && !BODY_TYPES.includes(parsed.body_type)) {
    throw new Error(`Invalid body_type: ${String(parsed.body_type)}`);
  }

  for (const mode of [parsed.headers_mode, parsed.params_mode, parsed.cookies_mode] as const) {
    if (mode !== undefined && !KEY_VALUE_MODES.includes(mode)) {
      throw new Error(`Invalid list mode: ${String(mode)}`);
    }
  }

  for (const mode of [parsed.pre_request_script_mode, parsed.post_request_script_mode] as const) {
    if (mode !== undefined && !SCRIPT_MODES.includes(mode)) {
      throw new Error(`Invalid script mode: ${String(mode)}`);
    }
  }

  return parsed;
}

/**
 * Returns persisted cookie rows without editor trailing blank rows.
 *
 * @param rows - Cookie table rows.
 */
function cookiesForStorage(rows: KeyValue[]): KeyValue[] {
  return rows.filter((row) => row.key.trim() !== '' || row.value.trim() !== '');
}

/**
 * Applies a partial update to the active request draft and optional cookie jar.
 *
 * @param args - Parsed update_active_request tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
async function updateActiveRequest(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | {
      ok: true;
      changedFields: string[];
      isDirty: boolean;
      summary: {
        name: string;
        method: string;
        url: string;
        body_type: string;
      };
    }
  | { error: string }
> {
  const tab = selectActiveTab(ctx.getState());
  if (!tab || !isRequestTab(tab)) {
    return { error: 'No active request tab.' };
  }

  const parsed = parseUpdateActiveRequestArgs(args);
  const {
    draft: nextDraft,
    changedFields,
    hasCookieUpdate
  } = applyRequestDraftUpdate(tab.draft, parsed);

  ctx.dispatch(setActiveDraft(nextDraft));

  if (hasCookieUpdate && parsed.cookies !== undefined) {
    const host = hostFromUrl(nextDraft.url);
    if (!host) {
      throw new Error('Cannot update cookies without a parseable URL hostname.');
    }

    const currentCookies = await window.api.getCookies(host);
    const mergedCookies = mergeKeyValues(
      parsed.cookies_mode === 'replace' ? [] : currentCookies,
      parsed.cookies,
      parsed.cookies_mode ?? 'merge'
    );
    await window.api.setCookies(host, cookiesForStorage(mergedCookies));
  }

  const updatedTab = selectActiveTab(ctx.getState());
  if (!updatedTab || !isRequestTab(updatedTab)) {
    return { error: 'No active request tab.' };
  }

  return {
    ok: true,
    changedFields,
    isDirty: isTabDirty(updatedTab),
    summary: {
      name: nextDraft.name,
      method: nextDraft.method,
      url: nextDraft.url,
      body_type: nextDraft.body_type
    }
  };
}

/**
 * Parses and validates update_request_script tool arguments from the model.
 *
 * @param args - Raw parsed tool arguments.
 * @returns Validated update_request_script arguments.
 */
function parseUpdateRequestScriptArgs(args: unknown): UpdateRequestScriptToolArgs {
  if (args == null || typeof args !== 'object') {
    throw new Error('Tool arguments must be an object.');
  }

  const parsed = args as Partial<UpdateRequestScriptToolArgs> & {
    requestId?: number | 'active' | string;
  };
  let requestId: number | 'active' | undefined;
  const rawRequestId = parsed.requestId;
  if (typeof rawRequestId === 'string') {
    const trimmed = rawRequestId.trim();
    if (trimmed === 'active') {
      requestId = 'active';
    } else if (/^\d+$/.test(trimmed)) {
      requestId = Number(trimmed);
    }
  } else {
    requestId = rawRequestId;
  }
  const phase = parsed.phase;
  const scriptIndex = parsed.scriptIndex;
  const code = parsed.code;
  const mode = parsed.mode;

  if (requestId !== 'active' && (typeof requestId !== 'number' || !Number.isFinite(requestId))) {
    throw new Error('requestId must be a number or "active".');
  }

  if (phase !== 'pre' && phase !== 'post') {
    throw new Error('phase must be "pre" or "post".');
  }

  if (typeof scriptIndex !== 'number' || !Number.isInteger(scriptIndex) || scriptIndex < 1) {
    throw new Error('scriptIndex must be a positive integer.');
  }

  if (typeof code !== 'string') {
    throw new Error('code must be a string.');
  }

  if (mode !== undefined && !SCRIPT_MODES.includes(mode)) {
    throw new Error(`Invalid script mode: ${String(mode)}`);
  }

  return {
    requestId,
    phase,
    scriptIndex,
    code,
    ...(mode !== undefined ? { mode } : {})
  };
}

/**
 * Returns whether the request id from an @ reference matches the active tab draft.
 *
 * @param requestId - Saved id or "active" from the tool arguments.
 * @param draftId - Saved request id on the active draft, if any.
 */
function requestIdMatchesActiveTab(
  requestId: number | 'active',
  draftId: number | undefined
): boolean {
  if (requestId === 'active') {
    // "active" means the request open in the editor tab (saved or unsaved).
    return true;
  }
  return draftId === requestId;
}

/**
 * Updates one inline script in the active request draft by phase and 1-based index.
 *
 * @param args - Parsed update_request_script tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
function updateRequestScript(
  args: unknown,
  ctx: AiToolContext
): { ok: true; phase: 'pre' | 'post'; scriptIndex: number; isDirty: boolean } | { error: string } {
  const tab = selectActiveTab(ctx.getState());
  if (!tab || !isRequestTab(tab)) {
    return { error: 'No active request tab.' };
  }

  let parsed: UpdateRequestScriptToolArgs;
  try {
    parsed = parseUpdateRequestScriptArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid tool arguments.';
    return { error: message };
  }

  const draft = tab.draft;
  if (!requestIdMatchesActiveTab(parsed.requestId, draft.id)) {
    return {
      error:
        'The @ reference request id does not match the active request tab. Ask the user to open the referenced request first.'
    };
  }

  const scripts = parsed.phase === 'pre' ? draft.pre_request_scripts : draft.post_request_scripts;
  const arrayIndex = parsed.scriptIndex - 1;

  if (arrayIndex >= scripts.length) {
    return {
      error: `Script index ${parsed.scriptIndex} is out of range for ${parsed.phase} scripts (count: ${scripts.length}).`
    };
  }

  const target = scripts[arrayIndex];
  if (target.kind === 'snippet') {
    return {
      error:
        'Cannot edit a snippet-linked script via update_request_script. Ask the user to edit the snippet in the library or convert the row to inline code first.'
    };
  }

  const nextCode = applyScriptUpdate(target.code ?? '', parsed.code, parsed.mode ?? 'replace');

  const nextScripts = scripts.map((script, index) =>
    index === arrayIndex ? { ...script, code: nextCode } : script
  );

  const nextDraft =
    parsed.phase === 'pre'
      ? {
          ...draft,
          pre_request_scripts: nextScripts,
          pre_request_script: mirrorLegacyScriptString(nextScripts)
        }
      : {
          ...draft,
          post_request_scripts: nextScripts,
          post_request_script: mirrorLegacyScriptString(nextScripts)
        };

  ctx.dispatch(setActiveDraft(nextDraft));

  const updatedTab = selectActiveTab(ctx.getState());
  if (!updatedTab || !isRequestTab(updatedTab)) {
    return { error: 'No active request tab.' };
  }

  return {
    ok: true,
    phase: parsed.phase,
    scriptIndex: parsed.scriptIndex,
    isDirty: isTabDirty(updatedTab)
  };
}
