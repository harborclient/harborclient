import type { CollectionDocument, SaveDocumentInput } from '#/shared/types/collection';

/**
 * IPC methods for collection markdown documents.
 */
export interface ApiDocuments {
  /**
   * Lists markdown documents in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Documents in the collection.
   */
  listDocuments: (collectionId: number) => Promise<CollectionDocument[]>;

  /**
   * Inserts a new document or updates an existing one.
   *
   * @param input - Document fields to persist.
   * @returns The saved document.
   */
  saveDocument: (input: SaveDocumentInput) => Promise<CollectionDocument>;

  /**
   * Deletes a markdown document by ID.
   *
   * @param id - Document ID to delete.
   */
  deleteDocument: (id: number) => Promise<void>;

  /**
   * Reorders documents within a folder or at collection root.
   *
   * @param collectionId - Collection containing the documents.
   * @param folderId - Folder ID, or null for root-level documents.
   * @param orderedDocumentIds - Document IDs in desired order.
   */
  reorderDocuments: (
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ) => Promise<void>;

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param documentId - Document ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  moveDocument: (documentId: number, folderId: number | null, index: number) => Promise<void>;
}
