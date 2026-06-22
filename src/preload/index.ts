import { contextBridge, ipcRenderer } from 'electron';
import type {
  Api,
  AuthConfig,
  Collection,
  CollectionExportResult,
  DatabaseConnection,
  EditorTab,
  Environment,
  Folder,
  AiSettings,
  AddChatMessageInput,
  Chat,
  ChatMessage,
  ChatSummary,
  CreateChatInput,
  GeneralSettings,
  ImportEntityResult,
  InviteIdentity,
  ListCollectionsResult,
  MenuActionId,
  PemExportResult,
  RequestExport,
  SaveRequestInput,
  SavedRequest,
  ScriptRunInput,
  ScriptRunResult,
  SendRequestInput,
  SendResult,
  SaveTextFileResult,
  ServiceHub,
  ShortcutBinding,
  ShortcutOverrides,
  SidebarExpansionState,
  ThemeSource,
  TrustedInviteKey,
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
function listDatabaseConnections(): Promise<DatabaseConnection[]> {
  return ipcRenderer.invoke('databaseConnections:list');
}

/**
 * Creates or updates a database connection via IPC.
 *
 * @param conn - Connection to persist.
 */
function saveDatabaseConnection(conn: DatabaseConnection): Promise<DatabaseConnection[]> {
  return ipcRenderer.invoke('databaseConnections:save', conn);
}

/**
 * Deletes a database connection via IPC.
 *
 * @param id - Connection id to remove.
 */
function deleteDatabaseConnection(id: string): Promise<DatabaseConnection[]> {
  return ipcRenderer.invoke('databaseConnections:delete', id);
}

/**
 * Lists all configured service hubs via IPC.
 */
function listServiceHubs(): Promise<ServiceHub[]> {
  return ipcRenderer.invoke('serviceHubs:list');
}

/**
 * Creates or updates a service hub via IPC.
 *
 * @param hub - Service hub to persist.
 */
function saveServiceHub(hub: ServiceHub): Promise<ServiceHub[]> {
  return ipcRenderer.invoke('serviceHubs:save', hub);
}

/**
 * Deletes a service hub via IPC.
 *
 * @param id - Service hub id to remove.
 */
function deleteServiceHub(id: string): Promise<ServiceHub[]> {
  return ipcRenderer.invoke('serviceHubs:delete', id);
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
 * Returns the active database connection id via IPC.
 */
function getActiveDatabaseId(): Promise<string> {
  return ipcRenderer.invoke('database:getActiveId');
}

/**
 * Sets the active database connection id via IPC.
 *
 * @param id - Connection id to activate on next launch.
 */
function setActiveDatabaseId(id: string): Promise<void> {
  return ipcRenderer.invoke('database:setActiveId', id);
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
 * Creates a signed, encrypted invite for a specific recipient via IPC.
 *
 * @param collectionId - Global collection id to share.
 * @param recipientKid - Fingerprint of the recipient's trusted public key.
 */
function createInviteToken(collectionId: number, recipientKid: string): Promise<string> {
  return ipcRenderer.invoke('invite:create', collectionId, recipientKid);
}

/**
 * Decodes an invite JWT and adds the embedded database connection via IPC.
 *
 * @param token - JWT string from an invite.
 */
function acceptInvite(token: string): Promise<DatabaseConnection[]> {
  return ipcRenderer.invoke('invite:accept', token);
}

/**
 * Returns the local invite identity via IPC.
 */
function getInviteIdentity(): Promise<InviteIdentity> {
  return ipcRenderer.invoke('certs:getIdentity');
}

/**
 * Exports the local private key via IPC.
 */
function exportInvitePrivateKey(): Promise<PemExportResult> {
  return ipcRenderer.invoke('certs:exportPrivateKey');
}

/**
 * Exports the local public key via IPC.
 */
function exportInvitePublicKey(): Promise<PemExportResult> {
  return ipcRenderer.invoke('certs:exportPublicKey');
}

/**
 * Imports a local invite key pair from a PEM file via IPC.
 */
function importInviteKeyPair(): Promise<InviteIdentity> {
  return ipcRenderer.invoke('certs:importKeyPair');
}

/**
 * Lists trusted collaborator public keys via IPC.
 */
function listTrustedKeys(): Promise<TrustedInviteKey[]> {
  return ipcRenderer.invoke('certs:listTrustedKeys');
}

/**
 * Adds a trusted collaborator public key via IPC.
 *
 * @param label - Display label for the key owner.
 * @param publicKeyPem - PEM-encoded RSA public key.
 */
function addTrustedKey(label: string, publicKeyPem: string): Promise<TrustedInviteKey[]> {
  return ipcRenderer.invoke('certs:addTrustedKey', label, publicKeyPem);
}

/**
 * Imports a trusted public key from a PEM file via IPC.
 *
 * @param label - Display label for the key owner.
 */
function importTrustedPublicKey(label: string): Promise<TrustedInviteKey[]> {
  return ipcRenderer.invoke('certs:importTrustedPublicKey', label);
}

/**
 * Removes a trusted public key via IPC.
 *
 * @param id - SHA-256 fingerprint of the key to remove.
 */
function removeTrustedKey(id: string): Promise<TrustedInviteKey[]> {
  return ipcRenderer.invoke('certs:removeTrustedKey', id);
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
  getAppVersion,
  checkForUpdates,
  getTheme,
  setTheme,
  getGeneralSettings,
  setGeneralSettings,
  getAiSettings,
  setAiSettings,
  listChats,
  createChat,
  getChat,
  addChatMessage,
  deleteChat,
  listDatabaseConnections,
  saveDatabaseConnection,
  deleteDatabaseConnection,
  listServiceHubs,
  saveServiceHub,
  deleteServiceHub,
  syncProvider,
  getActiveDatabaseId,
  setActiveDatabaseId,
  getRequestEditorTab,
  setRequestEditorTab,
  deleteRequestEditorTab,
  getSidebarExpansion,
  setSidebarExpansion,
  getShortcuts,
  setShortcuts,
  resetShortcuts,
  onBeforeClose,
  confirmClose,
  selectFiles,
  createInviteToken,
  acceptInvite,
  getInviteIdentity,
  exportInvitePrivateKey,
  exportInvitePublicKey,
  importInviteKeyPair,
  listTrustedKeys,
  addTrustedKey,
  importTrustedPublicKey,
  removeTrustedKey,
  saveTextFile
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('platform', process.platform);
