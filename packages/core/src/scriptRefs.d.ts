import type { CopiedScriptRef, ScriptRef } from './types/script';
import type { Snippet } from './types/snippet';
/**
 * Default display label for newly added inline scripts before the user names them.
 */
export declare const UNNAMED_SCRIPT_NAME = 'Unnamed script...';
/**
 * Maximum length for auto-generated script names derived from source code.
 */
export declare const SCRIPT_AUTO_NAME_MAX_LENGTH = 25;
/**
 * Creates a new inline script reference with a unique list id.
 *
 * @param code - Initial JavaScript source.
 * @param name - Optional display label.
 * @param stage - Stage within the phase script list.
 * @returns A new inline {@link ScriptRef}.
 */
export declare function createInlineScriptRef(
  code?: string,
  name?: string,
  stage?: import('@harborclient/sdk').ScriptStage
): ScriptRef;
/**
 * Creates a new snippet reference with a unique list id.
 *
 * @param snippetUuid - Stable uuid of the referenced snippet.
 * @param name - Optional display label override.
 * @param stage - Stage within the phase script list.
 * @returns A new snippet {@link ScriptRef}.
 */
export declare function createSnippetScriptRef(
  snippetUuid: string,
  name?: string,
  stage?: import('@harborclient/sdk').ScriptStage
): ScriptRef;
/**
 * Extracts a clipboard-safe payload from one script row.
 *
 * Snippet rows copy only the library uuid; inline rows copy code, name,
 * enabled, and stage.
 *
 * @param script - Script row to copy.
 * @returns Clipboard payload without list identity fields.
 */
export declare function copyScriptRefForClipboard(script: ScriptRef): CopiedScriptRef;
/**
 * Builds a new script row from a clipboard payload.
 *
 * Snippet payloads resolve the live library entry by uuid. Inline payloads
 * create a detached row with a fresh list id.
 *
 * @param copied - Clipboard payload from {@link copyScriptRefForClipboard}.
 * @param snippets - Snippet library used to resolve snippet references.
 * @returns A new script row, or null when a snippet uuid no longer exists.
 */
export declare function createScriptRefFromClipboard(
  copied: CopiedScriptRef,
  snippets: Snippet[]
): ScriptRef | null;
/**
 * Converts an existing script row into a snippet reference without stale inline code.
 *
 * @param script - Script row to relink.
 * @param snippetUuid - Saved snippet uuid to reference.
 * @param name - Display label stored on the script row.
 * @returns Snippet-linked {@link ScriptRef} preserving row identity fields.
 */
export declare function linkScriptRefToSnippet(
  script: ScriptRef,
  snippetUuid: string,
  name: string
): ScriptRef;
/**
 * Sanitizes script reference arrays loaded from storage or the editor.
 *
 * @param refs - Raw script references.
 * @returns Valid script references with trimmed inline code and snippet uuids.
 */
export declare function normalizeScriptRefs(refs: ScriptRef[] | undefined | null): ScriptRef[];
/**
 * Normalizes script references for dirty-state and equality checks.
 *
 * Omits {@link ScriptRef.expanded}, which is editor UI state and is not
 * persisted to storage.
 *
 * @param refs - Raw script references from drafts or forms.
 * @returns Comparable script references without ephemeral UI fields.
 */
export declare function normalizeScriptRefsForCompare(
  refs: ScriptRef[] | undefined | null
): ScriptRef[];
/**
 * Resolves canonical script references, falling back to a legacy single string.
 *
 * @param refs - Stored script reference array, possibly empty.
 * @param legacyScript - Legacy single-script column value.
 * @returns Normalized script references for the editor and send pipeline.
 */
export declare function resolveScriptRefs(
  refs: ScriptRef[] | undefined | null,
  legacyScript: string
): ScriptRef[];
/**
 * Parses script references from a JSON column with legacy fallback.
 *
 * @param raw - JSON string or already-parsed array from storage.
 * @param legacyScript - Legacy single-script column value.
 * @returns Resolved script references.
 */
export declare function readScriptRefsFromJson(raw: unknown, legacyScript: string): ScriptRef[];
/**
 * Serializes script references for JSON storage columns.
 *
 * @param refs - Script references to persist.
 * @returns JSON string suitable for SQLite/Postgres TEXT columns.
 */
export declare function serializeScriptRefs(refs: ScriptRef[] | undefined | null): string;
/**
 * Builds the legacy single-script mirror from enabled inline scripts only.
 *
 * Snippet references are excluded because their source is resolved at send time.
 *
 * @param refs - Canonical script reference array.
 * @returns Concatenated inline script source for legacy export paths.
 */
export declare function mirrorLegacyScriptString(refs: ScriptRef[] | undefined | null): string;
/**
 * Converts a legacy single-script string into a one-item inline script list.
 *
 * @param legacyScript - Legacy script column value.
 * @returns Inline script references, or an empty list when blank.
 */
export declare function scriptRefsFromLegacyString(legacyScript: string): ScriptRef[];
/**
 * Ensures at least one empty inline script exists for the script tab editor.
 *
 * @param refs - Current script references, possibly empty.
 * @returns The existing list when non-empty, otherwise a single blank inline script.
 */
export declare function ensureDefaultScriptRef(refs: ScriptRef[] | undefined | null): ScriptRef[];
/**
 * Resolves JavaScript source for one script reference.
 *
 * @param script - Script reference entry.
 * @param snippets - Snippet library lookup source.
 * @returns Inline code or referenced snippet source.
 */
export declare function resolveScriptSourceCode(script: ScriptRef, snippets: Snippet[]): string;
/**
 * Derives an auto-generated script name from the first non-empty source line.
 *
 * @param code - JavaScript source to inspect.
 * @returns Trimmed first line up to {@link SCRIPT_AUTO_NAME_MAX_LENGTH}, or null when empty.
 */
export declare function scriptAutoNameFromCode(code: string): string | null;
/**
 * Renames unnamed script rows using the first line of their resolved source code.
 *
 * @param refs - Script references to normalize and inspect.
 * @param snippets - Snippet library lookup source.
 * @param unnamedLabel - Placeholder label that triggers auto-naming.
 * @returns Script references with auto names applied where applicable.
 */
export declare function autoNameUnnamedScripts(
  refs: ScriptRef[] | undefined | null,
  snippets: Snippet[],
  unnamedLabel?: string
): ScriptRef[];
/**
 * One script row id change reported when storage round-trips regenerate list keys.
 */
export interface ScriptRefIdMigration {
  /**
   * Previous {@link ScriptRef.id} from the pre-save editor draft.
   */
  from: string;
  /**
   * New {@link ScriptRef.id} from the saved storage payload.
   */
  to: string;
}
/**
 * Result of merging ephemeral script UI state into a post-save script list.
 */
export interface MergeScriptRefsUiStateResult {
  /**
   * Saved script references with editor UI fields restored from the pre-save draft.
   */
  merged: ScriptRef[];
  /**
   * Id pairs to migrate persisted CodeEditor UI state in localStorage.
   */
  idMigrations: ScriptRefIdMigration[];
}
/**
 * Copies ephemeral {@link ScriptRef.expanded} from a pre-save list onto a saved list.
 *
 * Matches rows by id first, then by index when storage regenerates ids. Reports id
 * changes so callers can migrate localStorage editor UI keys.
 *
 * @param before - Script references from the editor draft before save.
 * @param after - Script references returned from storage after save.
 * @returns Merged list and any id migrations detected during index fallback matching.
 */
export declare function mergeScriptRefsUiState(
  before: ScriptRef[] | undefined | null,
  after: ScriptRef[] | undefined | null
): MergeScriptRefsUiStateResult;
/**
 * Returns whether any enabled script references exist in the list.
 *
 * @param refs - Script references to inspect.
 * @returns True when at least one enabled inline or snippet reference is present.
 */
export declare function hasScriptContent(refs: ScriptRef[] | undefined | null): boolean;
//# sourceMappingURL=scriptRefs.d.ts.map
