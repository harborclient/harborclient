import type { ScriptPhase } from '#/shared/types';

/**
 * Where a reusable snippet may be referenced in script lists.
 */
export type SnippetScope = 'pre-request' | 'post-request' | 'any';

/**
 * Select options for snippet scope fields in settings and script editors.
 */
export const SNIPPET_SCOPE_OPTIONS: { value: SnippetScope; label: string }[] = [
  { value: 'pre-request', label: 'Pre-request' },
  { value: 'post-request', label: 'Post-request' },
  { value: 'any', label: 'Any' }
];

const SNIPPET_SCOPES = new Set<SnippetScope>(SNIPPET_SCOPE_OPTIONS.map((option) => option.value));

/**
 * Maps a script phase tab to the matching snippet scope value.
 *
 * @param phase - Pre- or post-request script list phase.
 * @returns Corresponding snippet scope for defaults in script editors.
 */
export function snippetScopeForPhase(phase: ScriptPhase): SnippetScope {
  return phase === 'pre' ? 'pre-request' : 'post-request';
}

/**
 * Returns whether a snippet scope is compatible with a script list phase.
 *
 * @param scope - Snippet scope stored in the library.
 * @param phase - Active pre- or post-request script list phase.
 * @returns True when the snippet may be picked for the given phase.
 */
export function snippetMatchesPhase(scope: SnippetScope, phase: ScriptPhase): boolean {
  return scope === 'any' || scope === snippetScopeForPhase(phase);
}

/**
 * Coerces an unknown database value to a valid snippet scope.
 *
 * @param value - Raw scope column from SQLite.
 * @returns Valid scope, defaulting to `any` for legacy or corrupt rows.
 */
export function normalizeSnippetScope(value: unknown): SnippetScope {
  if (typeof value === 'string' && SNIPPET_SCOPES.has(value as SnippetScope)) {
    return value as SnippetScope;
  }
  return 'any';
}

/**
 * Returns the display label for a snippet scope value.
 *
 * @param scope - Snippet scope stored in the library.
 * @returns Human-readable label for settings and menus.
 */
export function snippetScopeLabel(scope: SnippetScope): string {
  return SNIPPET_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? 'Any';
}
