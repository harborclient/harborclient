import {
  VariableTable,
  cleanVariables,
  ModalFooter,
  Page,
  Button,
  FormGroup,
  Input
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { Environment, Variable } from '#/shared/types';

import { ENVIRONMENT_SETTINGS_NAME_INPUT_ID } from '#/renderer/src/ui/EnvironmentSettings/focusEnvironmentSettings';
import { serializeEnvironmentForm } from './serialize';

interface Props {
  /**
   * Environment being configured.
   */
  environment: Environment;

  /**
   * When set, focuses the matching variable row in the table.
   */
  focusVariableKey?: string;

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

/**
 * Full-area environment settings with name and variables.
 */
export function EnvironmentSettings(props: Props): JSX.Element {
  return <EnvironmentSettingsForm key={props.environment.id} {...props} />;
}

/**
 * Editable environment form keyed by environment id so state resets on navigation.
 */
function EnvironmentSettingsForm({
  environment,
  focusVariableKey,
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

  /**
   * Compares serialized form state to the saved environment to detect unsaved edits.
   */
  const isDirty = useMemo(
    () =>
      serializeEnvironmentForm(name, variables) !==
      serializeEnvironmentForm(environment.name, environment.variables),
    [name, variables, environment]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared.
   */
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /**
   * Persists name and variables.
   */
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
    <Page
      embedded
      className="flex min-h-0 flex-1 flex-col p-6 pt-0!"
      title="Environment Settings"
      description="Manage environment settings and configuration"
    >
      <div className="hc-scroll-stable -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <div className="mb-6">
          <FormGroup
            label="Name"
            htmlFor={ENVIRONMENT_SETTINGS_NAME_INPUT_ID}
            labelTone="muted"
            description="Name shown in the sidebar and environment selector."
          >
            <Input
              id={ENVIRONMENT_SETTINGS_NAME_INPUT_ID}
              className="w-full"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
                if (e.key === 'Escape') onClose();
              }}
            />
          </FormGroup>
        </div>

        <div className="mb-6 flex flex-col gap-1">
          <span className="text-[18px] text-muted">Variables</span>
          <p className="hc-form-group-description m-0 text-[14px] text-muted mb-2">
            Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the
            default is used. Environment variables override collection variables with the same key.
          </p>
          <VariableTable
            variables={variables}
            onChange={setVariables}
            focusKey={focusVariableKey}
          />
        </div>

        <ModalFooter spaced>
          <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </ModalFooter>
      </div>
    </Page>
  );
}
