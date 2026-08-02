import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import {
  applyRequestDraftUpdate,
  applyScriptUpdate,
  hasRequestUpdateFields,
  mergeKeyValues,
  resolveEffectiveBodyRaw,
  type KeyValueListMode,
  type ScriptUpdateMode,
  type UpdateActiveRequestToolArgs
} from '@harborclient/core/ai/requestUpdate';
import {
  AI_TOOL_NAMES,
  type AiToolName,
  type ClearLiveServerLogsToolArgs,
  type CreateCollectionToolArgs,
  type CreateFolderToolArgs,
  type CreateLiveServerToolArgs,
  type CreateRequestToolArgs,
  type DeleteLiveServerToolArgs,
  type GetActiveResponseToolArgs,
  type GetActiveTerminalLinesToolArgs,
  type GetLiveServerToolArgs,
  type GetLiveServerLogsToolArgs,
  type GetScriptRunDiagnosticsToolArgs,
  type GetSidebarItemByUuidToolArgs,
  type GitCommitsToolArgs,
  type GitDiffToolArgs,
  type GitFileDiffToolArgs,
  type GitFileInfoToolArgs,
  type GitRepoInfoToolArgs,
  type ListRequestsToolArgs,
  type QueryResponseBodyToolArgs,
  type SearchDocsToolArgs,
  type SendActiveRequestToolArgs,
  type SetActiveEnvironmentToolArgs,
  type StartLiveServerToolArgs,
  type StopLiveServerToolArgs,
  type TerminalExecToolArgs,
  type UpdateGeneralSettingsToolArgs,
  type UpdateLiveServerToolArgs,
  type UpdateRequestScriptToolArgs
} from '@harborclient/core/ai/tools';
import { getScriptingApiReferenceText } from '@harborclient/core/ai/scriptingApiReference';
import {
  hasGeneralSettingsAiPatch,
  listChangedGeneralSettingsKeys,
  mergeGeneralSettingsAiPatch,
  sanitizeGeneralSettingsForAi,
  type SanitizedGeneralSettingsForAi
} from '@harborclient/core/ai/generalSettingsForAi';
import {
  DEFAULT_RESPONSE_BODY_CHARS,
  formatActiveResponseConsole,
  formatHttpResponseForAgent,
  queryJsonForAgent,
  type AgentHttpResponse,
  type FormatHttpResponseOptions,
  type QueryResponseBodyError,
  type QueryResponseBodyResult
} from '@harborclient/core/ai/chatContext';
import { isMcpPrefixedToolName } from '@harborclient/core/mcpToolNames';
import { hostFromUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/cookieHost';
import {
  isMarkdownTab,
  isRequestTab,
  isTabDirty,
  type RequestTab
} from '#/renderer/src/store/tabs';
import { mirrorLegacyScriptString, resolveScriptSourceCode } from '@harborclient/core/scriptRefs';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { selectShowTerminal } from '#/renderer/src/store/slices/navigationSlice';
import { updateTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectActiveEnvironmentId,
  selectConsoleEntries,
  selectEffectiveActiveRequestTab,
  selectCollections,
  selectDocumentsByCollection,
  selectEnvironments,
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectRunningLiveServers,
  selectSavedLiveServers,
  selectSelectedCollectionId,
  selectSnippets,
  selectTabs
} from '#/renderer/src/store/selectors';
import {
  capWebpageEvalResult,
  readOptionalBooleanArg,
  readOptionalNumberArg,
  readOptionalStringArg,
  readRequiredStringArg
} from '#/renderer/src/store/ai/webpageTools';
import {
  evaluateWebpage,
  injectWebpageScript,
  injectWebpageStylesheet,
  openOrReuseWebpageTab,
  queryWebpageDom
} from '#/renderer/src/store/browser/webpageSession';
import type { RootState } from '#/renderer/src/store/redux';
import { sendRequest } from '#/renderer/src/store/thunks/requests';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { selectActiveTerminal, selectTerminals } from '#/renderer/src/store/slices/terminalsSlice';
import { buildScriptRunDiagnostics } from '#/renderer/src/scripting/scriptRunDiagnostics';
import { findJavascriptSyntaxError } from '#/renderer/src/scripting/javascriptSyntaxCheck';
import { getTerminalInstance } from '#/renderer/src/ui/Footer/TerminalPanel/terminalRegistry';
import { readTerminalBufferLines } from '#/renderer/src/ui/Footer/TerminalPanel/terminalSelection';
import {
  createCollectionFromPlugin,
  pluginRequestToSaveInput,
  validateCreateCollectionPayload
} from '#/renderer/src/plugins/hostRequestCommands';
import type { CreateCollectionRequest } from '@harborclient/sdk';
import { createFolder, refreshRequests } from '#/renderer/src/store/thunks/collections';
import {
  createSavedLiveServer,
  deleteSavedLiveServer,
  refreshLiveServers,
  refreshRunningLiveServers,
  startLiveServer,
  stopLiveServer,
  toLiveServerConfig,
  updateSavedLiveServer
} from '#/renderer/src/store/thunks/liveServers';
import {
  normalizeLiveServerCorsSettings,
  normalizeLiveServerHeaders,
  normalizeLiveServerProxies,
  normalizeLiveServerErrorPages,
  normalizeLiveServerRoutes,
  normalizeLiveServerSslSettings
} from '@harborclient/core/types';
import type { OperatingSystemInfo } from '@harborclient/core/types';
import type {
  AuthConfig,
  BodyType,
  Collection,
  CollectionDocument,
  Folder,
  GeneralSettings,
  HttpMethod,
  KeyValue,
  LiveServer,
  LiveServerAlias,
  LiveServerCorsSettings,
  LiveServerLogEntry,
  LiveServerLogsQuery,
  LiveServerErrorPage,
  LiveServerProxy,
  LiveServerScriptRef,
  LiveServerResponseHeader,
  LiveServerRoute,
  LiveServerSslSettings,
  RunningLiveServer,
  SavedRequest,
  ScriptRef,
  Snippet,
  Variable
} from '@harborclient/core/types';

/**
 * Maximum access-log lines returned by get_live_server_logs per call.
 */
const MAX_LIVE_SERVER_LOG_LINES = 1000;

/**
 * Default access-log line count when maxLines is omitted.
 */
const DEFAULT_LIVE_SERVER_LOG_LINES = 100;

/**
 * Returns whether a path looks like an absolute filesystem root for live servers.
 *
 * @param root - Candidate document-root path.
 * @returns True for POSIX absolute paths and Windows drive paths.
 */
function isAbsoluteLiveServerRoot(root: string): boolean {
  return root.startsWith('/') || /^[A-Za-z]:[\\/]/.test(root);
}

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
 *
 * Whole-script replace/append only — range splice is exclusive to update_request_script.
 */
const SCRIPT_MODES: readonly ScriptUpdateMode[] = ['replace', 'append'];

/**
 * Supported script update modes for update_request_script validation.
 */
const REQUEST_SCRIPT_MODES: readonly ScriptUpdateMode[] = ['replace', 'append', 'replace_range'];

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
        return JSON.stringify(await listCollections(ctx.getState()));
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
      case 'get_active_response_console':
        return JSON.stringify(getActiveResponseConsole(ctx.getState()));
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
      case 'get_general_settings':
        return JSON.stringify(getGeneralSettings(ctx));
      case 'update_general_settings':
        return JSON.stringify(await updateGeneralSettings(args, ctx));
      case 'create_collection':
        return JSON.stringify(await createCollectionTool(args, ctx));
      case 'create_folder':
        return JSON.stringify(await createFolderTool(args, ctx));
      case 'create_request':
        return JSON.stringify(await createRequestTool(args, ctx));
      case 'search_docs':
        return await window.api.searchDocs(args as SearchDocsToolArgs);
      case 'get_script_run_diagnostics':
        return JSON.stringify(getScriptRunDiagnostics(ctx.getState(), args));
      case 'get_scripting_api_reference':
        return getScriptingApiReferenceText();
      case 'git_diff':
        return await window.api.gitDiff(args as GitDiffToolArgs);
      case 'git_repo_info':
        return await window.api.gitRepoInfo(args as GitRepoInfoToolArgs);
      case 'git_commits':
        return await window.api.gitCollectionCommits(args as GitCommitsToolArgs);
      case 'git_file_info':
        return await window.api.gitFileInfo(args as GitFileInfoToolArgs);
      case 'git_file_diff':
        return await window.api.gitFileDiff(args as GitFileDiffToolArgs);
      case 'get_active_terminal':
        return JSON.stringify(getActiveTerminalInfo(ctx.getState()));
      case 'get_active_terminal_lines':
        return JSON.stringify(getActiveTerminalLines(ctx.getState(), args));
      case 'terminal_exec':
        return JSON.stringify(terminalExec(ctx.getState(), args));
      case 'webpage_tab':
        return JSON.stringify(await webpageTab(args, ctx));
      case 'webpage_query':
        return JSON.stringify(await webpageQuery(args, ctx.getState()));
      case 'webpage_evaluate':
        return JSON.stringify(await webpageEvaluate(args, ctx.getState()));
      case 'webpage_inject_script':
        return JSON.stringify(await webpageInjectScript(args, ctx.getState()));
      case 'webpage_inject_stylesheet':
        return JSON.stringify(await webpageInjectStylesheet(args, ctx.getState()));
      case 'get_markdown_document':
        return JSON.stringify(await getMarkdownDocument(args, ctx.getState()));
      case 'list_live_servers':
        return JSON.stringify(await listLiveServersTool(ctx));
      case 'list_running_live_servers':
        return JSON.stringify(await listRunningLiveServersTool(ctx));
      case 'get_live_server':
        return JSON.stringify(await getLiveServerTool(args, ctx));
      case 'get_live_server_logs':
        return JSON.stringify(await getLiveServerLogsTool(args));
      case 'start_live_server':
        return JSON.stringify(await startLiveServerTool(args, ctx));
      case 'stop_live_server':
        return JSON.stringify(await stopLiveServerTool(args, ctx));
      case 'create_live_server':
        return JSON.stringify(await createLiveServerTool(args, ctx));
      case 'update_live_server':
        return JSON.stringify(await updateLiveServerTool(args, ctx));
      case 'delete_live_server':
        return JSON.stringify(await deleteLiveServerTool(args, ctx));
      case 'clear_live_server_logs':
        return JSON.stringify(await clearLiveServerLogsTool(args));
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
 * Returns all collections with full configuration, storage metadata, and selection flag.
 *
 * @param state - Current Redux root state.
 */
async function listCollections(state: RootState): Promise<
  Array<{
    id: number;
    uuid: string;
    name: string;
    variables: Variable[];
    headers: KeyValue[];
    auth: AuthConfig;
    pre_request_script: string;
    post_request_script: string;
    isSelected: boolean;
    connectionId?: string;
    storageType: string | null;
    isGitBacked: boolean;
  }>
> {
  const selectedId = selectSelectedCollectionId(state);
  const connections = await window.api.listStorageConnections();
  const connectionTypeById = new Map(
    connections.map((connection) => [connection.id, connection.type])
  );

  return selectCollections(state).map((collection) => {
    const connectionId = collection.connectionId?.trim();
    const storageType = connectionId ? (connectionTypeById.get(connectionId) ?? null) : null;
    return {
      id: collection.id,
      uuid: collection.uuid,
      name: collection.name,
      variables: collection.variables,
      headers: collection.headers,
      auth: collection.auth,
      pre_request_script: collection.pre_request_script,
      post_request_script: collection.post_request_script,
      isSelected: collection.id === selectedId,
      ...(connectionId ? { connectionId } : {}),
      storageType,
      isGitBacked: storageType === 'git'
    };
  });
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
      body_raw: string | null;
      body_raw_open: boolean;
      body_raw_effective: string | null;
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
    body_raw: draft.body_raw,
    body_raw_open: draft.body_raw_open,
    body_raw_effective: resolveEffectiveBodyRaw(draft),
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
 * Returns the Console / Headers / Timing inspector for the effective active request tab.
 *
 * @param state - Current Redux root state.
 */
function getActiveResponseConsole(
  state: RootState
): ReturnType<typeof formatActiveResponseConsole> | null {
  const tab = selectEffectiveActiveRequestTab(state);
  if (!tab || !tab.response) return null;
  return formatActiveResponseConsole(tab.response);
}

/**
 * Returns script runtime diagnostics from the newest matching console entry.
 *
 * @param state - Current Redux root state.
 * @param args - Optional phase/script filters from the model.
 * @returns Diagnostics payload for the agent.
 */
function getScriptRunDiagnostics(
  state: RootState,
  args: unknown
): ReturnType<typeof buildScriptRunDiagnostics> {
  const parsed = (args ?? {}) as GetScriptRunDiagnosticsToolArgs;
  const tab = selectEffectiveActiveRequestTab(state);
  return buildScriptRunDiagnostics(
    selectConsoleEntries(state),
    {
      phase: parsed.phase,
      scriptIndex: parsed.scriptIndex,
      scriptId: parsed.scriptId,
      requestTabId: tab?.tabId
    },
    tab
  );
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
 * Opens a new browser tab, reuses a matching open tab, or returns the active browser tab.
 *
 * @param args - Optional url: match an open tab by URL, otherwise open a new tab.
 * @param ctx - Redux getState and dispatch.
 * @returns Tab info with dom descriptor, or an error object.
 */
async function webpageTab(
  args: unknown,
  ctx: AiToolContext
): Promise<Awaited<ReturnType<typeof openOrReuseWebpageTab>>> {
  const urlArg = readOptionalStringArg(args, 'url');
  if (urlArg === null) {
    return { error: 'url must be a non-empty string when provided.' };
  }

  return openOrReuseWebpageTab(ctx, {
    url: urlArg,
    reuse: true
  });
}

/**
 * Queries the live DOM of a browser tab with a CSS selector.
 *
 * @param args - tabId, selector, optional all/maxElements.
 * @param state - Current Redux root state.
 * @returns Query result or error.
 */
async function webpageQuery(
  args: unknown,
  state: RootState
): Promise<Awaited<ReturnType<typeof queryWebpageDom>>> {
  const tabId = readRequiredStringArg(args, 'tabId');
  const selector = readRequiredStringArg(args, 'selector');
  if (!tabId) {
    return { error: 'tabId is required.' };
  }
  if (!selector) {
    return { error: 'selector is required.' };
  }

  const all = readOptionalBooleanArg(args, 'all');
  if (all === null) {
    return { error: 'all must be a boolean when provided.' };
  }
  const maxElements = readOptionalNumberArg(args, 'maxElements');
  if (maxElements === null) {
    return { error: 'maxElements must be a finite number when provided.' };
  }

  return queryWebpageDom(state, tabId, selector, all, maxElements);
}

/**
 * Evaluates JavaScript in a browser tab page and returns a capped result.
 *
 * @param args - tabId and expression.
 * @param state - Current Redux root state.
 * @returns Capped evaluate result or error.
 */
async function webpageEvaluate(
  args: unknown,
  state: RootState
): Promise<ReturnType<typeof capWebpageEvalResult> | { error: string }> {
  const tabId = readRequiredStringArg(args, 'tabId');
  const expression = readRequiredStringArg(args, 'expression');
  if (!tabId) {
    return { error: 'tabId is required.' };
  }
  if (!expression) {
    return { error: 'expression is required.' };
  }

  const result = await evaluateWebpage(state, tabId, expression);
  if ('error' in result) {
    return result;
  }
  return capWebpageEvalResult(result.value);
}

/**
 * Injects JavaScript source into a browser tab page.
 *
 * @param args - tabId and source.
 * @param state - Current Redux root state.
 * @returns Success / capped result or error.
 */
async function webpageInjectScript(
  args: unknown,
  state: RootState
): Promise<({ ok: true } & ReturnType<typeof capWebpageEvalResult>) | { error: string }> {
  const tabId = readRequiredStringArg(args, 'tabId');
  const source = readRequiredStringArg(args, 'source');
  if (!tabId) {
    return { error: 'tabId is required.' };
  }
  if (!source) {
    return { error: 'source is required.' };
  }

  const result = await injectWebpageScript(state, tabId, source);
  if ('error' in result) {
    return result;
  }
  return { ok: true, ...capWebpageEvalResult(result.value) };
}

/**
 * Injects a CSS stylesheet into a browser tab page.
 *
 * @param args - tabId and css.
 * @param state - Current Redux root state.
 * @returns Success with insertion key, or error.
 */
async function webpageInjectStylesheet(
  args: unknown,
  state: RootState
): Promise<{ ok: true; key: string } | { error: string }> {
  const tabId = readRequiredStringArg(args, 'tabId');
  const css = readRequiredStringArg(args, 'css');
  if (!tabId) {
    return { error: 'tabId is required.' };
  }
  if (!css) {
    return { error: 'css is required.' };
  }

  const result = await injectWebpageStylesheet(state, tabId, css);
  if ('error' in result) {
    return result;
  }
  return { ok: true, key: result.key };
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
 * Returns sanitized General Settings for the AI agent.
 *
 * @param ctx - Tool context with Redux getState.
 * @returns Current general settings with proxy.password redacted when set.
 */
function getGeneralSettings(ctx: AiToolContext): SanitizedGeneralSettingsForAi {
  return sanitizeGeneralSettingsForAi(ctx.getState().settings.general);
}

/**
 * Applies a General Settings patch, persists it, and returns the updated values.
 *
 * @param args - Partial settings from the model.
 * @param ctx - Tool context with Redux getState and dispatch.
 * @returns Updated settings plus changed keys, or an error when the patch is empty.
 */
async function updateGeneralSettings(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | { updated: Array<keyof GeneralSettings>; settings: SanitizedGeneralSettingsForAi }
  | { error: string }
> {
  const patch = (args ?? {}) as UpdateGeneralSettingsToolArgs;
  if (!hasGeneralSettingsAiPatch(patch)) {
    return { error: 'Provide at least one settings field to update.' };
  }

  const before = ctx.getState().settings.general;
  const merged = mergeGeneralSettingsAiPatch(before, patch);
  const updatedKeys = listChangedGeneralSettingsKeys(before, merged);

  if (updatedKeys.length === 0) {
    return {
      updated: [],
      settings: sanitizeGeneralSettingsForAi(before)
    };
  }

  await ctx.dispatch(patchGeneralSettings(merged)).unwrap();

  return {
    updated: updatedKeys,
    settings: sanitizeGeneralSettingsForAi(ctx.getState().settings.general)
  };
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
  const startOffset = parsed.startOffset;
  const endOffset = parsed.endOffset;

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

  if (mode !== undefined && !REQUEST_SCRIPT_MODES.includes(mode)) {
    throw new Error(`Invalid script mode: ${String(mode)}`);
  }

  if (mode === 'replace_range') {
    if (
      typeof startOffset !== 'number' ||
      !Number.isFinite(startOffset) ||
      startOffset < 0 ||
      typeof endOffset !== 'number' ||
      !Number.isFinite(endOffset) ||
      endOffset < 0
    ) {
      throw new Error(
        'replace_range requires non-negative finite startOffset and endOffset from the @ #start.end selection.'
      );
    }
    if (startOffset > endOffset) {
      throw new Error('startOffset must be less than or equal to endOffset.');
    }
  }

  return {
    requestId,
    phase,
    scriptIndex,
    code,
    ...(mode !== undefined ? { mode } : {}),
    ...(typeof startOffset === 'number' ? { startOffset } : {}),
    ...(typeof endOffset === 'number' ? { endOffset } : {})
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

  const mode = parsed.mode ?? 'replace';
  const currentCode = target.code ?? '';
  const nextCode =
    mode === 'replace_range'
      ? applyScriptUpdate(currentCode, parsed.code, 'replace_range', {
          startOffset: parsed.startOffset as number,
          endOffset: parsed.endOffset as number
        })
      : applyScriptUpdate(currentCode, parsed.code, mode);

  const currentSyntaxError = findJavascriptSyntaxError(currentCode);
  const nextSyntaxError = nextCode.trim() ? findJavascriptSyntaxError(nextCode) : null;
  if (currentSyntaxError == null && nextSyntaxError != null) {
    const location = nextSyntaxError.excerpt
      ? `line ${nextSyntaxError.line}: ${JSON.stringify(nextSyntaxError.excerpt)}`
      : `line ${nextSyntaxError.line}, character ${nextSyntaxError.from}`;
    const recovery =
      mode === 'replace_range'
        ? 'replace_range splices code literally between startOffset and endOffset; text before and after the selection is unchanged. Retry with mode "replace" and send the entire corrected script.'
        : 'Retry with valid JavaScript and preserve the complete script.';
    return {
      error: `Edit rejected: the result is not valid JavaScript (${location}). ${recovery}`
    };
  }

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
 * Resolves an optional portable parent uuid within the target collection.
 *
 * @param state - Current Redux root state.
 * @param collectionId - Collection that must own the parent folder.
 * @param parentFolderUuid - Portable parent uuid, or undefined for collection root.
 * @returns Parent database id, or undefined when no parent was requested.
 */
async function resolveParentFolderId(
  state: RootState,
  collectionId: number,
  parentFolderUuid: unknown
): Promise<number | undefined> {
  if (parentFolderUuid === undefined) {
    return undefined;
  }

  const uuid = typeof parentFolderUuid === 'string' ? parentFolderUuid.trim() : '';
  if (!uuid) {
    throw new Error('parentFolderUuid must not be empty.');
  }

  const cachedFolders = selectFoldersByCollection(state)[collectionId];
  const folders = cachedFolders ?? (await window.api.listFolders(collectionId));
  const parent = folders.find((folder) => folder.uuid === uuid);
  if (parent == null) {
    throw new Error(
      `Parent folder with uuid "${uuid}" was not found in collection ${collectionId}.`
    );
  }

  return parent.id;
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
  const parentFolderId = await resolveParentFolderId(
    ctx.getState(),
    parsed.collectionId,
    parsed.parentFolderUuid
  );
  const folder = await ctx
    .dispatch(
      createFolder({
        collectionId: parsed.collectionId,
        name: trimmedName,
        ...(parentFolderId !== undefined ? { parentFolderId } : {})
      })
    )
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

/**
 * Compact SSL summary for AI tool results (paths only — never PEM contents).
 */
type LiveServerSslSummary = {
  enabled: boolean;
  certPath: string;
  keyPath: string;
};

/**
 * Compact summary of a saved live server for AI tool results.
 *
 * Includes the important expanded knobs (host, openPath, indexFiles, ssl.enabled)
 * so agents can inspect and update without round-tripping full PEMs.
 */
type LiveServerSummary = {
  id: number;
  uuid: string;
  connectionId?: string;
  name: string;
  root: string;
  port: number | null;
  aliases: LiveServerAlias[];
  watch: boolean;
  cors: LiveServerCorsSettings;
  openPath: string;
  openPathOnStartup: boolean;
  rememberLastUrl: boolean;
  indexFiles: string[];
  host: string;
  headers: LiveServerResponseHeader[];
  routes: LiveServerRoute[];
  errorPages: LiveServerErrorPage[];
  proxies: LiveServerProxy[];
  ssl: LiveServerSslSummary;
};

/**
 * Compact summary of a running live server for AI tool results.
 */
type RunningLiveServerSummary = {
  id: string;
  savedId: number | null;
  name: string;
  root: string;
  port: number;
  origin: string;
  startedAt: number;
  watch: boolean;
  watchUnavailable?: boolean;
  aliases: LiveServerAlias[];
  cors: LiveServerCorsSettings;
  openPath: string;
  openPathOnStartup: boolean;
  rememberLastUrl: boolean;
  indexFiles: string[];
  host: string;
  headers: LiveServerResponseHeader[];
  routes: LiveServerRoute[];
  errorPages: LiveServerErrorPage[];
  proxies: LiveServerProxy[];
  ssl: LiveServerSslSummary;
};

/**
 * Maps SSL settings to a path-only AI summary (never includes certificate contents).
 *
 * @param ssl - Normalized SSL settings from a saved or running config.
 * @returns Enabled flag plus cert/key filesystem paths.
 */
function summarizeLiveServerSsl(ssl: LiveServerSslSettings): LiveServerSslSummary {
  return {
    enabled: ssl.enabled,
    certPath: ssl.certPath,
    keyPath: ssl.keyPath
  };
}

/**
 * Maps a saved live server row to a compact AI-facing summary.
 *
 * @param server - Saved live server from the store or API.
 * @returns Summary fields the agent needs for inspection and follow-up calls.
 */
function summarizeSavedLiveServer(server: LiveServer): LiveServerSummary {
  return {
    id: server.id,
    uuid: server.uuid,
    ...(server.connectionId ? { connectionId: server.connectionId } : {}),
    name: server.name,
    root: server.root,
    port: server.port,
    aliases: server.aliases,
    watch: server.watch,
    cors: server.cors,
    openPath: server.openPath,
    openPathOnStartup: server.openPathOnStartup,
    rememberLastUrl: server.rememberLastUrl,
    indexFiles: server.indexFiles,
    host: server.host,
    headers: server.headers,
    routes: server.routes,
    errorPages: server.errorPages,
    proxies: server.proxies,
    ssl: summarizeLiveServerSsl(server.ssl)
  };
}

/**
 * Maps a running live server instance to a compact AI-facing summary.
 *
 * @param server - Running instance from the store or API.
 * @returns Summary fields including origin and runtime id.
 */
function summarizeRunningLiveServer(server: RunningLiveServer): RunningLiveServerSummary {
  return {
    id: server.id,
    savedId: server.savedId,
    name: server.config.name,
    root: server.config.root,
    port: server.port,
    origin: server.origin,
    startedAt: server.startedAt,
    watch: server.config.watch,
    ...(server.watchUnavailable ? { watchUnavailable: true } : {}),
    aliases: server.config.aliases,
    cors: server.config.cors,
    openPath: server.config.openPath,
    openPathOnStartup: server.config.openPathOnStartup,
    rememberLastUrl: server.config.rememberLastUrl,
    indexFiles: server.config.indexFiles,
    host: server.config.host,
    headers: server.config.headers,
    routes: server.config.routes,
    errorPages: server.config.errorPages,
    proxies: server.config.proxies,
    ssl: summarizeLiveServerSsl(server.config.ssl)
  };
}

/**
 * Lists saved live servers, refreshing from the registry first.
 *
 * @param ctx - Redux getState and dispatch.
 * @returns Compact summaries of every saved live server.
 */
async function listLiveServersTool(ctx: AiToolContext): Promise<LiveServerSummary[]> {
  await ctx.dispatch(refreshLiveServers()).unwrap();
  return selectSavedLiveServers(ctx.getState()).map(summarizeSavedLiveServer);
}

/**
 * Lists running live servers, refreshing from the main process first.
 *
 * @param ctx - Redux getState and dispatch.
 * @returns Compact summaries of every running instance.
 */
async function listRunningLiveServersTool(ctx: AiToolContext): Promise<RunningLiveServerSummary[]> {
  await ctx.dispatch(refreshRunningLiveServers()).unwrap();
  return selectRunningLiveServers(ctx.getState()).map(summarizeRunningLiveServer);
}

/**
 * Returns one saved live server by database id or uuid.
 *
 * @param args - Tool arguments with id and/or uuid.
 * @param ctx - Redux getState and dispatch.
 * @returns Saved server summary or an error object.
 */
async function getLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<LiveServerSummary | { error: string }> {
  const parsed = args as GetLiveServerToolArgs;
  const hasId = typeof parsed?.id === 'number' && Number.isFinite(parsed.id);
  const uuid = typeof parsed?.uuid === 'string' ? parsed.uuid.trim() : '';
  if (!hasId && !uuid) {
    return { error: 'id or uuid is required.' };
  }

  await ctx.dispatch(refreshLiveServers()).unwrap();
  const saved = selectSavedLiveServers(ctx.getState());
  const server = hasId
    ? saved.find((entry) => entry.id === parsed.id)
    : saved.find((entry) => entry.uuid === uuid);

  if (!server) {
    return { error: 'Live server not found.' };
  }
  return summarizeSavedLiveServer(server);
}

/**
 * Resolves a live-server logs query from tool arguments.
 *
 * @param args - Arguments with savedId and/or runtime id.
 * @returns Logs query or null when neither identifier is present.
 */
function resolveLiveServerLogsQuery(
  args: ClearLiveServerLogsToolArgs | GetLiveServerLogsToolArgs
): LiveServerLogsQuery | null {
  if (typeof args?.savedId === 'number' && Number.isFinite(args.savedId)) {
    return { savedId: args.savedId };
  }
  if (typeof args?.id === 'string' && args.id.trim()) {
    return { id: args.id.trim() };
  }
  return null;
}

/**
 * Returns capped access-log lines for a running live server.
 *
 * @param args - Tool arguments with savedId/id and optional maxLines.
 * @returns Log snapshot with truncation metadata, or an error object.
 */
async function getLiveServerLogsTool(args: unknown): Promise<
  | {
      query: LiveServerLogsQuery;
      totalLines: number;
      lines: LiveServerLogEntry[];
      truncated: boolean;
    }
  | { error: string }
> {
  const parsed = args as GetLiveServerLogsToolArgs;
  const query = resolveLiveServerLogsQuery(parsed);
  if (!query) {
    return { error: 'savedId or id is required.' };
  }

  const all = await window.api.getLiveServerLogs(query);
  const requested =
    typeof parsed.maxLines === 'number' && Number.isFinite(parsed.maxLines)
      ? Math.floor(parsed.maxLines)
      : DEFAULT_LIVE_SERVER_LOG_LINES;
  const maxLines = Math.min(Math.max(1, requested), MAX_LIVE_SERVER_LOG_LINES);
  const lines = all.length > maxLines ? all.slice(all.length - maxLines) : all;

  return {
    query,
    totalLines: all.length,
    lines,
    truncated: all.length > lines.length
  };
}

/**
 * Parses optional alias rows for create/start/update tools.
 *
 * @param value - Unknown aliases argument.
 * @returns Validated aliases or throws.
 */
function parseLiveServerAliases(value: unknown): LiveServerAlias[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('aliases must be an array.');
  }
  return value.map((entry, index) => {
    if (entry == null || typeof entry !== 'object') {
      throw new Error(`aliases[${index}] must be an object.`);
    }
    const row = entry as { path?: unknown; target?: unknown };
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    const target = typeof row.target === 'string' ? row.target.trim() : '';
    if (!path || !target) {
      throw new Error(`aliases[${index}] requires non-empty path and target.`);
    }
    return { path, target };
  });
}

/**
 * Parses optional response-header rows for create/start/update tools.
 *
 * @param value - Unknown headers argument.
 * @returns Normalized headers, or undefined when the argument was omitted.
 */
function parseLiveServerHeaders(value: unknown): LiveServerResponseHeader[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeLiveServerHeaders(value);
}

/**
 * Parses optional routing rules for create/start/update tools.
 *
 * @param value - Unknown routes argument.
 * @returns Normalized routes, or undefined when the argument was omitted.
 */
function parseLiveServerRoutes(value: unknown): LiveServerRoute[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeLiveServerRoutes(value);
}

/**
 * Parses optional error-page mappings for create/start/update tools.
 *
 * @param value - Unknown errorPages argument.
 * @returns Normalized error pages, or undefined when the argument was omitted.
 */
function parseLiveServerErrorPages(value: unknown): LiveServerErrorPage[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeLiveServerErrorPages(value);
}

/**
 * Parses optional reverse-proxy rules for create/start/update tools.
 *
 * @param value - Unknown proxies argument.
 * @returns Normalized proxies, or undefined when the argument was omitted.
 */
function parseLiveServerProxies(value: unknown): LiveServerProxy[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return normalizeLiveServerProxies(value);
}

/**
 * Parses optional SSL settings for create/start/update tools.
 *
 * @param value - Unknown ssl argument.
 * @returns Normalized SSL settings, or undefined when the argument was omitted.
 */
function parseLiveServerSsl(value: unknown): LiveServerSslSettings | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value == null || typeof value !== 'object') {
    throw new Error('ssl must be an object.');
  }
  return normalizeLiveServerSslSettings(value as Partial<LiveServerSslSettings>);
}

/**
 * Starts a live server from a saved id or an ad-hoc config.
 *
 * @param args - Tool arguments.
 * @param ctx - Redux getState and dispatch.
 * @returns Started instance summary or an error object.
 */
async function startLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<
  | {
      ok: true;
      id: string;
      savedId: number | null;
      port: number;
      origin: string;
      watchUnavailable?: boolean;
      openBrowser: boolean;
    }
  | { error: string }
> {
  const parsed = args as StartLiveServerToolArgs;
  /**
   * Explicit tool override when set; otherwise {@link startLiveServer} uses
   * `config.openPathOnStartup`.
   */
  const openBrowserOverride =
    typeof parsed.openBrowser === 'boolean' ? parsed.openBrowser : undefined;
  const hasSavedId = typeof parsed.savedId === 'number' && Number.isFinite(parsed.savedId);

  if (hasSavedId) {
    await ctx.dispatch(refreshLiveServers()).unwrap();
    const saved = selectSavedLiveServers(ctx.getState()).find(
      (entry) => entry.id === parsed.savedId
    );
    if (!saved) {
      return { error: 'Saved live server not found.' };
    }
    const config = toLiveServerConfig({
      name: saved.name,
      root: saved.root,
      port: saved.port,
      aliases: saved.aliases,
      watch: saved.watch,
      cors: saved.cors,
      openPath: saved.openPath,
      openPathOnStartup: saved.openPathOnStartup,
      rememberLastUrl: saved.rememberLastUrl,
      lastOpenedPath: saved.lastOpenedPath,
      indexFiles: saved.indexFiles,
      host: saved.host,
      headers: saved.headers,
      routes: saved.routes,
      errorPages: saved.errorPages,
      proxies: saved.proxies,
      ssl: saved.ssl,
      runCommand: saved.runCommand,
      runtimeId: saved.runtimeId,
      runCommandEnabled: saved.runCommandEnabled,
      runCommandEnv: saved.runCommandEnv,
      restartOnCrash: saved.restartOnCrash,
      urlVariable: saved.urlVariable,
      preRequestScripts: saved.preRequestScripts,
      postRequestScripts: saved.postRequestScripts
    });
    const openBrowser = openBrowserOverride ?? config.openPathOnStartup;
    const running = await ctx
      .dispatch(
        startLiveServer({
          savedId: saved.id,
          config,
          openBrowser: openBrowserOverride
        })
      )
      .unwrap();
    return {
      ok: true,
      id: running.id,
      savedId: running.savedId,
      port: running.port,
      origin: running.origin,
      ...(running.watchUnavailable ? { watchUnavailable: true } : {}),
      openBrowser
    };
  }

  const root = typeof parsed.root === 'string' ? parsed.root.trim() : '';
  if (!root) {
    return { error: 'root is required when savedId is omitted.' };
  }
  if (!isAbsoluteLiveServerRoot(root)) {
    return { error: 'root must be an absolute filesystem path.' };
  }

  const name =
    typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Live Server';
  const port =
    parsed.port === null
      ? null
      : typeof parsed.port === 'number' && Number.isFinite(parsed.port)
        ? Math.floor(parsed.port)
        : null;
  const aliases = parseLiveServerAliases(parsed.aliases);
  const watch = parsed.watch !== false;
  const cors = normalizeLiveServerCorsSettings(parsed.cors);
  const headers = parseLiveServerHeaders(parsed.headers);
  const routes = parseLiveServerRoutes(parsed.routes);
  const errorPages = parseLiveServerErrorPages(parsed.errorPages);
  const proxies = parseLiveServerProxies(parsed.proxies);
  const ssl = parseLiveServerSsl(parsed.ssl);

  const config = toLiveServerConfig({
    name,
    root,
    port,
    aliases,
    watch,
    cors,
    openPath: parsed.openPath,
    openPathOnStartup: parsed.openPathOnStartup,
    rememberLastUrl: parsed.rememberLastUrl,
    indexFiles: parsed.indexFiles,
    host: parsed.host,
    headers,
    routes,
    errorPages,
    proxies,
    ssl,
    runCommand: parsed.runCommand,
    runtimeId: parsed.runtimeId,
    runCommandEnabled: parsed.runCommandEnabled,
    runCommandEnv: parsed.runCommandEnv,
    restartOnCrash: parsed.restartOnCrash,
    urlVariable: parsed.urlVariable,
    preRequestScripts: parsed.preRequestScripts as LiveServerScriptRef[] | undefined,
    postRequestScripts: parsed.postRequestScripts as LiveServerScriptRef[] | undefined
  });
  const openBrowser = openBrowserOverride ?? config.openPathOnStartup;
  const running = await ctx
    .dispatch(
      startLiveServer({
        savedId: null,
        config,
        openBrowser: openBrowserOverride
      })
    )
    .unwrap();

  return {
    ok: true,
    id: running.id,
    savedId: running.savedId,
    port: running.port,
    origin: running.origin,
    ...(running.watchUnavailable ? { watchUnavailable: true } : {}),
    openBrowser
  };
}

/**
 * Stops a running live server by runtime id or saved id.
 *
 * @param args - Tool arguments.
 * @param ctx - Redux getState and dispatch.
 * @returns Success payload or an error object.
 */
async function stopLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = args as StopLiveServerToolArgs;
  await ctx.dispatch(refreshRunningLiveServers()).unwrap();
  const running = selectRunningLiveServers(ctx.getState());

  let runtimeId = typeof parsed.id === 'string' ? parsed.id.trim() : '';
  if (!runtimeId && typeof parsed.savedId === 'number' && Number.isFinite(parsed.savedId)) {
    const match = running.find((entry) => entry.savedId === parsed.savedId);
    if (!match) {
      return { error: 'No running live server matches that savedId.' };
    }
    runtimeId = match.id;
  }
  if (!runtimeId) {
    return { error: 'id or savedId is required.' };
  }
  if (!running.some((entry) => entry.id === runtimeId)) {
    return { error: 'Running live server not found.' };
  }

  await ctx.dispatch(stopLiveServer(runtimeId)).unwrap();
  return { ok: true, id: runtimeId };
}

/**
 * Creates a saved live server in the local registry.
 *
 * @param args - Tool arguments.
 * @param ctx - Redux getState and dispatch.
 * @returns Created server summary or an error object.
 */
async function createLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<{ ok: true; server: LiveServerSummary } | { error: string }> {
  const parsed = args as CreateLiveServerToolArgs;
  const name = typeof parsed?.name === 'string' ? parsed.name.trim() : '';
  const root = typeof parsed?.root === 'string' ? parsed.root.trim() : '';
  const connectionId =
    typeof parsed?.connectionId === 'string' ? parsed.connectionId.trim() : undefined;
  if (!name) {
    return { error: 'name is required.' };
  }
  if (!root) {
    return { error: 'root is required.' };
  }
  if (!isAbsoluteLiveServerRoot(root)) {
    return { error: 'root must be an absolute filesystem path.' };
  }

  const port =
    parsed.port === undefined
      ? null
      : parsed.port === null
        ? null
        : typeof parsed.port === 'number' && Number.isFinite(parsed.port)
          ? Math.floor(parsed.port)
          : null;
  const aliases = parseLiveServerAliases(parsed.aliases);
  const watch = parsed.watch !== false;
  const cors = normalizeLiveServerCorsSettings(parsed.cors);
  const headers = parseLiveServerHeaders(parsed.headers);
  const routes = parseLiveServerRoutes(parsed.routes);
  const errorPages = parseLiveServerErrorPages(parsed.errorPages);
  const proxies = parseLiveServerProxies(parsed.proxies);
  const ssl = parseLiveServerSsl(parsed.ssl);

  const created = await ctx
    .dispatch(
      createSavedLiveServer({
        ...(connectionId ? { connectionId } : {}),
        name,
        root,
        port,
        aliases,
        watch,
        cors,
        openPath: parsed.openPath,
        openPathOnStartup: parsed.openPathOnStartup,
        rememberLastUrl: parsed.rememberLastUrl,
        indexFiles: parsed.indexFiles,
        host: parsed.host,
        headers,
        routes,
        errorPages,
        proxies,
        ssl,
        runCommand: parsed.runCommand,
        runtimeId: parsed.runtimeId,
        runCommandEnabled: parsed.runCommandEnabled,
        runCommandEnv: parsed.runCommandEnv,
        restartOnCrash: parsed.restartOnCrash,
        urlVariable: parsed.urlVariable,
        preRequestScripts: parsed.preRequestScripts as LiveServerScriptRef[] | undefined,
        postRequestScripts: parsed.postRequestScripts as LiveServerScriptRef[] | undefined
      })
    )
    .unwrap();

  return { ok: true, server: summarizeSavedLiveServer(created) };
}

/**
 * Updates a saved live server in the local registry.
 *
 * @param args - Tool arguments.
 * @param ctx - Redux getState and dispatch.
 * @returns Updated server summary or an error object.
 */
async function updateLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<{ ok: true; server: LiveServerSummary } | { error: string }> {
  const parsed = args as UpdateLiveServerToolArgs;
  if (typeof parsed?.id !== 'number' || !Number.isFinite(parsed.id)) {
    return { error: 'id is required.' };
  }
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const root = typeof parsed.root === 'string' ? parsed.root.trim() : '';
  const connectionId =
    typeof parsed.connectionId === 'string' ? parsed.connectionId.trim() : undefined;
  if (!name) {
    return { error: 'name is required.' };
  }
  if (!root) {
    return { error: 'root is required.' };
  }
  if (!isAbsoluteLiveServerRoot(root)) {
    return { error: 'root must be an absolute filesystem path.' };
  }
  if (parsed.port !== null && (typeof parsed.port !== 'number' || !Number.isFinite(parsed.port))) {
    return { error: 'port must be a number or null.' };
  }
  if (typeof parsed.watch !== 'boolean') {
    return { error: 'watch is required.' };
  }
  if (parsed.cors == null || typeof parsed.cors !== 'object') {
    return { error: 'cors is required.' };
  }

  const aliases = parseLiveServerAliases(parsed.aliases);
  const cors = normalizeLiveServerCorsSettings(parsed.cors);
  const existing = selectSavedLiveServers(ctx.getState()).find((entry) => entry.id === parsed.id);
  const headers = parseLiveServerHeaders(parsed.headers);
  const routes = parseLiveServerRoutes(parsed.routes);
  const errorPages = parseLiveServerErrorPages(parsed.errorPages);
  const proxies = parseLiveServerProxies(parsed.proxies);
  const ssl = parseLiveServerSsl(parsed.ssl);
  const config = toLiveServerConfig({
    name,
    root,
    port: parsed.port === null ? null : Math.floor(parsed.port),
    aliases,
    watch: parsed.watch,
    cors,
    openPath: parsed.openPath ?? existing?.openPath,
    openPathOnStartup: parsed.openPathOnStartup ?? existing?.openPathOnStartup,
    rememberLastUrl: parsed.rememberLastUrl ?? existing?.rememberLastUrl,
    lastOpenedPath: existing?.lastOpenedPath,
    indexFiles: parsed.indexFiles ?? existing?.indexFiles,
    host: parsed.host ?? existing?.host,
    headers: headers ?? existing?.headers,
    routes: routes ?? existing?.routes,
    errorPages: errorPages ?? existing?.errorPages,
    proxies: proxies ?? existing?.proxies,
    ssl: ssl ?? existing?.ssl,
    runCommand: parsed.runCommand ?? existing?.runCommand,
    runtimeId: parsed.runtimeId ?? existing?.runtimeId,
    runCommandEnabled: parsed.runCommandEnabled ?? existing?.runCommandEnabled,
    runCommandEnv: parsed.runCommandEnv ?? existing?.runCommandEnv,
    restartOnCrash: parsed.restartOnCrash ?? existing?.restartOnCrash,
    urlVariable: parsed.urlVariable ?? existing?.urlVariable,
    preRequestScripts:
      (parsed.preRequestScripts as LiveServerScriptRef[] | undefined) ??
      existing?.preRequestScripts,
    postRequestScripts:
      (parsed.postRequestScripts as LiveServerScriptRef[] | undefined) ??
      existing?.postRequestScripts
  });

  await ctx
    .dispatch(
      updateSavedLiveServer({
        id: parsed.id,
        ...(connectionId ? { connectionId } : {}),
        ...config
      })
    )
    .unwrap();

  await ctx.dispatch(refreshLiveServers()).unwrap();
  const updated = selectSavedLiveServers(ctx.getState()).find((entry) => entry.id === parsed.id);
  if (!updated) {
    return { error: 'Live server not found after update.' };
  }
  return { ok: true, server: summarizeSavedLiveServer(updated) };
}

/**
 * Deletes a saved live server from the local registry.
 *
 * @param args - Tool arguments.
 * @param ctx - Redux getState and dispatch.
 * @returns Success payload or an error object.
 */
async function deleteLiveServerTool(
  args: unknown,
  ctx: AiToolContext
): Promise<{ ok: true; id: number } | { error: string }> {
  const parsed = args as DeleteLiveServerToolArgs;
  if (typeof parsed?.id !== 'number' || !Number.isFinite(parsed.id)) {
    return { error: 'id is required.' };
  }

  await ctx.dispatch(refreshLiveServers()).unwrap();
  const exists = selectSavedLiveServers(ctx.getState()).some((entry) => entry.id === parsed.id);
  if (!exists) {
    return { error: 'Live server not found.' };
  }

  await ctx.dispatch(deleteSavedLiveServer(parsed.id)).unwrap();
  return { ok: true, id: parsed.id };
}

/**
 * Clears the in-memory access-log buffer for a running live server.
 *
 * @param args - Tool arguments with savedId or runtime id.
 * @returns Success payload or an error object.
 */
async function clearLiveServerLogsTool(
  args: unknown
): Promise<{ ok: true; query: LiveServerLogsQuery } | { error: string }> {
  const parsed = args as ClearLiveServerLogsToolArgs;
  const query = resolveLiveServerLogsQuery(parsed);
  if (!query) {
    return { error: 'savedId or id is required.' };
  }
  await window.api.clearLiveServerLogs(query);
  return { ok: true, query };
}
