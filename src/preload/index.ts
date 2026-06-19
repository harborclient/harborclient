import { contextBridge, ipcRenderer } from 'electron';
import type {
  Api,
  Collection,
  CollectionExportResult,
  MenuActionId,
  SaveRequestInput,
  SavedRequest,
  SendRequestInput,
  SendResult,
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
  headers: KeyValue[]
): Promise<Collection> {
  return ipcRenderer.invoke('collections:update', id, name, variables, headers);
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

const api: Api = {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  exportCollection,
  importCollection,
  listRequests,
  saveRequest,
  deleteRequest,
  sendRequest,
  onMenuAction,
  getAppVersion,
  getTheme,
  setTheme
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('platform', process.platform);
