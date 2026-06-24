import { contextBridge, ipcRenderer } from 'electron';
import type {
  Api,
  AuthConfig,
  BackupExportResult,
  BackupImportResult,
  Collection,
  CollectionExportResult,
  StorageConnection,
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
  HubLlmModelGroup,
  ImportEntityResult,
  SharingIdentity,
  ListCollectionsResult,
  MenuActionId,
  RootMenuLabel,
  PanelLayoutState,
  PemExportResult,
  PluginAssetResult,
  PluginEntryKind,
  PluginFsPickFileOptions,
  PluginFsSaveFileOptions,
  PluginInfo,
  PluginPermission,
  SerializableMenuContribution,
  RequestExport,
  SaveRequestInput,
  SavedRequest,
  ScriptRunInput,
  ScriptRunResult,
  SendRequestInput,
  SendResult,
  SaveTextFileResult,
  TeamHub,
  TeamHubSessionScanResult,
  HubUserRecord,
  TeamHubAdminResourceOptions,
  UpdateHubUserInput,
  CreateHubUserInput,
  CreatedHubUser,
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
  KeyValue
} from '#/shared/types';

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
 * @returns The updated collection.
 */
function updateCollection(
  id: number,
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string,
  auth: AuthConfig
): Promise<Collection> {
  return ipcRenderer.invoke(
    'collections:update',
    id,
    name,
    variables,
    headers,
    preRequestScript,
    postRequestScript,
    auth
  );
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
 * Creates a new environment via IPC.
 *
 * @param name - Display name for the environment.
 * @returns The newly created environment.
 */
function createEnvironment(name: string): Promise<Environment> {
  return ipcRenderer.invoke('environments:create', name);
}

/**
 * Updates an environment's name and variables via IPC.
 *
 * @param id - Environment ID to update.
 * @param name - New display name.
 * @param variables - Environment-scoped variables.
 * @returns The updated environment.
 */
function updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
  return ipcRenderer.invoke('environments:update', id, name, variables);
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
 * @returns The imported entity, or null when the dialog was canceled.
 */
function importEntity(activeCollectionId: number | null): Promise<ImportEntityResult | null> {
  return ipcRenderer.invoke('imports:auto', activeCollectionId);
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
 * @returns The newly created folder.
 */
function createFolder(collectionId: number, name: string): Promise<Folder> {
  return ipcRenderer.invoke('folders:create', collectionId, name);
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
 * Deletes a folder and all requests inside it.
 *
 * @param id - Folder ID to delete.
 */
function deleteFolder(id: number): Promise<void> {
  return ipcRenderer.invoke('folders:delete', id);
}

/**
 * Reorders folders within a collection.
 *
 * @param collectionId - Collection containing the folders.
 * @param orderedFolderIds - Folder IDs in desired order.
 */
function reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
  return ipcRenderer.invoke('folders:reorder', collectionId, orderedFolderIds);
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
 * Syncs sidebar visibility to the View menu checkbox in the main process.
 *
 * @param visible - Whether the sidebar is currently visible in the renderer.
 */
function setMenuSidebarVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setSidebarVisible', visible);
}

/**
 * Syncs AI sidebar visibility to the View menu checkbox in the main process.
 *
 * @param visible - Whether the AI sidebar is currently visible in the renderer.
 */
function setMenuAiSidebarVisible(visible: boolean): Promise<void> {
  return ipcRenderer.invoke('menu:setAiSidebarVisible', visible);
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
 * Minimizes the focused application window.
 */
function minimizeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:minimize');
}

/**
 * Toggles maximize on the focused application window.
 */
function toggleMaximizeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:toggleMaximize');
}

/**
 * Closes the focused application window, honoring the quit prompt when configured.
 */
function closeWindow(): Promise<void> {
  return ipcRenderer.invoke('window:close');
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
 * @param input - Chat id, role, content, and optional model.
 */
function addChatMessage(input: AddChatMessageInput): Promise<ChatMessage> {
  return ipcRenderer.invoke('chats:addMessage', input);
}

/**
 * Runs one LLM completion step with tool definitions.
 *
 * @param input - Model id and conversation messages for the step.
 */
function completeChatStep(input: ChatStepInput): Promise<ChatStepResult> {
  return ipcRenderer.invoke('chats:completeStep', input);
}

/**
 * Lists LLM models offered by configured Team Hubs.
 */
function listHubLlmModels(): Promise<HubLlmModelGroup[]> {
  return ipcRenderer.invoke('llm:listHubModels');
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
 * Probes configured team hubs for session capabilities via IPC.
 */
function scanTeamHubSessions(): Promise<TeamHubSessionScanResult[]> {
  return ipcRenderer.invoke('teamHubs:scanSessions');
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
 * Re-reads collection data from a single provider via IPC.
 *
 * @param connectionId - Provider connection id to sync.
 */
function syncProvider(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('providers:sync', connectionId);
}

/**
 * Returns source-control status for each mounted git connection.
 */
function listGitStatuses(): Promise<Record<string, import('#/shared/types').SourceControlStatus>> {
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
 * Subscribes to background GitHub OAuth completion events.
 *
 * @param callback - Handler invoked when OAuth polling finishes or fails.
 * @returns Unsubscribe function.
 */
function onGitOAuthFinished(
  callback: (event: import('#/shared/types').GitOAuthFinishedEvent) => void
): () => void {
  const listener = (
    _event: Electron.IpcRendererEvent,
    payload: import('#/shared/types').GitOAuthFinishedEvent
  ): void => {
    callback(payload);
  };
  ipcRenderer.on('git:oauthFinished', listener);
  return () => ipcRenderer.removeListener('git:oauthFinished', listener);
}

/**
 * Commits staged changes in a git-backed connection.
 *
 * @param connectionId - Git connection id.
 * @param message - Commit message.
 * @param createHarborRoot - When true, creates the HarborClient subdirectory layout if missing.
 */
function gitCommit(
  connectionId: string,
  message: string,
  createHarborRoot?: boolean
): Promise<void> {
  return ipcRenderer.invoke('git:commit', connectionId, message, createHarborRoot);
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
): Promise<import('#/shared/types').GitLogEntry[]> {
  return ipcRenderer.invoke('git:log', connectionId, depth);
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
 * @param connectionId - Git connection id.
 */
function gitStartOAuth(connectionId: string): Promise<{
  userCode: string;
  verificationUri: string;
}> {
  return ipcRenderer.invoke('git:startOAuth', connectionId);
}

/**
 * Completes GitHub OAuth device flow after browser approval.
 *
 * Ensures background polling is running when a pending device flow exists.
 * Resolves immediately without waiting for GitHub approval.
 *
 * @param connectionId - Git connection id.
 */
function gitCompleteOAuth(connectionId: string): Promise<void> {
  return ipcRenderer.invoke('git:completeOAuth', connectionId);
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
 * Opens a native file picker for one or more files via IPC.
 *
 * @returns Selected absolute file paths, or an empty array when canceled.
 */
function selectFiles(): Promise<string[]> {
  return ipcRenderer.invoke('dialog:openFiles');
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
 * Writes text to a file via a native save dialog.
 *
 * @param content - UTF-8 text to write.
 * @param defaultPath - Suggested filename for the save dialog.
 */
function saveTextFile(content: string, defaultPath: string): Promise<SaveTextFileResult> {
  return ipcRenderer.invoke('files:saveText', content, defaultPath);
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
 * Lists installed and unpacked plugins.
 */
function listPlugins(): Promise<PluginInfo[]> {
  return ipcRenderer.invoke('plugins:list');
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
 * Activates a plugin main entry in the SES utilityProcess runner.
 *
 * @param pluginId - Plugin manifest id.
 * @param source - Bundled main entry source.
 * @param permissions - Granted plugin permissions.
 */
function activatePluginMain(
  pluginId: string,
  source: string,
  permissions: PluginPermission[]
): Promise<void> {
  return ipcRenderer.invoke('plugins:activateMain', pluginId, source, permissions);
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

const api: Api = {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  duplicateCollection,
  exportCollection,
  importCollection,
  exportRequest,
  importRequest,
  moveCollection,
  reorderCollections,
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  duplicateEnvironment,
  exportEnvironment,
  importEnvironment,
  importEntity,
  listRequests,
  saveRequest,
  deleteRequest,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  reorderFolders,
  reorderRequests,
  moveRequest,
  sendRequest,
  cancelRequest,
  getCookies,
  setCookies,
  runScript,
  onMenuAction,
  setMenuSidebarVisible,
  setMenuAiSidebarVisible,
  popupMenuSubmenu,
  getAppVersion,
  checkForUpdates,
  getTheme,
  setTheme,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  getGeneralSettings,
  setGeneralSettings,
  getAiSettings,
  setAiSettings,
  listChats,
  createChat,
  getChat,
  addChatMessage,
  completeChatStep,
  listHubLlmModels,
  deleteChat,
  listStorageConnections,
  saveStorageConnection,
  deleteStorageConnection,
  listTeamHubs,
  saveTeamHub,
  deleteTeamHub,
  scanTeamHubSessions,
  listTeamHubUsers,
  updateTeamHubUser,
  deleteTeamHubUser,
  createTeamHubUser,
  listTeamHubTokens,
  createTeamHubUserToken,
  deleteTeamHubToken,
  listTeamHubAdminResourceOptions,
  syncProvider,
  listGitStatuses,
  onGitWorkingTreeChanged,
  onGitOAuthFinished,
  gitCommit,
  gitPull,
  gitPush,
  gitLog,
  gitSetPat,
  gitStartOAuth,
  gitCompleteOAuth,
  gitRevokeOAuth,
  getActiveStorageId,
  setActiveStorageId,
  getRequestEditorTab,
  setRequestEditorTab,
  deleteRequestEditorTab,
  getSidebarExpansion,
  setSidebarExpansion,
  getPanelLayout,
  setPanelLayout,
  getAiChatSession,
  setAiChatSession,
  getShortcuts,
  setShortcuts,
  resetShortcuts,
  onBeforeClose,
  confirmClose,
  selectFiles,
  selectDirectory,
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
  exportBackup,
  importBackup,
  restartApp,
  listPlugins,
  installPlugin,
  installPluginFromPath,
  uninstallPlugin,
  setPluginEnabled,
  loadUnpackedPlugin,
  loadUnpackedPluginFromPath,
  reloadPlugin,
  removeUnpackedPlugin,
  readPluginEntry,
  readPluginAsset,
  getPluginStorage,
  setPluginStorage,
  activatePluginMain,
  deactivatePluginMain,
  invokePluginMain,
  onPluginsChanged,
  setPluginMenuContributions,
  onPluginMenuCommand,
  pluginFsPickFile,
  pluginFsPickDirectory,
  pluginFsSaveFile,
  pluginFsReadFile,
  pluginFsWriteFile
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('platform', process.platform);
