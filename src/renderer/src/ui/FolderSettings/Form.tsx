import {
  Button,
  cleanVariables,
  ModalFooter,
  Page,
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { AuthConfig, Folder, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { ensureDefaultScriptRef, hasScriptContent, resolveScriptRefs } from '#/shared/scriptRefs';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { VariablesSection } from '#/renderer/src/ui/CollectionSettings/VariablesSection';
import { ScriptSection } from '#/renderer/src/ui/CollectionSettings/ScriptSection';
import {
  COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER,
  POST_REQUEST_SCRIPT_PLACEHOLDER
} from '#/renderer/src/ui/shared/scriptPlaceholders';
import { AuthSection } from '#/renderer/src/ui/FolderSettings/AuthSection';
import { GeneralSection } from '#/renderer/src/ui/FolderSettings/GeneralSection';
import { HeadersSection } from '#/renderer/src/ui/FolderSettings/HeadersSection';
import { cleanHeaders, serializeFolderForm } from '#/renderer/src/ui/FolderSettings/serialize';

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
}

/**
 * Holds editable folder settings state and tab UI.
 */
export function Form({
  folder,
  focusVariableKey,
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const [tab, setTab] = useState<string>(focusVariableKey ? 'variables' : 'general');
  const [lastFocusVariableKey, setLastFocusVariableKey] = useState(focusVariableKey);

  if (focusVariableKey && focusVariableKey !== lastFocusVariableKey) {
    setLastFocusVariableKey(focusVariableKey);
    if (tab !== 'variables') {
      setTab('variables');
    }
  }

  const [name, setName] = useState(folder.name);
  const [variables, setVariables] = useState<Variable[]>(
    folder.variables.length
      ? folder.variables
      : [{ key: '', value: '', defaultValue: '', share: false }]
  );
  const [headers, setHeaders] = useState<KeyValue[]>(
    folder.headers.length ? folder.headers : [emptyKeyValue()]
  );
  const [auth, setAuth] = useState<AuthConfig>(normalizeAuth(folder.auth));
  const [preRequestScripts, setPreRequestScripts] = useState<ScriptRef[]>(
    resolveScriptRefs(folder.pre_request_scripts, folder.pre_request_script ?? '')
  );
  const [postRequestScripts, setPostRequestScripts] = useState<ScriptRef[]>(
    resolveScriptRefs(folder.post_request_scripts, folder.post_request_script ?? '')
  );
  const [saving, setSaving] = useState(false);

  /**
   * Whether any editable field differs from the persisted folder snapshot.
   */
  const isDirty = useMemo(
    () =>
      serializeFolderForm(name, variables, headers, preRequestScripts, postRequestScripts, auth) !==
      serializeFolderForm(
        folder.name,
        folder.variables,
        folder.headers,
        resolveScriptRefs(folder.pre_request_scripts, folder.pre_request_script ?? ''),
        resolveScriptRefs(folder.post_request_scripts, folder.post_request_script ?? ''),
        normalizeAuth(folder.auth)
      ),
    [name, variables, headers, preRequestScripts, postRequestScripts, auth, folder]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared.
   */
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /**
   * Dot indicators for tabs whose sections have content configured.
   */
  const tabIndicators = useMemo(
    () => ({
      variables: cleanVariables(variables).length > 0,
      headers: cleanHeaders(headers).length > 0,
      auth: auth.type !== 'none',
      pre: hasScriptContent(preRequestScripts),
      post: hasScriptContent(postRequestScripts)
    }),
    [variables, headers, auth, preRequestScripts, postRequestScripts]
  );

  const tabs = useMemo(
    () => [
      { value: 'general', label: 'General' },
      { value: 'variables', label: 'Variables', indicator: tabIndicators.variables },
      { value: 'headers', label: 'Headers', indicator: tabIndicators.headers },
      { value: 'auth', label: 'Authorization', indicator: tabIndicators.auth },
      { value: 'pre', label: 'PreRequest', indicator: tabIndicators.pre },
      { value: 'post', label: 'PostRequest', indicator: tabIndicators.post }
    ],
    [tabIndicators]
  );

  /**
   * Seeds a blank inline script when entering a script tab with no entries yet.
   *
   * @param nextTab - Folder settings tab the user selected.
   */
  const handleTabChange = (nextTab: string): void => {
    if (nextTab === 'pre' && preRequestScripts.length === 0) {
      setPreRequestScripts(ensureDefaultScriptRef(preRequestScripts));
    }
    if (nextTab === 'post' && postRequestScripts.length === 0) {
      setPostRequestScripts(ensureDefaultScriptRef(postRequestScripts));
    }
    setTab(nextTab);
  };

  /**
   * Validates name, persists the form, then closes on success.
   */
  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cleanedVariables = cleanVariables(variables);
    const cleanedHeaders = cleanHeaders(headers);
    setSaving(true);
    try {
      await onSave(
        folder.id,
        folder.collection_id,
        trimmedName,
        cleanedVariables,
        cleanedHeaders,
        preRequestScripts,
        postRequestScripts,
        auth
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      embedded
      className="flex min-h-0 flex-1 flex-col p-6 pt-0!"
      title="Folder Settings"
      description="Manage folder settings and configuration"
    >
      <SegmentedTabsGroup
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Folder settings sections"
      >
        <div className="-mx-6 -mt-3 mb-6 shrink-0">
          <SegmentedTabs tabs={tabs} />
        </div>

        <div className="hc-scroll-stable -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
          <SegmentedTabPanel value="general">
            <GeneralSection name={name} onNameChange={setName} />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="variables">
            <VariablesSection
              variables={variables}
              onChange={setVariables}
              focusVariableKey={focusVariableKey}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="headers">
            <HeadersSection headers={headers} variables={variables} onChange={setHeaders} />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="auth">
            <AuthSection
              auth={auth}
              folderId={folder.id}
              variables={variables}
              onChange={setAuth}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="pre" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="pre"
              description="Runs in the folder pre-request stage before every request in this folder, after collection scripts and before each request's pre-request stage. Supports {{variable}} syntax."
              placeholder={COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={preRequestScripts}
              onChange={setPreRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="post" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="post"
              description="Runs in the folder post-request stage after every request in this folder, after collection scripts and before each request's post-request stage. Supports {{variable}} syntax."
              placeholder={POST_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={postRequestScripts}
              onChange={setPostRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          <ModalFooter spaced>
            <Button onClick={() => void handleSave()} disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </div>
      </SegmentedTabsGroup>
    </Page>
  );
}
