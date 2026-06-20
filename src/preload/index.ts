import { contextBridge, ipcRenderer } from 'electron';
import type {
  Api,
  Collection,
  CollectionExportResult,
  DatabaseProvider,
  Environment,
  FirestoreSettings,
  MenuActionId,
  SaveRequestInput,
  SavedRequest,
  ScriptRunInput,
  ScriptRunResult,
  SendRequestInput,
  SendResult,
  SqliteSettings,
  ThemeSource,
  Variable,
  KeyValue
} from '#/shared/types';

/**
 * Lists all collections via IPC.
 *
 * @returns All collections from the main process.
 */
function listCollections(): Promise<Collection[]> {
  return ipcRenderer.invoke('collections:list');
}

/**
 * Creates a new collection via IPC.
 *
 * @param name - Display name for the collection.
 * @returns The newly created collection.
 */
function createCollection(name: string): Promise<Collection> {
  return ipcRenderer.invoke('collections:create', name);
}

/**
 * Updates a collection's name, variables, and headers via IPC.
 *
 * @param id - Collection ID to update.
 * @param name - New display name.
 * @param variables - Collection-scoped variables.
 * @param headers - Headers sent with every request in the collection.
 * @returns The updated collection.
 */
function updateCollection(
  id: number,
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string
): Promise<Collection> {
  return ipcRenderer.invoke(
    'collections:update',
    id,
    name,
    variables,
    headers,
    preRequestScript,
    postRequestScript
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
function updateEnvironment(
  id: number,
  name: string,
  variables: Variable[]
): Promise<Environment> {
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
 * Sends an HTTP request via IPC.
 *
 * @param req - Request configuration to execute.
 * @returns Response metadata from the main process.
 */
function sendRequest(req: SendRequestInput): Promise<SendResult> {
  return ipcRenderer.invoke('http:send', req);
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
 * Returns the application version from package.json.
 */
function getAppVersion(): Promise<string> {
  return ipcRenderer.invoke('app:getVersion');
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
 * Returns persisted SQLite path and legacy migration settings.
 */
function getSqliteSettings(): Promise<SqliteSettings> {
  return ipcRenderer.invoke('sqlite:getSettings');
}

/**
 * Persists SQLite path and legacy migration settings.
 *
 * @param settings - SQLite configuration to store.
 */
function setSqliteSettings(settings: SqliteSettings): Promise<void> {
  return ipcRenderer.invoke('sqlite:setSettings', settings);
}

/**
 * Returns the persisted database provider selection.
 */
function getDatabaseProvider(): Promise<DatabaseProvider> {
  return ipcRenderer.invoke('database:getProvider');
}

/**
 * Persists the database provider selection.
 *
 * @param provider - Provider to use on next launch.
 */
function setDatabaseProvider(provider: DatabaseProvider): Promise<void> {
  return ipcRenderer.invoke('database:setProvider', provider);
}

/**
 * Returns persisted Firestore connection settings.
 */
function getFirestoreSettings(): Promise<FirestoreSettings> {
  return ipcRenderer.invoke('firestore:getSettings');
}

/**
 * Persists Firestore connection settings.
 *
 * @param settings - Firestore configuration to store.
 */
function setFirestoreSettings(settings: FirestoreSettings): Promise<void> {
  return ipcRenderer.invoke('firestore:setSettings', settings);
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

const api: Api = {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  exportCollection,
  importCollection,
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  listRequests,
  saveRequest,
  deleteRequest,
  sendRequest,
  runScript,
  onMenuAction,
  getAppVersion,
  getTheme,
  setTheme,
  getSqliteSettings,
  setSqliteSettings,
  getDatabaseProvider,
  setDatabaseProvider,
  getFirestoreSettings,
  setFirestoreSettings,
  onBeforeClose,
  confirmClose
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('platform', process.platform);
