import {
  VariableTable,
  cleanVariables,
  Page,
  Button,
  FormGroup,
  Input,
  FormSection
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { Environment, Variable } from '#/shared/types';
import { useTabSaveRegistration } from '#/renderer/src/hooks/tabSaveRegistry';
import { ENVIRONMENT_SETTINGS_NAME_INPUT_ID } from './focusEnvironmentSettings';
import { serializeEnvironmentForm } from './serialize';

export interface Props {
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

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist this form.
   */
  tabId?: string;
}

/**
 * Editable environment form keyed by environment id so state resets on navigation.
 */
export function Form({
  environment,
  focusVariableKey,
  onSave,
  onClose,
  onDirtyChange,
  tabId
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
  const handleSave = useCallback(async (): Promise<void> => {
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
  }, [name, variables, environment.id, onSave, onClose]);

  /**
   * Whether File → Save / Ctrl+S should invoke this form (mirrors Save button).
   */
  const menuCanSave = Boolean(name.trim()) && !saving;

  useTabSaveRegistration(tabId, menuCanSave, handleSave);

  return (
    <Page
      embedded
      className="flex min-h-0 flex-1 flex-col p-6 pt-0!"
      title="Environment Settings"
      description="Manage environment settings and configuration"
      actions={
        <Button type="button" onClick={() => void handleSave()} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
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

        <FormSection
          title="Variables"
          description={
            <>
              Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the
              default is used. Environment variables override collection variables with the same
              key.
            </>
          }
        >
          <VariableTable
            variables={variables}
            onChange={setVariables}
            focusKey={focusVariableKey}
          />
        </FormSection>
      </div>
    </Page>
  );
}
