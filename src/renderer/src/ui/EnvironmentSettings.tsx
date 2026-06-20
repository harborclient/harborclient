import { useEffect, useMemo, useState, type JSX } from 'react';
import type { Environment, Variable } from '#/shared/types';
import { VariableTable, cleanVariables } from '#/renderer/src/components/VariableTable';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { field, iconButton, primaryButton, secondaryButton } from './classes';

interface Props {
  /**
   * Environment being configured.
   */
  environment: Environment;

  /**
   * Persists environment name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   */
  onSave: (id: number, name: string, variables: Variable[]) => Promise<void>;

  /**
   * Closes the settings view without saving.
   */
  onClose: () => void;

  /**
   * Called when unsaved form edits appear or are cleared.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

const serializeEnvironmentForm = (name: string, variables: Variable[]): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables)
  });

/**
 * Full-area environment settings with name and variables.
 */
export function EnvironmentSettings(props: Props): JSX.Element {
  return <EnvironmentSettingsForm key={props.environment.id} {...props} />;
}

function EnvironmentSettingsForm({
  environment,
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const [name, setName] = useState(environment.name);
  const [variables, setVariables] = useState<Variable[]>(
    environment.variables.length
      ? environment.variables
      : [{ key: '', value: '', defaultValue: '', share: false }]
  );
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      serializeEnvironmentForm(name, variables) !==
      serializeEnvironmentForm(environment.name, environment.variables),
    [name, variables, environment]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /** Persists name and variables. */
  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedVariables = cleanVariables(variables);
    setSaving(true);
    try {
      await onSave(environment.id, trimmedName, cleanedVariables);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Environment Settings</h1>
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
          <VariableTable
            variables={variables}
            onChange={setVariables}
            description={`Use variables in request URLs with {{variable}} syntax. When value is empty, the default is used. Environment variables override collection variables with the same key.`}
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
