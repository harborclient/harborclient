import { useEffect, useMemo, useState, type JSX } from 'react';
import type { Collection, KeyValue, Variable } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { KeyValueEditor } from '#/renderer/src/components/KeyValueEditor';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { faPlus, faXmark } from '#/renderer/src/fontawesome';
import {
  field,
  iconButton,
  iconButtonDanger,
  primaryButton,
  secondaryButton,
  toolbarButton
} from './classes';

type SettingsTab = 'general' | 'variables' | 'headers' | 'pre' | 'post';

interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection;

  /**
   * Persists collection name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Collection pre-request script.
   * @param postRequestScript - Collection post-request script.
   */
  onSave: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
  ) => Promise<void>;

  /**
   * Closes the settings view without saving.
   */
  onClose: () => void;

  /**
   * Called when unsaved form edits appear or are cleared.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

const emptyVariable = (): Variable => ({ key: '', value: '', defaultValue: '', share: false });

const cleanVariables = (variables: Variable[]): Variable[] =>
  variables.filter((v) => v.key.trim() || v.value.trim() || v.defaultValue.trim());

const cleanHeaders = (headers: KeyValue[]): KeyValue[] =>
  headers.filter((h) => h.key.trim() || h.value.trim());

const serializeCollectionForm = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string
): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables),
    headers: cleanHeaders(headers),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript
  });

const thClass = 'pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted';

/**
 * Full-area collection settings with tabbed sections.
 */
export function CollectionSettings(props: Props): JSX.Element {
  return <CollectionSettingsForm key={props.collection.id} {...props} />;
}

function CollectionSettingsForm({
  collection,
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(collection.name);
  const [variables, setVariables] = useState<Variable[]>(
    collection.variables.length ? collection.variables : [emptyVariable()]
  );
  const [headers, setHeaders] = useState<KeyValue[]>(
    collection.headers.length ? collection.headers : [emptyKeyValue()]
  );
  const [preRequestScript, setPreRequestScript] = useState(collection.pre_request_script ?? '');
  const [postRequestScript, setPostRequestScript] = useState(collection.post_request_script ?? '');
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      serializeCollectionForm(name, variables, headers, preRequestScript, postRequestScript) !==
      serializeCollectionForm(
        collection.name,
        collection.variables,
        collection.headers,
        collection.pre_request_script ?? '',
        collection.post_request_script ?? ''
      ),
    [name, variables, headers, preRequestScript, postRequestScript, collection]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /**
   * Updates a single variable row by index.
   *
   * @param index - Row index to update.
   * @param patch - Partial fields to merge into the row.
   */
  const updateVariable = (index: number, patch: Partial<Variable>): void => {
    setVariables((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /** Appends a blank variable row. */
  const addVariable = (): void => {
    setVariables((prev) => [...prev, emptyVariable()]);
  };

  /**
   * Removes a variable row, keeping at least one empty row.
   *
   * @param index - Row index to remove.
   */
  const removeVariable = (index: number): void => {
    setVariables((prev) => {
      if (prev.length === 1) return [emptyVariable()];
      return prev.filter((_, i) => i !== index);
    });
  };

  /** Persists name, variables, headers, and scripts. */
  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedVariables = cleanVariables(variables);
    const cleanedHeaders = cleanHeaders(headers);
    setSaving(true);
    try {
      await onSave(
        collection.id,
        trimmedName,
        cleanedVariables,
        cleanedHeaders,
        preRequestScript,
        postRequestScript
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Collection Settings</h1>
          <button
            type="button"
            className={`${iconButton} opacity-100 text-[28px]`}
            title="Close"
            onClick={onClose}
          >
            <FaIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'general', label: 'General' },
              { value: 'variables', label: 'Variables' },
              { value: 'headers', label: 'Headers' },
              { value: 'pre', label: 'PreRequest' },
              { value: 'post', label: 'PostRequest' }
            ]}
          />
        </div>

        {tab === 'general' && (
          <div className="mb-6">
            <label className="mb-1 block text-[13px] text-muted">Name</label>
            <input
              className={`${field} w-full`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>
        )}

        {tab === 'variables' && (
          <div className="mb-6">
            <p className="mb-3 text-[12px] text-muted">
              Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the
              default is used. Values are omitted from export unless Share is checked.
            </p>

            <div className="flex flex-col gap-1.5">
              <table className="w-full border-separate border-spacing-x-1.5 border-spacing-y-1.5">
                <thead>
                  <tr>
                    <th className={thClass}>Key</th>
                    <th className={thClass}>Value</th>
                    <th className={thClass}>Default</th>
                    <th className={`${thClass} w-14 text-center`}>Share</th>
                    <th className={`${thClass} w-7 p-0 text-center`} />
                  </tr>
                </thead>
                <tbody>
                  {variables.map((variable, index) => (
                    <tr className="group" key={index}>
                      <td>
                        <input
                          type="text"
                          className={`${field} w-full`}
                          value={variable.key}
                          placeholder="variable"
                          onChange={(e) => updateVariable(index, { key: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`${field} w-full`}
                          value={variable.value}
                          placeholder="value"
                          onChange={(e) => updateVariable(index, { value: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={`${field} w-full`}
                          value={variable.defaultValue}
                          placeholder="default"
                          onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                        />
                      </td>
                      <td className="w-14 text-center">
                        <input
                          type="checkbox"
                          checked={variable.share}
                          onChange={(e) => updateVariable(index, { share: e.target.checked })}
                          title="Include value in collection export"
                        />
                      </td>
                      <td className="w-7 p-0 text-center">
                        <button
                          type="button"
                          className={iconButtonDanger}
                          onClick={() => removeVariable(index)}
                          title="Remove"
                        >
                          <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className={`${toolbarButton} inline-flex items-center gap-1 self-start`}
                onClick={addVariable}
              >
                <FaIcon icon={faPlus} className="h-3 w-3" />
                Add variable
              </button>
            </div>
          </div>
        )}

        {tab === 'headers' && (
          <div className="mb-6">
            <p className="mb-3 text-[12px] text-muted">
              These headers are sent with every request in this collection. Header values support{' '}
              {'{{variable}}'} syntax. Request-level headers override collection headers with the
              same name.
            </p>
            <KeyValueEditor
              rows={headers}
              onChange={setHeaders}
              placeholderKey="header"
              placeholderValue="value"
              variables={variables}
            />
          </div>
        )}

        {tab === 'pre' && (
          <div className="mb-6">
            <p className="mb-3 text-[12px] text-muted">
              Runs before every request in this collection, before the request-level pre-request
              script. Supports {'{{variable}}'} syntax.
            </p>
            <CodeEditor
              value={preRequestScript}
              onChange={setPreRequestScript}
              language="javascript"
              scriptPhase="pre"
              placeholder="// hc.variables.set('token', 'abc');"
              variables={variables}
              minHeight="240px"
            />
          </div>
        )}

        {tab === 'post' && (
          <div className="mb-6">
            <p className="mb-3 text-[12px] text-muted">
              Runs after every request in this collection, after the request-level post-request
              script. Supports {'{{variable}}'} syntax.
            </p>
            <CodeEditor
              value={postRequestScript}
              onChange={setPostRequestScript}
              language="javascript"
              scriptPhase="post"
              placeholder={
                '// hc.test("status is 200", () => {\n//   hc.expect(hc.response.code).to.equal(200);\n// });'
              }
              variables={variables}
              minHeight="240px"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={primaryButton}
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
