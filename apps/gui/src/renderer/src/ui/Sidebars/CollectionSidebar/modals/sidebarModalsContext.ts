import { createContext, useContext } from 'react';
import type { CollectionDocument } from '#/shared/types';

/**
 * Default filename offered when creating a new markdown document.
 */
export const DEFAULT_DOCUMENT_NAME = 'README.md';

/**
 * Ensures a sidebar document filename ends with the `.md` suffix.
 *
 * @param name - Raw filename from the create/rename modal.
 * @returns Trimmed filename with a `.md` extension.
 */
export function ensureMarkdownFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.toLowerCase().endsWith('.md')) {
    return trimmed;
  }
  return `${trimmed}.md`;
}

/**
 * Modal-opening actions shared with sidebar rows and the markdown editor tab so
 * callers can trigger create/rename dialogs without threading callbacks through
 * every level.
 */
export interface SidebarModalsContextValue {
  /**
   * Opens the create-folder modal for a collection.
   */
  openNewFolder: (collectionId: number) => void;

  /**
   * Opens the rename-folder modal for a folder.
   */
  openRenameFolder: (folderId: number, collectionId: number) => void;

  /**
   * Opens the create-document modal at a collection root or inside a folder.
   */
  openNewDocument: (collectionId: number, folderId?: number | null) => void;

  /**
   * Opens the rename-document modal for a document.
   */
  openRenameDocument: (doc: CollectionDocument) => void;

  /**
   * Opens the add-environment modal (create or import).
   */
  openAddEnvironment: () => void;
}

/**
 * React context for sidebar modal openers.
 */
export const SidebarModalsContext = createContext<SidebarModalsContextValue | null>(null);

/**
 * Returns sidebar modal openers.
 *
 * @throws When called outside `SidebarModalsProvider`.
 */
export function useSidebarModals(): SidebarModalsContextValue {
  const context = useContext(SidebarModalsContext);
  if (!context) {
    throw new Error('useSidebarModals must be used within SidebarModalsProvider');
  }
  return context;
}
