import type { ScriptPhase } from './types';
/**
 * Where a reusable snippet may be referenced across request stages.
 */
export type SnippetScope = 'pre-request' | 'post-request' | 'any';
/**
 * Select options for snippet request-stage fields in settings and script editors.
 */
export declare const SNIPPET_SCOPE_OPTIONS: {
  value: SnippetScope;
  label: string;
}[];
/**
 * Maps a script phase tab to the matching snippet scope value.
 *
 * @param phase - Pre- or post-request script list phase.
 * @returns Corresponding snippet scope for defaults in script editors.
 */
export declare function snippetScopeForPhase(phase: ScriptPhase): SnippetScope;
/**
 * Returns whether a snippet scope is compatible with a script list phase.
 *
 * @param scope - Snippet scope stored in the library.
 * @param phase - Active pre- or post-request script list phase.
 * @returns True when the snippet may be picked for the given phase.
 */
export declare function snippetMatchesPhase(scope: SnippetScope, phase: ScriptPhase): boolean;
/**
 * Coerces an unknown database value to a valid snippet scope.
 *
 * @param value - Raw scope column from SQLite.
 * @returns Valid scope, defaulting to `any` for legacy or corrupt rows.
 */
export declare function normalizeSnippetScope(value: unknown): SnippetScope;
/**
 * Returns the display label for a snippet scope value.
 *
 * @param scope - Snippet scope stored in the library.
 * @returns Human-readable label for settings and menus.
 */
export declare function snippetScopeLabel(scope: SnippetScope): string;
//# sourceMappingURL=snippetScope.d.ts.map
