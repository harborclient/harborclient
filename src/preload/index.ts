import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  Collection,
  CollectionExportResult,
  SaveRequestInput,
  SavedRequest,
  SendRequestInput,
  SendResult,
  Variable
} from '#/shared/types'

/**
 * Lists all collections via IPC.
 *
 * @returns All collections from the main process.
 */
function listCollections(): Promise<Collection[]> {
  return ipcRenderer.invoke('collections:list')
}

/**
 * Creates a new collection via IPC.
 *
 * @param name - Display name for the collection.
 * @returns The newly created collection.
 */
function createCollection(name: string): Promise<Collection> {
  return ipcRenderer.invoke('collections:create', name)
}

/**
 * Updates a collection's name and variables via IPC.
 *
 * @param id - Collection ID to update.
 * @param name - New display name.
 * @param variables - Collection-scoped variables.
 * @returns The updated collection.
 */
function updateCollection(id: number, name: string, variables: Variable[]): Promise<Collection> {
  return ipcRenderer.invoke('collections:update', id, name, variables)
}

/**
 * Deletes a collection via IPC.
 *
 * @param id - Collection ID to delete.
 */
function deleteCollection(id: number): Promise<void> {
  return ipcRenderer.invoke('collections:delete', id)
}

/**
 * Exports a collection to a JSON file via IPC.
 *
 * @param id - Collection ID to export.
 * @returns Whether the dialog was canceled and the saved path when written.
 */
function exportCollection(id: number): Promise<CollectionExportResult> {
  return ipcRenderer.invoke('collections:export', id)
}

/**
 * Imports a collection from a JSON file via IPC.
 *
 * @returns The imported collection, or null when the dialog was canceled.
 */
function importCollection(): Promise<Collection | null> {
  return ipcRenderer.invoke('collections:import')
}

/**
 * Lists saved requests in a collection via IPC.
 *
 * @param collectionId - Collection to query.
 * @returns Requests in the collection.
 */
function listRequests(collectionId: number): Promise<SavedRequest[]> {
  return ipcRenderer.invoke('requests:list', collectionId)
}

/**
 * Saves a request via IPC.
 *
 * @param req - Request fields to persist.
 * @returns The saved request.
 */
function saveRequest(req: SaveRequestInput): Promise<SavedRequest> {
  return ipcRenderer.invoke('requests:save', req)
}

/**
 * Deletes a saved request via IPC.
 *
 * @param id - Request ID to delete.
 */
function deleteRequest(id: number): Promise<void> {
  return ipcRenderer.invoke('requests:delete', id)
}

/**
 * Sends an HTTP request via IPC.
 *
 * @param req - Request configuration to execute.
 * @returns Response metadata from the main process.
 */
function sendRequest(req: SendRequestInput): Promise<SendResult> {
  return ipcRenderer.invoke('http:send', req)
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
  sendRequest
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('platform', process.platform)
