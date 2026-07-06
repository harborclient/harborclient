import type { Snippet } from '#/shared/types/snippet';
import type { SnippetScope } from '#/shared/snippetScope';

/**
 * Result of reading a JavaScript file selected for snippet import.
 */
export type SnippetImportResult = {
  /**
   * Raw JavaScript source from the selected file.
   */
  code: string;
};

/**
 * IPC methods for reusable JavaScript snippets.
 */
export interface ApiSnippets {
  /**
   * Lists all snippets ordered for settings display.
   *
   * @returns All snippets from the local registry database.
   */
  listSnippets: () => Promise<Snippet[]>;

  /**
   * Creates a new snippet with the given name and code.
   *
   * @param name - Display name for the snippet.
   * @param code - JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @returns The newly created snippet.
   */
  createSnippet: (name: string, code: string, scope: SnippetScope) => Promise<Snippet>;

  /**
   * Updates a snippet's name, code, and scope.
   *
   * @param id - Snippet ID to update.
   * @param name - New display name.
   * @param code - Updated JavaScript source.
   * @param scope - Script phases where the snippet may be referenced.
   * @returns The updated snippet.
   */
  updateSnippet: (id: number, name: string, code: string, scope: SnippetScope) => Promise<Snippet>;

  /**
   * Deletes a snippet by id.
   *
   * @param id - Snippet ID to delete.
   */
  deleteSnippet: (id: number) => Promise<void>;

  /**
   * Opens a native file picker for a `.js` file and returns its contents.
   *
   * @returns Imported source, or null when the dialog was canceled.
   * @throws When the selected file is empty or whitespace-only.
   */
  importSnippetFile: () => Promise<SnippetImportResult | null>;
}
