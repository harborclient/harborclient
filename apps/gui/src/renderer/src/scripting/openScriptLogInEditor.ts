import type { ScriptLogEntry, ScriptPhase, ScriptTestScope } from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { resolveScriptOwnerTab } from './resolveScriptOwnerTab';

/**
 * Minimal script ownership fields required to open a request script editor.
 */
export interface ScriptEditorOwnerRef {
  /**
   * Display label of the script slot.
   */
  scriptName?: string;
  /**
   * Stable script id when the slot has one.
   */
  scriptId?: string;
  /**
   * Pre or post phase of the slot.
   */
  phase?: ScriptPhase;
  /**
   * Collection / folder / request ownership of the slot.
   */
  scope?: ScriptTestScope;
}

/**
 * Returns whether a script log (or similar) row can open a request script editor.
 *
 * Only request-scoped slots with a stable script id are navigable; collection
 * and folder scripts have no per-request editor tab to reveal into.
 *
 * @param entry - Log or ownership fields from the last send.
 * @returns True when jump-to-editor is available for this entry.
 */
export function canOpenScriptLogInEditor(entry: ScriptEditorOwnerRef): boolean {
  return entry.scope === 'request' && Boolean(entry.scriptId?.trim()) && Boolean(entry.phase);
}

/**
 * Opens the request script editor page tab for the script that produced a log line.
 *
 * @param dispatch - Redux dispatch used to open or focus the script-editor page tab.
 * @param getState - Store getter used to locate the owning request tab.
 * @param entry - Log row the user activated.
 * @param requestTabId - Optional tab id of the request that produced this log.
 * @returns True when a script-editor tab was opened or focused.
 */
export function openScriptLogInEditor(
  dispatch: AppDispatch,
  getState: () => RootState,
  entry: ScriptLogEntry | ScriptEditorOwnerRef,
  requestTabId?: string
): boolean {
  if (!canOpenScriptLogInEditor(entry) || !entry.scriptId || !entry.phase) {
    return false;
  }

  const scriptId = entry.scriptId;
  const phase = entry.phase;
  const requestTab = resolveScriptOwnerTab(getState(), phase, scriptId, requestTabId);
  if (!requestTab) {
    return false;
  }

  dispatch(
    openPageTab({
      type: 'script-editor',
      requestTabId: requestTab.tabId,
      phase,
      scriptId,
      label: entry.scriptName?.trim() || 'Script',
      revealSource: 'script',
      revealNonce: Date.now()
    })
  );
  return true;
}
