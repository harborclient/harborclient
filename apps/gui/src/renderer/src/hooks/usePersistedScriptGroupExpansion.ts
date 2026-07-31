import { useCallback, useState } from 'react';
import type { ScriptEditorGroup } from '@harborclient/core/scriptStage';

/** Stable editor group keys for Before/Main/After section expansion. */
export const SCRIPT_EDITOR_GROUPS = ['before', 'main', 'after'] as const;

/** Expanded/collapsed flags for each script editor stage group. */
export type ScriptGroupExpansionState = Record<ScriptEditorGroup, boolean>;

/** localStorage key prefix for per-request, per-phase group expansion. */
export const SCRIPT_GROUP_EXPAND_STORAGE_PREFIX = 'hc.scriptGroupExpand.';

interface PersistedScriptGroupExpansionResult {
  /**
   * Expanded flags keyed by Before/Main/After group.
   */
  expandedByGroup: ScriptGroupExpansionState;

  /**
   * Updates one group's expand state and persists when a scope key is present.
   */
  setGroupExpanded: (group: ScriptEditorGroup, expanded: boolean) => void;
}

/**
 * Builds the localStorage key for script stage-group expansion.
 *
 * @param scopeKey - Request id or `tab:${tabId}` fallback for unsaved drafts.
 * @param phase - Pre or post request script phase.
 * @returns Storage key scoped to that request/tab and phase.
 */
export function scriptGroupExpansionStorageKey(scopeKey: string, phase: 'pre' | 'post'): string {
  return `${SCRIPT_GROUP_EXPAND_STORAGE_PREFIX}${scopeKey}.${phase}`;
}

/**
 * Derives a persistence scope key from the request editor identity props.
 *
 * Prefers a saved request id; falls back to the open tab id for unsaved drafts.
 *
 * @param requestId - Saved request id when the draft has been persisted.
 * @param sourceTabId - Open request tab id.
 * @returns Scope key, or null when neither identity is available.
 */
export function scriptGroupExpansionScopeKey(
  requestId: number | undefined,
  sourceTabId: string | undefined
): string | null {
  if (requestId != null) {
    return String(requestId);
  }
  if (sourceTabId != null && sourceTabId.trim() !== '') {
    return `tab:${sourceTabId}`;
  }
  return null;
}

/**
 * Returns whether a string is a known script editor group key.
 *
 * @param key - Candidate group key.
 */
export function isScriptEditorGroup(key: string): key is ScriptEditorGroup {
  return (SCRIPT_EDITOR_GROUPS as readonly string[]).includes(key);
}

/**
 * Returns the default expansion state with every stage group expanded.
 */
export function defaultScriptGroupExpansion(): ScriptGroupExpansionState {
  return {
    before: true,
    main: true,
    after: true
  };
}

/**
 * Parses persisted script stage-group expansion JSON.
 *
 * Unknown keys are ignored. Missing known keys default to expanded.
 *
 * @param raw - Stored JSON string.
 * @returns Validated expansion state, or null when parsing fails.
 */
export function parsePersistedScriptGroupExpansion(raw: string): ScriptGroupExpansionState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const next = defaultScriptGroupExpansion();

    for (const key of SCRIPT_EDITOR_GROUPS) {
      const value = record[key];
      if (typeof value === 'boolean') {
        next[key] = value;
      }
    }

    return next;
  } catch {
    return null;
  }
}

/**
 * Loads persisted script stage-group expansion from localStorage.
 *
 * @param scopeKey - Request/tab scope key, or null to skip storage.
 * @param phase - Pre or post request script phase.
 * @returns Stored expansion state, or defaults when missing/unavailable.
 */
export function loadPersistedScriptGroupExpansion(
  scopeKey: string | null,
  phase: 'pre' | 'post'
): ScriptGroupExpansionState {
  if (scopeKey == null) {
    return defaultScriptGroupExpansion();
  }

  try {
    const raw = localStorage.getItem(scriptGroupExpansionStorageKey(scopeKey, phase));
    if (!raw) {
      return defaultScriptGroupExpansion();
    }

    return parsePersistedScriptGroupExpansion(raw) ?? defaultScriptGroupExpansion();
  } catch {
    return defaultScriptGroupExpansion();
  }
}

/**
 * Persists script stage-group expansion to localStorage.
 *
 * @param scopeKey - Request/tab scope key, or null to skip storage.
 * @param phase - Pre or post request script phase.
 * @param state - Expanded flags for each stage group.
 */
export function persistScriptGroupExpansion(
  scopeKey: string | null,
  phase: 'pre' | 'post',
  state: ScriptGroupExpansionState
): void {
  if (scopeKey == null) {
    return;
  }

  try {
    localStorage.setItem(scriptGroupExpansionStorageKey(scopeKey, phase), JSON.stringify(state));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Builds a stable identity string for the current persistence scope and phase.
 *
 * @param scopeKey - Request/tab scope key, or null when persistence is disabled.
 * @param phase - Pre or post request script phase.
 */
function expansionIdentity(scopeKey: string | null, phase: 'pre' | 'post'): string {
  return `${scopeKey ?? ''}:${phase}`;
}

/**
 * Loads and persists Before/Main/After section expand state per request and phase.
 *
 * When `scopeKey` is null (collection/folder editors without a request identity),
 * expansion stays in memory only and defaults to all expanded.
 *
 * @param scopeKey - Request id or `tab:${tabId}`, or null to skip persistence.
 * @param phase - Pre or post request script phase.
 * @returns Controlled expansion state and a setter that writes through to storage.
 */
export function usePersistedScriptGroupExpansion(
  scopeKey: string | null,
  phase: 'pre' | 'post'
): PersistedScriptGroupExpansionResult {
  const nextIdentity = expansionIdentity(scopeKey, phase);
  const [identity, setIdentity] = useState(nextIdentity);
  const [expandedByGroup, setExpandedByGroup] = useState<ScriptGroupExpansionState>(() =>
    loadPersistedScriptGroupExpansion(scopeKey, phase)
  );

  // Reload when the request/tab scope or phase changes (React prop→state sync).
  if (identity !== nextIdentity) {
    setIdentity(nextIdentity);
    setExpandedByGroup(loadPersistedScriptGroupExpansion(scopeKey, phase));
  }

  /**
   * Updates one group's expand flag in memory and mirrors the change to localStorage.
   *
   * @param group - Before, main, or after section being toggled.
   * @param expanded - Whether the section body should be visible.
   */
  const setGroupExpanded = useCallback(
    (group: ScriptEditorGroup, expanded: boolean): void => {
      setExpandedByGroup((current) => {
        if (current[group] === expanded) {
          return current;
        }

        const next = { ...current, [group]: expanded };
        persistScriptGroupExpansion(scopeKey, phase, next);
        return next;
      });
    },
    [phase, scopeKey]
  );

  return { expandedByGroup, setGroupExpanded };
}
