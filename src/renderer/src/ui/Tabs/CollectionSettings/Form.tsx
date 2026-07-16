import { useCallback, useMemo, useState, type JSX } from 'react';
import type {
  AuthConfig,
  Collection,
  KeyValue,
  ScriptRef,
  StorageConnection,
  Variable
} from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { resolveScriptRefs } from '#/shared/scriptRefs';
import { useProviders } from '#/renderer/src/hooks/useProviders';
import { useStorageConnections } from '#/renderer/src/hooks/useStorageConnections';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import { usePluginCollectionSettingsTabs } from '#/renderer/src/plugins/pluginHooks';
import { ScopedAuthSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedAuthSection';
import { ScopedHeadersSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedHeadersSection';
import {
  ScopedSettingsForm,
  type ScopedSettingsExtraTab,
  type ScopedSettingsRenderState
} from '#/renderer/src/ui/Shared/ScopedSettings/ScopedSettingsForm';
import { GeneralSection } from './GeneralSection';
import { GitSection } from './GitSection';
import { collectionFormCoreFields } from './serialize';

export interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection;

  /**
   * When set, switches to the Variables tab and focuses the matching row.
   */
  focusVariableKey?: string;

  /**
   * When set, switches to this settings section tab (for example `git`).
   */
  focusSection?: string;

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

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist this form.
   */
  tabId?: string;
}

/**
 * Holds editable collection settings state and tab UI. Separated from the
 * export so the parent can reset all fields via React key on collection change.
 */
export function Form({
  collection,
  focusVariableKey,
  focusSection,
  onSave,
  onClose,
  onDirtyChange,
  tabId
}: Props): JSX.Element {
  const pluginTabs = usePluginCollectionSettingsTabs();
  const [connectionId, setConnectionId] = useState(collection.connectionId ?? '');
  const [gitConnectionDraft, setGitConnectionDraft] = useState<
    (StorageConnection & { type: 'git' }) | null
  >(null);
  const [gitDraftConnectionId, setGitDraftConnectionId] = useState<string | null>(null);
  const [initGitRepo, setInitGitRepo] = useState(false);
  const [hiddenTabValues, setHiddenTabValues] = useState<ReadonlySet<string>>(new Set());

  const {
    connections: storageConnections,
    loading: storageConnectionsLoading,
    reload: reloadStorageConnections
  } = useStorageConnections([collection.connectionId]);
  const persistedGitConnection = useMemo((): (StorageConnection & { type: 'git' }) | null => {
    const match = storageConnections.find(
      (connection) => connection.id === collection.connectionId
    );
    return match?.type === 'git' ? match : null;
  }, [collection.connectionId, storageConnections]);
  const gitConnection =
    gitConnectionDraft && gitDraftConnectionId === collection.connectionId
      ? gitConnectionDraft
      : persistedGitConnection;

  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError,
    reload: reloadProviders
  } = useProviders([collection.connectionId], {
    excludeAdminTeamHubs: true,
    excludeGit: true,
    retainConnectionId: collection.connectionId
  });

  const resolvedConnectionId = connectionId || collection.connectionId || primaryProviderId;
  const isGitBacked = gitConnection != null;
  const baselineConnectionId = collection.connectionId || primaryProviderId;

  /**
   * Normalized persisted snapshot used to seed and compare scoped form fields.
   */
  const initial = useMemo(
    () =>
      collectionFormCoreFields(
        collection.name,
        collection.variables,
        collection.headers,
        resolveScriptRefs(collection.pre_request_scripts, collection.pre_request_script ?? ''),
        resolveScriptRefs(collection.post_request_scripts, collection.post_request_script ?? ''),
        normalizeAuth(collection.auth)
      ),
    [collection]
  );

  /**
   * Whether git repository settings differ from the persisted connection snapshot.
   */
  const isGitDirty = useMemo(() => {
    if (!gitConnection || !persistedGitConnection) {
      return false;
    }
    return (
      JSON.stringify(gitConnection.settings) !== JSON.stringify(persistedGitConnection.settings)
    );
  }, [gitConnection, persistedGitConnection]);

  const connectionChanged = resolvedConnectionId !== baselineConnectionId;
  const extraDirty = connectionChanged || isGitDirty;

  /**
   * Git and plugin tabs injected around the shared scoped settings tabs.
   */
  const extraTabs = useMemo((): ScopedSettingsExtraTab[] => {
    const entries: ScopedSettingsExtraTab[] = [];

    if (isGitBacked && gitConnection) {
      entries.push({
        value: 'git',
        label: 'Git',
        position: 'afterGeneral',
        panel: (state: ScopedSettingsRenderState) => (
          <GitSection
            connection={gitConnection}
            disabled={state.saving}
            onInitGitRepoChange={setInitGitRepo}
            onChange={(next) => {
              setGitDraftConnectionId(collection.connectionId ?? null);
              setGitConnectionDraft(next);
            }}
          />
        )
      });
    }

    for (const entry of pluginTabs) {
      entries.push({
        value: entry.id,
        label: entry.title,
        position: 'afterScripts',
        panelClassName: 'flex min-h-0 flex-1 flex-col',
        panel: (state: ScopedSettingsRenderState) => (
          <HostedSurface
            pluginId={entry.pluginId}
            contributionId={entry.contributionId}
            kind="collectionSettingsTabs"
            context={{
              collectionId: collection.id,
              readOnly: state.saving
            }}
            resizeMode="fill"
            className="h-full"
          />
        )
      });
    }

    return entries;
  }, [isGitBacked, gitConnection, pluginTabs, collection.connectionId, collection.id]);

  /**
   * Tab values shown in the strip, derived from the current tab list minus any
   * the user hid via the VisibilityMenu.
   */
  const allTabValues = useMemo(() => {
    const values = [
      'general',
      ...(isGitBacked ? ['git'] : []),
      'variables',
      'headers',
      'auth',
      'pre',
      'post',
      ...pluginTabs.map((entry) => entry.id)
    ];
    return values;
  }, [isGitBacked, pluginTabs]);

  const visibleTabValues = useMemo(
    () => allTabValues.filter((value) => !hiddenTabValues.has(value)),
    [allTabValues, hiddenTabValues]
  );

  /**
   * Persists VisibilityMenu toggles into hiddenTabValues.
   *
   * @param nextVisibleTabValues - Tab values that should remain in the strip.
   */
  const handleVisibleTabValuesChange = useCallback(
    (nextVisibleTabValues: string[]): void => {
      const nextVisible = new Set(nextVisibleTabValues);
      setHiddenTabValues(new Set(allTabValues.filter((value) => !nextVisible.has(value))));
    },
    [allTabValues]
  );

  /**
   * Persists git changes when needed, then saves collection core fields.
   *
   * @param fields - Cleaned scoped settings fields from the shared form.
   */
  const handleScopedSave = async (fields: typeof initial): Promise<void> => {
    if (isGitBacked && gitConnection && (isGitDirty || initGitRepo)) {
      if (initGitRepo) {
        const { repoPath, url, branch } = gitConnection.settings;
        await window.api.gitInitRepo(repoPath, url, branch);
        setInitGitRepo(false);
      }
      if (isGitDirty) {
        await window.api.saveStorageConnection(gitConnection);
      }
      setGitConnectionDraft(null);
      setGitDraftConnectionId(null);
      reloadStorageConnections();
    }

    await onSave(
      collection.id,
      fields.name,
      fields.variables,
      fields.headers,
      fields.preRequestScripts,
      fields.postRequestScripts,
      fields.auth,
      resolvedConnectionId
    );
  };

  return (
    <ScopedSettingsForm
      title="Collection Settings"
      description="Manage collection settings and configuration"
      ariaLabel="Collection settings sections"
      pageClassName="collection-settings-page"
      initial={initial}
      focusVariableKey={focusVariableKey}
      focusSection={focusSection}
      preScriptDescription="Runs in the collection pre-request stage before every request, ahead of each request's pre-request stage. Supports {{variable}} syntax."
      postScriptDescription="Runs in the collection post-request stage after every request, following each request's post-request stage. Supports {{variable}} syntax."
      extraTabs={extraTabs}
      visibleTabValues={visibleTabValues}
      onVisibleTabValuesChange={handleVisibleTabValuesChange}
      extraDirty={extraDirty}
      dirtyReady={!providersLoading && !storageConnectionsLoading}
      disableSave={!resolvedConnectionId}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      onSave={handleScopedSave}
      tabId={tabId}
      renderGeneral={(state) => (
        <GeneralSection
          name={state.name}
          onNameChange={state.setName}
          connectionId={resolvedConnectionId}
          providers={providers}
          onConnectionIdChange={setConnectionId}
          providersLoading={providersLoading}
          providersError={providersError}
          onProvidersRetry={reloadProviders}
          onSave={state.save}
          onClose={onClose}
          showProviderSelect={!isGitBacked}
        />
      )}
      renderHeaders={(state) => (
        <ScopedHeadersSection
          scope="collection"
          headers={state.headers}
          variables={state.variables}
          onChange={state.setHeaders}
        />
      )}
      renderAuth={(state) => (
        <ScopedAuthSection
          scope="collection"
          id={collection.id}
          auth={state.auth}
          variables={state.variables}
          onChange={state.setAuth}
        />
      )}
    />
  );
}
