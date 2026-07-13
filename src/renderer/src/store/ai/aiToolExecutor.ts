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
  type CreateCollectionToolArgs,
  type CreateFolderToolArgs,
  type CreateRequestToolArgs,
  type GetActiveResponseToolArgs,
  type GetActiveTerminalLinesToolArgs,
  type GetSidebarItemByUuidToolArgs,
  type GitDiffToolArgs,
  type ListRequestsToolArgs,
  type QueryResponseBodyToolArgs,
  type SearchDocsToolArgs,
  type SendActiveRequestToolArgs,
  type SetActiveEnvironmentToolArgs,
  type TerminalExecToolArgs,
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
import {
  isMarkdownTab,
  isRequestTab,
  isTabDirty,
  type RequestTab
} from '#/renderer/src/store/drafts';
import { mirrorLegacyScriptString, resolveScriptSourceCode } from '#/shared/scriptRefs';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { selectShowTerminal } from '#/renderer/src/store/slices/navigationSlice';
import { updateTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectActiveEnvironmentId,
  selectEffectiveActiveRequestTab,
  selectCollections,
  selectDocumentsByCollection,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectSelectedCollectionId,
  selectSnippets,
  selectTabs
} from '#/renderer/src/store/selectors';
import type { RootState } from '#/renderer/src/store/redux';
import { sendRequest } from '#/renderer/src/store/thunks/requests';
import { selectActiveTerminal, selectTerminals } from '#/renderer/src/store/slices/terminalsSlice';
import { getTerminalInstance } from '#/renderer/src/ui/Footer/TerminalPanel/terminalRegistry';
import { readTerminalBufferLines } from '#/renderer/src/ui/Footer/TerminalPanel/terminalSelection';
import {
  createCollectionFromPlugin,
  pluginRequestToSaveInput,
  validateCreateCollectionPayload
} from '#/renderer/src/plugins/hostRequestCommands';
import type { CreateCollectionRequest } from '@harborclient/sdk';
import { createFolder, refreshRequests } from '#/renderer/src/store/thunks/collections';
import type { OperatingSystemInfo } from '#/shared/types';
import type {
  AuthConfig,
  BodyType,
  Collection,
  CollectionDocument,
  Folder,
  HttpMethod,
  KeyValue,
  SavedRequest,
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
 * Maximum number of terminal output lines returned by get_active_terminal_lines per call.
 */
const MAX_TERMINAL_LINES = 2000;

/**
 * Maximum characters terminal_exec may write to the active shell per call.
 */
const MAX_TERMINAL_EXEC_INPUT_CHARS = 8192;

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
      case 'get_collection':
        return JSON.stringify(getCollection(args, ctx.getState()));
      case 'list_requests':
        return JSON.stringify(await listRequests(args));
      case 'get_folder':
        return JSON.stringify(await getFolder(args, ctx.getState()));
      case 'get_request':
        return JSON.stringify(await getRequest(args, ctx.getState()));
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
      case 'create_collection':
        return JSON.stringify(await createCollectionTool(args, ctx));
      case 'create_folder':
        return JSON.stringify(await createFolderTool(args, ctx));
      case 'create_request':
        return JSON.stringify(await createRequestTool(args, ctx));
      case 'search_docs':
        return await window.api.searchDocs(args as SearchDocsToolArgs);
      case 'git_diff':
        return await window.api.gitDiff(args as GitDiffToolArgs);
      case 'get_active_terminal':
        return JSON.stringify(getActiveTerminalInfo(ctx.getState()));
      case 'get_active_terminal_lines':
        return JSON.stringify(getActiveTerminalLines(ctx.getState(), args));
      case 'terminal_exec':
        return JSON.stringify(terminalExec(ctx.getState(), args));
      case 'get_markdown_document':
        return JSON.stringify(await getMarkdownDocument(args, ctx.getState()));
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
 * Formats one collection for agent tool responses.
 *
 * @param collection - Collection record from storage or Redux.
 */
function formatCollectionForAgent(collection: Collection): {
  id: number;
  uuid: string;
  name: string;
  connectionId?: string;
  variables: Variable[];
  headers: KeyValue[];
  auth: AuthConfig;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
} {
  return {
    id: collection.id,
    uuid: collection.uuid,
    name: collection.name,
    ...(collection.connectionId ? { connectionId: collection.connectionId } : {}),
    variables: collection.variables,
    headers: collection.headers,
    auth: collection.auth,
    pre_request_script: collection.pre_request_script,
    post_request_script: collection.post_request_script,
    pre_request_scripts: collection.pre_request_scripts,
    post_request_scripts: collection.post_request_scripts
  };
}

/**
 * Parses uuid arguments for sidebar item lookup tools.
 *
 * @param args - Parsed tool arguments from the model.
 */
function parseSidebarItemUuidArgs(args: unknown): string {
  const parsed = args as GetSidebarItemByUuidToolArgs;
  if (typeof parsed?.uuid !== 'string' || !parsed.uuid.trim()) {
    throw new Error('uuid is required.');
  }

  return parsed.uuid.trim();
}

/**
 * Returns one collection by uuid from Redux.
 *
 * @param args - Tool arguments containing uuid.
 * @param state - Current Redux root state.
 */
function getCollection(
  args: unknown,
  state: RootState
): ReturnType<typeof formatCollectionForAgent> | { error: string } {
  const uuid = parseSidebarItemUuidArgs(args);
  const collection = selectCollections(state).find((entry) => entry.uuid === uuid);
  if (collection == null) {
    return { error: `Collection with uuid "${uuid}" not found.` };
  }

  return formatCollectionForAgent(collection);
}

/**
 * Finds one folder by uuid in cached Redux state.
 *
 * @param state - Current Redux root state.
 * @param uuid - Folder uuid to locate.
 */
function findFolderInState(state: RootState, uuid: string): Folder | undefined {
  for (const folders of Object.values(selectFoldersByCollection(state))) {
    const match = folders.find((folder) => folder.uuid === uuid);
    if (match != null) {
      return match;
    }
  }

  return undefined;
}

/**
 * Returns one folder by uuid, falling back to IPC when not cached in Redux.
 *
 * @param args - Tool arguments containing uuid.
 * @param state - Current Redux root state.
 */
async function getFolder(args: unknown, state: RootState): Promise<Folder | { error: string }> {
  const uuid = parseSidebarItemUuidArgs(args);
  const cached = findFolderInState(state, uuid);
  if (cached != null) {
    return cached;
  }

  for (const collection of selectCollections(state)) {
    const folders = await window.api.listFolders(collection.id);
    const match = folders.find((folder) => folder.uuid === uuid);
    if (match != null) {
      return match;
    }
  }

  return { error: `Folder with uuid "${uuid}" not found.` };
}

/**
 * Finds one saved request by uuid in cached Redux state.
 *
 * @param state - Current Redux root state.
 * @param uuid - Saved request uuid to locate.
 */
function findRequestInState(state: RootState, uuid: string): SavedRequest | undefined {
  for (const requests of Object.values(selectRequestsByCollection(state))) {
    const match = requests.find((request) => request.uuid === uuid);
    if (match != null) {
      return match;
    }
  }

  return undefined;
}

/**
 * Returns one saved request by uuid, falling back to IPC when not cached in Redux.
 *
 * @param args - Tool arguments containing uuid.
 * @param state - Current Redux root state.
 */
async function getRequest(
  args: unknown,
  state: RootState
): Promise<SavedRequest | { error: string }> {
  const uuid = parseSidebarItemUuidArgs(args);
  const cached = findRequestInState(state, uuid);
  if (cached != null) {
    return cached;
  }

  for (const collection of selectCollections(state)) {
    const requests = await window.api.listRequests(collection.id);
    const match = requests.find((request) => request.uuid === uuid);
    if (match != null) {
      return match;
    }
  }

  return { error: `Request with uuid "${uuid}" not found.` };
}

/**
 * Finds one collection markdown document by uuid in cached Redux state.
 *
 * @param state - Current Redux root state.
 * @param uuid - Collection document uuid to locate.
 */
function findDocumentInState(state: RootState, uuid: string): CollectionDocument | undefined {
  for (const documents of Object.values(selectDocumentsByCollection(state))) {
    const match = documents.find((document) => document.uuid === uuid);
    if (match != null) {
      return match;
    }
  }

  return undefined;
}

/**
 * Returns one markdown document or saved request comment by uuid.
 *
 * Prefers the open markdown editor tab, then cached collection documents, then
 * saved request comments resolved by the same uuid.
 *
 * @param args - Tool arguments containing uuid.
 * @param state - Current Redux root state.
 */
async function getMarkdownDocument(
  args: unknown,
  state: RootState
): Promise<{ name: string; content: string } | { error: string }> {
  const uuid = parseSidebarItemUuidArgs(args);

  for (const tab of selectTabs(state)) {
    if (!isMarkdownTab(tab)) {
      continue;
    }

    const document = findDocumentInState(state, uuid);
    if (document != null && document.id === tab.docId) {
      return {
        name: tab.name,
        content: tab.content
      };
    }
  }

  const activeRequestTab = selectEffectiveActiveRequestTab(state);
  if (activeRequestTab?.draft.id != null) {
    const activeRequest = findRequestInState(state, uuid);
    if (activeRequest != null && activeRequest.id === activeRequestTab.draft.id) {
      return {
        name: `Comment: ${activeRequestTab.draft.name}`,
        content: activeRequestTab.draft.comment
      };
    }
  }

  const cachedDocument = findDocumentInState(state, uuid);
  if (cachedDocument != null) {
    return {
      name: cachedDocument.name,
      content: cachedDocument.content
    };
  }

  const requestResult = await getRequest(args, state);
  if ('error' in requestResult) {
    return { error: `Markdown document with uuid "${uuid}" not found.` };
  }

  return {
    name: `Comment: ${requestResult.name}`,
    content: requestResult.comment
  };
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
 * Returns a request tab by tab id from the open tab list.
 *
 * @param state - Current Redux root state.
 * @param tabId - Request tab id to resolve.
 */
function findRequestTabById(state: RootState, tabId: string): RequestTab | undefined {
  const tab = state.tabs.tabs.find((entry) => entry.tabId === tabId);
  return tab && isRequestTab(tab) ? tab : undefined;
}

/**
 * Returns the saved request highlighted in the sidebar from the effective active request tab.
 *
 * @param state - Current Redux root state.
 */
function getSidebarRequest(state: RootState): {
  id: number;
  name: string;
  collectionId: number | undefined;
  folderId: number | null | undefined;
} | null {
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab) return null;
  const draftId = tab.draft.id;
  if (draftId == null) return null;
  const draft = tab.draft;
  return {
    id: draftId,
    name: draft.name,
    collectionId: draft.collection_id,
    folderId: draft.folder_id
  };
}

/**
 * Returns summary info for the effective active request tab.
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
  const tab = selectEffectiveActiveRequestTab(state);
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
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab) {
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
 * Returns a compact summary of the last HTTP response for the effective active request tab.
 *
 * @param state - Current Redux root state.
 */
function getActiveResponseSummary(state: RootState): AgentHttpResponse | null {
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab || !tab.response) return null;
  return formatHttpResponseForAgent(tab.response, tab.testResults, { mode: 'summary' });
}

/**
 * Returns the last HTTP response for the effective active request tab with a capped body.
 *
 * @param state - Current Redux root state.
 * @param args - Optional maxBodyChars limit.
 */
function getActiveResponse(state: RootState, args: unknown): AgentHttpResponse | null {
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab || !tab.response) return null;
  return formatHttpResponseForAgent(tab.response, tab.testResults, {
    maxBodyChars: resolveMaxBodyChars(args)
  });
}

/**
 * Evaluates a JMESPath expression against the effective active request tab JSON response body.
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

  const tab = selectEffectiveActiveRequestTab(state);
  const response = tab?.response;
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
 * Returns summary info for the active footer terminal tab.
 *
 * @param state - Current Redux root state.
 */
function getActiveTerminalInfo(state: RootState):
  | {
      terminalId: string;
      title: string;
      terminalIndex: number;
      totalLines: number;
      operatingSystem: OperatingSystemInfo;
    }
  | { error: string } {
  const activeTerminal = selectActiveTerminal(state);
  if (activeTerminal == null) {
    return { error: 'No active terminal.' };
  }

  const terminal = getTerminalInstance(activeTerminal.id);
  if (terminal == null) {
    return { error: 'Active terminal is not ready yet.' };
  }

  const terminals = selectTerminals(state);
  const terminalIndex = terminals.findIndex((entry) => entry.id === activeTerminal.id) + 1;

  return {
    terminalId: activeTerminal.id,
    title: activeTerminal.title,
    terminalIndex,
    totalLines: terminal.buffer.active.length,
    operatingSystem: window.operatingSystemInfo
  };
}

/**
 * Returns a 1-based inclusive line range from the active footer terminal output.
 *
 * @param state - Current Redux root state.
 * @param args - Tool arguments with startLine and endLine.
 */
function getActiveTerminalLines(
  state: RootState,
  args: unknown
):
  | {
      startLine: number;
      endLine: number;
      totalLines: number;
      lines: string;
      linesTruncated?: boolean;
    }
  | { error: string } {
  const parsed = args as GetActiveTerminalLinesToolArgs;
  if (typeof parsed?.startLine !== 'number' || typeof parsed?.endLine !== 'number') {
    return { error: 'startLine and endLine are required numbers.' };
  }

  if (!Number.isFinite(parsed.startLine) || !Number.isFinite(parsed.endLine)) {
    return { error: 'startLine and endLine must be finite numbers.' };
  }

  if (parsed.startLine < 1 || parsed.endLine < 1) {
    return { error: 'startLine and endLine must be at least 1.' };
  }

  if (parsed.startLine > parsed.endLine) {
    return { error: 'startLine must be less than or equal to endLine.' };
  }

  const activeTerminal = selectActiveTerminal(state);
  if (activeTerminal == null) {
    return { error: 'No active terminal.' };
  }

  const terminal = getTerminalInstance(activeTerminal.id);
  if (terminal == null) {
    return { error: 'Active terminal is not ready yet.' };
  }

  const totalLines = terminal.buffer.active.length;
  if (totalLines === 0) {
    return {
      startLine: parsed.startLine,
      endLine: parsed.endLine,
      totalLines,
      lines: ''
    };
  }

  const clampedStart = Math.max(1, Math.min(parsed.startLine, totalLines));
  const clampedEnd = Math.min(parsed.endLine, totalLines);
  const requestedLineCount = clampedEnd - clampedStart + 1;
  const linesTruncated = requestedLineCount > MAX_TERMINAL_LINES;
  const effectiveEnd = linesTruncated ? clampedStart + MAX_TERMINAL_LINES - 1 : clampedEnd;

  const result: {
    startLine: number;
    endLine: number;
    totalLines: number;
    lines: string;
    linesTruncated?: boolean;
  } = {
    startLine: clampedStart,
    endLine: effectiveEnd,
    totalLines,
    lines: readTerminalBufferLines(terminal, clampedStart, effectiveEnd)
  };

  if (linesTruncated) {
    result.linesTruncated = true;
  }

  return result;
}

/**
 * Sends raw input to the active footer terminal shell stdin.
 *
 * @param state - Current Redux root state.
 * @param args - Tool arguments with input text.
 */
function terminalExec(state: RootState, args: unknown): { ok: true } | { error: string } {
  const parsed = args as TerminalExecToolArgs;
  if (typeof parsed?.input !== 'string' || parsed.input.length === 0) {
    return { error: 'input is required.' };
  }

  if (parsed.input.length > MAX_TERMINAL_EXEC_INPUT_CHARS) {
    return {
      error: `input exceeds maximum length of ${MAX_TERMINAL_EXEC_INPUT_CHARS} characters.`
    };
  }

  const activeTerminal = selectActiveTerminal(state);
  if (activeTerminal == null) {
    return { error: 'No active terminal.' };
  }

  if (!selectShowTerminal(state)) {
    return { error: 'Terminal panel is closed. Open the terminal panel before sending input.' };
  }

  window.api.writeTerminal(activeTerminal.id, parsed.input);
  return { ok: true };
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
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab) {
    return { error: 'No active request tab.' };
  }
  if (tab.sending) {
    return { error: 'A request is already in progress.' };
  }

  await ctx.dispatch(sendRequest(tab.tabId)).unwrap();

  const nextTab = findRequestTabById(ctx.getState(), tab.tabId);
  if (!nextTab || !nextTab.response) {
    return { error: 'Request finished without a response.' };
  }

  return formatHttpResponseForAgent(
    nextTab.response,
    nextTab.testResults,
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
  const tab = selectEffectiveActiveRequestTab(ctx.getState());
  if (!tab) {
    return { error: 'No active request tab.' };
  }

  const parsed = parseUpdateActiveRequestArgs(args);
  const {
    draft: nextDraft,
    changedFields,
    hasCookieUpdate
  } = applyRequestDraftUpdate(tab.draft, parsed);

  ctx.dispatch(updateTab({ tabId: tab.tabId, updates: { draft: nextDraft } }));

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

  const updatedTab = findRequestTabById(ctx.getState(), tab.tabId);
  if (!updatedTab) {
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
  const tab = selectEffectiveActiveRequestTab(ctx.getState());
  if (!tab) {
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

  ctx.dispatch(updateTab({ tabId: tab.tabId, updates: { draft: nextDraft } }));

  const updatedTab = findRequestTabById(ctx.getState(), tab.tabId);
  if (!updatedTab) {
    return { error: 'No active request tab.' };
  }

  return {
    ok: true,
    phase: parsed.phase,
    scriptIndex: parsed.scriptIndex,
    isDirty: isTabDirty(updatedTab)
  };
}

/**
 * Returns a collection from Redux state or throws when it is missing.
 *
 * @param state - Current Redux root state.
 * @param collectionId - Collection database id to resolve.
 */
function requireCollection(state: RootState, collectionId: number): Collection {
  const collection = selectCollections(state).find((entry) => entry.id === collectionId);
  if (collection == null) {
    throw new Error(`Collection id ${collectionId} not found.`);
  }

  return collection;
}

/**
 * Resolves a folder id for create_request from explicit id or folder name.
 *
 * @param state - Current Redux root state.
 * @param collectionId - Collection that owns the folder.
 * @param folderId - Explicit folder id when provided.
 * @param folderName - Folder display name to resolve when folderId is omitted.
 */
function resolveFolderIdForCreateRequest(
  state: RootState,
  collectionId: number,
  folderId?: number | null,
  folderName?: string
): number | null {
  if (folderId != null) {
    const folders = selectFoldersByCollection(state)[collectionId] ?? [];
    const match = folders.find((folder) => folder.id === folderId);
    if (match == null) {
      throw new Error(`Folder id ${folderId} was not found in collection ${collectionId}.`);
    }
    return match.id;
  }

  const trimmedName = typeof folderName === 'string' ? folderName.trim() : '';
  if (!trimmedName) {
    return null;
  }

  const folders = selectFoldersByCollection(state)[collectionId] ?? [];
  const target = trimmedName.toLowerCase();
  const match = folders.find((folder) => folder.name.trim().toLowerCase() === target);
  if (match == null) {
    throw new Error(
      `Folder "${folderName}" was not found in collection ${collectionId}. Call create_folder first.`
    );
  }

  return match.id;
}

/**
 * Maps create_request tool arguments onto the plugin bulk-import request row shape.
 *
 * @param args - Parsed create_request tool arguments.
 */
function toCreateCollectionRequestRow(args: CreateRequestToolArgs): CreateCollectionRequest {
  let headers: Record<string, string> | undefined;
  if (Array.isArray(args.headers)) {
    headers = Object.fromEntries(
      args.headers.filter((row) => row.key.trim().length > 0).map((row) => [row.key, row.value])
    );
  } else {
    headers = args.headers;
  }

  return {
    name: args.name,
    method: args.method,
    url: args.url,
    headers,
    params: args.params,
    body: args.body,
    bodyType: args.bodyType,
    comment: args.comment
  };
}

/**
 * Creates a collection with optional saved requests and returns a summary for the model.
 *
 * @param args - Parsed create_collection tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
async function createCollectionTool(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | {
      ok: true;
      collection: { id: number; uuid: string; name: string };
      requests: Array<{
        id: number;
        name: string;
        method: string;
        url: string;
        folderId: number | null;
      }>;
    }
  | { error: string }
> {
  const validated = validateCreateCollectionPayload(args as CreateCollectionToolArgs);
  const result = await createCollectionFromPlugin(validated);
  const collection = requireCollection(ctx.getState(), result.collectionId);
  const requests = await window.api.listRequests(result.collectionId);

  return {
    ok: true,
    collection: {
      id: collection.id,
      uuid: collection.uuid,
      name: collection.name
    },
    requests: requests.map((request) => ({
      id: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      folderId: request.folder_id
    }))
  };
}

/**
 * Creates a folder inside an existing collection.
 *
 * @param args - Parsed create_folder tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
async function createFolderTool(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | {
      ok: true;
      folder: { id: number; uuid: string; name: string; collectionId: number };
    }
  | { error: string }
> {
  const parsed = args as CreateFolderToolArgs;
  if (typeof parsed?.collectionId !== 'number' || !Number.isFinite(parsed.collectionId)) {
    throw new Error('collectionId is required.');
  }

  const trimmedName = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  if (!trimmedName) {
    throw new Error('Folder name is required.');
  }

  requireCollection(ctx.getState(), parsed.collectionId);
  const folder = await ctx
    .dispatch(createFolder({ collectionId: parsed.collectionId, name: trimmedName }))
    .unwrap();

  return {
    ok: true,
    folder: {
      id: folder.id,
      uuid: folder.uuid,
      name: folder.name,
      collectionId: parsed.collectionId
    }
  };
}

/**
 * Creates a saved request in an existing collection or folder.
 *
 * @param args - Parsed create_request tool arguments.
 * @param ctx - Redux getState and dispatch.
 */
async function createRequestTool(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | {
      ok: true;
      request: {
        id: number;
        uuid: string;
        name: string;
        method: string;
        url: string;
        folderId: number | null;
      };
    }
  | { error: string }
> {
  const parsed = args as CreateRequestToolArgs;
  if (typeof parsed?.collectionId !== 'number' || !Number.isFinite(parsed.collectionId)) {
    throw new Error('collectionId is required.');
  }

  if (typeof parsed.method !== 'string' || !HTTP_METHODS.includes(parsed.method as HttpMethod)) {
    throw new Error(`Invalid method: ${String(parsed.method)}`);
  }

  requireCollection(ctx.getState(), parsed.collectionId);
  const folderId = resolveFolderIdForCreateRequest(
    ctx.getState(),
    parsed.collectionId,
    parsed.folderId,
    parsed.folderName
  );

  const saveInput = pluginRequestToSaveInput(
    toCreateCollectionRequestRow(parsed),
    parsed.collectionId,
    folderId
  );

  const saved = await window.api.saveRequest(saveInput);
  await ctx.dispatch(refreshRequests(parsed.collectionId));

  return {
    ok: true,
    request: {
      id: saved.id,
      uuid: saved.uuid,
      name: saved.name,
      method: saved.method,
      url: saved.url,
      folderId: saved.folder_id
    }
  };
}
