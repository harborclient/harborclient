import type { RootState } from '#/renderer/src/store/redux';
import { selectEffectiveActiveRequestTab } from '#/renderer/src/store/selectors';
import { isRequestTab, type RequestTab } from '#/renderer/src/store/tabs';

/**
 * Returns whether a request tab draft still contains the given script id for a phase.
 *
 * @param tab - Open request tab to inspect.
 * @param scriptsKey - Pre or post script list key on the draft.
 * @param scriptId - Script row id from the test result or script error.
 * @returns True when the draft list includes that id.
 */
function tabHasScript(
  tab: RequestTab,
  scriptsKey: 'pre_request_scripts' | 'post_request_scripts',
  scriptId: string
): boolean {
  return tab.draft[scriptsKey].some((script) => script.id === scriptId);
}

/**
 * Finds the open request tab that owns a script row for jump-to-editor.
 *
 * Prefers the request tab that owned the send (`requestTabId`), then the effective
 * active request tab, then any open tab that still contains the script id. Script ids
 * are not globally unique (duplicates can share them), so owner preference matters.
 * Plugin-injected scripts never appear in draft lists, so this returns undefined for them.
 *
 * @param state - Current renderer store state.
 * @param phase - Pre- or post-request phase of the script row.
 * @param scriptId - Stable {@link ScriptRef.id} of the script row.
 * @param requestTabId - Optional tab id of the request that produced the results.
 * @returns Owning request tab, or undefined when no open tab contains the script.
 */
export function resolveScriptOwnerTab(
  state: RootState,
  phase: 'pre' | 'post',
  scriptId: string,
  requestTabId?: string
): RequestTab | undefined {
  const scriptsKey = phase === 'pre' ? 'pre_request_scripts' : 'post_request_scripts';
  const tabs = state.tabs.tabs;

  if (requestTabId) {
    const owner = tabs.find((tab) => tab.tabId === requestTabId);
    if (owner && isRequestTab(owner) && tabHasScript(owner, scriptsKey, scriptId)) {
      return owner;
    }
  }

  const active = selectEffectiveActiveRequestTab(state);
  if (active && tabHasScript(active, scriptsKey, scriptId)) {
    return active;
  }

  const fallback = tabs.find((tab) => isRequestTab(tab) && tabHasScript(tab, scriptsKey, scriptId));
  return fallback && isRequestTab(fallback) ? fallback : undefined;
}
