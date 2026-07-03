import type { CodeEditorViewState } from '@harborclient/sdk/components';
import { useCallback, useState } from 'react';

/** localStorage key prefix for unified per-script CodeEditor UI state. */
export const SCRIPT_EDITOR_UI_STORAGE_PREFIX = 'hc.scriptEditorUi.';

/** Legacy localStorage key prefix for height-only persistence. */
export const SCRIPT_EDITOR_HEIGHT_STORAGE_PREFIX = 'hc.scriptEditorHeight.';

/**
 * Persisted scroll, selection, and height for a script row editor.
 */
export interface PersistedScriptEditorUiState {
  /**
   * Wrapper height in pixels after user resize.
   */
  heightPx?: number;

  /**
   * Vertical scroll offset of the CodeMirror scroller.
   */
  scrollTop?: number;

  /**
   * Document offsets for the caret/selection range.
   */
  selection?: {
    anchor: number;
    head: number;
  };
}

/**
 * Builds the localStorage key for a script row editor UI state.
 *
 * @param scriptId - Stable {@link ScriptRef.id} for the script row.
 * @returns Storage key scoped to that script.
 */
export function scriptEditorUiStorageKey(scriptId: string): string {
  return `${SCRIPT_EDITOR_UI_STORAGE_PREFIX}${scriptId}`;
}

/**
 * @deprecated Use {@link scriptEditorUiStorageKey} — kept for legacy height migration tests.
 */
export function scriptEditorHeightStorageKey(scriptId: string): string {
  return `${SCRIPT_EDITOR_HEIGHT_STORAGE_PREFIX}${scriptId}`;
}

/**
 * Parses a CSS min-height value into pixels for clamping and defaults.
 *
 * @param cssHeight - CSS length such as `125px`.
 * @returns Parsed pixel value, or 125 when parsing fails.
 */
export function parseScriptEditorMinHeightPx(cssHeight: string): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(cssHeight.trim());
  if (!match) {
    return 125;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.round(parsed) : 125;
}

/**
 * Validates a selection range from persisted storage.
 *
 * @param value - Unknown parsed JSON value.
 * @returns Normalized selection or undefined when invalid.
 */
function parsePersistedSelection(
  value: unknown
): PersistedScriptEditorUiState['selection'] | undefined {
  if (typeof value !== 'object' || value == null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const anchor = Number(record.anchor);
  const head = Number(record.head);
  if (!Number.isFinite(anchor) || !Number.isFinite(head)) {
    return undefined;
  }
  return {
    anchor: Math.max(0, Math.round(anchor)),
    head: Math.max(0, Math.round(head))
  };
}

/**
 * Parses and validates persisted UI state JSON.
 *
 * @param raw - Stored JSON string.
 * @param minPx - Minimum allowed editor height.
 * @returns Validated UI state or null when parsing fails.
 */
export function parsePersistedScriptEditorUiState(
  raw: string,
  minPx: number
): PersistedScriptEditorUiState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const next: PersistedScriptEditorUiState = {};

    if (record.heightPx != null) {
      const heightPx = Number(record.heightPx);
      if (Number.isFinite(heightPx)) {
        next.heightPx = Math.max(minPx, Math.round(heightPx));
      }
    }

    if (record.scrollTop != null) {
      const scrollTop = Number(record.scrollTop);
      if (Number.isFinite(scrollTop)) {
        next.scrollTop = Math.max(0, Math.round(scrollTop));
      }
    }

    const selection = parsePersistedSelection(record.selection);
    if (selection) {
      next.selection = selection;
    }

    return Object.keys(next).length > 0 ? next : null;
  } catch {
    return null;
  }
}

/**
 * Loads persisted script editor UI state, migrating legacy height-only keys when needed.
 *
 * @param scriptId - Stable script row id.
 * @param minPx - Minimum allowed height in pixels.
 * @returns Stored UI state when present, otherwise null.
 */
export function loadPersistedScriptEditorUiState(
  scriptId: string,
  minPx: number
): PersistedScriptEditorUiState | null {
  try {
    const uiRaw = localStorage.getItem(scriptEditorUiStorageKey(scriptId));
    if (uiRaw) {
      return parsePersistedScriptEditorUiState(uiRaw, minPx);
    }

    const legacyRaw = localStorage.getItem(scriptEditorHeightStorageKey(scriptId));
    if (!legacyRaw) {
      return null;
    }

    const legacyHeight = Number(legacyRaw);
    if (!Number.isFinite(legacyHeight)) {
      return null;
    }

    const migrated: PersistedScriptEditorUiState = {
      heightPx: Math.max(minPx, Math.round(legacyHeight))
    };
    localStorage.setItem(scriptEditorUiStorageKey(scriptId), JSON.stringify(migrated));
    localStorage.removeItem(scriptEditorHeightStorageKey(scriptId));
    return migrated;
  } catch {
    return null;
  }
}

/**
 * Reads UI state from the unified key without legacy migration.
 *
 * @param scriptId - Stable script row id.
 * @param minPx - Minimum allowed height in pixels.
 * @returns Parsed UI state or null when missing/invalid.
 */
function readStoredScriptEditorUiState(
  scriptId: string,
  minPx: number
): PersistedScriptEditorUiState | null {
  try {
    const uiRaw = localStorage.getItem(scriptEditorUiStorageKey(scriptId));
    if (!uiRaw) {
      return null;
    }
    return parsePersistedScriptEditorUiState(uiRaw, minPx);
  } catch {
    return null;
  }
}

/**
 * Merges and persists script editor UI state to localStorage.
 *
 * @param scriptId - Stable script row id.
 * @param patch - Partial UI state to merge into the stored record.
 * @param minPx - Minimum allowed height used when parsing existing JSON.
 */
export function persistScriptEditorUiState(
  scriptId: string,
  patch: PersistedScriptEditorUiState,
  minPx = 125
): void {
  try {
    const existing = readStoredScriptEditorUiState(scriptId, minPx);
    const next = { ...(existing ?? {}), ...patch };
    localStorage.setItem(scriptEditorUiStorageKey(scriptId), JSON.stringify(next));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

interface PersistedScriptEditorUiStateResult {
  /**
   * Explicit CSS height when a size has been stored or resized.
   */
  height: string | undefined;

  /**
   * Persists wrapper height changes from the CodeEditor resize handle.
   */
  onHeightChange: (heightPx: number) => void;

  /**
   * Restores vertical scroll when the editor mounts.
   */
  initialScrollTop: number | undefined;

  /**
   * Restores caret/selection when the editor mounts.
   */
  initialSelection: PersistedScriptEditorUiState['selection'];

  /**
   * Persists scroll and selection changes from the CodeEditor.
   */
  onViewStateChange: (state: CodeEditorViewState) => void;
}

/**
 * Restores and persists per-script CodeEditor UI state keyed by script id.
 *
 * @param scriptId - Stable {@link ScriptRef.id} for the script row.
 * @param minHeightCss - Minimum editor height in CSS units (for example `125px`).
 * @returns Props to pass through to {@link CodeEditor}.
 */
export function usePersistedScriptEditorUiState(
  scriptId: string,
  minHeightCss: string
): PersistedScriptEditorUiStateResult {
  const minPx = parseScriptEditorMinHeightPx(minHeightCss);
  const [initialState] = useState<PersistedScriptEditorUiState | null>(() =>
    loadPersistedScriptEditorUiState(scriptId, minPx)
  );
  const [heightPx, setHeightPx] = useState<number | null>(() => initialState?.heightPx ?? null);

  /**
   * Merges a partial UI state patch into localStorage.
   */
  const mergePersist = useCallback(
    (patch: PersistedScriptEditorUiState): void => {
      persistScriptEditorUiState(scriptId, patch, minPx);
    },
    [minPx, scriptId]
  );

  /**
   * Clamps, stores, and applies a new editor height after user resize.
   */
  const onHeightChange = useCallback(
    (nextHeightPx: number): void => {
      const clamped = Math.max(minPx, Math.round(nextHeightPx));
      setHeightPx(clamped);
      mergePersist({ heightPx: clamped });
    },
    [minPx, mergePersist]
  );

  /**
   * Persists scroll position and selection whenever the editor reports a change.
   */
  const onViewStateChange = useCallback(
    (state: CodeEditorViewState): void => {
      mergePersist({
        scrollTop: Math.max(0, Math.round(state.scrollTop)),
        selection: state.selection
      });
    },
    [mergePersist]
  );

  return {
    height: `${heightPx ?? minPx}px`,
    onHeightChange,
    initialScrollTop: initialState?.scrollTop,
    initialSelection: initialState?.selection,
    onViewStateChange
  };
}
