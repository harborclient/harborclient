import type { SaveRequestInput, SavedRequest } from '../request';

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
   * Updates a saved request sidebar marker.
   *
   * @param id - Request ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated request.
   */
  setRequestMarker: (id: number, marker: string | null) => Promise<SavedRequest>;
  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  deleteRequest: (id: number) => Promise<void>;
}
