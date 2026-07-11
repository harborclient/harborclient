import type { IStorage } from '#/main/storage/IStorage';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';

/**
 * Registers IPC handlers for collection markdown document operations.
 *
 * @param db - Database instance backing document persistence.
 */
export function registerDocumentHandlers(db: IStorage): void {
  handle('documents:list', ipcArgSchemas.documentList, (_event, collectionId) =>
    db.listDocuments(collectionId)
  );

  handle('documents:save', ipcArgSchemas.documentSave, (_event, input) => db.saveDocument(input));

  handle('documents:delete', ipcArgSchemas.documentDelete, (_event, id) => db.deleteDocument(id));

  handle(
    'documents:reorder',
    ipcArgSchemas.documentReorder,
    (_event, collectionId, folderId, orderedDocumentIds) =>
      db.reorderDocuments(collectionId, folderId, orderedDocumentIds)
  );

  handle('documents:move', ipcArgSchemas.documentMove, (_event, documentId, folderId, index) =>
    db.moveDocument(documentId, folderId, index)
  );
}
