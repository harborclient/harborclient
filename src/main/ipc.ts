import { ipcMain } from 'electron'
import {
  createCollection,
  deleteCollection,
  deleteRequest,
  listCollections,
  listRequests,
  renameCollection,
  saveRequest
} from '#/main/db'
import { executeRequest } from '#/main/http'
import type { SaveRequestInput, SendRequestInput } from '#/shared/types'

/**
 * Registers IPC handlers that bridge renderer calls to db and HTTP modules.
 */
export function registerIpcHandlers(): void {
  // Returns all collections, ordered by name.
  ipcMain.handle('collections:list', () => listCollections());

  // Creates a new collection with the given display name.
  ipcMain.handle('collections:create', (_event, name: string) => createCollection(name));

  // Renames an existing collection by ID.
  ipcMain.handle('collections:rename', (_event, id: number, name: string) =>
    renameCollection(id, name)
  );

  // Deletes a collection and all of its saved requests.
  ipcMain.handle('collections:delete', (_event, id: number) => deleteCollection(id));

  // Returns all saved requests in a collection, ordered by sort order then name.
  ipcMain.handle('requests:list', (_event, collectionId: number) =>
    listRequests(collectionId)
  );

  // Inserts a new saved request or updates an existing one.
  ipcMain.handle('requests:save', (_event, req: SaveRequestInput) => saveRequest(req));

  // Deletes a saved request by ID.
  ipcMain.handle('requests:delete', (_event, id: number) => deleteRequest(id));

  // Sends an HTTP request and returns the response (status, headers, body, timing).
  ipcMain.handle('http:send', (_event, req: SendRequestInput) => executeRequest(req));
}
