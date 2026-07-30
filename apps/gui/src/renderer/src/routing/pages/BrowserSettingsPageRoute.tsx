import { useMemo, type JSX } from 'react';
import { CodeEditor, FormSection, RoundButton } from '@harborclient/sdk/components';
import type { ScriptRef } from '@harborclient/core/types';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets, selectTabs } from '#/renderer/src/store/selectors';
import { isBrowserTab, hasBrowserPendingSave } from '#/renderer/src/store/tabs';
import {
  discardBrowserScripts,
  saveBrowserScripts,
  setBrowserPostRequestScripts,
  setBrowserPreRequestScripts,
  setBrowserScripts
} from '#/renderer/src/store/slices/tabsSlice';
import {
  createEmptyBrowserScript,
  type BrowserInjectionScript,
  type BrowserScriptRunAt
} from '#/browser/browserScripts';
import { resolveBrowserHcScriptSources } from '#/browser/browserHcScripts';
import { buildScriptModuleMap } from '#/renderer/src/scripting/scriptResolution';
import { ScriptSection } from '#/renderer/src/ui/Tabs/CollectionSettings/ScriptSection';
import { faTrash } from '#/renderer/src/fontawesome';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';

const RUN_AT_OPTIONS: { value: BrowserScriptRunAt; label: string }[] = [
  { value: 'document-start', label: 'Document start' },
  { value: 'dom-ready', label: 'DOM ready' },
  { value: 'did-finish-load', label: 'Load complete' }
];

const BROWSER_SCRIPT_STAGES = ['main'] as const;

/**
 * Settings page for one embedded browser tab: injection scripts plus pre/post hc.* scripts.
 *
 * @param props - Page identity including the owning browser tab id.
 * @returns Script editors with Save and Discard.
 */
export function BrowserSettingsPageRoute({
  page
}: PageComponentProps<'browser-settings'>): JSX.Element {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const snippets = useAppSelector(selectSnippets);
  const browserTab = useMemo(
    () => tabs.find((tab) => isBrowserTab(tab) && tab.tabId === page.browserTabId),
    [tabs, page.browserTabId]
  );

  if (!browserTab || !isBrowserTab(browserTab)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-muted">
        This browser tab is no longer open.
      </div>
    );
  }

  const activeBrowser = browserTab;
  const dirty = hasBrowserPendingSave(activeBrowser);
  const scripts = activeBrowser.scripts;

  /**
   * Replaces the draft injection script list on the browser tab.
   *
   * @param next - Updated draft scripts.
   */
  function updateScripts(next: BrowserInjectionScript[]): void {
    dispatch(setBrowserScripts({ tabId: activeBrowser.tabId, scripts: next }));
  }

  /**
   * Patches one injection script by id.
   *
   * @param scriptId - Script to update.
   * @param patch - Fields to merge.
   */
  function patchScript(scriptId: string, patch: Partial<BrowserInjectionScript>): void {
    updateScripts(
      scripts.map((script) => (script.id === scriptId ? { ...script, ...patch } : script))
    );
  }

  /**
   * Appends a new empty injection script.
   */
  function handleAdd(): void {
    updateScripts([...scripts, createEmptyBrowserScript()]);
  }

  /**
   * Removes an injection script from the draft list.
   *
   * @param scriptId - Script to remove.
   */
  function handleRemove(scriptId: string): void {
    updateScripts(scripts.filter((script) => script.id !== scriptId));
  }

  /**
   * Updates draft pre-request scripts.
   *
   * @param next - Updated pre-request ScriptRef list.
   */
  function handlePreChange(next: ScriptRef[]): void {
    dispatch(setBrowserPreRequestScripts({ tabId: activeBrowser.tabId, scripts: next }));
  }

  /**
   * Updates draft post-request scripts.
   *
   * @param next - Updated post-request ScriptRef list.
   */
  function handlePostChange(next: ScriptRef[]): void {
    dispatch(setBrowserPostRequestScripts({ tabId: activeBrowser.tabId, scripts: next }));
  }

  /**
   * Commits draft scripts and pushes applied sets to the main-process guest.
   */
  function handleSave(): void {
    const { modules, conflicts } = buildScriptModuleMap(snippets, [
      activeBrowser.pre_request_scripts,
      activeBrowser.post_request_scripts
    ]);
    void window.api.browserSetScripts(activeBrowser.tabId, scripts, {
      preRequestScripts: resolveBrowserHcScriptSources(activeBrowser.pre_request_scripts, snippets),
      postRequestScripts: resolveBrowserHcScriptSources(
        activeBrowser.post_request_scripts,
        snippets
      ),
      snippetModules: modules,
      snippetModuleConflicts: conflicts
    });
    dispatch(saveBrowserScripts(activeBrowser.tabId));
  }

  /**
   * Restores draft scripts from the last saved baselines.
   */
  function handleDiscard(): void {
    dispatch(discardBrowserScripts(activeBrowser.tabId));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-separator px-4 py-3">
        <div>
          <h1 className="text-[18px] font-semibold text-text">Browser Settings</h1>
          <p className="text-muted">
            Injection and request scripts for {activeBrowser.title || 'this browser tab'}. Saved
            scripts run on navigation; unsaved edits do not.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-muted hover:bg-selection disabled:opacity-50"
            disabled={!dirty}
            onClick={handleDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-white hover:brightness-110 disabled:opacity-50"
            disabled={!dirty}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
      <Scrollbars axis="vertical" className="min-h-0 flex-1">
        <div className="flex flex-col gap-8 p-4">
          <FormSection
            title="Injection scripts"
            description="Plain JavaScript injected into the page at document start, DOM ready, or load complete."
          >
            <div className="flex flex-col gap-4">
              {scripts.length === 0 ? (
                <p className="text-muted">
                  No injection scripts yet. Add one to inject JavaScript into pages.
                </p>
              ) : null}
              {scripts.map((script, index) => (
                <section
                  key={script.id}
                  className="flex flex-col gap-2 rounded-md border border-separator bg-control p-3"
                  aria-label={`Injection script ${index + 1}`}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                      <label htmlFor={`browser-script-name-${script.id}`} className="text-muted">
                        Name
                      </label>
                      <input
                        id={`browser-script-name-${script.id}`}
                        type="text"
                        value={script.name}
                        onChange={(event) => patchScript(script.id, { name: event.target.value })}
                        className="rounded-md border border-separator bg-panel px-2 py-1 text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`browser-script-runat-${script.id}`} className="text-muted">
                        Run at
                      </label>
                      <select
                        id={`browser-script-runat-${script.id}`}
                        value={script.runAt}
                        onChange={(event) =>
                          patchScript(script.id, {
                            runAt: event.target.value as BrowserScriptRunAt
                          })
                        }
                        className="rounded-md border border-separator bg-panel px-2 py-1 text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {RUN_AT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <input
                        id={`browser-script-enabled-${script.id}`}
                        type="checkbox"
                        checked={script.enabled}
                        onChange={(event) =>
                          patchScript(script.id, { enabled: event.target.checked })
                        }
                      />
                      <label htmlFor={`browser-script-enabled-${script.id}`}>Enabled</label>
                    </div>
                    <RoundButton
                      icon={faTrash}
                      ariaLabel={`Remove script ${script.name || index + 1}`}
                      onClick={() => handleRemove(script.id)}
                    />
                  </div>
                  <div className="flex min-h-[12rem] flex-col gap-1">
                    <label htmlFor={`browser-script-source-${script.id}`} className="text-muted">
                      JavaScript
                    </label>
                    <CodeEditor
                      id={`browser-script-source-${script.id}`}
                      value={script.source}
                      onChange={(value) => patchScript(script.id, { source: value })}
                      language="javascript"
                      className="min-h-[12rem] flex-1 overflow-hidden rounded-md border border-separator"
                    />
                  </div>
                </section>
              ))}
              <div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-selection"
                  onClick={handleAdd}
                >
                  <span aria-hidden>+</span>
                  Add script
                </button>
              </div>
            </div>
          </FormSection>

          <ScriptSection
            phase="pre"
            description="Runs in the HarborClient script sandbox before each navigation. Use hc.request to inspect or change the target URL."
            placeholder="// Pre-request script (hc.* API)"
            scripts={activeBrowser.pre_request_scripts}
            onChange={handlePreChange}
            variables={[]}
            allowedStages={[...BROWSER_SCRIPT_STAGES]}
          />

          <ScriptSection
            phase="post"
            description="Runs after the page finishes loading. hc.response exposes the page URL, status, and HTML snapshot."
            placeholder="// Post-request script (hc.* API)"
            scripts={activeBrowser.post_request_scripts}
            onChange={handlePostChange}
            variables={[]}
            allowedStages={[...BROWSER_SCRIPT_STAGES]}
          />
        </div>
      </Scrollbars>
    </div>
  );
}
