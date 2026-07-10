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
import type { AuthConfig, Collection, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { ensureDefaultScriptRef, hasScriptContent, resolveScriptRefs } from '#/shared/scriptRefs';

import { useProviders } from '#/renderer/src/hooks/useProviders';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { usePluginCollectionSettingsTabs } from '#/renderer/src/plugins/pluginHooks';
import type { CollectionSettingsTabContext } from '#/shared/plugin/types';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { AuthSection } from './AuthSection';
import { GeneralSection } from './GeneralSection';
import { HeadersSection } from './HeadersSection';
import { ScriptSection } from './ScriptSection';
import {
  COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER,
  POST_REQUEST_SCRIPT_PLACEHOLDER
} from '#/renderer/src/ui/shared/scriptPlaceholders';
import { cleanHeaders, serializeCollectionForm } from './serialize';
import { VariablesSection } from './VariablesSection';

interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection;

  /**
   * When set, switches to the Variables tab and focuses the matching row.
   */
  focusVariableKey?: string;

  /**
   * Persists collection name, variables, headers, scripts, and database.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScripts - Collection pre-request script references.
   * @param postRequestScripts - Collection post-request script references.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param connectionId - Target database connection id.
   */
  onSave: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScripts: ScriptRef[],
    postRequestScripts: ScriptRef[],
    auth: AuthConfig,
    connectionId: string
  ) => Promise<Collection | void>;

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
 * Full-area collection settings with tabbed sections. Remounts internal form
 * state when the collection id changes.
 */
export function CollectionSettings(props: Props): JSX.Element {
  return <CollectionSettingsForm key={props.collection.id} {...props} />;
}

/**
 * Holds editable collection settings state and tab UI. Separated from the
 * export so the parent can reset all fields via React key on collection change.
 */
function CollectionSettingsForm({
  collection,
  focusVariableKey,
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const pluginTabs = usePluginCollectionSettingsTabs();
  const [tab, setTab] = useState<string>(focusVariableKey ? 'variables' : 'general');
  const [lastFocusVariableKey, setLastFocusVariableKey] = useState(focusVariableKey);

  if (focusVariableKey && focusVariableKey !== lastFocusVariableKey) {
    setLastFocusVariableKey(focusVariableKey);
    if (tab !== 'variables') {
      setTab('variables');
    }
  }
  const [name, setName] = useState(collection.name);
  const [variables, setVariables] = useState<Variable[]>(
    collection.variables.length
      ? collection.variables
      : [{ key: '', value: '', defaultValue: '', share: false }]
  );
  const [headers, setHeaders] = useState<KeyValue[]>(
    collection.headers.length ? collection.headers : [emptyKeyValue()]
  );
  const [auth, setAuth] = useState<AuthConfig>(normalizeAuth(collection.auth));
  const [preRequestScripts, setPreRequestScripts] = useState<ScriptRef[]>(
    resolveScriptRefs(collection.pre_request_scripts, collection.pre_request_script ?? '')
  );
  const [postRequestScripts, setPostRequestScripts] = useState<ScriptRef[]>(
    resolveScriptRefs(collection.post_request_scripts, collection.post_request_script ?? '')
  );
  const [connectionId, setConnectionId] = useState(collection.connectionId ?? '');
  const [saving, setSaving] = useState(false);

  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError,
    reload: reloadProviders
  } = useProviders([collection.connectionId], {
    excludeAdminTeamHubs: true,
    retainConnectionId: collection.connectionId
  });

  const resolvedConnectionId = connectionId || collection.connectionId || primaryProviderId;

  /**
   * Whether any editable field differs from the persisted collection snapshot.
   * Memoized because form serialization is expensive and the result drives the
   * dirty-state callback effect.
   */
  const isDirty = useMemo(
    () =>
      serializeCollectionForm(
        name,
        variables,
        headers,
        preRequestScripts,
        postRequestScripts,
        auth,
        resolvedConnectionId
      ) !==
      serializeCollectionForm(
        collection.name,
        collection.variables,
        collection.headers,
        resolveScriptRefs(collection.pre_request_scripts, collection.pre_request_script ?? ''),
        resolveScriptRefs(collection.post_request_scripts, collection.post_request_script ?? ''),
        normalizeAuth(collection.auth),
        collection.connectionId || primaryProviderId
      ),
    [
      name,
      variables,
      headers,
      preRequestScripts,
      postRequestScripts,
      auth,
      resolvedConnectionId,
      collection,
      primaryProviderId
    ]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared. Reports clean
   * until async provider bootstrap finishes so primaryProviderId does not
   * cause a spurious dirty flicker during load.
   */
  useEffect(() => {
    onDirtyChange?.(!providersLoading ? isDirty : false);
  }, [isDirty, providersLoading, onDirtyChange]);

  /**
   * Dot indicators for tabs whose sections have content configured.
   * Memoized so SegmentedTabs tab config only rebuilds when section values change.
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

  /**
   * Read-only context passed to plugin collection settings tabs.
   */
  const collectionTabContext = useMemo<CollectionSettingsTabContext>(
    () => ({
      collectionId: collection.id,
      readOnly: saving
    }),
    [collection.id, saving]
  );

  /**
   * Built-in and plugin collection settings tabs merged for SegmentedTabs.
   */
  const tabs = useMemo(
    () => [
      { value: 'general', label: 'General' },
      { value: 'variables', label: 'Variables', indicator: tabIndicators.variables },
      { value: 'headers', label: 'Headers', indicator: tabIndicators.headers },
      { value: 'auth', label: 'Authorization', indicator: tabIndicators.auth },
      { value: 'pre', label: 'PreRequest', indicator: tabIndicators.pre },
      { value: 'post', label: 'PostRequest', indicator: tabIndicators.post },
      ...pluginTabs.map((entry) => ({ value: entry.id, label: entry.title }))
    ],
    [pluginTabs, tabIndicators]
  );

  /**
   * Seeds a blank inline script when entering a script tab with no entries yet.
   *
   * @param nextTab - Collection settings tab the user selected.
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
   * Validates name and connection, persists the form, then closes on success.
   * No-ops when the trimmed name is empty or no connection is selected.
   */
  const handleSave = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName || !resolvedConnectionId) return;

    const cleanedVariables = cleanVariables(variables);
    const cleanedHeaders = cleanHeaders(headers);
    setSaving(true);
    try {
      await onSave(
        collection.id,
        trimmedName,
        cleanedVariables,
        cleanedHeaders,
        preRequestScripts,
        postRequestScripts,
        auth,
        resolvedConnectionId
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
      title="Collection Settings"
      description="Manage collection settings and configuration"
    >
      <SegmentedTabsGroup
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Collection settings sections"
      >
        <div className="-mx-6 -mt-3 mb-6 shrink-0">
          <SegmentedTabs tabs={tabs} />
        </div>

        <div className="hc-scroll-stable -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
          <SegmentedTabPanel value="general">
            <GeneralSection
              name={name}
              onNameChange={setName}
              connectionId={resolvedConnectionId}
              providers={providers}
              onConnectionIdChange={setConnectionId}
              providersLoading={providersLoading}
              providersError={providersError}
              onProvidersRetry={reloadProviders}
              onSave={() => void handleSave()}
              onClose={onClose}
            />
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
              collectionId={collection.id}
              variables={variables}
              onChange={setAuth}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="pre" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="pre"
              description="Runs in the collection pre-request stage before every request, ahead of each request's pre-request stage. Supports {{variable}} syntax."
              placeholder={COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={preRequestScripts}
              onChange={setPreRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="post" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="post"
              description="Runs in the collection post-request stage after every request, following each request's post-request stage. Supports {{variable}} syntax."
              placeholder={POST_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={postRequestScripts}
              onChange={setPostRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          {pluginTabs.map((entry) => (
            <SegmentedTabPanel
              key={entry.id}
              value={entry.id}
              className="flex min-h-0 flex-1 flex-col"
            >
              <PluginSurface
                pluginId={entry.pluginId}
                contributionId={entry.contributionId}
                kind="collectionSettingsTabs"
                context={collectionTabContext}
                resizeMode="fill"
                className="h-full"
              />
            </SegmentedTabPanel>
          ))}
          <ModalFooter spaced>
            <Button
              onClick={() => void handleSave()}
              disabled={!name.trim() || !resolvedConnectionId || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </div>
      </SegmentedTabsGroup>
    </Page>
  );
}
