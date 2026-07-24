import type { SaveRequestInput, SavedRequest } from '#/shared/types/request';

/**
 * IPC methods for requests.
 */
export interface ApiRequests {
  /**
   * Lists saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests in the collection.
   */
  listRequests: (collectionId: number) => Promise<SavedRequest[]>;
  /**
   * Inserts a new saved request or updates an existing one.
   *
   * @param req - Request fields to persist.
   * @returns The saved request.
   */
  saveRequest: (req: SaveRequestInput) => Promise<SavedRequest>;
  /**
   * Updates a saved request sidebar color.
   *
   * @param id - Request ID to update.
   * @param color - CSS color string, or null to clear.
   * @returns The updated request.
   */
  setRequestColor: (id: number, color: string | null) => Promise<SavedRequest>;
  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  deleteRequest: (id: number) => Promise<void>;
}
