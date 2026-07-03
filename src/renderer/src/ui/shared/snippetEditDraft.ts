import type { Snippet } from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';

/**
 * Editable snippet fields shown in the create/edit modal.
 */
export type SnippetEditDraft = {
  /**
   * Existing snippet database id when editing.
   */
  id?: number;

  /**
   * Display name for the snippet.
   */
  name: string;

  /**
   * JavaScript source saved with the snippet.
   */
  code: string;

  /**
   * Script phases where the snippet may be referenced.
   */
  scope: SnippetScope;
};

/**
 * Creates a blank snippet used when opening the create modal.
 *
 * @param scope - Default script phase scope for the new snippet.
 * @returns Default name, empty code, and scope for a new snippet draft.
 */
export function createBlankSnippet(
  scope: SnippetScope = 'any'
): Pick<Snippet, 'name' | 'code' | 'scope'> {
  return {
    name: 'Untitled Snippet',
    code: '',
    scope
  };
}
