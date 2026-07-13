import type { IStorage } from '#/main/storage/IStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { getTrashService } from '#/main/storage/trashServiceInstance';

/**
 * Registers IPC handlers for saved requests and collection folder operations.
 *
 * @param db - Database instance backing request and folder persistence.
 */
export function registerRequestHandlers(db: IStorage): void {
  // Lists saved requests in a collection.
  handle('requests:list', ipcArgSchemas.collectionId, (_event, collectionId) =>
    db.listRequests(collectionId)
  );

  // Inserts or updates a saved request.
  handle('requests:save', ipcArgSchemas.saveRequest, (_event, req) => db.saveRequest(req));

  handle('requests:setColor', ipcArgSchemas.requestsSetColor, (_event, id, color) =>
    db.setRequestColor(id, color)
  );

  // Deletes a saved request by id.
  handle('requests:delete', ipcArgSchemas.dbId, (_event, id) =>
    getTrashService().moveRequestToTrash(id)
  );

  // Lists folders in a collection.
  handle('folders:list', ipcArgSchemas.collectionId, (_event, collectionId) =>
    db.listFolders(collectionId)
  );

  // Creates a folder in a collection.
  handle('folders:create', ipcArgSchemas.folderCreate, (_event, collectionId, folderName) =>
    db.createFolder(collectionId, folderName)
  );

  // Renames a folder.
  handle('folders:rename', ipcArgSchemas.folderRename, (_event, id, folderName) =>
    db.renameFolder(id, folderName)
  );

  // Updates a folder's name, variables, headers, auth, and scripts.
  handle(
    'folders:update',
    ipcArgSchemas.folderUpdate,
    (
      _event,
      id,
      folderName,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth,
      preRequestScripts,
      postRequestScripts
    ) =>
      db.updateFolder(
        id,
        folderName,
        variables,
        headers,
        preRequestScript,
        postRequestScript,
        auth,
        preRequestScripts,
        postRequestScripts
      )
  );

  handle('folders:setColor', ipcArgSchemas.foldersSetColor, (_event, id, color) =>
    db.setFolderColor(id, color)
  );

  // Deletes a folder and its requests.
  handle('folders:delete', ipcArgSchemas.dbId, (_event, id) =>
    getTrashService().moveFolderToTrash(id)
  );

  // Reorders folders within a collection.
  handle('folders:reorder', ipcArgSchemas.folderReorder, (_event, collectionId, orderedFolderIds) =>
    db.reorderFolders(collectionId, orderedFolderIds)
  );

  // Reorders requests within a collection folder (or at collection root).
  handle(
    'requests:reorder',
    ipcArgSchemas.requestReorder,
    (_event, collectionId, folderId, orderedRequestIds) =>
      db.reorderRequests(collectionId, folderId, orderedRequestIds)
  );

  // Moves a request to a folder and position within the collection.
  handle('requests:move', ipcArgSchemas.requestMove, (_event, requestId, folderId, index) =>
    db.moveRequest(requestId, folderId, index)
  );
}
