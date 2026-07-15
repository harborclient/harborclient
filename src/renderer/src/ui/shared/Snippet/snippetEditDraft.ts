import type { Snippet } from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';
import { DEFAULT_SCRIPT_STAGE } from '#/shared/scriptStage';

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
   * Request stage where the snippet may be referenced.
   */
  scope: SnippetScope;

  /**
   * Default script stage when the snippet is added to a request stage script list.
   */
  stage: ScriptStage;

  /**
   * Storage connection id that should store this snippet.
   */
  connectionId?: string;
};

/**
 * Creates a blank snippet used when opening the create modal.
 *
 * @param scope - Default script phase scope for the new snippet.
 * @returns Default name, empty code, and scope for a new snippet draft.
 */
export function createBlankSnippet(
  scope: SnippetScope = 'any',
  stage: ScriptStage = DEFAULT_SCRIPT_STAGE
): Pick<Snippet, 'name' | 'code' | 'scope' | 'stage'> {
  return {
    name: 'Untitled Snippet',
    code: '',
    scope,
    stage
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
  scope: SnippetScope = 'any',
  stage: ScriptStage = DEFAULT_SCRIPT_STAGE
): SnippetEditDraft {
  return {
    name: snippetNameFromScript(code),
    code,
    scope,
    stage
  };
}
