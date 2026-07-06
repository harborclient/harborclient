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

/**
 * Derives a default snippet name from the first line of imported script source.
 *
 * @param code - JavaScript read from an imported file.
 * @param maxLength - Maximum characters to keep from the first line.
 * @returns Trimmed first line up to maxLength, or the blank-snippet default when empty.
 */
export function snippetNameFromScript(code: string, maxLength = 30): string {
  const firstLine = code.split(/\r?\n/)[0]?.trim() ?? '';
  if (!firstLine) {
    return 'Untitled Snippet';
  }

  return firstLine.slice(0, maxLength);
}

/**
 * Builds a create-modal draft from imported JavaScript source.
 *
 * @param code - JavaScript read from an imported file.
 * @param scope - Default script phase scope for the imported snippet.
 * @returns Draft pre-filled with derived name, imported code, and scope.
 */
export function createImportedSnippetDraft(
  code: string,
  scope: SnippetScope = 'any'
): SnippetEditDraft {
  return {
    name: snippetNameFromScript(code),
    code,
    scope
  };
}
