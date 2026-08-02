import type { OAuthFetchTokenResult } from '@harborclient/core/auth';
import type { SearchDocsToolArgs } from '@harborclient/core/ai/tools';
import type { HarborDeepLink } from '@harborclient/core/deepLink';
import type { MenuSelectThemePayload, ThemeMenuOption } from '@harborclient/core/themes';
import type { ScriptLivePageRequest } from '@harborclient/core/scripting/scriptApi';
import type {
  PluginAfterScriptsContext,
  PluginHttpRequest,
  PluginHttpResponse,
  PluginInjectedScript,
  ScriptPhase
} from '@harborclient/sdk';
import { clipboard, contextBridge, ipcRenderer } from 'electron';
import os from 'node:os';
import { normalize, resolve } from 'path';
import type {
  Api,
  AuthConfig,
  BackupExportResult,
  BackupImportResult,
  BuiltinCollectionOpenRequestTarget,
  Collection,
  CollectionDocument,
  CollectionExportResult,
  StorageConnection,
  Runtime,
  VerifyRuntimeInput,
  VerifyRuntimeResult,
  EditorTab,
  Environment,
  Folder,
  AiSettings,
  AddChatMessageInput,
  AiChatSessionState,
  Chat,
  ChatMessage,
  ChatSummary,
  ChatStepInput,
  ChatStepResult,
  CreateChatInput,
  GeneralSettings,
  GenerateChatTitleInput,
  GithubModelsSignInFinishedEvent,
  GithubModelsStatus,
  HubLlmModelGroup,
  McpClientServer,
  McpClientServerListItem,
  McpClientServerStatus,
  McpClientToolInfo,
  McpServerLogEntry,
  McpServerSettings,
  McpServerStatus,
  ImportEntityResult,
  SharingIdentity,
  ListCollectionsResult,
  MenuActionId,
  AppSubmenuItemSnapshot,
  RootMenuLabel,
  PanelLayoutState,
  PemExportResult,
  PluginAssetResult,
  PluginEntryKind,
  PluginFsPickFileOptions,
  PluginFsSaveFileOptions,
  PluginGitPreview,
  PluginInfo,
  PluginCatalog,
  PluginSourcesSettings,
  ThemeCatalog,
  TeamHubPluginSourcesView,
  ResolvedThemeImport,
  SerializableMenuContribution,
  RequestExport,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  ScriptRunInput,
  ScriptRunResult,
  Snippet,
  SendRequestInput,
  SendResult,
  SaveTextFileResult,
  WriteTextInDirectoryResult,
  TeamHub,
  TeamHubSessionScanResult,
  TeamHubInvitationRedeemResult,
  TeamHubVerifiedSession,
  ReloadConfigResponse,
  HubUserRecord,
  TeamHubAdminResourceOptions,
  TeamHubAdminCollectionContents,
  TeamHubAdminSnippet,
  TeamHubAdminSnippetInput,
  TeamHubAdminRunResult,
  UpdateHubUserInput,
  CreateHubUserInput,
  CreatedHubUser,
  CreateInvitedHubUserInput,
  CreateUserInvitationInput,
  CreatedInvitedHubUser,
  HubInvitationPreview,
  HubInvitationRecord,
  HubApiTokenRecord,
  CreateHubTokenInput,
  CreatedHubToken,
  ShortcutBinding,
  ShortcutOverrides,
  SidebarExpansionState,
  ThemeSource,
  TrustedSharingKey,
  UpdateCheckResult,
  Variable,
  KeyValue,
  RequestHistoryEntry,
  CreateWorkflowInput,
  CreateWebsiteInput,
  CreateLiveServerInput,
  CreateWorkspaceInput,
  UpdateWorkflowInput,
  UpdateWebsiteInput,
  UpdateLiveServerInput,
  StartLiveServerInput,
  LiveServer,
  LiveServerFileChangedEvent,
  LiveServerLogEntry,
  LiveServerLogSession,
  LiveServerLogsQuery,
  LiveServerProcessLogEntry,
  LiveServerRequestLogEntry,
  LiveServerScriptLogEntry,
  RunningLiveServer,
  Workflow,
  Website,
  WorkflowRunHistoryEntry,
  Workspace,
  TrashEntityType,
  TrashItem,
  WorkspaceLayout,
  WorkspaceRequest
} from '@harborclient/core/types';
import type { ApisIoCollection, ApisIoCollectionList } from '@harborclient/core/apisio/catalog';
import type { PublicCollectionPreview } from '@harborclient/core/types/api/collections';
import type { SnippetImportResult } from '@harborclient/core/types/api/snippets';
import type {
  BrowserConsoleEntryPayload,
  BrowserCopyToChatPayload,
  BrowserDownloadEntry,
  BrowserDownloadsChangedPayload,
  BrowserInjectionScriptPayload,
  BrowserHcScriptsPayload,
  BrowserNavigationState,
  BrowserOpenTabRequest,
  BrowserViewBounds
} from '@harborclient/core/types/api/browser';
import type {
  CreateTerminalInput,
  CreateTerminalResult,
  TerminalDataEvent,
  TerminalExitEvent
} from '@harborclient/core/types/api/terminal';
import type {
  CollectionRunnerConfig,
  RunResultsExport,
  SavedRunResult,
  SavedRunResultSummary,
  SaveRunResultInput
} from '@harborclient/core/collectionRunner';

/**
 * Lists all collections via IPC.
 *
 * @returns Collections and any warnings when backends were unavailable.
 */
function listCollections(): Promise<ListCollectionsResult> {
  return ipcRenderer.invoke('collections:list');
}

/**
 * Creates a new collection via IPC.
 *
 * @param name - Display name for the collection.
 * @param connectionId - Optional provider id; defaults to the active database.
 * @returns The newly created collection.
 */
function createCollection(name: string, connectionId?: string): Promise<Collection> {
  return ipcRenderer.invoke('collections:create', name, connectionId);
}

/**
 * Updates a collection's name, variables, and headers via IPC.
 *
 * @param id - Collection ID to update.
 * @param name - New display name.
 * @param variables - Collection-scoped variables.
 * @param headers - Headers sent with every request in the collection.
 * @param preRequestScript - Collection pre-request script.
 * @param postRequestScript - Collection post-request script.
 * @param auth - Default Authorization settings for requests in the collection.
 * @param userAgent - User-Agent override; empty inherits the global default.
 * @param preRequestScripts - Ordered collection pre-request script references.
 * @param postRequestScripts - Ordered collection post-request script references.
 * @returns The updated collection.
 */
function updateCollection(
  id: number,
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string,
  auth: AuthConfig,
  userAgent: string,
  preRequestScripts: ScriptRef[] = [],
  postRequestScripts: ScriptRef[] = []
): Promise<Collection> {
  return ipcRenderer.invoke(
    'collections:update',
    id,
    name,
    variables,
    headers,
    preRequestScript,
    postRequestScript,
    auth,
    userAgent,
    preRequestScripts,
    postRequestScripts
  );
}

/**
 * Updates a collection sidebar marker via IPC.
 *
 * @param id - Collection ID to update.
 * @param marker - CSS marker string, or null to clear.
 */
function setCollectionMarker(id: number, marker: string | null): Promise<Collection> {
  return ipcRenderer.invoke('collections:setMarker', id, marker);
}

/**
 * Marks or unmarks a collection as archived via IPC.
 *
 * @param id - Collection ID to update.
 * @param archived - When true, hide the collection from the Collections tree.
 */
function setCollectionArchived(id: number, archived: boolean): Promise<void> {
  return ipcRenderer.invoke('collections:setArchived', id, archived);
}

/**
 * Deletes a collection via IPC.
 *
 * @param id - Collection ID to delete.
 */
function deleteCollection(id: number): Promise<void> {
  return ipcRenderer.invoke('collections:delete', id);
}

/**
 * Deep-copies a collection into a new collection on the same backend via IPC.
 *
 * @param id - Global collection ID to duplicate.
 * @returns The newly created collection.
 */
function duplicateCollection(id: number): Promise<Collection> {
  return ipcRenderer.invoke('collections:duplicate', id);
}

/**
 * Exports a collection to a JSON file via IPC.
 *
 * @param id - Collection ID to export.
 * @returns Whether the dialog was canceled and the saved path when written.
 */
function exportCollection(id: number): Promise<CollectionExportResult> {
  return ipcRenderer.invoke('collections:export', id);
}

/**
 * Imports a collection from a JSON file via IPC.
 *
 * @returns The imported collection, or null when the dialog was canceled.
 */
function importCollection(): Promise<Collection | null> {
  return ipcRenderer.invoke('collections:import');
}

/**
 * Downloads a collection from a remote URL and imports it via IPC.
 *
 * @param url - Absolute http(s) URL to a HarborClient, Postman, OpenCollection, or HAR file.
 * @returns The imported collection, or null when the user canceled a warning dialog.
 */
function importCollectionFromUrl(url: string): Promise<Collection | null> {
  return ipcRenderer.invoke('collections:importFromUrl', url);
}

/**
 * Re-downloads a URL-backed collection and merges remote changes via IPC.
 *
 * @param id - Global collection id that was previously imported from a URL.
 * @returns The updated collection after the additive merge.
 */
function refreshCollectionFromUrl(id: number): Promise<Collection> {
  return ipcRenderer.invoke('collections:refreshFromUrl', id);
}

/**
 * Searches the apis.io public catalog for importable collections via IPC.
 *
 * @param query - Free-text query over name and description.
 * @param page - Optional 1-based page number (defaults to 1).
 * @returns Paginated catalog results.
 */
function searchPublicCollections(query: string, page?: number): Promise<ApisIoCollectionList> {
  return ipcRenderer.invoke('collections:searchPublic', query, page);
}

/**
 * Downloads a public apis.io collection and returns a preview summary via IPC.
 *
 * @param item - Catalog listing selected from search results.
 * @returns Preview with format, source URL, counts, and outline.
 */
function previewPublicCollection(item: ApisIoCollection): Promise<PublicCollectionPreview> {
  return ipcRenderer.invoke('collections:previewPublic', item);
}

/**
 * Downloads a public apis.io collection and imports it via IPC.
 *
 * @param item - Catalog listing to import.
 * @returns The imported collection, or null when the user canceled a warning dialog.
 */
function importPublicCollection(item: ApisIoCollection): Promise<Collection | null> {
  return ipcRenderer.invoke('collections:importPublic', item);
}

/**
 * Exports a request to a JSON file via IPC.
 *
 * @param data - Portable request export payload.
 * @returns Whether the dialog was canceled and the saved path when written.
 */
function exportRequest(data: RequestExport): Promise<CollectionExportResult> {
  return ipcRenderer.invoke('requests:export', data);
}

/**
 * Imports a request from a JSON file via IPC.
 *
 * @param collectionId - Collection to add the imported request to.
 * @param folderId - Target folder id, or omitted/null for collection root.
 * @returns The imported request, or null when the dialog was canceled.
 */
function importRequest(
  collectionId: number,
  folderId?: number | null
): Promise<SavedRequest | null> {
  return ipcRenderer.invoke('requests:import', collectionId, folderId);
}

/**
 * Exports run results to a JSON file via IPC.
 *
 * @param data - Portable run-results export payload.
 * @returns Whether the dialog was canceled and the saved path when written.
 */
function exportRunResults(data: RunResultsExport): Promise<CollectionExportResult> {
  return ipcRenderer.invoke('runResults:export', data);
}

/**
 * Imports run results from a JSON file via IPC.
 *
 * @returns Parsed run-results export, or null when the dialog was canceled.
 */
function importRunResults(): Promise<RunResultsExport | null> {
  return ipcRenderer.invoke('runResults:import');
}

/**
 * Lists saved run result snapshots from all storage providers via IPC.
 */
function listSavedRunResults(): Promise<SavedRunResultSummary[]> {
  return ipcRenderer.invoke('runResults:list');
}

/**
 * Saves a run result snapshot to a storage provider via IPC.
 *
 * @param connectionId - Database connection or team hub id.
 * @param input - Label and portable export payload.
 */
function saveRunResult(connectionId: string, input: SaveRunResultInput): Promise<SavedRunResult> {
  return ipcRenderer.invoke('runResults:save', connectionId, input);
}

/**
 * Loads a saved run result snapshot by routed global id via IPC.
 *
 * @param id - Global run result id.
 */
function getSavedRunResult(id: number): Promise<SavedRunResult | null> {
  return ipcRenderer.invoke('runResults:get', id);
}

/**
 * Deletes a saved run result snapshot via IPC.
 *
 * @param id - Global run result id.
 */
function deleteSavedRunResult(id: number): Promise<void> {
  return ipcRenderer.invoke('runResults:delete', id);
}

/**
 * Lists persisted request history entries via IPC.
 */
function listRequestHistory(): Promise<RequestHistoryEntry[]> {
  return ipcRenderer.invoke('requestHistory:list');
}

/**
 * Persists a completed request and prunes entries beyond the configured cap.
 *
 * @param entry - Captured request/response metadata to store.
 */
function addRequestHistory(entry: RequestHistoryEntry): Promise<RequestHistoryEntry[]> {
  return ipcRenderer.invoke('requestHistory:add', entry);
}

/**
 * Removes all persisted request history entries via IPC.
 */
function clearRequestHistory(): Promise<void> {
  return ipcRenderer.invoke('requestHistory:clear');
}

/**
 * Removes one persisted request history entry via IPC.
 *
 * @param id - History entry id to delete.
 */
function deleteRequestHistory(id: number): Promise<RequestHistoryEntry[]> {
  return ipcRenderer.invoke('requestHistory:delete', id);
}

/**
 * Lists persisted workspaces via IPC.
 */
function listWorkspaces(): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:list');
}

/**
 * Creates a workspace and returns the refreshed list.
 *
 * @param input - Group name and ordered request members.
 */
function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:create', input);
}

/**
 * Replaces workspace members and optional layout and returns the refreshed list.
 *
 * @param id - Workspace id.
 * @param requests - Ordered saved request members.
 * @param layout - Optional UI layout snapshot to persist.
 */
function updateWorkspace(
  id: number,
  requests: WorkspaceRequest[],
  layout?: WorkspaceLayout | null
): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:update', id, requests, layout);
}

/**
 * Renames a workspace and returns the refreshed list.
 *
 * @param id - Workspace id.
 * @param name - New display name.
 */
function renameWorkspace(id: number, name: string): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:rename', id, name);
}

/**
 * Clones a workspace and returns the refreshed list.
 *
 * @param id - Source workspace id.
 * @param name - Name for the cloned group.
 */
function cloneWorkspace(id: number, name: string): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:clone', id, name);
}

/**
 * Deletes a workspace and returns the refreshed list.
 *
 * @param id - Workspace id.
 */
function deleteWorkspace(id: number): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:delete', id);
}

/**
 * Persists a new sidebar order for workspaces and returns the refreshed list.
 *
 * @param orderedWorkspaceIds - Workspace ids in desired order.
 */
function reorderWorkspaces(orderedWorkspaceIds: number[]): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:reorder', orderedWorkspaceIds);
}

/**
 * Updates a workspace sidebar marker and returns the refreshed list.
 *
 * @param id - Workspace id.
 * @param marker - CSS marker string, or null to clear.
 */
function setWorkspaceMarker(id: number, marker: string | null): Promise<Workspace[]> {
  return ipcRenderer.invoke('workspaces:setMarker', id, marker);
}

/**
 * Imports a workspace from a JSON file via IPC.
 */
function importWorkspace(): Promise<Workspace[] | null> {
  return ipcRenderer.invoke('workspaces:import');
}

/**
 * Lists persisted workflows via IPC.
 */
function listWorkflows(): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:list');
}

/**
 * Creates a workflow and returns the refreshed list.
 *
 * @param input - Workflow name, actions, and duration.
 */
function createWorkflow(input: CreateWorkflowInput): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:create', input);
}

/**
 * Renames a workflow and returns the refreshed list.
 *
 * @param id - Workflow id.
 * @param name - New display name.
 */
function renameWorkflow(id: number, name: string): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:rename', id, name);
}

/**
 * Updates a workflow's actions and duration and returns the refreshed list.
 *
 * @param input - Workflow id, actions, and duration.
 */
function updateWorkflow(input: UpdateWorkflowInput): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:update', input);
}

/**
 * Deletes a workflow (moves it to trash) and returns the refreshed list.
 *
 * @param id - Workflow id.
 */
function deleteWorkflow(id: number): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:delete', id);
}

/**
 * Lists persisted websites via IPC.
 */
function listWebsites(): Promise<Website[]> {
  return ipcRenderer.invoke('websites:list');
}

/**
 * Creates a website and returns the refreshed list.
 *
 * @param input - Website name, URL, and scripts.
 */
function createWebsite(input: CreateWebsiteInput): Promise<Website[]> {
  return ipcRenderer.invoke('websites:create', input);
}

/**
 * Updates a website and returns the refreshed list.
 *
 * @param input - Website id and fields to persist.
 */
function updateWebsite(input: UpdateWebsiteInput): Promise<Website[]> {
  return ipcRenderer.invoke('websites:update', input);
}

/**
 * Deletes a website (moves it to trash) and returns the refreshed list.
 *
 * @param id - Website id.
 */
function deleteWebsite(id: number): Promise<Website[]> {
  return ipcRenderer.invoke('websites:delete', id);
}

/**
 * Moves a live page to another storage provider and returns the refreshed list.
 *
 * @param id - Live page id.
 * @param targetConnectionId - Destination storage connection id.
 */
function moveWebsite(id: number, targetConnectionId: string): Promise<Website[]> {
  return ipcRenderer.invoke('websites:move', id, targetConnectionId);
}

/**
 * Imports a HarborClient live-page export via a native file dialog.
 *
 * @returns The imported or updated website, or null when the dialog was canceled.
 */
function importWebsite(): Promise<Website | null> {
  return ipcRenderer.invoke('websites:import');
}

/**
 * Starts a live server instance via IPC.
 *
 * @param input - Runtime id (optional), saved id, and server config.
 * @returns The running instance including assigned port and origin.
 */
function startLiveServer(input: StartLiveServerInput): Promise<RunningLiveServer> {
  return ipcRenderer.invoke('liveServer:start', input);
}

/**
 * Stops one running live server via IPC.
 *
 * @param id - Runtime instance id.
 */
function stopLiveServer(id: string): Promise<void> {
  return ipcRenderer.invoke('liveServer:stop', id);
}

/**
 * Lists currently running live server instances via IPC.
 */
function listRunningLiveServers(): Promise<RunningLiveServer[]> {
  return ipcRenderer.invoke('liveServer:listRunning');
}

/**
 * Lists saved live servers via IPC.
 */
function listLiveServers(): Promise<LiveServer[]> {
  return ipcRenderer.invoke('liveServers:list');
}

/**
 * Creates a saved live server and returns the refreshed list.
 *
 * @param input - Live server name, root, and options.
 */
function createLiveServer(input: CreateLiveServerInput): Promise<LiveServer[]> {
  return ipcRenderer.invoke('liveServers:create', input);
}

/**
 * Imports a HarborClient live-server export from a JSON file via IPC.
 *
 * @returns The imported or updated live server, or null when the dialog was canceled.
 */
function importLiveServer(): Promise<
  import('@harborclient/core/types').LiveServerImportResult | null
> {
  return ipcRenderer.invoke('liveServers:import');
}

/**
 * Updates a saved live server and returns the refreshed list.
 *
 * @param input - Live server id and fields to persist.
 */
function updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer[]> {
  return ipcRenderer.invoke('liveServers:update', input);
}

/**
 * Deletes a saved live server and returns the refreshed list.
 *
 * @param id - Live server id.
 */
function deleteLiveServer(id: number): Promise<LiveServer[]> {
  return ipcRenderer.invoke('liveServers:delete', id);
}

/**
 * Moves a saved live server to another storage provider and returns the refreshed list.
 *
 * @param id - Live server id.
 * @param targetConnectionId - Destination storage connection id.
 */
function moveLiveServer(id: number, targetConnectionId: string): Promise<LiveServer[]> {
  return ipcRenderer.invoke('liveServers:move', id, targetConnectionId);
}

/**
 * Persists only the machine-local last opened path for a saved live server.
 *
 * @param id - Live server id.
 * @param path - Last path opened within the server origin.
 */
function setLiveServerLastOpenedPath(id: number, path: string | null): Promise<void> {
  return ipcRenderer.invoke('liveServers:setLastOpenedPath', id, path);
}

/**
 * Returns buffered access and script logs for a running live server.
 *
 * @param query - Saved id or runtime instance id.
 */
function getLiveServerLogs(query: LiveServerLogsQuery): Promise<LiveServerLogEntry[]> {
  return ipcRenderer.invoke('liveServer:getLogs', query);
}

/**
 * Clears the in-memory request log buffer for a live-server log session.
 *
 * @param query - Saved id or runtime / session id.
 */
function clearLiveServerLogs(query: LiveServerLogsQuery): Promise<void> {
  return ipcRenderer.invoke('liveServer:clearLogs', query);
}

/**
 * Lists retained live-server log sessions (metadata only) via IPC.
 */
function listLiveServerLogSessions(): Promise<LiveServerLogSession[]> {
  return ipcRenderer.invoke('liveServer:listLogSessions');
}

/**
 * Clears retained live-server log sessions via IPC.
 *
 * Drops inactive sessions and empties active buffers (active rows remain).
 */
function clearAllLiveServerLogSessions(): Promise<void> {
  return ipcRenderer.invoke('liveServer:clearAllLogSessions');
}

/**
 * Subscribes to live-server log session list changes (start/stop/clear).
 *
 * @param callback - Handler invoked with the refreshed session metadata list.
 * @returns Unsubscribe function.
 */
function onLiveServerLogSessionsChanged(
  callback: (sessions: LiveServerLogSession[]) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, sessions: LiveServerLogSession[]): void => {
    callback(sessions);
  };
  ipcRenderer.on('liveServer:log-sessions-changed', listener);
  return () => ipcRenderer.removeListener('liveServer:log-sessions-changed', listener);
}

/**
 * Subscribes to file-change notifications from watched live servers.
 *
 * @param callback - Handler invoked after a debounced change is detected.
 * @returns Unsubscribe function.
 */
function onLiveServerFileChanged(
  callback: (event: LiveServerFileChangedEvent) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: LiveServerFileChangedEvent
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('liveServer:file-changed', listener);
  return () => ipcRenderer.removeListener('liveServer:file-changed', listener);
}

/**
 * Subscribes to running-server list changes (start/stop).
 *
 * @param callback - Handler invoked with the refreshed running list.
 * @returns Unsubscribe function.
 */
function onLiveServersChanged(callback: (running: RunningLiveServer[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, running: RunningLiveServer[]): void => {
    callback(running);
  };
  ipcRenderer.on('liveServers:changed', listener);
  return () => ipcRenderer.removeListener('liveServers:changed', listener);
}

/**
 * Subscribes to Express request log lines from running live servers.
 *
 * @param callback - Handler invoked for each completed request.
 * @returns Unsubscribe function.
 */
function onLiveServerRequestLog(callback: (entry: LiveServerRequestLogEntry) => void): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: LiveServerRequestLogEntry
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('liveServer:request-log', listener);
  return () => ipcRenderer.removeListener('liveServer:request-log', listener);
}

/**
 * Subscribes to live-server script console/test/error log lines.
 *
 * @param callback - Handler invoked for each script log line.
 * @returns Unsubscribe function.
 */
function onLiveServerScriptLog(callback: (entry: LiveServerScriptLogEntry) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: LiveServerScriptLogEntry): void => {
    callback(payload);
  };
  ipcRenderer.on('liveServer:script-log', listener);
  return () => ipcRenderer.removeListener('liveServer:script-log', listener);
}

/**
 * Subscribes to companion run-command stdout/stderr/lifecycle log lines.
 *
 * @param callback - Handler invoked for each process log line.
 * @returns Unsubscribe function.
 */
function onLiveServerProcessLog(callback: (entry: LiveServerProcessLogEntry) => void): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: LiveServerProcessLogEntry
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('liveServer:process-log', listener);
  return () => ipcRenderer.removeListener('liveServer:process-log', listener);
}

/**
 * Marks or unmarks a workflow as archived and returns the refreshed list.
 *
 * @param id - Workflow id.
 * @param archived - When true, hide the workflow from the Workflows list.
 */
function setWorkflowArchived(id: number, archived: boolean): Promise<Workflow[]> {
  return ipcRenderer.invoke('workflows:setArchived', id, archived);
}

/**
 * Lists persisted workflow run history entries via IPC.
 */
function listWorkflowRunHistory(): Promise<WorkflowRunHistoryEntry[]> {
  return ipcRenderer.invoke('workflowRunHistory:list');
}

/**
 * Persists a completed workflow run and prunes entries beyond the configured cap.
 *
 * @param entry - Captured run metadata and export payload to store.
 */
function addWorkflowRunHistory(
  entry: Omit<WorkflowRunHistoryEntry, 'id'> & { id?: number }
): Promise<WorkflowRunHistoryEntry[]> {
  return ipcRenderer.invoke('workflowRunHistory:add', entry);
}

/**
 * Removes all persisted workflow run history entries via IPC.
 */
function clearWorkflowRunHistory(): Promise<void> {
  return ipcRenderer.invoke('workflowRunHistory:clear');
}

/**
 * Removes one persisted workflow run history entry via IPC.
 *
 * @param id - History entry id to delete.
 */
function deleteWorkflowRunHistory(id: number): Promise<WorkflowRunHistoryEntry[]> {
  return ipcRenderer.invoke('workflowRunHistory:delete', id);
}

/**
 * Lists trash snapshot rows via IPC.
 */
function listTrashItems(): Promise<TrashItem[]> {
  return ipcRenderer.invoke('trash:list');
}

/**
 * Restores an entity from trash via IPC.
 *
 * @param id - Trash row id.
 */
function restoreTrashItem(id: number): Promise<TrashEntityType> {
  return ipcRenderer.invoke('trash:restore', id);
}

/**
 * Permanently deletes one trash snapshot row via IPC.
 *
 * @param id - Trash row id.
 */
function permanentlyDeleteTrashItem(id: number): Promise<void> {
  return ipcRenderer.invoke('trash:deleteItem', id);
}

/**
 * Permanently deletes every trash snapshot row via IPC.
 */
function emptyTrash(): Promise<void> {
  return ipcRenderer.invoke('trash:empty');
}

/**
 * Resolves a run result UUID across mounted Team Hub providers via IPC.
 *
 * @param uuid - Stable portable run result identifier.
 */
function resolveRunResultByUuid(uuid: string): Promise<SavedRunResult | null> {
  return ipcRenderer.invoke('runResults:getByUuid', uuid);
}

/**
 * Moves a collection to another database connection via IPC.
 *
 * @param id - Global collection ID to move.
 * @param targetConnectionId - Destination connection id.
 */
function moveCollection(id: number, targetConnectionId: string): Promise<Collection> {
  return ipcRenderer.invoke('collections:move', id, targetConnectionId);
}

/**
 * Persists a new sidebar order for collections via IPC.
 *
 * @param orderedCollectionIds - Global collection ids in desired order.
 */
function reorderCollections(orderedCollectionIds: number[]): Promise<void> {
  return ipcRenderer.invoke('collections:reorder', orderedCollectionIds);
}

/**
 * Lists all environments via IPC.
 *
 * @returns All environments from the main process.
 */
function listEnvironments(): Promise<Environment[]> {
  return ipcRenderer.invoke('environments:list');
}

/**
 * Persists a new sidebar order for environments via IPC.
 *
 * @param orderedEnvironmentIds - Environment ids in desired order.
 */
function reorderEnvironments(orderedEnvironmentIds: number[]): Promise<void> {
  return ipcRenderer.invoke('environments:reorder', orderedEnvironmentIds);
}

/**
 * Creates a new environment via IPC.
 *
 * @param name - Display name for the environment.
 * @returns The newly created environment.
 */
function createEnvironment(name: string): Promise<Environment> {
  return ipcRenderer.invoke('environments:create', name);
}

/**
 * Updates an environment's name, variables, and optional parent link via IPC.
 *
 * @param id - Environment ID to update.
 * @param name - New display name.
 * @param variables - Environment-scoped variables.
 * @param parentUuid - Parent environment uuid; `null` clears; omit to leave unchanged.
 * @returns The updated environment.
 */
function updateEnvironment(
  id: number,
  name: string,
  variables: Variable[],
  parentUuid?: string | null
): Promise<Environment> {
  return ipcRenderer.invoke('environments:update', id, name, variables, parentUuid);
}

/**
 * Updates an environment sidebar marker via IPC.
 *
 * @param id - Environment ID to update.
 * @param marker - CSS marker string, or null to clear.
 */
function setEnvironmentMarker(id: number, marker: string | null): Promise<Environment> {
  return ipcRenderer.invoke('environments:setMarker', id, marker);
}

/**
 * Deletes an environment via IPC.
 *
 * @param id - Environment ID to delete.
 */
function deleteEnvironment(id: number): Promise<void> {
  return ipcRenderer.invoke('environments:delete', id);
}

/**
 * Lists all reusable JavaScript snippets via IPC.
 */
function listSnippets(): Promise<Snippet[]> {
  return ipcRenderer.invoke('snippets:list');
}

/**
 * Creates a new snippet via IPC.
 *
 * @param name - Display name for the snippet.
 * @param code - JavaScript source.
 * @param scope - Script phases where the snippet may be referenced.
 * @param connectionId - Optional storage connection id; defaults to active storage.
 */
function createSnippet(
  name: string,
  code: string,
  scope: Snippet['scope'],
  stage?: Snippet['stage'],
  connectionId?: string
): Promise<Snippet> {
  return ipcRenderer.invoke('snippets:create', name, code, scope, stage, connectionId);
}

/**
 * Updates a snippet via IPC.
 *
 * @param id - Snippet ID to update.
 * @param name - New display name.
 * @param code - Updated JavaScript source.
 * @param scope - Script phases where the snippet may be referenced.
 * @param stage - Default stage when added to a script list.
 */
function updateSnippet(
  id: number,
  name: string,
  code: string,
  scope: Snippet['scope'],
  stage?: Snippet['stage']
): Promise<Snippet> {
  return ipcRenderer.invoke('snippets:update', id, name, code, scope, stage);
}

/**
 * Deletes a snippet via IPC.
 *
 * @param id - Snippet ID to delete.
 */
function deleteSnippet(id: number): Promise<void> {
  return ipcRenderer.invoke('snippets:delete', id);
}

/**
 * Moves a snippet to another storage provider via IPC.
 *
 * @param id - Global snippet id from the registry.
 * @param targetConnectionId - Destination storage connection id.
 */
function moveSnippet(id: number, targetConnectionId: string): Promise<Snippet> {
  return ipcRenderer.invoke('snippets:move', id, targetConnectionId);
}

/**
 * Reads a JavaScript or snippets bundle file selected via a native open dialog.
 *
 * @param includeBundle - When true, the dialog also accepts snippets bundle JSON.
 * @returns Imported source or bundle, or null when the dialog was canceled.
 */
function importSnippetFile(includeBundle?: boolean): Promise<SnippetImportResult | null> {
  return ipcRenderer.invoke('snippets:importFile', includeBundle);
}

/**
 * Fetches the public snippet marketplace catalog via IPC.
 */
function getSnippetCatalog(): Promise<import('@harborclient/core/snippet/catalog').SnippetCatalog> {
  return ipcRenderer.invoke('snippets:catalog');
}

/**
 * Fetches a snippet bundle preview from a public git repository via IPC.
 *
 * @param url - Public repository URL.
 * @param ref - Optional branch or tag.
 */
function previewSnippetFromGit(
  url: string,
  ref?: string
): Promise<import('@harborclient/core/snippet/types').SnippetGitPreview> {
  return ipcRenderer.invoke('snippets:previewFromGit', url, ref);
}

/**
 * Installs a snippet bundle from a public git repository via IPC.
 *
 * @param url - Public repository URL.
 * @param ref - Optional branch or tag.
 */
function installSnippetFromGit(
  url: string,
  ref?: string
): Promise<import('@harborclient/core/snippet/types').InstalledSnippetPackage> {
  return ipcRenderer.invoke('snippets:installFromGit', url, ref);
}

/**
 * Opens a native file picker for a `.hcs` or `.zip` snippet bundle and installs it via IPC.
 */
function installSnippet(): Promise<
  import('@harborclient/core/snippet/types').InstalledSnippetPackage | null
> {
  return ipcRenderer.invoke('snippets:install');
}

/**
 * Installs a snippet bundle from an absolute archive path via IPC.
 *
 * @param path - Absolute path to a `.hcs` or `.zip` snippet package.
 */
function installSnippetFromPath(
  path: string
): Promise<import('@harborclient/core/snippet/types').InstalledSnippetPackage> {
  return ipcRenderer.invoke('snippets:installFromPath', path);
}

/**
 * Opens a native directory picker and imports a snippet bundle via IPC.
 */
function loadUnpackedSnippet(): Promise<
  import('@harborclient/core/snippet/types').InstalledSnippetPackage | null
> {
  return ipcRenderer.invoke('snippets:loadUnpacked');
}

/**
 * Imports a snippet bundle from an absolute directory path via IPC.
 *
 * @param path - Absolute path to an unpacked snippet bundle root.
 */
function loadUnpackedSnippetFromPath(
  path: string
): Promise<import('@harborclient/core/snippet/types').InstalledSnippetPackage> {
  return ipcRenderer.invoke('snippets:loadUnpackedFromPath', path);
}

/**
 * Updates an installed snippet bundle from its stored git origin via IPC.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 */
function updateSnippetFromGit(
  catalogId: string
): Promise<import('@harborclient/core/snippet/types').InstalledSnippetPackage> {
  return ipcRenderer.invoke('snippets:updateFromGit', catalogId);
}

/**
 * Uninstalls one marketplace snippet bundle via IPC.
 *
 * @param catalogId - Snippet bundle id from snippets.json.
 */
function uninstallSnippetPackage(catalogId: string): Promise<void> {
  return ipcRenderer.invoke('snippets:uninstallPackage', catalogId);
}

/**
 * Lists installed marketplace snippet bundles via IPC.
 */
function listInstalledSnippetPackages(): Promise<
  import('@harborclient/core/snippet/types').InstalledSnippetPackage[]
> {
  return ipcRenderer.invoke('snippets:listInstalledPackages');
}

/**
 * Deep-copies an environment into a new record via IPC.
 *
 * @param id - Environment ID to duplicate.
 * @returns The newly created environment.
 */
function duplicateEnvironment(id: number): Promise<Environment> {
  return ipcRenderer.invoke('environments:duplicate', id);
}

/**
 * Exports an environment to a JSON file via IPC.
 *
 * @param id - Environment ID to export.
 * @returns Whether the dialog was canceled and the saved path when written.
 */
function exportEnvironment(id: number): Promise<CollectionExportResult> {
  return ipcRenderer.invoke('environments:export', id);
}

/**
 * Imports an environment from a JSON file via IPC.
 *
 * @returns The imported environment, or null when the dialog was canceled.
 */
function importEnvironment(): Promise<Environment | null> {
  return ipcRenderer.invoke('environments:import');
}

/**
 * Imports a collection, request, or environment from File -> Import via IPC.
 *
 * @param activeCollectionId - Selected collection id; required when importing a request.
 * @param pluginExtensions - Additional file extensions registered by enabled plugins.
 * @returns The imported entity, or null when the dialog was canceled.
 */
function importEntity(
  activeCollectionId: number | null,
  pluginExtensions?: string[]
): Promise<ImportEntityResult | null> {
  return ipcRenderer.invoke('imports:auto', activeCollectionId, pluginExtensions);
}

/**
 * Lists saved requests in a collection via IPC.
 *
 * @param collectionId - Collection to query.
 * @returns Requests in the collection.
 */
function listRequests(collectionId: number): Promise<SavedRequest[]> {
  return ipcRenderer.invoke('requests:list', collectionId);
}

/**
 * Saves a request via IPC.
 *
 * @param req - Request fields to persist.
 * @returns The saved request.
 */
function saveRequest(req: SaveRequestInput): Promise<SavedRequest> {
  return ipcRenderer.invoke('requests:save', req);
}

/**
 * Updates a saved request sidebar marker via IPC.
 *
 * @param id - Request ID to update.
 * @param marker - CSS marker string, or null to clear.
 */
function setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
  return ipcRenderer.invoke('requests:setMarker', id, marker);
}

/**
 * Deletes a saved request via IPC.
 *
 * @param id - Request ID to delete.
 */
function deleteRequest(id: number): Promise<void> {
  return ipcRenderer.invoke('requests:delete', id);
}

/**
 * Lists all folders in a collection.
 *
 * @param collectionId - Collection to query.
 * @returns Folders ordered by sort_order then name.
 */
function listFolders(collectionId: number): Promise<Folder[]> {
  return ipcRenderer.invoke('folders:list', collectionId);
}

/**
 * Creates a new folder in a collection.
 *
 * @param collectionId - Collection to add the folder to.
 * @param name - Display name for the folder.
 * @param parentFolderId - Parent folder id, or null/omitted for collection root.
 * @returns The newly created folder.
 */
function createFolder(
  collectionId: number,
  name: string,
  parentFolderId?: number | null
): Promise<Folder> {
  return ipcRenderer.invoke('folders:create', collectionId, name, parentFolderId);
}

/**
 * Moves a folder to a new parent and optional sibling index.
 *
 * @param folderId - Folder to move.
 * @param parentFolderId - New parent folder id, or null for collection root.
 * @param sortOrder - Optional zero-based index among new siblings.
 * @returns The updated folder.
 */
function moveFolder(
  folderId: number,
  parentFolderId: number | null,
  sortOrder?: number
): Promise<Folder> {
  return ipcRenderer.invoke('folders:move', folderId, parentFolderId, sortOrder);
}

/**
 * Renames a folder.
 *
 * @param id - Folder ID to rename.
 * @param name - New display name.
 * @returns The updated folder.
 */
function renameFolder(id: number, name: string): Promise<Folder> {
  return ipcRenderer.invoke('folders:rename', id, name);
}

/**
 * Updates a folder's name, variables, headers, auth, User-Agent, and scripts.
 *
 * @param id - Folder ID to update.
 * @param name - New display name.
 * @param variables - Folder-scoped variables.
 * @param headers - Headers sent with every request in the folder.
 * @param preRequestScript - Folder pre-request script.
 * @param postRequestScript - Folder post-request script.
 * @param auth - Default Authorization settings for requests in the folder.
 * @param userAgent - User-Agent override; empty inherits collection → global.
 * @param preRequestScripts - Ordered folder pre-request script references.
 * @param postRequestScripts - Ordered folder post-request script references.
 * @returns The updated folder.
 */
function updateFolder(
  id: number,
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string,
  auth: AuthConfig,
  userAgent: string,
  preRequestScripts?: ScriptRef[],
  postRequestScripts?: ScriptRef[]
): Promise<Folder> {
  return ipcRenderer.invoke(
    'folders:update',
    id,
    name,
    variables,
    headers,
    preRequestScript,
    postRequestScript,
    auth,
    userAgent,
    preRequestScripts,
    postRequestScripts
  );
}

/**
 * Updates a folder sidebar marker via IPC.
 *
 * @param id - Folder ID to update.
 * @param marker - CSS marker string, or null to clear.
 */
function setFolderMarker(id: number, marker: string | null): Promise<Folder> {
  return ipcRenderer.invoke('folders:setMarker', id, marker);
}

/**
 * Deletes a folder and all requests inside it.
 *
 * @param id - Folder ID to delete.
 */
function deleteFolder(id: number): Promise<void> {
  return ipcRenderer.invoke('folders:delete', id);
}

/**
 * Reorders sibling folders that share the same parent within a collection.
 *
 * @param collectionId - Collection containing the folders.
 * @param parentFolderId - Parent folder id, or null for collection-root siblings.
 * @param orderedFolderIds - Sibling folder IDs in desired order.
 */
function reorderFolders(
  collectionId: number,
  parentFolderId: number | null,
  orderedFolderIds: number[]
): Promise<void> {
  return ipcRenderer.invoke('folders:reorder', collectionId, parentFolderId, orderedFolderIds);
}

/**
 * Reorders requests within a folder or at collection root.
 *
 * @param collectionId - Collection containing the requests.
 * @param folderId - Folder ID, or null for root-level requests.
 * @param orderedRequestIds - Request IDs in desired order.
 */
function reorderRequests(
  collectionId: number,
  folderId: number | null,
  orderedRequestIds: number[]
): Promise<void> {
  return ipcRenderer.invoke('requests:reorder', collectionId, folderId, orderedRequestIds);
}

/**
 * Moves a request to another folder or collection root at a given index.
 *
 * @param requestId - Request ID to move.
 * @param folderId - Destination folder ID, or null for collection root.
 * @param index - Zero-based position within the destination container.
 */
function moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
  return ipcRenderer.invoke('requests:move', requestId, folderId, index);
}

/**
 * Reorders requests and markdown documents together within a folder or collection root.
 *
 * @param collectionId - Collection containing the items.
 * @param folderId - Folder ID, or null for root-level items.
 * @param items - Request and document refs in desired unified sidebar order.
 */
function reorderContainerItems(
  collectionId: number,
  folderId: number | null,
  items: Array<{ kind: 'request' | 'document'; id: number }>
): Promise<void> {
  return ipcRenderer.invoke('collections:reorder-container-items', collectionId, folderId, items);
}

/**
 * Lists all markdown documents in a collection.
 *
 * @param collectionId - Collection to query.
 * @returns Documents ordered by sort_order then name.
 */
function listDocuments(collectionId: number): Promise<CollectionDocument[]> {
  return ipcRenderer.invoke('documents:list', collectionId);
}

/**
 * Inserts a new document or updates an existing one.
 *
 * @param input - Document fields to persist.
 * @returns The saved document with ID and timestamps.
 */
function saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
  return ipcRenderer.invoke('documents:save', input);
}

/**
 * Updates a markdown document sidebar marker via IPC.
 *
 * @param id - Document ID to update.
 * @param marker - CSS marker string, or null to clear.
 */
function setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
  return ipcRenderer.invoke('documents:setMarker', id, marker);
}

/**
 * Deletes a markdown document by ID.
 *
 * @param id - Document ID to delete.
 */
function deleteDocument(id: number): Promise<void> {
  return ipcRenderer.invoke('documents:delete', id);
}

/**
 * Reorders documents within a folder or at collection root.
 *
 * @param collectionId - Collection containing the documents.
 * @param folderId - Folder ID, or null for root-level documents.
 * @param orderedDocumentIds - Document IDs in desired order.
 */
function reorderDocuments(
  collectionId: number,
  folderId: number | null,
  orderedDocumentIds: number[]
): Promise<void> {
  return ipcRenderer.invoke('documents:reorder', collectionId, folderId, orderedDocumentIds);
}

/**
 * Moves a document to another folder or collection root at a given index.
 *
 * @param documentId - Document ID to move.
 * @param folderId - Destination folder ID, or null for collection root.
 * @param index - Zero-based position within the destination container.
 */
function moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
  return ipcRenderer.invoke('documents:move', documentId, folderId, index);
}

/**
 * Sends an HTTP request via IPC.
 *
 * @param req - Request configuration to execute.
 * @param requestId - Optional ID used to cancel the in-flight request.
 * @returns Response metadata from the main process.
 */
function sendRequest(req: SendRequestInput, requestId?: string): Promise<SendResult> {
  return ipcRenderer.invoke('http:send', req, requestId);
}

/**
 * Cancels an in-flight HTTP request via IPC.
 *
 * @param requestId - ID passed to sendRequest when the request was started.
 */
function cancelRequest(requestId: string): Promise<void> {
  return ipcRenderer.invoke('http:cancel', requestId);
}

/**
 * Returns cookies stored for a hostname via IPC.
 *
 * @param domain - Hostname to query.
 */
function getCookies(domain: string): Promise<KeyValue[]> {
  return ipcRenderer.invoke('cookies:getForDomain', domain);
}

/**
 * Returns domains with saved cookies via IPC.
 */
function listCookieDomains(): Promise<string[]> {
  return ipcRenderer.invoke('cookies:listDomains');
}

/**
 * Persists cookies for a hostname via IPC.
 *
 * @param domain - Hostname to update.
 * @param cookies - Cookie rows to store.
 */
function setCookies(domain: string, cookies: KeyValue[]): Promise<void> {
  return ipcRenderer.invoke('cookies:setForDomain', domain, cookies);
}

/**
 * Runs a pre/post script via IPC.
 *
 * @param input - Script source, phase, request/response context, and variables.
 * @returns Mutated request, variable sets, tests, and logs from the sandbox.
 */
function runScript(input: ScriptRunInput): Promise<ScriptRunResult> {
  return ipcRenderer.invoke('scripts:run', input);
}

/**
 * Subscribes to menu bar action events from the main process.
 *
 * @param callback - Handler invoked with the menu action id.
 * @returns Unsubscribe function.
 */
function onMenuAction(callback: (action: MenuActionId) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, action: MenuActionId): void => {
    callback(action);
  };
  ipcRenderer.on('menu:action', listener);
  return () => ipcRenderer.removeListener('menu:action', listener);
}

/**
 * Subscribes to harborclient:// deep-link events from the main process.
 *
 * @param callback - Handler invoked with a parsed deep-link action.
 * @returns Unsubscribe function.
 */
function onDeepLink(callback: (payload: HarborDeepLink) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: HarborDeepLink): void => {
    callback(payload);
  };
  ipcRenderer.on('app:deep-link', listener);
  return () => ipcRenderer.removeListener('app:deep-link', listener);
}

/**
 * Syncs sidebar visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the sidebar is currently visible in the renderer.
 */
function setMenuSidebarVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setSidebarVisible', visible);
}

/**
 * Syncs activity-rail visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the activity rail is currently visible in the renderer.
 */
function setMenuRailVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setRailVisible', visible);
}

/**
 * Syncs AI sidebar visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the AI sidebar is currently visible in the renderer.
 */
function setMenuAiSidebarVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setAiSidebarVisible', visible);
}

/**
 * Syncs Git sidebar visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the Git sidebar is currently visible in the renderer.
 */
function setMenuGitSidebarVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setGitSidebarVisible', visible);
}

/**
 * Syncs request editor visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the request editor is currently visible in the renderer.
 */
function setMenuRequestEditorVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setRequestEditorVisible', visible);
}

/**
 * Syncs response editor visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the response editor is currently visible in the renderer.
 */
function setMenuResponseEditorVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setResponseEditorVisible', visible);
}

/**
 * Syncs shortcuts reference modal open state to the View > Appearance submenu checkbox.
 *
 * @param open - Whether the shortcuts reference modal is currently open.
 */
function setMenuShortcutsSidebarOpen(open: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setShortcutsSidebarOpen', open);
}

/**
 * Syncs console panel visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the console panel is currently open.
 */
function setMenuConsoleVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setConsoleVisible', visible);
}

/**
 * Syncs variables panel visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the variables panel is currently open.
 */
function setMenuVariablesVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setVariablesVisible', visible);
}

/**
 * Syncs MCP panel visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the MCP panel is currently open.
 */
function setMenuMcpVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setMcpVisible', visible);
}

/**
 * Syncs terminal panel visibility to the View > Appearance submenu checkbox in the main process.
 *
 * @param visible - Whether the terminal panel is currently open.
 */
function setMenuTerminalVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setTerminalVisible', visible);
}

/**
 * Syncs storage-location badge visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether storage-location badges are shown on sidebar rows.
 */
function setMenuStorageLocationsVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setStorageLocationsVisible', visible);
}

/**
 * Syncs color marker visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether color marker dots are shown on sidebar rows.
 */
function setMenuColorMarkersVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setColorMarkersVisible', visible);
}

/**
 * Syncs method-color highlight visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether HTTP method badges use per-method colors.
 */
function setMenuHighlightsVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setHighlightsVisible', visible);
}

/**
 * Syncs status indicator visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether HTTP/run status indicators are shown on sidebar rows.
 */
function setMenuIndicatorsVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setIndicatorsVisible', visible);
}

/**
 * Syncs sidebar filter-control visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether section-header filter controls are shown.
 */
function setMenuFiltersVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setFiltersVisible', visible);
}

/**
 * Syncs sidebar sort-control visibility to the View > Appearance submenu checkbox.
 *
 * @param visible - Whether section-header sort controls are shown.
 */
function setMenuSortingVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setSortingVisible', visible);
}

/**
 * Syncs active theme and plugin theme options to the View menu in the main process.
 *
 * @param theme - Persisted appearance theme preference.
 * @param options - Plugin-provided theme menu options.
 */
function setMenuThemeMenuState(theme: ThemeSource, options: ThemeMenuOption[]): Promise<void> {
  return ipcRenderer.invoke('menu:setThemeMenuState', theme, options);
}

/**
 * Syncs Designer undo/redo ownership and enabled state to the Edit menu in the main process.
 *
 * @param active - Whether the Designer tab is open and should own undo/redo.
 * @param canUndo - Whether an undo step is available in the Designer history.
 * @param canRedo - Whether a redo step is available in the Designer history.
 */
function setMenuDesignerUndoRedo(
  active: boolean,
  canUndo: boolean,
  canRedo: boolean
): Promise<void> {
  return ipcRenderer.invoke('menu:setDesignerUndoRedo', active, canUndo, canRedo);
}

/**
 * Syncs tab-group availability to the Edit menu in the main process.
 *
 * @param available - Whether at least one saved request tab is open.
 */
function setWorkspaceAvailable(available: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setWorkspaceAvailable', available);
}

/**
 * Syncs collections sidebar deselect availability to the Edit menu in the main process.
 *
 * @param available - Whether the collections sidebar has selection to clear.
 */
function setSidebarDeselectAllAvailable(available: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setSidebarDeselectAllAvailable', available);
}

/**
 * Syncs git-backed collection availability to the Git menu in the main process.
 *
 * @param active - Whether the active collection is git-backed.
 */
function setMenuGitCollectionActive(active: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setGitCollectionActive', active);
}

/**
 * Subscribes to View menu appearance theme selection events from the main process.
 *
 * @param callback - Handler invoked with the selected theme and label.
 */
function onMenuSelectTheme(callback: (payload: MenuSelectThemePayload) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: MenuSelectThemePayload): void => {
    callback(payload);
  };
  ipcRenderer.on('menu:selectTheme', listener);
  return () => ipcRenderer.removeListener('menu:selectTheme', listener);
}

/**
 * Opens a root application submenu at the given window coordinates.
 *
 * Used by the Linux in-app menu bar where frameless windows have no native menu strip.
 *
 * @param label - Root menu label to open.
 * @param x - Left edge in window coordinates.
 * @param y - Top edge in window coordinates.
 */
function popupMenuSubmenu(label: RootMenuLabel, x: number, y: number): Promise<void> {
  return ipcRenderer.invoke('menu:popupSubmenu', label, x, y);
}

/**
 * Returns a serializable snapshot of a root application submenu for Linux in-app menus.
 *
 * @param label - Root menu label to describe.
 */
function getAppSubmenuSnapshot(label: RootMenuLabel): Promise<AppSubmenuItemSnapshot[]> {
  return ipcRenderer.invoke('menu:getSubmenuSnapshot', label);
}

/**
 * Activates an item from a root application submenu snapshot by index.
 *
 * @param label - Root menu label that owns the item.
 * @param index - Flat item index from {@link getAppSubmenuSnapshot}.
 * @param nestedIndex - Index of a child item when activating a nested submenu entry (such as View > Theme).
 */
function activateAppSubmenuItem(
  label: RootMenuLabel,
  index: number,
  nestedIndex?: number
): Promise<void> {
  return ipcRenderer.invoke('menu:activateSubmenuItem', label, index, nestedIndex);
}

/**
 * Returns the application version from package.json.
 */
function getAppVersion(): Promise<string> {
  return ipcRenderer.invoke('app:getVersion');
}

/**
 * Compares the running version against the latest GitHub release.
 */
function checkForUpdates(): Promise<UpdateCheckResult> {
  return ipcRenderer.invoke('app:checkForUpdates');
}

/**
 * Forwards renderer diagnostics to the main-process verbose log stream.
 *
 * @param step - Short step label.
 * @param detail - Optional structured fields for the step.
 */
function logVerbose(step: string, detail?: Record<string, unknown>): Promise<void> {
  return ipcRenderer.invoke('app:logVerbose', step, detail);
}

/**
 * Returns the persisted theme preference.
 */
function getTheme(): Promise<ThemeSource> {
  return ipcRenderer.invoke('theme:get');
}

/**
 * Persists and applies a theme preference.
 *
 * @param theme - Theme source to apply.
 */
function setTheme(theme: ThemeSource): Promise<void> {
  return ipcRenderer.invoke('theme:set', theme);
}

/**
 * Applies a theme preference without persisting it (theme picker live preview).
 *
 * @param theme - Theme source to preview.
 */
function previewTheme(theme: ThemeSource): Promise<void> {
  return ipcRenderer.invoke('theme:preview', theme);
}

/**
 * Returns whether the first-run theme picker modal should open.
 */
function shouldPickTheme(): Promise<boolean> {
  return ipcRenderer.invoke('theme:shouldPrompt');
}

/**
 * Marks the first-run theme picker as seen so it is not shown again.
 */
function markThemePickerSeen(): Promise<void> {
  return ipcRenderer.invoke('theme:markPickerSeen');
}

/**
 * Returns the current main-window zoom factor.
 */
function getZoomFactor(): Promise<number> {
  return ipcRenderer.invoke('zoom:get');
}

/**
 * Applies a zoom factor without persisting it (theme picker live preview).
 *
 * @param factor - Target zoom factor.
 */
function previewZoomFactor(factor: number): Promise<void> {
  return ipcRenderer.invoke('zoom:preview', factor);
}

/**
 * Persists and applies the main-window zoom factor.
 *
 * @param factor - Target zoom factor.
 */
function setZoomFactor(factor: number): Promise<void> {
  return ipcRenderer.invoke('zoom:set', factor);
}

/**
 * Returns whether the Getting Started tab should open automatically on launch.
 */
function shouldOpenGettingStarted(): Promise<boolean> {
  return ipcRenderer.invoke('getting-started:shouldOpen');
}

/**
 * Marks Getting Started as seen so it is not auto-opened on future launches.
 */
function markGettingStartedSeen(): Promise<void> {
  return ipcRenderer.invoke('getting-started:markSeen');
}

/**
 * Returns and clears the one-shot built-in request open target after first-run import.
 */
function consumeBuiltinCollectionOpenRequestTarget(): Promise<BuiltinCollectionOpenRequestTarget | null> {
  return ipcRenderer.invoke('builtin-collections:consumeOpenRequestTarget');
}

/**
 * Subscribes to theme preference change notifications from the main process.
 *
 * @param callback - Called with the new persisted theme preference.
 */
function onThemeChanged(callback: (theme: ThemeSource) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, theme: ThemeSource): void => {
    callback(theme);
  };
  ipcRenderer.on('theme:changed', listener);
  return () => ipcRenderer.removeListener('theme:changed', listener);
}

/**
 * Returns whether developer tooling (DevTools, Inspect Element) is available.
 */
function isDeveloperToolsEnabled(): Promise<boolean> {
  return ipcRenderer.invoke('app:isDeveloperToolsEnabled');
}

/**
 * Inspects the DOM node at viewport coordinates and opens DevTools when enabled.
 *
 * @param x - Horizontal coordinate relative to the viewport.
 * @param y - Vertical coordinate relative to the viewport.
 */
function inspectElement(x: number, y: number): Promise<void> {
  return ipcRenderer.invoke('window:inspectElement', { x, y });
}

/**
 * Minimizes the focused application window.
 */
function minimizeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:minimize');
}

/**
 * Focuses the main renderer webContents so shell UI can receive keyboard input.
 */
function focusRenderer(): Promise<void> {
  return ipcRenderer.invoke('window:focusRenderer');
}

/**
 * Toggles maximize on the focused application window.
 */
function toggleMaximizeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:toggleMaximize');
}

/**
 * Toggles native fullscreen on the focused application window.
 */
function toggleFullscreenWindow(): Promise<void> {
  return ipcRenderer.invoke('window:toggleFullscreen');
}

/**
 * Closes the focused application window, honoring the quit prompt when configured.
 */
function closeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:close');
}

/**
 * Signals that the renderer shell has finished bootstrap so main may close
 * the splash and show the main window.
 */
function notifyUiReady(): Promise<void> {
  return ipcRenderer.invoke('window:notifyUiReady');
}

/**
 * Returns persisted general request settings.
 */
function getGeneralSettings(): Promise<GeneralSettings> {
  return ipcRenderer.invoke('general:getSettings');
}

/**
 * Persists general request settings.
 *
 * @param settings - General configuration to store.
 */
function setGeneralSettings(settings: GeneralSettings): Promise<void> {
  return ipcRenderer.invoke('general:setSettings', settings);
}

/**
 * Returns persisted AI provider API keys.
 */
function getAiSettings(): Promise<AiSettings> {
  return ipcRenderer.invoke('ai:getSettings');
}

/**
 * Persists AI provider API keys.
 *
 * @param settings - AI configuration to store.
 */
function setAiSettings(settings: AiSettings): Promise<void> {
  return ipcRenderer.invoke('ai:setSettings', settings);
}

/**
 * Returns persisted MCP server settings.
 */
function getMcpServerSettings(): Promise<McpServerSettings> {
  return ipcRenderer.invoke('mcp:getServerSettings');
}

/**
 * Persists MCP server settings and applies the HTTP listener lifecycle.
 *
 * @param settings - MCP server configuration to store.
 */
function setMcpServerSettings(settings: McpServerSettings): Promise<McpServerSettings> {
  return ipcRenderer.invoke('mcp:setServerSettings', settings);
}

/**
 * Returns whether the local MCP HTTP server is running.
 */
function getMcpServerStatus(): Promise<McpServerStatus> {
  return ipcRenderer.invoke('mcp:getServerStatus');
}

/**
 * Generates a new MCP server bearer token and persists it.
 */
function regenerateMcpServerToken(): Promise<McpServerSettings> {
  return ipcRenderer.invoke('mcp:regenerateToken');
}

/**
 * Returns persisted sanitized MCP server log entries (oldest first).
 */
function getMcpServerLogs(): Promise<McpServerLogEntry[]> {
  return ipcRenderer.invoke('mcp:getServerLogs');
}

/**
 * Subscribes to newly appended MCP server log entries while Keep logs is on.
 *
 * @param callback - Invoked with each newly persisted log entry.
 * @returns Unsubscribe function.
 */
function onMcpServerLog(callback: (entry: McpServerLogEntry) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, entry: unknown): void => {
    callback(entry as McpServerLogEntry);
  };
  ipcRenderer.on('mcp:serverLog', listener);
  return () => {
    ipcRenderer.removeListener('mcp:serverLog', listener);
  };
}

/**
 * Lists configured remote MCP client servers, including plugin registrations.
 */
function listMcpClientServers(): Promise<McpClientServerListItem[]> {
  return ipcRenderer.invoke('mcp:listClientServers');
}

/**
 * Creates or updates a remote MCP client server.
 *
 * @param server - Client server record to persist.
 */
function saveMcpClientServer(server: McpClientServer): Promise<McpClientServerListItem[]> {
  return ipcRenderer.invoke('mcp:saveClientServer', server);
}

/**
 * Deletes a remote MCP client server by id.
 *
 * @param id - Client server id to remove.
 */
function deleteMcpClientServer(id: string): Promise<McpClientServerListItem[]> {
  return ipcRenderer.invoke('mcp:deleteClientServer', id);
}

/**
 * Subscribes to MCP client server list changes from plugin registration lifecycle.
 */
function onMcpClientServersChanged(callback: () => void): () => void {
  const listener = (): void => {
    callback();
  };
  ipcRenderer.on('mcp:clientServersChanged', listener);
  return () => {
    ipcRenderer.removeListener('mcp:clientServersChanged', listener);
  };
}

/**
 * Returns connection status for configured MCP client servers.
 */
function listMcpClientServerStatuses(): Promise<McpClientServerStatus[]> {
  return ipcRenderer.invoke('mcp:listClientServerStatuses');
}

/**
 * Lists cached MCP client tools available to the chat agent.
 */
function listMcpClientTools(): Promise<McpClientToolInfo[]> {
  return ipcRenderer.invoke('mcp:listClientTools');
}

/**
 * Invokes a prefixed MCP client tool on the matching remote server.
 *
 * @param prefixedName - Tool name with mcp__ prefix from the model.
 * @param args - Parsed tool arguments object.
 */
function mcpCallTool(prefixedName: string, args: unknown): Promise<string> {
  return ipcRenderer.invoke('mcp:callTool', prefixedName, args);
}

/**
 * Searches HarborClient site and SDK documentation for the AI assistant.
 *
 * @param args - Query text and optional limit/source filter.
 */
function searchDocs(args: SearchDocsToolArgs): Promise<string> {
  return ipcRenderer.invoke('docs:search', args);
}

/**
 * Subscribes to MCP server tool invocations routed from external MCP clients.
 */
function onMcpServerToolInvoke(
  callback: (message: { requestId: number; name: string; args: unknown }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('mcp:serverToolInvoke', listener);
  return () => {
    ipcRenderer.removeListener('mcp:serverToolInvoke', listener);
  };
}

/**
 * Completes an MCP server tool invocation with a result or error.
 */
function completeMcpServerTool(message: {
  requestId: number;
  ok: boolean;
  result?: string;
  error?: string;
}): void {
  ipcRenderer.send('mcp:serverToolComplete', message);
}

/**
 * Subscribes to script livePage invocations routed from the main-process script host.
 */
function onScriptLivePageInvoke(
  callback: (message: { requestId: number; req: ScriptLivePageRequest }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as { requestId: number; req: ScriptLivePageRequest });
  };
  ipcRenderer.on('scripts:livePageInvoke', listener);
  return () => {
    ipcRenderer.removeListener('scripts:livePageInvoke', listener);
  };
}

/**
 * Completes a script live page invocation with a result or error.
 */
function completeScriptLivePage(message: {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}): void {
  ipcRenderer.send('scripts:livePageComplete', message);
}

/**
 * Spawns a shell in a pseudo-terminal owned by the calling renderer.
 *
 * @param input - Tab id, optional cwd, and initial terminal dimensions.
 */
function createTerminal(input: CreateTerminalInput): Promise<CreateTerminalResult> {
  return ipcRenderer.invoke('terminal:create', input);
}

/**
 * Sends raw input to an active terminal session.
 *
 * @param id - Terminal tab id.
 * @param data - Bytes to write to shell stdin.
 */
function writeTerminal(id: string, data: string): void {
  ipcRenderer.send('terminal:write', id, data);
}

/**
 * Resizes an active terminal session.
 *
 * @param id - Terminal tab id.
 * @param cols - New width in columns.
 * @param rows - New height in rows.
 */
function resizeTerminal(id: string, cols: number, rows: number): void {
  ipcRenderer.send('terminal:resize', id, cols, rows);
}

/**
 * Kills one terminal session.
 *
 * @param id - Terminal tab id.
 */
function killTerminal(id: string): Promise<void> {
  return ipcRenderer.invoke('terminal:kill', id);
}

/**
 * Subscribes to streamed terminal output from the main process.
 *
 * @param callback - Handler invoked for each output chunk.
 */
function onTerminalData(callback: (event: TerminalDataEvent) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent): void => {
    callback(payload);
  };
  ipcRenderer.on('terminal:data', listener);
  return () => ipcRenderer.removeListener('terminal:data', listener);
}

/**
 * Reads the system clipboard text for terminal OSC 52 support.
 *
 * @returns Current clipboard text, or an empty string when unavailable.
 */
function readClipboardText(): string {
  return clipboard.readText();
}

/**
 * Writes text to the system clipboard for terminal OSC 52 support.
 *
 * @param text - Plain text to store on the clipboard.
 */
function writeClipboardText(text: string): void {
  clipboard.writeText(text);
}

/**
 * Subscribes to shell exit notifications from the main process.
 *
 * @param callback - Handler invoked when a shell process exits.
 */
function onTerminalExit(callback: (event: TerminalExitEvent) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent): void => {
    callback(payload);
  };
  ipcRenderer.on('terminal:exit', listener);
  return () => ipcRenderer.removeListener('terminal:exit', listener);
}

/**
 * Lists all AI chats ordered by most recently updated.
 */
function listChats(): Promise<ChatSummary[]> {
  return ipcRenderer.invoke('chats:list');
}

/**
 * Creates a new AI chat thread.
 *
 * @param input - Optional title and model for the new chat.
 */
function createChat(input: CreateChatInput): Promise<Chat> {
  return ipcRenderer.invoke('chats:create', input);
}

/**
 * Loads a chat and its messages by id.
 *
 * @param id - Chat id to load.
 */
function getChat(id: number): Promise<Chat | null> {
  return ipcRenderer.invoke('chats:get', id);
}

/**
 * Appends a message to a chat thread.
 *
 * @param input - Chat id, stage, content, and optional model.
 */
function addChatMessage(input: AddChatMessageInput): Promise<ChatMessage> {
  return ipcRenderer.invoke('chats:addMessage', input);
}

/**
 * Summarizes the user's first message into a short chat title and persists it.
 *
 * @param input - Chat id, prompt text, and model routing fields.
 */
function generateChatTitle(input: GenerateChatTitleInput): Promise<string> {
  return ipcRenderer.invoke('chats:generateTitle', input);
}

/**
 * Runs one LLM completion step with tool definitions.
 *
 * @param input - Model id and conversation messages for the step.
 * @param stepRequestId - Optional client id used to cancel the in-flight step.
 */
function completeChatStep(input: ChatStepInput, stepRequestId?: string): Promise<ChatStepResult> {
  return ipcRenderer.invoke('chats:completeStep', input, stepRequestId);
}

/**
 * Aborts an in-flight LLM completion step via IPC.
 *
 * @param stepRequestId - Id passed to completeChatStep when the step was started.
 */
function cancelChatStep(stepRequestId: string): Promise<void> {
  return ipcRenderer.invoke('chats:cancelStep', stepRequestId);
}

/**
 * Lists LLM models offered by configured Team Hubs.
 */
function listHubLlmModels(): Promise<HubLlmModelGroup[]> {
  return ipcRenderer.invoke('llm:listHubModels');
}

/**
 * Returns GitHub Models connection status.
 */
function getGithubModelsStatus(): Promise<GithubModelsStatus> {
  return ipcRenderer.invoke('githubModels:getStatus');
}

/**
 * Starts GitHub Models device flow and returns the user code for browser approval.
 *
 * The browser is not opened until {@link completeGithubModelsSignIn} is called.
 */
function startGithubModelsSignIn(): Promise<{ userCode: string; verificationUri: string }> {
  return ipcRenderer.invoke('githubModels:startSignIn');
}

/**
 * Opens the GitHub Models verification URI and starts background sign-in polling.
 *
 * @param verificationUri - Device-flow verification URL from {@link startGithubModelsSignIn}.
 */
function completeGithubModelsSignIn(verificationUri: string): Promise<void> {
  return ipcRenderer.invoke('githubModels:completeSignIn', verificationUri);
}

/**
 * Removes stored GitHub Models credentials.
 */
function signOutGithubModels(): Promise<void> {
  return ipcRenderer.invoke('githubModels:signOut');
}

/**
 * Subscribes to background GitHub Models sign-in completion events.
 *
 * @param callback - Handler invoked when sign-in polling finishes or fails.
 * @returns Unsubscribe function.
 */
function onGithubModelsSignInFinished(
  callback: (event: GithubModelsSignInFinishedEvent) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: GithubModelsSignInFinishedEvent
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('githubModels:signInFinished', listener);
  return () => ipcRenderer.removeListener('githubModels:signInFinished', listener);
}

/**
 * Deletes a chat and its messages.
 *
 * @param id - Chat id to delete.
 */
function deleteChat(id: number): Promise<void> {
  return ipcRenderer.invoke('chats:delete', id);
}

/**
 * Lists all configured database connections via IPC.
 */
function listStorageConnections(): Promise<StorageConnection[]> {
  return ipcRenderer.invoke('storageConnections:list');
}

/**
 * Creates or updates a database connection via IPC.
 *
 * @param conn - Connection to persist.
 */
function saveStorageConnection(conn: StorageConnection): Promise<StorageConnection[]> {
  return ipcRenderer.invoke('storageConnections:save', conn);
}

/**
 * Deletes a database connection via IPC.
 *
 * @param id - Connection id to remove.
 */
function deleteStorageConnection(id: string): Promise<StorageConnection[]> {
  return ipcRenderer.invoke('storageConnections:delete', id);
}

/**
 * Lists machine-local companion-process runtimes via IPC.
 */
function listRuntimes(): Promise<Runtime[]> {
  return ipcRenderer.invoke('runtimes:list');
}

/**
 * Creates or updates a companion-process runtime via IPC.
 *
 * @param runtime - Runtime to persist; empty id inserts a new runtime.
 */
function saveRuntime(runtime: Runtime): Promise<Runtime[]> {
  return ipcRenderer.invoke('runtimes:save', runtime);
}

/**
 * Deletes a companion-process runtime via IPC.
 *
 * @param id - Runtime id to remove.
 */
function deleteRuntime(id: string): Promise<Runtime[]> {
  return ipcRenderer.invoke('runtimes:delete', id);
}

/**
 * Verifies a runtime executable path and declared version via IPC.
 *
 * @param input - Kind, version, and path to verify.
 */
function verifyRuntime(input: VerifyRuntimeInput): Promise<VerifyRuntimeResult> {
  return ipcRenderer.invoke('runtimes:verify', input);
}

/**
 * Lists all configured team hubs via IPC.
 */
function listTeamHubs(): Promise<TeamHub[]> {
  return ipcRenderer.invoke('teamHubs:list');
}

/**
 * Creates or updates a team hub via IPC.
 *
 * @param hub - Team hub to persist.
 */
function saveTeamHub(hub: TeamHub): Promise<TeamHub[]> {
  return ipcRenderer.invoke('teamHubs:save', hub);
}

/**
 * Deletes a team hub via IPC.
 *
 * @param id - Team hub id to remove.
 */
function deleteTeamHub(id: string): Promise<TeamHub[]> {
  return ipcRenderer.invoke('teamHubs:delete', id);
}

/**
 * Soft-connects or soft-disconnects a team hub via IPC without deleting it.
 *
 * @param id - Team hub id to update.
 * @param connected - Whether the hub should be mounted.
 */
function setTeamHubConnected(id: string, connected: boolean): Promise<TeamHub[]> {
  return ipcRenderer.invoke('teamHubs:setConnected', id, connected);
}

/**
 * Probes configured team hubs for session capabilities via IPC.
 */
function scanTeamHubSessions(): Promise<TeamHubSessionScanResult[]> {
  return ipcRenderer.invoke('teamHubs:scanSessions');
}

/**
 * Re-reads reloadable config sections on a Team Hub using an admin token.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function reloadTeamHubConfig(hubId: string): Promise<ReloadConfigResponse> {
  return ipcRenderer.invoke('teamHubs:reloadConfig', hubId);
}

/**
 * Lists Team Hub user accounts via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubUsers(hubId: string): Promise<HubUserRecord[]> {
  return ipcRenderer.invoke('teamHubs:listUsers', hubId);
}

/**
 * Updates a Team Hub user account via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param userId - User account identifier to update.
 * @param input - Partial user fields to apply.
 */
function updateTeamHubUser(
  hubId: string,
  userId: string,
  input: UpdateHubUserInput
): Promise<HubUserRecord> {
  return ipcRenderer.invoke('teamHubs:updateUser', hubId, userId, input);
}

/**
 * Deletes a Team Hub user account via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param userId - User account identifier to delete.
 */
function deleteTeamHubUser(hubId: string, userId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteUser', hubId, userId);
}

/**
 * Creates a Team Hub user account and initial token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param input - User fields for the new account.
 */
function createTeamHubUser(hubId: string, input: CreateHubUserInput): Promise<CreatedHubUser> {
  return ipcRenderer.invoke('teamHubs:createUser', hubId, input);
}

/**
 * Creates a Team Hub user account and onboarding invitation via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param input - User fields and optional invitation expiry.
 */
function createTeamHubInvitedUser(
  hubId: string,
  input: CreateInvitedHubUserInput
): Promise<CreatedInvitedHubUser> {
  return ipcRenderer.invoke('teamHubs:createInvitedUser', hubId, input);
}

/**
 * Issues a replacement onboarding invitation for an existing user account via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param userId - User account identifier.
 * @param input - Optional invitation expiry override.
 */
function createTeamHubUserInvitation(
  hubId: string,
  userId: string,
  input?: CreateUserInvitationInput
): Promise<CreatedInvitedHubUser> {
  return ipcRenderer.invoke('teamHubs:createUserInvitation', hubId, userId, input);
}

/**
 * Lists onboarding invitations via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubInvitations(hubId: string): Promise<HubInvitationRecord[]> {
  return ipcRenderer.invoke('teamHubs:listInvitations', hubId);
}

/**
 * Revokes a pending onboarding invitation via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param invitationId - Invitation record identifier.
 */
function revokeTeamHubInvitation(hubId: string, invitationId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:revokeInvitation', hubId, invitationId);
}

/**
 * Returns invited user details for confirmation without consuming the invitation.
 *
 * @param baseUrl - Team Hub server base URL.
 * @param code - Invitation secret prefixed with `hbi_`.
 */
function previewTeamHubInvitation(baseUrl: string, code: string): Promise<HubInvitationPreview> {
  return ipcRenderer.invoke('teamHubs:previewInvitation', baseUrl, code);
}

/**
 * Redeems an invitation, verifies the issued bearer token, and returns both results.
 *
 * @param baseUrl - Team Hub server base URL.
 * @param code - Invitation secret prefixed with `hbi_`.
 * @param tokenName - Optional label for the issued API token.
 */
function redeemTeamHubInvitation(
  baseUrl: string,
  code: string,
  tokenName?: string
): Promise<TeamHubInvitationRedeemResult> {
  return ipcRenderer.invoke('teamHubs:redeemInvitation', baseUrl, code, tokenName);
}

/**
 * Verifies a bearer token against session introspection without persisting it.
 *
 * @param baseUrl - Team Hub server base URL.
 * @param token - Bearer token prefixed with `hbk_`.
 */
function verifyTeamHubSession(baseUrl: string, token: string): Promise<TeamHubVerifiedSession> {
  return ipcRenderer.invoke('teamHubs:verifySession', baseUrl, token);
}

/**
 * Lists Team Hub API tokens via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubTokens(hubId: string): Promise<HubApiTokenRecord[]> {
  return ipcRenderer.invoke('teamHubs:listTokens', hubId);
}

/**
 * Creates a Team Hub API token for a user via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param userId - Owning user account identifier.
 * @param input - Human-readable label for the new token.
 */
function createTeamHubUserToken(
  hubId: string,
  userId: string,
  input: CreateHubTokenInput
): Promise<CreatedHubToken> {
  return ipcRenderer.invoke('teamHubs:createToken', hubId, userId, input);
}

/**
 * Deletes a Team Hub API token via IPC using an admin token on the given hub.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param tokenId - Token record identifier to delete.
 */
function deleteTeamHubToken(hubId: string, tokenId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteToken', hubId, tokenId);
}

/**
 * Loads admin resource options for user management forms via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubAdminResourceOptions(hubId: string): Promise<TeamHubAdminResourceOptions> {
  return ipcRenderer.invoke('teamHubs:listAdminResourceOptions', hubId);
}

/**
 * Loads folders and saved requests in a hub collection for admin inspection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param collectionId - Server collection UUID.
 */
function listTeamHubAdminCollectionContents(
  hubId: string,
  collectionId: string
): Promise<TeamHubAdminCollectionContents> {
  return ipcRenderer.invoke('teamHubs:listAdminCollectionContents', hubId, collectionId);
}

/**
 * Deletes a hub collection using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param collectionId - Server collection UUID.
 */
function deleteTeamHubCollection(hubId: string, collectionId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteCollection', hubId, collectionId);
}

/**
 * Lists hub snippets using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubAdminSnippets(hubId: string): Promise<TeamHubAdminSnippet[]> {
  return ipcRenderer.invoke('teamHubs:listAdminSnippets', hubId);
}

/**
 * Creates a hub snippet using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param input - Snippet name, code, and scope.
 */
function createTeamHubAdminSnippet(
  hubId: string,
  input: TeamHubAdminSnippetInput
): Promise<TeamHubAdminSnippet> {
  return ipcRenderer.invoke('teamHubs:createAdminSnippet', hubId, input);
}

/**
 * Updates a hub snippet using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param snippetId - Server snippet UUID.
 * @param input - Updated snippet name, code, and scope.
 */
function updateTeamHubAdminSnippet(
  hubId: string,
  snippetId: string,
  input: TeamHubAdminSnippetInput
): Promise<TeamHubAdminSnippet> {
  return ipcRenderer.invoke('teamHubs:updateAdminSnippet', hubId, snippetId, input);
}

/**
 * Deletes a hub snippet using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param snippetId - Server snippet UUID.
 */
function deleteTeamHubAdminSnippet(hubId: string, snippetId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteAdminSnippet', hubId, snippetId);
}

/**
 * Lists hub run results using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 */
function listTeamHubAdminRunResults(hubId: string): Promise<TeamHubAdminRunResult[]> {
  return ipcRenderer.invoke('teamHubs:listAdminRunResults', hubId);
}

/**
 * Deletes a hub run result using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param runResultId - Server run result UUID.
 */
function deleteTeamHubRunResult(hubId: string, runResultId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteRunResult', hubId, runResultId);
}

/**
 * Deletes a saved request on a hub collection using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param requestId - Server saved request UUID.
 */
function deleteTeamHubRequest(hubId: string, requestId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteRequest', hubId, requestId);
}

/**
 * Deletes a hub environment using an admin token via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param environmentId - Server environment UUID.
 */
function deleteTeamHubEnvironment(hubId: string, environmentId: string): Promise<void> {
  return ipcRenderer.invoke('teamHubs:deleteEnvironment', hubId, environmentId);
}

/**
 * Updates whether non-admin users may delete a hub collection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param collectionId - Server collection UUID.
 * @param deletionLocked - When true, user-role tokens cannot delete the collection.
 */
function updateTeamHubCollectionDeletionLocked(
  hubId: string,
  collectionId: string,
  deletionLocked: boolean
): Promise<import('@harborclient/core/types').AdminEntityConfig> {
  return ipcRenderer.invoke(
    'teamHubs:updateCollectionDeletionLocked',
    hubId,
    collectionId,
    deletionLocked
  );
}

/**
 * Updates whether non-admin users may delete a hub environment via IPC.
 *
 * @param hubId - Team hub connection id with an admin token.
 * @param environmentId - Server environment UUID.
 * @param deletionLocked - When true, user-role tokens cannot delete the environment.
 */
function updateTeamHubEnvironmentDeletionLocked(
  hubId: string,
  environmentId: string,
  deletionLocked: boolean
): Promise<import('@harborclient/core/types').AdminEntityConfig> {
  return ipcRenderer.invoke(
    'teamHubs:updateEnvironmentDeletionLocked',
    hubId,
    environmentId,
    deletionLocked
  );
}

/**
 * Re-reads collection data from a single provider via IPC.
 *
 * @param connectionId - Provider connection id to sync.
 */
function syncProvider(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('providers:sync', connectionId);
}

/**
 * Lists collections on a mounted provider that are not yet in the sidebar registry.
 *
 * @param connectionId - Storage connection id to scan.
 */
function listUnregisteredCollections(
  connectionId: string
): Promise<import('@harborclient/core/types').DiscoveredCollection[]> {
  return ipcRenderer.invoke('providers:listUnregisteredCollections', connectionId);
}

/**
 * Registers selected provider collections in the sidebar registry.
 *
 * @param connectionId - Storage connection id that owns the collections.
 * @param providerCollectionIds - Provider-local collection ids to add.
 */
function registerDiscoveredCollections(
  connectionId: string,
  providerCollectionIds: number[]
): Promise<import('@harborclient/core/types').RegisterDiscoveredCollectionsResult> {
  return ipcRenderer.invoke(
    'providers:registerDiscoveredCollections',
    connectionId,
    providerCollectionIds
  );
}

/**
 * Records that the user skipped collection discovery for a storage connection.
 *
 * @param connectionId - Storage connection id to mark.
 */
function markCollectionDiscoverySkipped(
  connectionId: string
): Promise<import('@harborclient/core/types').StorageConnection[]> {
  return ipcRenderer.invoke('providers:markCollectionDiscoverySkipped', connectionId);
}

/**
 * Returns source-control status for each mounted git connection.
 */
function listGitStatuses(): Promise<
  Record<string, import('@harborclient/core/types').SourceControlStatus>
> {
  return ipcRenderer.invoke('git:statuses');
}

/**
 * Subscribes to working-tree changes for git-backed connections.
 *
 * @param callback - Handler invoked with the connection id whose tree changed.
 * @returns Unsubscribe function.
 */
function onGitWorkingTreeChanged(callback: (connectionId: string) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, connectionId: string): void => {
    callback(connectionId);
  };
  ipcRenderer.on('git:workingTreeChanged', listener);
  return () => ipcRenderer.removeListener('git:workingTreeChanged', listener);
}

/**
 * Subscribes to storage connection list changes (save or delete).
 *
 * @param callback - Handler invoked when connections change.
 * @returns Unsubscribe function.
 */
function onStorageConnectionsChanged(callback: () => void): () => void {
  const listener = (): void => {
    callback();
  };
  ipcRenderer.on('storageConnections:changed', listener);
  return () => ipcRenderer.removeListener('storageConnections:changed', listener);
}

/**
 * Subscribes to background GitHub OAuth completion events.
 *
 * @param callback - Handler invoked when OAuth polling finishes or fails.
 * @returns Unsubscribe function.
 */
function onGitOAuthFinished(
  callback: (event: import('@harborclient/core/types').GitOAuthFinishedEvent) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: import('@harborclient/core/types').GitOAuthFinishedEvent
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('git:oauthFinished', listener);
  return () => ipcRenderer.removeListener('git:oauthFinished', listener);
}

/**
 * Commits local changes for one git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 * @param message - Commit message.
 * @param createHarborRoot - When true, creates the HarborClient subdirectory layout if missing.
 */
function gitCommit(
  connectionId: string,
  collectionUuid: string,
  message: string,
  createHarborRoot?: boolean
): Promise<void> {
  return ipcRenderer.invoke('git:commit', connectionId, collectionUuid, message, createHarborRoot);
}

/**
 * Returns local branch names for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 */
function gitListBranches(connectionId: string): Promise<string[]> {
  return ipcRenderer.invoke('git:listBranches', connectionId);
}

/**
 * Creates a new branch from the current commit and checks it out.
 *
 * @param connectionId - Git connection id.
 * @param name - Branch name to create.
 */
function gitCreateBranch(connectionId: string, name: string): Promise<void> {
  return ipcRenderer.invoke('git:createBranch', connectionId, name);
}

/**
 * Deletes a local branch that is not currently checked out.
 *
 * @param connectionId - Git connection id.
 * @param name - Branch name to delete.
 */
function gitDeleteBranch(connectionId: string, name: string): Promise<void> {
  return ipcRenderer.invoke('git:deleteBranch', connectionId, name);
}

/**
 * Checks out an existing local branch when the working tree is clean.
 *
 * @param connectionId - Git connection id.
 * @param name - Branch name to check out.
 */
function gitCheckoutBranch(connectionId: string, name: string): Promise<void> {
  return ipcRenderer.invoke('git:checkoutBranch', connectionId, name);
}

/**
 * Merges another local branch into the current branch.
 *
 * @param connectionId - Git connection id.
 * @param name - Local branch name to merge.
 */
function gitMergeBranch(connectionId: string, name: string): Promise<{ conflictCount: number }> {
  return ipcRenderer.invoke('git:merge', connectionId, name);
}

/**
 * Reads raw text from one repository-relative conflict file.
 *
 * @param args - Git connection id and repository-relative file path.
 */
function gitReadConflictFile(args: {
  connectionId: string;
  filePath: string;
}): Promise<{ path: string; content: string }> {
  return ipcRenderer.invoke('git:readConflictFile', args);
}

/**
 * Writes one repository-relative conflict file and stages it.
 *
 * @param args - Git connection id, file path, and resolved file contents.
 */
function gitWriteConflictFile(args: {
  connectionId: string;
  filePath: string;
  content: string;
}): Promise<void> {
  return ipcRenderer.invoke('git:writeConflictFile', args);
}

/**
 * Launches the configured external merge editor for one conflicted file.
 *
 * @param args - Git connection id and repository-relative file path.
 */
function gitOpenExternalMergeEditor(args: {
  connectionId: string;
  filePath: string;
}): Promise<void> {
  return ipcRenderer.invoke('git:openExternalMergeEditor', args);
}

/**
 * Fetches from the configured remote without merging.
 *
 * @param connectionId - Git connection id.
 */
function gitFetch(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:fetch', connectionId);
}

/**
 * Validates credentials against the connection's remote URL.
 *
 * @param connectionId - Git connection id.
 * @returns Whether the remote is empty and whether push access was confirmed.
 */
function gitTestConnection(
  connectionId: string
): Promise<{ emptyRemote: boolean; canPush?: boolean }> {
  return ipcRenderer.invoke('git:testConnection', connectionId);
}

/**
 * Pulls remote changes for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 */
function gitPull(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:pull', connectionId);
}

/**
 * Pushes commits for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 */
function gitPush(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:push', connectionId);
}

/**
 * Returns recent commits for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 * @param depth - Maximum number of commits.
 */
function gitLog(
  connectionId: string,
  depth?: number
): Promise<import('@harborclient/core/types').GitLogEntry[]> {
  return ipcRenderer.invoke('git:log', connectionId, depth);
}

/**
 * Suggests commit author name and email from repo-local and global git config.
 *
 * @param connectionId - Optional git connection id for repo-local lookup.
 */
function gitSuggestedAuthor(connectionId?: string): Promise<{ name: string; email: string }> {
  return ipcRenderer.invoke('git:suggestedAuthor', connectionId);
}

/**
 * Permanently removes the local git clone directory for a git-backed connection.
 *
 * @param connectionId - Git connection id whose repoPath should be deleted.
 */
function gitDeleteRepoDirectory(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:deleteRepoDirectory', connectionId);
}

/**
 * Returns graph-ready commit history for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 * @param depth - Maximum number of commits to include.
 */
function gitGraphLog(
  connectionId: string,
  depth?: number
): Promise<import('@harborclient/core/types').GitGraphLogResult> {
  return ipcRenderer.invoke('git:graphLog', connectionId, depth);
}

/**
 * Returns detailed metadata and changed files for one commit.
 *
 * @param connectionId - Git connection id.
 * @param oid - Commit object id.
 */
function gitCommitDetail(
  connectionId: string,
  oid: string
): Promise<import('@harborclient/core/types').GitCommitDetail> {
  return ipcRenderer.invoke('git:commitDetail', connectionId, oid);
}

/**
 * Returns a diff for one HarborClient file in a specific commit.
 *
 * @param args - Git connection id, commit oid, file path, and optional display metadata.
 */
function gitCommitFileDiff(args: {
  connectionId: string;
  commitOid: string;
  filePath: string;
  status: 'added' | 'modified' | 'deleted';
  displayName?: string;
  resourceKind?: 'request' | 'document' | 'collection';
  method?: string;
  maxChars?: number;
}): Promise<import('@harborclient/core/types').GitRequestDiffFileEntry> {
  return ipcRenderer.invoke('git:commitFileDiff', args);
}

/**
 * Returns uncommitted HarborClient-tree diffs for a git-backed collection.
 *
 * @param args - Collection uuid and optional diff output caps.
 */
function gitDiff(args: {
  collectionUuid: string;
  maxFiles?: number;
  maxCharsPerFile?: number;
  maxTotalChars?: number;
  /**
   * When true, includes only staged changes (HEAD vs index). Defaults to working-tree changes.
   */
  stagedOnly?: boolean;
  /**
   * When true, omits untracked files (not yet added to git) from the diff payload.
   */
  excludeUntracked?: boolean;
}): Promise<string> {
  return ipcRenderer.invoke('git:diff', args);
}

/**
 * Returns git repository metadata for one git-backed collection.
 *
 * @param args - Collection uuid used to resolve the git-backed repository connection.
 */
function gitRepoInfo(args: { collectionUuid: string }): Promise<string> {
  return ipcRenderer.invoke('git:repoInfo', args);
}

/**
 * Returns recent commit history for the repository that contains a collection.
 *
 * @param args - Collection uuid and optional commit depth.
 */
function gitCollectionCommits(args: { collectionUuid: string; depth?: number }): Promise<string> {
  return ipcRenderer.invoke('git:collectionCommits', args);
}

/**
 * Returns per-file git metadata and commit history for one saved request.
 *
 * @param args - Collection uuid, request uuid, and optional history depth.
 */
function gitFileInfo(args: {
  collectionUuid: string;
  requestUuid: string;
  depth?: number;
}): Promise<string> {
  return ipcRenderer.invoke('git:fileInfo', args);
}

/**
 * Returns a diff of one saved request file between two commits.
 *
 * @param args - Collection uuid, request uuid, commit range, and optional diff cap.
 */
function gitFileDiff(args: {
  collectionUuid: string;
  requestUuid: string;
  commitA: string;
  commitB: string;
  maxChars?: number;
}): Promise<string> {
  return ipcRenderer.invoke('git:fileDiff', args);
}

/**
 * Returns per-request and per-document git status for one git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 */
function gitListItemStatuses(
  connectionId: string,
  collectionUuid: string
): Promise<Record<string, import('@harborclient/core/types').GitRequestFileStatus>> {
  return ipcRenderer.invoke('git:itemStatuses', connectionId, collectionUuid);
}

/**
 * Returns the number of changed request/document files in one git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 */
function gitChangedItemCount(connectionId: string, collectionUuid: string): Promise<number> {
  return ipcRenderer.invoke('git:changedItemCount', connectionId, collectionUuid);
}

/**
 * Stages one request or markdown document in a git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 * @param itemUuid - Stable request or document uuid.
 */
function gitStageItem(
  connectionId: string,
  collectionUuid: string,
  itemUuid: string
): Promise<void> {
  return ipcRenderer.invoke('git:stageItem', connectionId, collectionUuid, itemUuid);
}

/**
 * Stages every untracked request and markdown document in a git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 * @returns Number of items staged.
 */
function gitStageAllUntrackedItems(connectionId: string, collectionUuid: string): Promise<number> {
  return ipcRenderer.invoke('git:stageAllUntrackedItems', connectionId, collectionUuid);
}

/**
 * Unstages one request or markdown document in a git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 * @param itemUuid - Stable request or document uuid.
 */
function gitUnstageItem(
  connectionId: string,
  collectionUuid: string,
  itemUuid: string
): Promise<void> {
  return ipcRenderer.invoke('git:unstageItem', connectionId, collectionUuid, itemUuid);
}

/**
 * Discards working-tree changes for one request or markdown file in a git-backed collection.
 *
 * @param connectionId - Git connection id.
 * @param collectionUuid - Stable collection uuid.
 * @param filePath - Repository-relative changed file path.
 * @param previousPaths - Optional deleted paths to restore when reverting a rename.
 */
function gitRevertFile(
  connectionId: string,
  collectionUuid: string,
  filePath: string,
  previousPaths?: string[]
): Promise<void> {
  return ipcRenderer.invoke(
    'git:revertFile',
    connectionId,
    collectionUuid,
    filePath,
    previousPaths
  );
}

/**
 * Stores a PAT for a git-backed connection and validates credentials.
 *
 * @param connectionId - Git connection id.
 * @param username - Basic Auth username.
 * @param token - Personal access token.
 */
function gitSetPat(connectionId: string, username: string, token: string): Promise<void> {
  return ipcRenderer.invoke('git:setPat', connectionId, username, token);
}

/**
 * Starts GitHub OAuth device flow for a git-backed connection.
 *
 * Returns the device-flow user code so the user can copy it before the browser
 * opens. Call {@link gitCompleteOAuth} to open the verification URI and start polling.
 *
 * @param connectionId - Git connection id.
 */
function gitStartOAuth(connectionId: string): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  return ipcRenderer.invoke('git:startOAuth', connectionId);
}

/**
 * Opens the GitHub verification URI and starts background OAuth polling for a connection.
 *
 * Resolves immediately without waiting for GitHub approval.
 *
 * @param connectionId - Git connection id.
 * @param verificationUri - Device-flow verification URL from {@link gitStartOAuth}.
 */
function gitCompleteOAuth(connectionId: string, verificationUri: string): Promise<void> {
  return ipcRenderer.invoke('git:completeOAuth', connectionId, verificationUri);
}

/**
 * Removes stored GitHub OAuth tokens and resets auth metadata for a git-backed connection.
 *
 * @param connectionId - Git connection id.
 */
function gitRevokeOAuth(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:revokeOAuth', connectionId);
}

/**
 * Reads the origin remote URL from a local git repository path.
 *
 * SSH remotes are normalized to HTTPS. Returns null when the path is not a git
 * repository or has no configured remotes.
 *
 * @param repoPath - Absolute path to a local git working tree.
 */
function gitReadRemoteUrl(repoPath: string): Promise<string | null> {
  return ipcRenderer.invoke('git:readRemoteUrl', repoPath);
}

/**
 * Lists saved git host identities.
 */
function listGitIdentities(): Promise<import('@harborclient/core/types').GitIdentity[]> {
  return ipcRenderer.invoke('git:listIdentities');
}

/**
 * Stores a PAT for a git host and optionally validates credentials.
 *
 * @param host - Normalized lowercase git host key.
 * @param username - Basic Auth username.
 * @param token - Personal access token.
 * @param testUrl - Optional repository URL used to validate the token.
 * @param branch - Optional branch name used when validating against testUrl.
 * @returns Empty-remote and push capability when validation ran; otherwise an empty object.
 */
function gitSetHostPat(
  host: string,
  username: string,
  token: string,
  testUrl?: string,
  branch?: string
): Promise<{ emptyRemote?: boolean; canPush?: boolean }> {
  return ipcRenderer.invoke('git:setHostPat', host, username, token, testUrl, branch);
}

/**
 * Starts GitHub OAuth device flow for a git host.
 *
 * Returns the device-flow user code so the user can copy it before the browser
 * opens. Call {@link gitCompleteHostOAuth} to open the verification URI and start polling.
 *
 * @param host - Normalized lowercase git host key.
 * @param testUrl - Optional repository URL used to validate after completion.
 * @param branch - Optional branch name used when validating against testUrl.
 */
function gitStartHostOAuth(
  host: string,
  testUrl?: string,
  branch?: string
): Promise<{ userCode: string; verificationUri: string }> {
  return ipcRenderer.invoke('git:startHostOAuth', host, testUrl, branch);
}

/**
 * Opens the GitHub verification URI and starts background OAuth polling for a host.
 *
 * @param host - Normalized lowercase git host key.
 * @param verificationUri - Device-flow verification URL from {@link gitStartHostOAuth}.
 * @param testUrl - Optional repository URL used to validate after completion.
 * @param branch - Optional branch name used when validating against testUrl.
 */
function gitCompleteHostOAuth(
  host: string,
  verificationUri: string,
  testUrl?: string,
  branch?: string
): Promise<void> {
  return ipcRenderer.invoke('git:completeHostOAuth', host, verificationUri, testUrl, branch);
}

/**
 * Revokes stored credentials for a git host.
 *
 * @param host - Normalized lowercase git host key.
 */
function gitRevokeHost(host: string): Promise<void> {
  return ipcRenderer.invoke('git:revokeHost', host);
}

/**
 * Returns whether a directory path is the root of a git working tree.
 *
 * @param repoPath - Absolute directory path to inspect.
 */
function gitIsRepo(repoPath: string): Promise<boolean> {
  return ipcRenderer.invoke('git:isRepo', repoPath);
}

/**
 * Initializes a git repository and optionally adds an origin remote.
 *
 * @param repoPath - Absolute directory path to initialize.
 * @param url - HTTPS remote URL for origin, or empty to skip.
 * @param branch - Default branch name.
 */
function gitInitRepo(repoPath: string, url: string, branch: string): Promise<void> {
  return ipcRenderer.invoke('git:initRepo', repoPath, url, branch);
}

/**
 * Fetches or returns a cached OAuth 2.0 access token using Client Credentials.
 *
 * @param cacheKey - Stable cache key; empty string skips persistence.
 * @param config - Resolved OAuth 2.0 configuration.
 * @param force - When true, bypass cache and fetch a fresh token.
 */
function oauthFetchToken(
  cacheKey: string,
  config: AuthConfig['oauth2'],
  force: boolean
): Promise<OAuthFetchTokenResult> {
  return ipcRenderer.invoke('oauth:fetchToken', cacheKey, config, force);
}

/**
 * Clears a cached OAuth 2.0 access token for the given cache key.
 *
 * @param cacheKey - Stable cache key such as request:1 or collection:2.
 */
function oauthClearToken(cacheKey: string): Promise<void> {
  return ipcRenderer.invoke('oauth:clearToken', cacheKey);
}

/**
 * Returns persisted autocomplete values for a category.
 *
 * @param category - Autocomplete pool id (e.g. `header.key`, `url`).
 */
function getAutocompleteValues(category: string): Promise<string[]> {
  return ipcRenderer.invoke('autocomplete:list', category);
}

/**
 * Persists a new autocomplete value for a category.
 *
 * @param category - Autocomplete pool id.
 * @param value - User-committed value to remember.
 */
function addAutocompleteValue(category: string, value: string): Promise<void> {
  return ipcRenderer.invoke('autocomplete:add', category, value);
}

/**
 * Returns the active database connection id via IPC.
 */
function getActiveStorageId(): Promise<string> {
  return ipcRenderer.invoke('storage:getActiveId');
}

/**
 * Sets the active database connection id via IPC.
 *
 * @param id - Connection id to activate on next launch.
 */
function setActiveStorageId(id: string): Promise<void> {
  return ipcRenderer.invoke('storage:setActiveId', id);
}

/**
 * Returns the persisted request editor tab for a storage key.
 *
 * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
 */
function getRequestEditorTab(key: string): Promise<EditorTab | null> {
  return ipcRenderer.invoke('requestEditor:getTab', key);
}

/**
 * Persists the request editor tab for a storage key.
 *
 * @param key - Saved request id or `tab:${tabId}` for unsaved drafts.
 * @param tab - Editor tab to remember.
 */
function setRequestEditorTab(key: string, tab: EditorTab): Promise<void> {
  return ipcRenderer.invoke('requestEditor:setTab', key, tab);
}

/**
 * Removes persisted request editor tab state for a storage key.
 *
 * @param key - Saved request id string to clear.
 */
function deleteRequestEditorTab(key: string): Promise<void> {
  return ipcRenderer.invoke('requestEditor:deleteTab', key);
}

/**
 * Returns the persisted sidebar section for a page tab key.
 *
 * @param key - Page sidebar storage key such as `settings` or `plugins`.
 */
function getPageSidebarSection(key: string): Promise<string | null> {
  return ipcRenderer.invoke('pageSidebar:getSection', key);
}

/**
 * Persists the sidebar section for a page tab key.
 *
 * @param key - Page sidebar storage key such as `settings` or `plugins`.
 * @param section - Section id to remember.
 */
function setPageSidebarSection(key: string, section: string): Promise<void> {
  return ipcRenderer.invoke('pageSidebar:setSection', key, section);
}

/**
 * Returns persisted sidebar expansion for sections, collections, and folders.
 */
function getSidebarExpansion(): Promise<SidebarExpansionState> {
  return ipcRenderer.invoke('sidebar:getExpansion');
}

/**
 * Persists sidebar expansion for sections, collections, and folders.
 *
 * @param state - Expansion snapshot to store.
 */
function setSidebarExpansion(state: SidebarExpansionState): Promise<void> {
  return ipcRenderer.invoke('sidebar:setExpansion', state);
}

/**
 * Returns persisted sidebar and AI sidebar visibility preferences.
 */
function getPanelLayout(): Promise<PanelLayoutState> {
  return ipcRenderer.invoke('layout:getPanel');
}

/**
 * Persists sidebar and AI sidebar visibility preferences.
 *
 * @param state - Panel layout snapshot to store.
 */
function setPanelLayout(state: PanelLayoutState): Promise<void> {
  return ipcRenderer.invoke('layout:setPanel', state);
}

/**
 * Returns persisted AI chat open tabs and active tab.
 */
function getAiChatSession(): Promise<AiChatSessionState> {
  return ipcRenderer.invoke('aiChat:getSession');
}

/**
 * Persists AI chat open tabs and active tab.
 *
 * @param state - Chat session snapshot to store.
 */
function setAiChatSession(state: AiChatSessionState): Promise<void> {
  return ipcRenderer.invoke('aiChat:setSession', state);
}

/**
 * Returns persisted open request tabs as a JSON payload.
 */
function getOpenTabsPayload(): Promise<string | null> {
  return ipcRenderer.invoke('openTabs:getPayload');
}

/**
 * Persists open request tabs as a JSON payload.
 *
 * @param payload - Serialized open-tabs JSON from the renderer.
 */
function setOpenTabsPayload(payload: string): Promise<void> {
  return ipcRenderer.invoke('openTabs:setPayload', payload);
}

/**
 * Creates a WebContentsView guest for an embedded browser tab.
 *
 * @param tabId - Browser tab id.
 * @param url - Initial URL.
 * @param homeUrl - Home control URL.
 * @param scripts - Saved injection scripts.
 * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
 */
function browserCreate(
  tabId: string,
  url: string,
  homeUrl: string,
  scripts: BrowserInjectionScriptPayload[],
  hcScripts?: BrowserHcScriptsPayload
): Promise<void> {
  return ipcRenderer.invoke('browser:create', tabId, url, homeUrl, scripts, hcScripts);
}

/**
 * Force-destroys the WebContentsView for a closed browser tab (skips beforeunload).
 *
 * @param tabId - Browser tab id.
 */
function browserDestroy(tabId: string): Promise<void> {
  return ipcRenderer.invoke('browser:destroy', tabId);
}

/**
 * Closes a browser guest for a user-initiated tab close, honoring page leave prompts.
 *
 * @param tabId - Browser tab id.
 * @returns True when the guest closed; false when the user chose to stay.
 */
function browserRequestClose(tabId: string): Promise<boolean> {
  return ipcRenderer.invoke('browser:requestClose', tabId);
}

/**
 * Hides every browser guest so HTML modals are not covered by the native view.
 */
function browserHideAll(): Promise<void> {
  return ipcRenderer.invoke('browser:hideAll');
}

/**
 * Updates the on-screen bounds of a browser guest.
 *
 * @param tabId - Browser tab id.
 * @param bounds - Rectangle in window content coordinates.
 */
function browserSetBounds(tabId: string, bounds: BrowserViewBounds): Promise<void> {
  return ipcRenderer.invoke('browser:setBounds', tabId, bounds);
}

/**
 * Shows or hides a browser guest.
 *
 * @param tabId - Browser tab id.
 * @param visible - Whether the guest should be visible.
 */
function browserSetVisible(tabId: string, visible: boolean): Promise<void> {
  return ipcRenderer.invoke('browser:setVisible', tabId, visible);
}

/**
 * Navigates a browser guest to a URL.
 *
 * @param tabId - Browser tab id.
 * @param url - Allowed target URL.
 */
function browserLoadURL(tabId: string, url: string): Promise<void> {
  return ipcRenderer.invoke('browser:loadURL', tabId, url);
}

/**
 * Navigates back in browser guest history.
 *
 * @param tabId - Browser tab id.
 */
function browserGoBack(tabId: string): Promise<void> {
  return ipcRenderer.invoke('browser:goBack', tabId);
}

/**
 * Navigates forward in browser guest history.
 *
 * @param tabId - Browser tab id.
 */
function browserGoForward(tabId: string): Promise<void> {
  return ipcRenderer.invoke('browser:goForward', tabId);
}

/**
 * Reloads the current browser guest page.
 *
 * @param tabId - Browser tab id.
 */
function browserReload(tabId: string): Promise<void> {
  return ipcRenderer.invoke('browser:reload', tabId);
}

/**
 * Navigates the browser guest to its home URL.
 *
 * @param tabId - Browser tab id.
 */
function browserGoHome(tabId: string): Promise<void> {
  return ipcRenderer.invoke('browser:goHome', tabId);
}

/**
 * Replaces saved injection and optional pre/post scripts for a browser guest.
 *
 * @param tabId - Browser tab id.
 * @param scripts - Applied injection script set.
 * @param hcScripts - Optional resolved pre/post scripts and snippet modules.
 */
function browserSetScripts(
  tabId: string,
  scripts: BrowserInjectionScriptPayload[],
  hcScripts?: BrowserHcScriptsPayload
): Promise<void> {
  return ipcRenderer.invoke('browser:setScripts', tabId, scripts, hcScripts);
}

/**
 * Updates the home URL for a browser guest.
 *
 * @param tabId - Browser tab id.
 * @param homeUrl - Allowed home URL.
 */
function browserSetHomeUrl(tabId: string, homeUrl: string): Promise<void> {
  return ipcRenderer.invoke('browser:setHomeUrl', tabId, homeUrl);
}

/**
 * Runs JavaScript in the guest page main world and returns the result.
 *
 * @param tabId - Browser tab id.
 * @param code - JavaScript source to evaluate.
 */
function browserExecuteJavaScript(tabId: string, code: string): Promise<unknown> {
  return ipcRenderer.invoke('browser:executeJavaScript', tabId, code);
}

/**
 * Inserts a CSS stylesheet into the guest page.
 *
 * @param tabId - Browser tab id.
 * @param css - Stylesheet source.
 * @returns Electron insertion key.
 */
function browserInsertCSS(tabId: string, css: string): Promise<string> {
  return ipcRenderer.invoke('browser:insertCSS', tabId, css);
}

/**
 * Queries the live guest DOM with a CSS selector.
 *
 * @param tabId - Browser tab id.
 * @param selector - CSS selector.
 * @param all - When true, return every match up to maxElements.
 * @param maxElements - Maximum elements to return.
 */
function browserQuerySelector(
  tabId: string,
  selector: string,
  all?: boolean,
  maxElements?: number
): Promise<{
  selector: string;
  matchCount: number;
  elements: Array<{
    tagName: string;
    id: string;
    className: string;
    textContent: string;
    outerHTML: string;
    attributes: Record<string, string>;
  }>;
}> {
  return ipcRenderer.invoke('browser:querySelector', tabId, selector, all, maxElements);
}

/**
 * Waits until the guest finishes loading and returns a navigation snapshot.
 *
 * @param tabId - Browser tab id.
 * @param timeoutMs - Optional max wait in milliseconds.
 */
function browserWaitForLoad(tabId: string, timeoutMs?: number): Promise<BrowserNavigationState> {
  return ipcRenderer.invoke('browser:waitForLoad', tabId, timeoutMs);
}

/**
 * Captures a PNG screenshot of the guest's visible viewport or full scrollable page.
 *
 * Full-page captures taller than the height/tile caps are truncated from the top;
 * `truncated` is true when that happens.
 *
 * @param tabId - Browser tab id.
 * @param options - Optional `{ fullPage }` (default false).
 * @returns PNG data URL, base64 payload, and optional truncation flag.
 */
function browserCapturePage(
  tabId: string,
  options?: { fullPage?: boolean }
): Promise<{ dataUrl: string; pngBase64: string; truncated?: boolean }> {
  return ipcRenderer.invoke('browser:capturePage', tabId, options);
}

/**
 * Returns the newest completed browser downloads for this app session (up to 5).
 *
 * @returns Newest-first download list.
 */
function browserListDownloads(): Promise<BrowserDownloadEntry[]> {
  return ipcRenderer.invoke('browser:listDownloads');
}

/**
 * Records a completed file path (for example a screenshot) into the recent-downloads list.
 *
 * @param filePath - Absolute path of the saved file.
 */
function browserRecordDownload(filePath: string): Promise<void> {
  return ipcRenderer.invoke('browser:recordDownload', filePath);
}

/**
 * Subscribes to browser guest navigation and title updates.
 *
 * @param callback - Handler invoked with navigation state.
 * @returns Unsubscribe function.
 */
function onBrowserNavigation(callback: (state: BrowserNavigationState) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, state: BrowserNavigationState): void => {
    callback(state);
  };
  ipcRenderer.on('browser:navigation', listener);
  return () => {
    ipcRenderer.removeListener('browser:navigation', listener);
  };
}

/**
 * Subscribes to live-page footer console entries after each navigation load.
 *
 * @param callback - Handler invoked with the console entry payload.
 * @returns Unsubscribe function.
 */
function onBrowserConsoleEntry(
  callback: (payload: BrowserConsoleEntryPayload) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: BrowserConsoleEntryPayload
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('browser:console-entry', listener);
  return () => {
    ipcRenderer.removeListener('browser:console-entry', listener);
  };
}

/**
 * Subscribes to guest popup / new-tab requests from the embedded browser.
 *
 * @param callback - Handler invoked when a guest wants a HarborClient tab opened.
 * @returns Unsubscribe function.
 */
function onBrowserOpenTab(callback: (request: BrowserOpenTabRequest) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, request: BrowserOpenTabRequest): void => {
    callback(request);
  };
  ipcRenderer.on('browser:open-tab', listener);
  return () => {
    ipcRenderer.removeListener('browser:open-tab', listener);
  };
}

/**
 * Subscribes to guest context-menu Copy to chat requests.
 *
 * @param callback - Handler invoked with tab id and viewport click coordinates.
 * @returns Unsubscribe function.
 */
function onBrowserCopyToChat(callback: (payload: BrowserCopyToChatPayload) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: BrowserCopyToChatPayload): void => {
    callback(payload);
  };
  ipcRenderer.on('browser:copy-to-chat', listener);
  return () => {
    ipcRenderer.removeListener('browser:copy-to-chat', listener);
  };
}

/**
 * Subscribes to updates of the recent browser downloads list.
 *
 * @param callback - Handler invoked with the newest-first list and whether to auto-open the menu.
 * @returns Unsubscribe function.
 */
function onBrowserDownloadsChanged(
  callback: (payload: BrowserDownloadsChangedPayload) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: BrowserDownloadsChangedPayload
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('browser:downloads-changed', listener);
  return () => {
    ipcRenderer.removeListener('browser:downloads-changed', listener);
  };
}

/**
 * Returns persisted collection runner configuration.
 */
function getCollectionRunnerConfig(): Promise<CollectionRunnerConfig> {
  return ipcRenderer.invoke('collectionRunner:getConfig');
}

/**
 * Persists collection runner configuration.
 *
 * @param config - Runner settings snapshot to store.
 */
function setCollectionRunnerConfig(config: CollectionRunnerConfig): Promise<void> {
  return ipcRenderer.invoke('collectionRunner:setConfig', config);
}

/**
 * Returns resolved keyboard shortcut bindings with user overrides applied.
 */
function getShortcuts(): Promise<ShortcutBinding[]> {
  return ipcRenderer.invoke('shortcuts:get');
}

/**
 * Persists keyboard shortcut overrides and rebuilds the application menu.
 *
 * @param overrides - Shortcut overrides keyed by shortcut id.
 */
function setShortcuts(overrides: ShortcutOverrides): Promise<ShortcutBinding[]> {
  return ipcRenderer.invoke('shortcuts:set', overrides);
}

/**
 * Clears keyboard shortcut overrides and restores default bindings.
 */
function resetShortcuts(): Promise<ShortcutBinding[]> {
  return ipcRenderer.invoke('shortcuts:reset');
}

/**
 * Subscribes to window close and app quit attempts from the main process.
 *
 * @param callback - Handler invoked when the user tries to close or quit.
 * @returns Unsubscribe function.
 */
function onBeforeClose(callback: () => void): () => void {
  const listener = (): void => {
    callback();
  };
  ipcRenderer.on('app:before-close', listener);
  return () => ipcRenderer.removeListener('app:before-close', listener);
}

/**
 * Responds to a close/quit attempt after checking unsaved state or user choice.
 *
 * @param proceed - True to allow close/quit, false to cancel.
 */
function confirmClose(proceed: boolean): void {
  ipcRenderer.send('app:close-decision', proceed);
}

/**
 * Opens a native file picker via IPC and returns selected absolute paths.
 *
 * @returns Selected paths, or an empty array when the dialog is canceled.
 */
function selectFiles(): Promise<string[]> {
  return ipcRenderer.invoke('dialog:openFiles');
}

/**
 * Opens a single-file picker filtered for SSL certificate and private-key files.
 *
 * @param defaultPath - Optional initial path shown in the dialog.
 * @returns Selected absolute file path, or null when canceled.
 */
function selectSslFile(defaultPath?: string): Promise<string | null> {
  return ipcRenderer.invoke('dialog:openSslFile', defaultPath ?? '');
}

/**
 * Opens a single-file picker filtered for HTML files (error pages, etc.).
 *
 * @param defaultPath - Optional initial path shown in the dialog.
 * @returns Selected absolute file path, or null when canceled.
 */
function selectFile(defaultPath?: string): Promise<string | null> {
  return ipcRenderer.invoke('dialog:openFile', defaultPath ?? '');
}

/**
 * Opens a native directory picker via IPC.
 *
 * @param defaultPath - Initial directory shown in the dialog, if any.
 * @returns Selected absolute directory path, or null when canceled.
 */
function selectDirectory(defaultPath: string): Promise<string | null> {
  return ipcRenderer.invoke('dialog:openDirectory', defaultPath);
}

/**
 * Opens a native save dialog via IPC.
 *
 * @param defaultPath - Initial file path shown in the dialog; main process fills a default when empty.
 * @returns Selected absolute file path, or null when canceled.
 */
function selectSaveFile(defaultPath: string): Promise<string | null> {
  return ipcRenderer.invoke('dialog:saveFile', defaultPath);
}

/**
 * Opens a file or directory in the OS default application via IPC.
 *
 * @param path - Absolute path to open in the system file browser or default handler.
 */
function openPath(path: string): Promise<void> {
  return ipcRenderer.invoke('files:openPath', path);
}

/**
 * Reveals a file in its containing folder in the OS file manager.
 *
 * @param path - Absolute path of the file to select in the folder view.
 */
function showItemInFolder(path: string): Promise<void> {
  return ipcRenderer.invoke('files:showItemInFolder', path);
}

/**
 * Reads a local image file and returns a data URL for the image viewer.
 *
 * @param path - Absolute path to an image file.
 * @returns Data URL and basename of the file.
 */
function readImageDataUrl(path: string): Promise<{ dataUrl: string; fileName: string }> {
  return ipcRenderer.invoke('files:readImageDataUrl', path);
}

/**
 * Copies a local file to a destination chosen via a native save dialog.
 *
 * @param sourcePath - Absolute path of the source file.
 * @param defaultFileName - Suggested filename shown in the save dialog.
 */
function copyFileToSaveDialog(
  sourcePath: string,
  defaultFileName: string
): Promise<{ canceled: boolean; path?: string }> {
  return ipcRenderer.invoke('files:copyFileToSaveDialog', sourcePath, defaultFileName);
}

/**
 * Writes image bytes from a data URL or remote URL via a native save dialog.
 *
 * @param payload - Exactly one of `dataUrl` or `url`, plus a suggested filename.
 */
function saveDataUrlToFile(payload: {
  dataUrl?: string;
  url?: string;
  defaultFileName: string;
}): Promise<{ canceled: boolean; path?: string }> {
  return ipcRenderer.invoke('files:saveDataUrlToFile', payload);
}

/**
 * Creates a signed, encrypted share token for a specific recipient via IPC.
 *
 * @param collectionId - Global collection id to share.
 * @param recipientKid - Fingerprint of the recipient's trusted public key.
 */
function createShareToken(collectionId: number, recipientKid: string): Promise<string> {
  return ipcRenderer.invoke('share:create', collectionId, recipientKid);
}

/**
 * Decodes a share JWT and adds the embedded database connection via IPC.
 *
 * @param token - JWT string from a share token.
 */
function joinSharedCollection(token: string): Promise<StorageConnection[]> {
  return ipcRenderer.invoke('share:join', token);
}

/**
 * Returns the local sharing identity via IPC.
 */
function getSharingIdentity(): Promise<SharingIdentity> {
  return ipcRenderer.invoke('sharingKeys:getIdentity');
}

/**
 * Exports the local private key via IPC.
 */
function exportSharingPrivateKey(): Promise<PemExportResult> {
  return ipcRenderer.invoke('sharingKeys:exportPrivateKey');
}

/**
 * Exports the local public key via IPC.
 */
function exportSharingPublicKey(): Promise<PemExportResult> {
  return ipcRenderer.invoke('sharingKeys:exportPublicKey');
}

/**
 * Imports a local sharing key pair from a PEM file via IPC.
 */
function importSharingKeyPair(): Promise<SharingIdentity> {
  return ipcRenderer.invoke('sharingKeys:importKeyPair');
}

/**
 * Lists trusted collaborator public keys via IPC.
 */
function listTrustedKeys(): Promise<TrustedSharingKey[]> {
  return ipcRenderer.invoke('sharingKeys:listTrustedKeys');
}

/**
 * Adds a trusted collaborator public key via IPC.
 *
 * @param label - Display label for the key owner.
 * @param publicKeyPem - PEM-encoded RSA public key.
 */
function addTrustedKey(label: string, publicKeyPem: string): Promise<TrustedSharingKey[]> {
  return ipcRenderer.invoke('sharingKeys:addTrustedKey', label, publicKeyPem);
}

/**
 * Imports a trusted public key from a PEM file via IPC.
 *
 * @param label - Display label for the key owner.
 */
function importTrustedPublicKey(label: string): Promise<TrustedSharingKey[]> {
  return ipcRenderer.invoke('sharingKeys:importTrustedPublicKey', label);
}

/**
 * Removes a trusted public key via IPC.
 *
 * @param id - SHA-256 fingerprint of the key to remove.
 */
function removeTrustedKey(id: string): Promise<TrustedSharingKey[]> {
  return ipcRenderer.invoke('sharingKeys:removeTrustedKey', id);
}

/**
 * Lists all custom themes stored under `{userData}/custom_themes`.
 */
function listCustomThemes(): Promise<import('@harborclient/core/types/customTheme').CustomTheme[]> {
  return ipcRenderer.invoke('customThemes:list');
}

/**
 * Returns one custom theme by id, or null when missing.
 *
 * @param id - Custom theme filename stem.
 */
function getCustomTheme(
  id: string
): Promise<import('@harborclient/core/types/customTheme').CustomTheme | null> {
  return ipcRenderer.invoke('customThemes:get', id);
}

/**
 * Saves a custom theme export file and returns the stored record.
 *
 * @param input - Theme values to persist.
 */
function saveCustomTheme(
  input: import('@harborclient/core/types/api/customThemes').SaveCustomThemeInput
): Promise<import('@harborclient/core/types/customTheme').CustomTheme> {
  return ipcRenderer.invoke('customThemes:save', input);
}

/**
 * Deletes one custom theme file from disk.
 *
 * @param id - Custom theme filename stem.
 */
function deleteCustomTheme(id: string): Promise<void> {
  return ipcRenderer.invoke('customThemes:delete', id);
}

/**
 * Restores one built-in theme file from its packaged canonical export.
 *
 * @param id - Reserved built-in theme filename stem.
 */
function restoreBuiltinTheme(
  id: string
): Promise<import('@harborclient/core/types/customTheme').CustomTheme> {
  return ipcRenderer.invoke('customThemes:restoreBuiltin', id);
}

/**
 * Opens an import dialog and returns draft values without saving.
 */
function importCustomTheme(): Promise<
  import('@harborclient/core/types/customTheme').CustomThemeImportDraft | null
> {
  return ipcRenderer.invoke('customThemes:import');
}

/**
 * Writes text to a file via a native save dialog.
 *
 * @param content - UTF-8 text to write.
 * @param defaultPath - Suggested filename for the save dialog.
 */
function saveTextFile(content: string, defaultPath: string): Promise<SaveTextFileResult> {
  return ipcRenderer.invoke('files:saveText', content, defaultPath);
}

/**
 * Writes UTF-8 text into a directory using a basename (no save dialog).
 *
 * @param directory - Absolute destination directory.
 * @param fileName - Basename only.
 * @param content - UTF-8 text to write.
 */
function writeTextInDirectory(
  directory: string,
  fileName: string,
  content: string
): Promise<WriteTextInDirectoryResult> {
  return ipcRenderer.invoke('files:writeTextInDirectory', directory, fileName, content);
}

/**
 * Exports all local HarborClient data to a `.hcb` backup file.
 *
 * @param localStorage - Renderer localStorage snapshot to embed in the archive.
 */
function exportBackup(localStorage: Record<string, string>): Promise<BackupExportResult> {
  return ipcRenderer.invoke('backup:export', localStorage);
}

/**
 * Restores local HarborClient data from a `.hcb` backup file.
 */
function importBackup(): Promise<BackupImportResult> {
  return ipcRenderer.invoke('backup:import');
}

/**
 * Relaunches HarborClient so restored on-disk state is loaded cleanly.
 */
function restartApp(): Promise<void> {
  return ipcRenderer.invoke('app:restart');
}

/**
 * Returns the Electron userData directory where HarborClient stores local files.
 */
function getUserDataPath(): Promise<string> {
  return ipcRenderer.invoke('backup:getUserDataPath');
}

/**
 * Lists installed and unpacked plugins.
 */
function listPlugins(): Promise<PluginInfo[]> {
  return ipcRenderer.invoke('plugins:list');
}

/**
 * Fetches the curated plugin marketplace catalog.
 */
function getPluginCatalog(): Promise<PluginCatalog> {
  return ipcRenderer.invoke('plugins:catalog');
}

/**
 * Fetches the curated theme marketplace catalog.
 */
function getThemeCatalog(): Promise<ThemeCatalog> {
  return ipcRenderer.invoke('plugins:themeCatalog');
}

/**
 * Returns persisted plugin catalog and trusted-key source settings.
 */
function getPluginSources(): Promise<PluginSourcesSettings> {
  return ipcRenderer.invoke('plugins:getSources');
}

/**
 * Persists plugin catalog and trusted-key source settings.
 *
 * @param settings - Catalog and trusted registry endpoints to store.
 */
function setPluginSources(settings: PluginSourcesSettings): Promise<PluginSourcesSettings> {
  return ipcRenderer.invoke('plugins:setSources', settings);
}

/**
 * Refreshes and returns read-only plugin source URLs from connected Team Hubs.
 */
function getTeamHubPluginSources(): Promise<TeamHubPluginSourcesView> {
  return ipcRenderer.invoke('plugins:getTeamHubSources');
}

/**
 * Installs a plugin via native file picker.
 */
function installPlugin(): Promise<PluginInfo | null> {
  return ipcRenderer.invoke('plugins:install');
}

/**
 * Installs a plugin from an absolute archive path.
 *
 * @param path - Absolute path to a `.hcp` or `.zip` plugin package.
 */
function installPluginFromPath(path: string): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:installFromPath', path);
}

/**
 * Installs a plugin by cloning a public git repository.
 *
 * @param url - Public https (or http) repository URL.
 * @param ref - Optional branch or tag to clone.
 */
function installPluginFromGit(url: string, ref?: string): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:installFromGit', url, ref);
}

/**
 * Fetches manifest and preview assets from a public git repository without installing.
 *
 * @param url - Public https (or http) repository URL.
 * @param ref - Optional branch or tag to read.
 */
function previewPluginFromGit(url: string, ref?: string): Promise<PluginGitPreview> {
  return ipcRenderer.invoke('plugins:previewFromGit', url, ref);
}

/**
 * Re-clones a git-installed plugin from its stored origin.
 *
 * @param pluginId - Plugin manifest id.
 */
function updatePluginFromGit(pluginId: string): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:updateFromGit', pluginId);
}

/**
 * Uninstalls an installed plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
function uninstallPlugin(pluginId: string): Promise<void> {
  return ipcRenderer.invoke('plugins:uninstall', pluginId);
}

/**
 * Enables or disables a plugin.
 *
 * @param pluginId - Plugin manifest id.
 * @param enabled - Whether the plugin should activate.
 */
function setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:setEnabled', pluginId, enabled);
}

/**
 * Loads an unpacked plugin via native directory picker.
 */
function loadUnpackedPlugin(): Promise<PluginInfo | null> {
  return ipcRenderer.invoke('plugins:loadUnpacked');
}

/**
 * Loads an unpacked plugin from an absolute directory path.
 *
 * @param path - Absolute path to the plugin project folder.
 */
function loadUnpackedPluginFromPath(path: string): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:loadUnpackedFromPath', path);
}

/**
 * Reloads one plugin from disk.
 *
 * @param pluginId - Plugin manifest id.
 */
function reloadPlugin(pluginId: string): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:reload', pluginId);
}

/**
 * Removes an unpacked dev plugin registration.
 *
 * @param pluginId - Plugin manifest id.
 */
function removeUnpackedPlugin(pluginId: string): Promise<void> {
  return ipcRenderer.invoke('plugins:removeUnpacked', pluginId);
}

/**
 * Reads a plugin entry bundle as UTF-8 source text.
 *
 * @param pluginId - Plugin manifest id.
 * @param kind - Renderer or main entry.
 */
function readPluginEntry(pluginId: string, kind: PluginEntryKind): Promise<string> {
  return ipcRenderer.invoke('plugins:readEntry', pluginId, kind);
}

/**
 * Reads a plugin asset relative to the plugin root.
 *
 * @param pluginId - Plugin manifest id.
 * @param assetPath - Plugin-relative asset path.
 */
function readPluginAsset(pluginId: string, assetPath: string): Promise<PluginAssetResult> {
  return ipcRenderer.invoke('plugins:readAsset', pluginId, assetPath);
}

/**
 * Loads a theme JSON export referenced by `contributes.themes[].import`.
 *
 * On first read, inlines a referenced stylesheet file into the JSON on disk.
 *
 * @param pluginId - Plugin manifest id.
 * @param importPath - Plugin-relative path to the theme export JSON.
 */
function resolveThemeImport(pluginId: string, importPath: string): Promise<ResolvedThemeImport> {
  return ipcRenderer.invoke('plugins:resolveThemeImport', pluginId, importPath);
}

/**
 * Returns a plugin-scoped persisted value.
 *
 * @param pluginId - Plugin manifest id.
 * @param key - Storage key within the plugin namespace.
 */
function getPluginStorage(pluginId: string, key: string): Promise<unknown> {
  return ipcRenderer.invoke('plugins:storageGet', pluginId, key);
}

/**
 * Persists a plugin-scoped JSON-serializable value.
 *
 * @param pluginId - Plugin manifest id.
 * @param key - Storage key within the plugin namespace.
 * @param value - Value to store.
 */
function setPluginStorage(pluginId: string, key: string, value: unknown): Promise<void> {
  return ipcRenderer.invoke('plugins:storageSet', pluginId, key, value);
}

/**
 * Runs one plugin database query outside or inside a transaction.
 *
 * @param pluginId - Plugin manifest id.
 * @param mode - Query shape to execute.
 * @param sql - Parameterized SQL statement.
 * @param params - Bound parameter values.
 * @param txnId - Active transaction id when applicable.
 */
function pluginDatabaseQuery(
  pluginId: string,
  mode: 'get' | 'all' | 'run',
  sql: string,
  params?: unknown[],
  txnId?: string
): Promise<unknown> {
  return ipcRenderer.invoke('plugins:databaseQuery', pluginId, mode, sql, params, txnId);
}

/**
 * Executes a plugin database migration script.
 *
 * @param pluginId - Plugin manifest id.
 * @param sql - Multi-statement SQL script.
 */
function pluginDatabaseExec(pluginId: string, sql: string): Promise<void> {
  return ipcRenderer.invoke('plugins:databaseExec', pluginId, sql);
}

/**
 * Starts a plugin database transaction and returns an opaque transaction id.
 *
 * @param pluginId - Plugin manifest id.
 */
function pluginDatabaseTxBegin(pluginId: string): Promise<string> {
  return ipcRenderer.invoke('plugins:databaseTxBegin', pluginId);
}

/**
 * Commits or rolls back a plugin database transaction.
 *
 * @param pluginId - Plugin manifest id.
 * @param txnId - Transaction id from {@link pluginDatabaseTxBegin}.
 * @param action - Whether to commit or roll back.
 */
function pluginDatabaseTxEnd(
  pluginId: string,
  txnId: string,
  action: 'commit' | 'rollback'
): Promise<void> {
  return ipcRenderer.invoke('plugins:databaseTxEnd', pluginId, txnId, action);
}

/**
 * Activates a plugin main entry in the SES utilityProcess runner.
 *
 * Main entry source and permissions are resolved in the main process from disk.
 *
 * @param pluginId - Plugin manifest id.
 */
function activatePluginMain(pluginId: string): Promise<void> {
  return ipcRenderer.invoke('plugins:activateMain', pluginId);
}

/**
 * Deactivates a plugin main entry in the SES utilityProcess runner.
 *
 * @param pluginId - Plugin manifest id.
 */
function deactivatePluginMain(pluginId: string): Promise<void> {
  return ipcRenderer.invoke('plugins:deactivateMain', pluginId);
}

/**
 * Records or clears a plugin activation/runtime error shown in Settings.
 *
 * @param pluginId - Plugin manifest id.
 * @param message - Error message, or null to clear.
 * @param logDetails - Optional activation failure details for the main process terminal.
 */
function reportPluginRuntimeError(
  pluginId: string,
  message: string | null,
  logDetails?: string
): Promise<PluginInfo> {
  return ipcRenderer.invoke('plugins:reportRuntimeError', pluginId, message, logDetails);
}

/**
 * Invokes a plugin IPC handler registered in the main runtime.
 *
 * @param pluginId - Plugin manifest id.
 * @param channel - Registered channel name.
 * @param args - Arguments from the renderer half.
 */
function invokePluginMain(pluginId: string, channel: string, args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke('plugins:invokeMain', pluginId, channel, args);
}

/**
 * Subscribes to plugin change notifications from the main process.
 *
 * @param callback - Called with the changed plugin id.
 */
function onPluginsChanged(callback: (pluginId: string) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, pluginId: string): void => {
    callback(pluginId);
  };
  ipcRenderer.on('plugins:changed', listener);
  return () => ipcRenderer.removeListener('plugins:changed', listener);
}

/**
 * Pushes plugin menu contributions to the main process for menu merge.
 *
 * @param contributions - Serializable menu entries from the renderer registry.
 */
function setPluginMenuContributions(contributions: SerializableMenuContribution[]): Promise<void> {
  return ipcRenderer.invoke('plugins:setMenuContributions', contributions);
}

/**
 * Subscribes to plugin menu command clicks from the application menu.
 *
 * @param callback - Called with the plugin id and command id.
 */
function onPluginMenuCommand(
  callback: (payload: { pluginId: string; command: string }) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: { pluginId: string; command: string }
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('menu:pluginCommand', listener);
  return () => ipcRenderer.removeListener('menu:pluginCommand', listener);
}

/**
 * Opens a native file picker for a plugin with filesystem:pick permission.
 */
function pluginFsPickFile(pluginId: string, options?: PluginFsPickFileOptions): Promise<string[]> {
  return ipcRenderer.invoke('plugins:fsPickFile', pluginId, options);
}

/**
 * Opens a native directory picker for a plugin with filesystem:pick permission.
 */
function pluginFsPickDirectory(pluginId: string, defaultPath = ''): Promise<string | null> {
  return ipcRenderer.invoke('plugins:fsPickDirectory', pluginId, defaultPath);
}

/**
 * Saves text to a user-selected path for a plugin with filesystem:pick permission.
 */
function pluginFsSaveFile(
  pluginId: string,
  content: string,
  options?: PluginFsSaveFileOptions
): Promise<string | null> {
  return ipcRenderer.invoke('plugins:fsSaveFile', pluginId, content, options);
}

/**
 * Reads a UTF-8 file from an allowlisted path for a plugin.
 */
function pluginFsReadFile(pluginId: string, path: string): Promise<string> {
  return ipcRenderer.invoke('plugins:fsReadFile', pluginId, path);
}

/**
 * Writes a UTF-8 file to an allowlisted path for a plugin.
 */
function pluginFsWriteFile(pluginId: string, path: string, content: string): Promise<void> {
  return ipcRenderer.invoke('plugins:fsWriteFile', pluginId, path, content);
}

/**
 * Writes binary bytes (base64-encoded) to an allowlisted plugin path.
 *
 * @param pluginId - Plugin manifest id.
 * @param path - Relative or absolute allowlisted path.
 * @param base64 - Base64-encoded payload.
 * @returns Absolute path written.
 */
function pluginFsWriteBytes(pluginId: string, path: string, base64: string): Promise<string> {
  return ipcRenderer.invoke('plugins:fsWriteBytes', pluginId, path, base64);
}

/**
 * Watches an allowlisted file for a plugin and invokes the callback on change.
 */
function pluginFsWatchFile(pluginId: string, path: string, callback: () => void): () => void {
  const normalizedPath = normalize(resolve(path));
  void ipcRenderer.invoke('plugins:fsWatchFile', pluginId, path);
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: { pluginId: string; path: string }
  ): void => {
    if (payload.pluginId === pluginId && payload.path === normalizedPath) {
      callback();
    }
  };
  ipcRenderer.on('plugins:fsChanged', listener);
  return () => {
    void ipcRenderer.invoke('plugins:fsUnwatchFile', pluginId, path);
    ipcRenderer.removeListener('plugins:fsChanged', listener);
  };
}

/**
 * Pushes serialized view context to an isolated plugin surface webview.
 */
function pushPluginViewContext(payload: {
  pluginId: string;
  contributionId: string;
  kind: string;
  context: unknown;
}): Promise<void> {
  return ipcRenderer.invoke('plugins:pushViewContext', payload);
}

/**
 * Pushes a completed HTTP exchange to plugin webviews with the `http` permission.
 */
function pushPluginHttpAfterSend(payload: {
  request: PluginHttpRequest;
  response: PluginHttpResponse;
}): Promise<void> {
  return ipcRenderer.invoke('plugins:pushHttpAfterSend', payload);
}

/**
 * Runs main-entry before-scripts hooks and returns injected scripts for a stage.
 *
 * @param payload - Stage, request snapshot, and current `hc.data` bag.
 * @returns Injected scripts plus the possibly-mutated data bag.
 */
function runPluginBeforeScripts(payload: {
  phase: ScriptPhase;
  request: PluginHttpRequest;
  data: Record<string, unknown>;
}): Promise<{ scripts: PluginInjectedScript[]; data: Record<string, unknown> }> {
  return ipcRenderer.invoke('plugins:runBeforeScripts', payload);
}

/**
 * Runs main-entry after-scripts hooks with the summary of a completed stage.
 *
 * @param payload - Stage summary with data bag, tests, logs, and errors.
 */
function runPluginAfterScripts(payload: PluginAfterScriptsContext): Promise<void> {
  return ipcRenderer.invoke('plugins:runAfterScripts', payload);
}

/**
 * Pushes a coarse library invalidation to plugin webviews with the `ui` permission.
 */
function pushPluginLibraryChanged(payload: {
  reason: 'collections' | 'folders' | 'requests' | 'documents';
  collectionId?: number;
}): Promise<void> {
  return ipcRenderer.invoke('plugins:pushLibraryChanged', payload);
}

/**
 * Pushes a coarse workflow invalidation to plugin webviews with the `ui` permission.
 */
function pushPluginWorkflowsChanged(payload: {
  reason: 'created' | 'updated' | 'renamed' | 'deleted' | 'refreshed';
  workflowId?: number;
}): Promise<void> {
  return ipcRenderer.invoke('plugins:pushWorkflowsChanged', payload);
}

/**
 * Pushes host sidebar selection changes to plugin webviews with the `ui` permission.
 */
function pushPluginSidebarSelectionChanged(
  selection: {
    kind: 'collection' | 'folder' | 'request' | 'document';
    collectionId: number;
    folderId?: number | null;
    requestId?: number;
    documentId?: number;
  } | null
): Promise<void> {
  return ipcRenderer.invoke('plugins:pushSidebarSelectionChanged', selection);
}

/**
 * Pushes running live-server list changes to plugin webviews with the `live-server` permission.
 *
 * @param running - Current running live server instances.
 */
function pushPluginLiveServersRunningChanged(running: unknown[]): Promise<void> {
  return ipcRenderer.invoke('plugins:pushLiveServersRunningChanged', running);
}

/**
 * Pushes a live-server access-log line to plugin webviews with the `live-server` permission.
 *
 * @param entry - Access-log entry from a running live server.
 */
function pushPluginLiveServerRequestLog(entry: unknown): Promise<void> {
  return ipcRenderer.invoke('plugins:pushLiveServerRequestLog', entry);
}

/**
 * Executes a plugin command in the plugin agent webview.
 */
function executePluginAgentCommand(
  pluginId: string,
  commandId: string,
  args: unknown[] = []
): Promise<void> {
  return ipcRenderer.invoke('plugins:executeAgentCommand', pluginId, commandId, args);
}

/**
 * Invokes one import handler phase in a plugin agent webview.
 *
 * @param pluginId - Target plugin manifest id.
 * @param registrationId - Agent-scoped handler registration id.
 * @param phase - Import detection or execution phase.
 * @param file - Selected import file from File → Import.
 */
function invokePluginImportHandler(
  pluginId: string,
  registrationId: string,
  phase: 'canImport' | 'import',
  file: {
    name: string;
    path: string;
    extension: string;
    contents: string;
  }
): Promise<unknown> {
  return ipcRenderer.invoke('plugins:invokeImportHandler', pluginId, registrationId, phase, file);
}

/**
 * Subscribes to contribution registry updates from plugin agent webviews.
 */
function onPluginsContributions(
  callback: (message: {
    pluginId: string;
    op: string;
    kind?: string;
    contribution?: Record<string, unknown>;
    contributionId?: string;
  }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('plugins:contributions', listener);
  return () => {
    ipcRenderer.removeListener('plugins:contributions', listener);
  };
}

/**
 * Subscribes to import handler metadata synced from plugin agent webviews.
 */
function onPluginsImportHandlers(
  callback: (message: {
    pluginId: string;
    op: 'register' | 'unregister';
    registrationId: string;
    extensions?: string[];
  }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('plugins:importHandlers', listener);
  return () => {
    ipcRenderer.removeListener('plugins:importHandlers', listener);
  };
}

/**
 * Subscribes to host bridge requests from isolated plugin webviews.
 */
function onPluginsHostBridge(
  callback: (message: { pluginId: string; op: string; payload?: unknown }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('plugins:hostBridge', listener);
  return () => {
    ipcRenderer.removeListener('plugins:hostBridge', listener);
  };
}

/**
 * Subscribes to correlated host bridge invokes that must return a result.
 */
function onPluginsHostBridgeInvoke(
  callback: (message: {
    requestId: number;
    pluginId: string;
    op: string;
    payload?: unknown;
  }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('plugins:hostBridgeInvoke', listener);
  return () => {
    ipcRenderer.removeListener('plugins:hostBridgeInvoke', listener);
  };
}

/**
 * Completes a correlated host bridge invoke with a result or error.
 */
function completePluginHostBridge(message: {
  requestId: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}): void {
  ipcRenderer.send('plugins:hostBridgeComplete', message);
}

/**
 * Subscribes to content height updates from isolated plugin surface webviews.
 */
function onPluginSurfaceResize(
  callback: (message: {
    pluginId: string;
    contributionId: string;
    kind: string;
    height: number;
  }) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, message: unknown): void => {
    callback(message as never);
  };
  ipcRenderer.on('plugins:surfaceResize', listener);
  return () => {
    ipcRenderer.removeListener('plugins:surfaceResize', listener);
  };
}

/**
 * Subscribes to plugin agent webview readiness notifications.
 */
function onPluginsAgentReady(callback: (payload: { pluginId: string }) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: { pluginId: string }): void => {
    callback(payload);
  };
  ipcRenderer.on('plugins:agentReady', listener);
  return () => {
    ipcRenderer.removeListener('plugins:agentReady', listener);
  };
}

/**
 * Subscribes to plugin agent webview bootstrap failure notifications.
 */
function onPluginsAgentFailed(
  callback: (payload: { pluginId: string; message: string }) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: { pluginId: string; message: string }
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('plugins:agentFailed', listener);
  return () => {
    ipcRenderer.removeListener('plugins:agentFailed', listener);
  };
}

const api: Api = {
  listCollections,
  createCollection,
  updateCollection,
  setCollectionMarker,
  setCollectionArchived,
  deleteCollection,
  duplicateCollection,
  exportCollection,
  importCollection,
  importCollectionFromUrl,
  refreshCollectionFromUrl,
  searchPublicCollections,
  previewPublicCollection,
  importPublicCollection,
  exportRequest,
  importRequest,
  exportRunResults,
  importRunResults,
  listSavedRunResults,
  saveRunResult,
  getSavedRunResult,
  deleteSavedRunResult,
  listRequestHistory,
  addRequestHistory,
  clearRequestHistory,
  deleteRequestHistory,
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  renameWorkspace,
  cloneWorkspace,
  deleteWorkspace,
  reorderWorkspaces,
  setWorkspaceMarker,
  importWorkspace,
  listWorkflows,
  createWorkflow,
  renameWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowArchived,
  listWebsites,
  createWebsite,
  updateWebsite,
  deleteWebsite,
  moveWebsite,
  importWebsite,
  startLiveServer,
  stopLiveServer,
  listRunningLiveServers,
  listLiveServers,
  createLiveServer,
  importLiveServer,
  updateLiveServer,
  deleteLiveServer,
  moveLiveServer,
  setLiveServerLastOpenedPath,
  getLiveServerLogs,
  clearLiveServerLogs,
  listLiveServerLogSessions,
  clearAllLiveServerLogSessions,
  onLiveServerFileChanged,
  onLiveServersChanged,
  onLiveServerLogSessionsChanged,
  onLiveServerRequestLog,
  onLiveServerScriptLog,
  onLiveServerProcessLog,
  listWorkflowRunHistory,
  addWorkflowRunHistory,
  clearWorkflowRunHistory,
  deleteWorkflowRunHistory,
  listTrashItems,
  restoreTrashItem,
  permanentlyDeleteTrashItem,
  emptyTrash,
  resolveRunResultByUuid,
  moveCollection,
  reorderCollections,
  listEnvironments,
  reorderEnvironments,
  createEnvironment,
  updateEnvironment,
  setEnvironmentMarker,
  deleteEnvironment,
  duplicateEnvironment,
  exportEnvironment,
  importEnvironment,
  listSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  moveSnippet,
  importSnippetFile,
  getSnippetCatalog,
  previewSnippetFromGit,
  installSnippetFromGit,
  installSnippet,
  installSnippetFromPath,
  loadUnpackedSnippet,
  loadUnpackedSnippetFromPath,
  updateSnippetFromGit,
  uninstallSnippetPackage,
  listInstalledSnippetPackages,
  importEntity,
  listRequests,
  saveRequest,
  setRequestMarker,
  deleteRequest,
  listFolders,
  createFolder,
  moveFolder,
  renameFolder,
  updateFolder,
  setFolderMarker,
  deleteFolder,
  reorderFolders,
  reorderRequests,
  moveRequest,
  reorderContainerItems,
  listDocuments,
  saveDocument,
  setDocumentMarker,
  deleteDocument,
  reorderDocuments,
  moveDocument,
  sendRequest,
  cancelRequest,
  getCookies,
  listCookieDomains,
  setCookies,
  runScript,
  onMenuAction,
  onDeepLink,
  setMenuSidebarVisible,
  setMenuRailVisible,
  setMenuAiSidebarVisible,
  setMenuGitSidebarVisible,
  setMenuRequestEditorVisible,
  setMenuResponseEditorVisible,
  setMenuShortcutsSidebarOpen,
  setMenuConsoleVisible,
  setMenuVariablesVisible,
  setMenuMcpVisible,
  setMenuTerminalVisible,
  setMenuStorageLocationsVisible,
  setMenuColorMarkersVisible,
  setMenuHighlightsVisible,
  setMenuIndicatorsVisible,
  setMenuFiltersVisible,
  setMenuSortingVisible,
  setMenuThemeMenuState,
  setMenuDesignerUndoRedo,
  setWorkspaceAvailable,
  setSidebarDeselectAllAvailable,
  setMenuGitCollectionActive,
  onMenuSelectTheme,
  popupMenuSubmenu,
  getAppSubmenuSnapshot,
  activateAppSubmenuItem,
  getAppVersion,
  checkForUpdates,
  logVerbose,
  getTheme,
  setTheme,
  previewTheme,
  shouldPickTheme,
  markThemePickerSeen,
  getZoomFactor,
  previewZoomFactor,
  setZoomFactor,
  shouldOpenGettingStarted,
  markGettingStartedSeen,
  consumeBuiltinCollectionOpenRequestTarget,
  onThemeChanged,
  isDeveloperToolsEnabled,
  inspectElement,
  minimizeWindow,
  focusRenderer,
  toggleMaximizeWindow,
  toggleFullscreenWindow,
  closeWindow,
  notifyUiReady,
  getGeneralSettings,
  setGeneralSettings,
  getAiSettings,
  setAiSettings,
  getMcpServerSettings,
  setMcpServerSettings,
  getMcpServerStatus,
  regenerateMcpServerToken,
  getMcpServerLogs,
  onMcpServerLog,
  listMcpClientServers,
  saveMcpClientServer,
  deleteMcpClientServer,
  onMcpClientServersChanged,
  listMcpClientServerStatuses,
  listMcpClientTools,
  mcpCallTool,
  searchDocs,
  onMcpServerToolInvoke,
  completeMcpServerTool,
  onScriptLivePageInvoke,
  completeScriptLivePage,
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  onTerminalData,
  onTerminalExit,
  readClipboardText,
  writeClipboardText,
  listChats,
  createChat,
  getChat,
  addChatMessage,
  generateChatTitle,
  completeChatStep,
  cancelChatStep,
  listHubLlmModels,
  getGithubModelsStatus,
  startGithubModelsSignIn,
  completeGithubModelsSignIn,
  signOutGithubModels,
  onGithubModelsSignInFinished,
  deleteChat,
  listStorageConnections,
  saveStorageConnection,
  deleteStorageConnection,
  onStorageConnectionsChanged,
  listRuntimes,
  saveRuntime,
  deleteRuntime,
  verifyRuntime,
  listTeamHubs,
  saveTeamHub,
  deleteTeamHub,
  setTeamHubConnected,
  scanTeamHubSessions,
  reloadTeamHubConfig,
  listTeamHubUsers,
  updateTeamHubUser,
  deleteTeamHubUser,
  createTeamHubUser,
  createTeamHubInvitedUser,
  createTeamHubUserInvitation,
  listTeamHubInvitations,
  revokeTeamHubInvitation,
  previewTeamHubInvitation,
  redeemTeamHubInvitation,
  verifyTeamHubSession,
  listTeamHubTokens,
  createTeamHubUserToken,
  deleteTeamHubToken,
  listTeamHubAdminResourceOptions,
  listTeamHubAdminCollectionContents,
  deleteTeamHubCollection,
  listTeamHubAdminSnippets,
  createTeamHubAdminSnippet,
  updateTeamHubAdminSnippet,
  deleteTeamHubAdminSnippet,
  listTeamHubAdminRunResults,
  deleteTeamHubRunResult,
  deleteTeamHubRequest,
  deleteTeamHubEnvironment,
  updateTeamHubCollectionDeletionLocked,
  updateTeamHubEnvironmentDeletionLocked,
  syncProvider,
  listUnregisteredCollections,
  registerDiscoveredCollections,
  markCollectionDiscoverySkipped,
  listGitStatuses,
  onGitWorkingTreeChanged,
  onGitOAuthFinished,
  gitCommit,
  gitListBranches,
  gitCreateBranch,
  gitDeleteBranch,
  gitCheckoutBranch,
  gitMergeBranch,
  gitReadConflictFile,
  gitWriteConflictFile,
  gitOpenExternalMergeEditor,
  gitFetch,
  gitTestConnection,
  gitPull,
  gitPush,
  gitLog,
  gitSuggestedAuthor,
  gitDeleteRepoDirectory,
  gitGraphLog,
  gitCommitDetail,
  gitCommitFileDiff,
  gitDiff,
  gitRepoInfo,
  gitCollectionCommits,
  gitFileInfo,
  gitFileDiff,
  gitListItemStatuses,
  gitChangedItemCount,
  gitStageItem,
  gitStageAllUntrackedItems,
  gitUnstageItem,
  gitRevertFile,
  gitSetPat,
  gitStartOAuth,
  gitCompleteOAuth,
  gitRevokeOAuth,
  gitReadRemoteUrl,
  listGitIdentities,
  gitSetHostPat,
  gitStartHostOAuth,
  gitCompleteHostOAuth,
  gitRevokeHost,
  gitIsRepo,
  gitInitRepo,
  oauthFetchToken,
  oauthClearToken,
  getAutocompleteValues,
  addAutocompleteValue,
  getActiveStorageId,
  setActiveStorageId,
  getRequestEditorTab,
  setRequestEditorTab,
  deleteRequestEditorTab,
  getPageSidebarSection,
  setPageSidebarSection,
  getSidebarExpansion,
  setSidebarExpansion,
  getPanelLayout,
  setPanelLayout,
  getAiChatSession,
  setAiChatSession,
  getOpenTabsPayload,
  setOpenTabsPayload,
  browserCreate,
  browserDestroy,
  browserRequestClose,
  browserHideAll,
  browserSetBounds,
  browserSetVisible,
  browserLoadURL,
  browserGoBack,
  browserGoForward,
  browserReload,
  browserGoHome,
  browserSetScripts,
  browserSetHomeUrl,
  browserExecuteJavaScript,
  browserInsertCSS,
  browserQuerySelector,
  browserWaitForLoad,
  browserCapturePage,
  browserListDownloads,
  browserRecordDownload,
  onBrowserNavigation,
  onBrowserConsoleEntry,
  onBrowserOpenTab,
  onBrowserCopyToChat,
  onBrowserDownloadsChanged,
  getCollectionRunnerConfig,
  setCollectionRunnerConfig,
  getShortcuts,
  setShortcuts,
  resetShortcuts,
  onBeforeClose,
  confirmClose,
  selectFiles,
  selectSslFile,
  selectFile,
  selectDirectory,
  selectSaveFile,
  openPath,
  showItemInFolder,
  readImageDataUrl,
  copyFileToSaveDialog,
  saveDataUrlToFile,
  createShareToken,
  joinSharedCollection,
  getSharingIdentity,
  exportSharingPrivateKey,
  exportSharingPublicKey,
  importSharingKeyPair,
  listTrustedKeys,
  addTrustedKey,
  importTrustedPublicKey,
  removeTrustedKey,
  saveTextFile,
  writeTextInDirectory,
  listCustomThemes,
  getCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  restoreBuiltinTheme,
  importCustomTheme,
  exportBackup,
  importBackup,
  restartApp,
  getUserDataPath,
  listPlugins,
  getPluginCatalog,
  getThemeCatalog,
  getPluginSources,
  setPluginSources,
  getTeamHubPluginSources,
  installPlugin,
  installPluginFromPath,
  installPluginFromGit,
  previewPluginFromGit,
  updatePluginFromGit,
  uninstallPlugin,
  setPluginEnabled,
  loadUnpackedPlugin,
  loadUnpackedPluginFromPath,
  reloadPlugin,
  removeUnpackedPlugin,
  readPluginEntry,
  readPluginAsset,
  resolveThemeImport,
  getPluginStorage,
  setPluginStorage,
  pluginDatabaseQuery,
  pluginDatabaseExec,
  pluginDatabaseTxBegin,
  pluginDatabaseTxEnd,
  activatePluginMain,
  deactivatePluginMain,
  reportPluginRuntimeError,
  invokePluginMain,
  onPluginsChanged,
  setPluginMenuContributions,
  onPluginMenuCommand,
  pluginFsPickFile,
  pluginFsPickDirectory,
  pluginFsSaveFile,
  pluginFsReadFile,
  pluginFsWriteFile,
  pluginFsWriteBytes,
  pluginFsWatchFile,
  pushPluginViewContext,
  pushPluginHttpAfterSend,
  runPluginBeforeScripts,
  runPluginAfterScripts,
  pushPluginLibraryChanged,
  pushPluginWorkflowsChanged,
  pushPluginSidebarSelectionChanged,
  pushPluginLiveServersRunningChanged,
  pushPluginLiveServerRequestLog,
  executePluginAgentCommand,
  invokePluginImportHandler,
  onPluginsContributions,
  onPluginsImportHandlers,
  onPluginsHostBridge,
  onPluginsHostBridgeInvoke,
  completePluginHostBridge,
  onPluginSurfaceResize,
  onPluginsAgentReady,
  onPluginsAgentFailed
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('platform', process.platform);
contextBridge.exposeInMainWorld('operatingSystemInfo', {
  platform: process.platform,
  type: os.type(),
  release: os.release(),
  arch: process.arch
});
