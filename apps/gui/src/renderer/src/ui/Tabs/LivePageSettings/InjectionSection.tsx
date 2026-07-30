import { CodeEditor, FormSection, RoundButton } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import {
  createEmptyBrowserScript,
  type BrowserInjectionScript,
  type BrowserScriptRunAt
} from '#/browser/browserScripts';
import { faTrash } from '#/renderer/src/fontawesome';

const RUN_AT_OPTIONS: { value: BrowserScriptRunAt; label: string }[] = [
  { value: 'document-start', label: 'Document start' },
  { value: 'dom-ready', label: 'DOM ready' },
  { value: 'did-finish-load', label: 'Load complete' }
];

interface Props {
  /**
   * Draft injection scripts for the live page.
   */
  scripts: BrowserInjectionScript[];

  /**
   * Replaces the draft injection script list.
   */
  onChange: (scripts: BrowserInjectionScript[]) => void;
}

/**
 * Injection scripts editor for the live page settings Injection tab.
 */
export function InjectionSection({ scripts, onChange }: Props): JSX.Element {
  /**
   * Patches one injection script by id.
   *
   * @param scriptId - Script to update.
   * @param patch - Fields to merge.
   */
  function patchScript(scriptId: string, patch: Partial<BrowserInjectionScript>): void {
    onChange(scripts.map((script) => (script.id === scriptId ? { ...script, ...patch } : script)));
  }

  /**
   * Appends a new empty injection script.
   */
  function handleAdd(): void {
    onChange([...scripts, createEmptyBrowserScript()]);
  }

  /**
   * Removes an injection script from the draft list.
   *
   * @param scriptId - Script to remove.
   */
  function handleRemove(scriptId: string): void {
    onChange(scripts.filter((script) => script.id !== scriptId));
  }

  return (
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
                  onChange={(event) => patchScript(script.id, { enabled: event.target.checked })}
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
  );
}
