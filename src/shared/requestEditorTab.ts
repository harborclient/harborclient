import type { EditorTab } from '#/shared/types';

const EDITOR_TABS: ReadonlySet<EditorTab> = new Set([
  'params',
  'headers',
  'auth',
  'cookies',
  'body',
  'pre',
  'post',
  'comment'
]);

/**
 * Builds the electron-store key for a request editor tab preference.
 *
 * @param draft - Draft with optional saved request id.
 * @param tabId - Open tab id for unsaved drafts.
 */
export function requestEditorTabKey(draft: { id?: number }, tabId: string): string {
  return draft.id != null ? String(draft.id) : `tab:${tabId}`;
}

/**
 * Returns a valid editor tab value or null when unknown.
 *
 * @param value - Raw stored value.
 */
export function normalizeEditorTab(value: unknown): EditorTab | null {
  if (typeof value !== 'string' || !EDITOR_TABS.has(value as EditorTab)) {
    return null;
  }
  return value as EditorTab;
}

/**
 * Resolves a stored editor tab for the current request method.
 *
 * @param stored - Persisted tab or null when unset.
 * @param showBody - Whether the Body tab is available.
 */
export function resolveEditorTab(stored: EditorTab | null, showBody: boolean): EditorTab {
  const tab = stored ?? 'params';
  if (tab === 'body' && !showBody) {
    return 'params';
  }
  return tab;
}
