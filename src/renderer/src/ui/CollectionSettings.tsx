import { useState, type JSX } from 'react';
import type { Collection, KeyValue, Variable } from '#/shared/types';
import { KeyValueEditor } from '#/renderer/src/components/KeyValueEditor';
import { FaIcon } from '#/renderer/src/components/FaIcon';
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

interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection;

  /**
   * Persists collection name, variables, and headers.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   */
  onSave: (id: number, name: string, variables: Variable[], headers: KeyValue[]) => Promise<void>;

  /**
   * Closes the settings view without saving.
   */
  onClose: () => void;
}

const emptyVariable = (): Variable => ({ key: '', value: '', defaultValue: '', share: false });

const thClass = 'pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted';

/**
 * Full-area collection settings: rename, manage variables, and configure shared headers.
 */
export function CollectionSettings(props: Props): JSX.Element {
  return <CollectionSettingsForm key={props.collection.id} {...props} />;
}

function CollectionSettingsForm({ collection, onSave, onClose }: Props): JSX.Element {
  const [name, setName] = useState(collection.name);
  const [variables, setVariables] = useState<Variable[]>(
    collection.variables.length ? collection.variables : [emptyVariable()]
  );
  const [headers, setHeaders] = useState<KeyValue[]>(
    collection.headers.length ? collection.headers : [emptyKeyValue()]
  );
  const [saving, setSaving] = useState(false);

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

  /** Persists name, non-empty variable rows, and non-empty header rows. */
  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedVariables = variables.filter(
      (v) => v.key.trim() || v.value.trim() || v.defaultValue.trim()
    );
    const cleanedHeaders = headers.filter((h) => h.key.trim() || h.value.trim());
    setSaving(true);
    try {
      await onSave(collection.id, trimmedName, cleanedVariables, cleanedHeaders);
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

        <div className="mb-6">
          <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Variables</h2>
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

        <div className="mb-6">
          <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Headers</h2>
          <p className="mb-3 text-[12px] text-muted">
            These headers are sent with every request in this collection. Header values support{' '}
            {'{{variable}}'} syntax. Request-level headers override collection headers with the same
            name.
          </p>
          <KeyValueEditor
            rows={headers}
            onChange={setHeaders}
            placeholderKey="header"
            placeholderValue="value"
            variables={variables}
          />
        </div>

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
