import type { Snippet } from '#/shared/types/snippet';
import type { SnippetScope } from '#/shared/snippetScope';

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
}
