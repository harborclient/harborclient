import {
  VariableTable,
  cleanVariables,
  ModalFooter,
  Page,
  Button,
  FormGroup,
  Input
} from '@harborclient/sdk/components';
import { useEffect, useId, useMemo, useState, type JSX } from 'react';
import type { Environment, Variable } from '#/shared/types';

import { serializeEnvironmentForm } from './serialize';

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
  const nameId = useId();

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
      title="Environment Settings"
      description="Manage environment settings and configuration"
      footer={
        <ModalFooter>
          <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </ModalFooter>
      }
    >
      <div className="mb-6">
        <FormGroup label="Name" htmlFor={nameId} labelTone="muted">
          <Input
            id={nameId}
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

      <div className="mb-6">
        <VariableTable
          variables={variables}
          onChange={setVariables}
          description={`Use variables in request URLs with {{variable}} syntax. When value is empty, the default is used. Environment variables override collection variables with the same key.`}
        />
      </div>
    </Page>
  );
}
