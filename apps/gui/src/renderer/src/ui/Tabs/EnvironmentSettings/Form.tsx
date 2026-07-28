import {
  VariableTable,
  cleanVariables,
  Page,
  Button,
  FormGroup,
  Input,
  FormSection,
  Select
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { Environment, Variable } from '@harborclient/core/types';
import {
  environmentInheritanceBreadcrumb,
  listInheritedEnvironmentVariables,
  listValidEnvironmentParents,
  type InheritedEnvironmentVariable
} from '@harborclient/core/environmentTree';
import { useTabSaveRegistration } from '#/renderer/src/hooks/tabSaveRegistry';
import { ENVIRONMENT_SETTINGS_NAME_INPUT_ID } from './focusEnvironmentSettings';
import { InheritedVariablesList } from './InheritedVariablesList';
import { serializeEnvironmentForm } from './serialize';

export interface Props {
  /**
   * Environment being configured.
   */
  environment: Environment;

  /**
   * All environments used to resolve inheritance options and inherited rows.
   */
  environments: Environment[];

  /**
   * When set, focuses the matching variable row in the table.
   */
  focusVariableKey?: string;

  /**
   * Persists environment name, variables, and parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param parentUuid - Parent environment uuid, or null when a root.
   */
  onSave: (
    id: number,
    name: string,
    variables: Variable[],
    parentUuid: string | null
  ) => Promise<void>;

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
  environments,
  focusVariableKey,
  onSave,
  onClose,
  onDirtyChange,
  tabId
}: Props): JSX.Element {
  const [name, setName] = useState(environment.name);
  const [parentUuid, setParentUuid] = useState<string | null>(environment.parentUuid ?? null);
  const [variables, setVariables] = useState<Variable[]>(
    environment.variables.length
      ? environment.variables
      : [{ key: '', value: '', defaultValue: '', enabled: true, share: false }]
  );
  const [saving, setSaving] = useState(false);

  /**
   * Environments that can be selected as parent without creating a cycle.
   */
  const parentOptions = useMemo(
    () => listValidEnvironmentParents(environment, environments),
    [environment, environments]
  );

  /**
   * Draft environment used to preview inheritance while editing the parent select.
   */
  const draftEnvironment = useMemo(
    (): Environment => ({ ...environment, name, variables, parentUuid }),
    [environment, name, variables, parentUuid]
  );

  /**
   * Breadcrumb of inheritance names from root to this environment.
   */
  const breadcrumb = useMemo(
    () => environmentInheritanceBreadcrumb(draftEnvironment, environments).join(' → '),
    [draftEnvironment, environments]
  );

  /**
   * Inherited variables from ancestors, excluding keys this env already enables.
   */
  const inheritedVariables = useMemo(
    () => listInheritedEnvironmentVariables(draftEnvironment, environments),
    [draftEnvironment, environments]
  );

  /**
   * Compares serialized form state to the saved environment to detect unsaved edits.
   */
  const isDirty = useMemo(
    () =>
      serializeEnvironmentForm(name, variables, parentUuid) !==
      serializeEnvironmentForm(
        environment.name,
        environment.variables,
        environment.parentUuid ?? null
      ),
    [name, variables, parentUuid, environment]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared.
   */
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /**
   * Persists name, variables, and parent link.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedVariables = cleanVariables(variables);
    setSaving(true);
    try {
      await onSave(environment.id, trimmedName, cleanedVariables, parentUuid);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [name, variables, parentUuid, environment.id, onSave, onClose]);

  /**
   * Inserts an enabled local row that overrides an inherited key.
   *
   * @param entry - Inherited variable to shadow on this environment.
   */
  const handleOverride = useCallback((entry: InheritedEnvironmentVariable): void => {
    setVariables((current) => {
      const existingIndex = current.findIndex((row) => row.key.trim() === entry.key);
      if (existingIndex >= 0) {
        return current.map((row, index) =>
          index === existingIndex
            ? { ...row, enabled: true, value: entry.value, defaultValue: row.defaultValue }
            : row
        );
      }
      return [
        ...current.filter((row) => row.key.trim() || row.value.trim() || row.defaultValue.trim()),
        {
          key: entry.key,
          value: entry.value,
          defaultValue: '',
          enabled: true,
          share: false
        }
      ];
    });
  }, []);

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
        <div className="mb-6 space-y-4">
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

          <FormGroup
            label="Inherit from"
            htmlFor="environment-inherit-from"
            labelTone="muted"
            description="Variables from the parent environment are available unless overridden below."
          >
            <Select
              id="environment-inherit-from"
              className="w-full"
              value={parentUuid ?? ''}
              onChange={(e) => setParentUuid(e.target.value.trim() || null)}
            >
              <option value="">None</option>
              {parentOptions.map((option) => (
                <option key={option.uuid} value={option.uuid}>
                  {option.name}
                </option>
              ))}
            </Select>
            {parentUuid ? (
              <p className="mt-2 text-[14px] text-muted" aria-live="polite">
                {breadcrumb}
              </p>
            ) : null}
          </FormGroup>
        </div>

        <FormSection
          title="Variables"
          description={
            <>
              Use variables in request URLs with {'{{variable}}'} syntax. When value is empty, the
              default is used. Uncheck Enable to let a parent value pass through for that key.
            </>
          }
        >
          <VariableTable
            variables={variables}
            onChange={setVariables}
            focusKey={focusVariableKey}
          />
          <InheritedVariablesList variables={inheritedVariables} onOverride={handleOverride} />
        </FormSection>
      </div>
    </Page>
  );
}
