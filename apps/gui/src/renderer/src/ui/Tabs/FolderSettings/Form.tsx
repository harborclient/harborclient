import { useMemo, type JSX } from 'react';
import type { AuthConfig, Folder, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { resolveScriptRefs } from '#/shared/scriptRefs';
import { GeneralSection } from './GeneralSection';
import { ScopedAuthSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedAuthSection';
import { ScopedHeadersSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedHeadersSection';
import { ScopedSettingsForm } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedSettingsForm';
import { folderFormCoreFields } from './serialize';

export interface Props {
  /**
   * Folder being configured.
   */
  folder: Folder;

  /**
   * When set, switches to the Variables tab and focuses the matching row.
   */
  focusVariableKey?: string;

  /**
   * Persists folder name, variables, headers, scripts, and auth settings.
   */
  onSave: (
    id: number,
    collectionId: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScripts: ScriptRef[],
    postRequestScripts: ScriptRef[],
    auth: AuthConfig
  ) => Promise<Folder | void>;

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
 * Holds editable folder settings state and tab UI.
 */
export function Form({
  folder,
  focusVariableKey,
  onSave,
  onClose,
  onDirtyChange,
  tabId
}: Props): JSX.Element {
  /**
   * Normalized persisted snapshot used to seed and compare scoped form fields.
   */
  const initial = useMemo(
    () =>
      folderFormCoreFields(
        folder.name,
        folder.variables,
        folder.headers,
        resolveScriptRefs(folder.pre_request_scripts, folder.pre_request_script ?? ''),
        resolveScriptRefs(folder.post_request_scripts, folder.post_request_script ?? ''),
        normalizeAuth(folder.auth)
      ),
    [folder]
  );

  return (
    <ScopedSettingsForm
      title="Folder Settings"
      description="Manage folder settings and configuration"
      ariaLabel="Folder settings sections"
      initial={initial}
      focusVariableKey={focusVariableKey}
      preScriptDescription="Runs in the folder pre-request stage before every request in this folder, after collection scripts and before each request's pre-request stage. Supports {{variable}} syntax."
      postScriptDescription="Runs in the folder post-request stage after every request in this folder, after collection scripts and before each request's post-request stage. Supports {{variable}} syntax."
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      tabId={tabId}
      onSave={async (fields) => {
        await onSave(
          folder.id,
          folder.collection_id,
          fields.name,
          fields.variables,
          fields.headers,
          fields.preRequestScripts,
          fields.postRequestScripts,
          fields.auth
        );
      }}
      renderGeneral={(state) => <GeneralSection name={state.name} onNameChange={state.setName} />}
      renderHeaders={(state) => (
        <ScopedHeadersSection
          scope="folder"
          headers={state.headers}
          variables={state.variables}
          onChange={state.setHeaders}
        />
      )}
      renderAuth={(state) => (
        <ScopedAuthSection
          scope="folder"
          id={folder.id}
          auth={state.auth}
          variables={state.variables}
          onChange={state.setAuth}
        />
      )}
    />
  );
}
