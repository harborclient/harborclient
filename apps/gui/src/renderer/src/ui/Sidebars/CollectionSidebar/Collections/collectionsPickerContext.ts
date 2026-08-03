import { createContext, useContext } from 'react';

/**
 * How the Collections tree should behave when rendered.
 */
export type CollectionsMode = 'sidebar' | 'save-target';

/**
 * Local selection state for the save-request location picker.
 */
export interface CollectionsPickerSelection {
  /**
   * Selected collection id, or null when none is chosen yet.
   */
  collectionId: number | null;

  /**
   * Selected folder id within {@link collectionId}, or null for the collection root.
   */
  folderId: number | null;
}

/**
 * Context value when Collections is embedded in the save-location picker.
 */
export interface CollectionsPickerContextValue {
  /**
   * Always `'save-target'` when this context is provided.
   */
  mode: 'save-target';

  /**
   * Current picker selection highlight.
   */
  selection: CollectionsPickerSelection;

  /**
   * Selects a collection (folder cleared to root).
   *
   * @param collectionId - Collection the user clicked.
   */
  onSelectCollection: (collectionId: number) => void;

  /**
   * Selects a folder within a collection.
   *
   * @param collectionId - Parent collection id.
   * @param folderId - Folder the user clicked.
   */
  onSelectFolder: (collectionId: number, folderId: number) => void;
}

/**
 * Picker context; null when Collections is in the normal sidebar.
 */
export const CollectionsPickerContext = createContext<CollectionsPickerContextValue | null>(null);

/**
 * Returns save-target picker context when Collections is embedded in the modal,
 * or null for the normal sidebar.
 */
export function useCollectionsPicker(): CollectionsPickerContextValue | null {
  return useContext(CollectionsPickerContext);
}
