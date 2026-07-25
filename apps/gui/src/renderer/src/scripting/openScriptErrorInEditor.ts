import type { ScriptRunError } from '@harborclient/core/types';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { resolveScriptOwnerTab } from './resolveScriptOwnerTab';

/**
 * Returns whether a script error row can open a request script editor.
 *
 * Only request-scoped slots with a stable script id are navigable; collection
 * and folder scripts have no per-request editor tab to reveal into.
 *
 * @param error - Structured script failure from the last send or console entry.
 * @returns True when jump-to-editor is available for this error.
 */
export function canOpenScriptErrorInEditor(error: ScriptRunError): boolean {
  return error.scope === 'request' && Boolean(error.scriptId?.trim()) && Boolean(error.phase);
}

/**
 * Opens the request script editor page tab at the failing script line when possible.
 *
 * Owner tab resolution is delegated to {@link resolveScriptOwnerTab}, matching
 * the behavior of test-result navigation.
 *
 * @param dispatch - Redux dispatch used to open or focus the script-editor page tab.
 * @param getState - Store getter used to locate the owning request tab.
 * @param error - Script failure row the user activated.
 * @param requestTabId - Optional tab id of the request that produced this error.
 * @returns True when a script-editor tab was opened or focused.
 */
export function openScriptErrorInEditor(
  dispatch: AppDispatch,
  getState: () => RootState,
  error: ScriptRunError,
  requestTabId?: string
): boolean {
  if (!canOpenScriptErrorInEditor(error) || !error.scriptId || !error.phase) {
    return false;
  }

  const scriptId = error.scriptId;
  const phase = error.phase;
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
      label: error.scriptName?.trim() || 'Script error',
      revealLine: error.line,
      revealColumn: error.column,
      revealMessage: error.message.trim() || 'Script error',
      revealSource: 'script',
      revealNonce: Date.now()
    })
  );
  return true;
}
