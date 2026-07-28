import { Page, Button, FormGroup, Input, Select } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import type { Environment, Workspace } from '@harborclient/core/types';
import { useTabSaveRegistration } from '#/renderer/src/hooks/tabSaveRegistry';
import {
  WORKSPACE_SETTINGS_ENVIRONMENT_SELECT_ID,
  WORKSPACE_SETTINGS_NAME_INPUT_ID
} from './focusWorkspaceSettings';
import { serializeWorkspaceForm } from './serialize';

export interface Props {
  /**
   * Workspace being configured.
   */
  workspace: Workspace;

  /**
   * Available environments for the open-with selector.
   */
  environments: Environment[];

  /**
   * Persists workspace name and open-with environment.
   *
   * @param id - Workspace ID to update.
   * @param name - New display name.
   * @param activeEnvironmentUuid - Environment uuid to restore on open, or null.
   */
  onSave: (id: number, name: string, activeEnvironmentUuid: string | null) => Promise<void>;

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
 * Editable workspace form keyed by workspace id so state resets on navigation.
 */
export function Form({
  workspace,
  environments,
  onSave,
  onClose,
  onDirtyChange,
  tabId
}: Props): JSX.Element {
  const savedEnvironmentUuid = workspace.layout?.activeEnvironmentUuid ?? null;
  const [name, setName] = useState(workspace.name);
  const [activeEnvironmentUuid, setActiveEnvironmentUuid] = useState<string | null>(
    savedEnvironmentUuid
  );
  const [saving, setSaving] = useState(false);

  /**
   * Compares serialized form state to the saved workspace to detect unsaved edits.
   */
  const isDirty = useMemo(
    () =>
      serializeWorkspaceForm(name, activeEnvironmentUuid) !==
      serializeWorkspaceForm(workspace.name, savedEnvironmentUuid),
    [name, activeEnvironmentUuid, workspace.name, savedEnvironmentUuid]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared.
   */
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /**
   * Persists name and open-with environment.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      await onSave(workspace.id, trimmedName, activeEnvironmentUuid);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [name, activeEnvironmentUuid, workspace.id, onSave, onClose]);

  /**
   * Whether File → Save / Ctrl+S should invoke this form (mirrors Save button).
   */
  const menuCanSave = Boolean(name.trim()) && !saving;

  useTabSaveRegistration(tabId, menuCanSave, handleSave);

  return (
    <Page
      embedded
      className="flex min-h-0 flex-1 flex-col p-6 pt-0!"
      title="Workspace Settings"
      description="Manage workspace name and the environment used when this workspace is opened"
      actions={
        <Button type="button" onClick={() => void handleSave()} disabled={!name.trim() || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <div className="hc-scroll-stable -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <div className="mb-6 space-y-6">
          <FormGroup
            label="Name"
            htmlFor={WORKSPACE_SETTINGS_NAME_INPUT_ID}
            labelTone="muted"
            description="Name shown in the Workspaces sidebar."
          >
            <Input
              id={WORKSPACE_SETTINGS_NAME_INPUT_ID}
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
            label="Environment"
            htmlFor={WORKSPACE_SETTINGS_ENVIRONMENT_SELECT_ID}
            labelTone="muted"
            description="Environment selected when this workspace is opened. Overrides the environment recorded when the workspace was saved."
          >
            <Select
              id={WORKSPACE_SETTINGS_ENVIRONMENT_SELECT_ID}
              className="w-full cursor-pointer py-1"
              value={activeEnvironmentUuid ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setActiveEnvironmentUuid(value.length > 0 ? value : null);
              }}
              aria-label="Environment to use when opening this workspace"
            >
              <option value="">No Environment</option>
              {environments.map((environment) => (
                <option key={environment.uuid} value={environment.uuid}>
                  {environment.name}
                </option>
              ))}
            </Select>
          </FormGroup>
        </div>
      </div>
    </Page>
  );
}
