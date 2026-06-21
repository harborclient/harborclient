import { useEffect, useMemo, useState, type JSX } from 'react';
import type { AuthConfig, Collection, KeyValue, Variable } from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { cleanVariables } from '#/renderer/src/components/variableUtils';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { useDatabaseConnections } from '#/renderer/src/hooks/useDatabaseConnections';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { faXmark } from '#/renderer/src/fontawesome';
import { iconButton, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { AuthSection } from './AuthSection';
import { GeneralSection } from './GeneralSection';
import { HeadersSection } from './HeadersSection';
import { ScriptSection } from './ScriptSection';
import { cleanHeaders, serializeCollectionForm } from './serialize';
import type { SettingsTab } from './types';
import { VariablesSection } from './VariablesSection';

interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection;

  /**
   * Persists collection name, variables, headers, scripts, and database.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Collection pre-request script.
   * @param postRequestScript - Collection post-request script.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param connectionId - Target database connection id.
   */
  onSave: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
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
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('general');
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
  const [preRequestScript, setPreRequestScript] = useState(collection.pre_request_script ?? '');
  const [postRequestScript, setPostRequestScript] = useState(collection.post_request_script ?? '');
  const [connectionId, setConnectionId] = useState(collection.connectionId ?? '');
  const [saving, setSaving] = useState(false);

  const {
    connections,
    primaryConnectionId,
    loading: connectionsLoading,
    error: connectionsError,
    reload: reloadConnections
  } = useDatabaseConnections([collection.connectionId]);

  const resolvedConnectionId = connectionId || collection.connectionId || primaryConnectionId;

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
        preRequestScript,
        postRequestScript,
        auth,
        resolvedConnectionId
      ) !==
      serializeCollectionForm(
        collection.name,
        collection.variables,
        collection.headers,
        collection.pre_request_script ?? '',
        collection.post_request_script ?? '',
        normalizeAuth(collection.auth),
        collection.connectionId || primaryConnectionId
      ),
    [
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth,
      resolvedConnectionId,
      collection,
      primaryConnectionId
    ]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared. Reports clean
   * until async connection bootstrap finishes so primaryConnectionId does not
   * cause a spurious dirty flicker during load.
   */
  useEffect(() => {
    onDirtyChange?.(!connectionsLoading ? isDirty : false);
  }, [isDirty, connectionsLoading, onDirtyChange]);

  /**
   * Dot indicators for tabs whose sections have content configured.
   * Memoized so SegmentedTabs tab config only rebuilds when section values change.
   */
  const tabIndicators = useMemo(
    () => ({
      variables: cleanVariables(variables).length > 0,
      headers: cleanHeaders(headers).length > 0,
      auth: auth.type !== 'none',
      pre: preRequestScript.trim().length > 0,
      post: postRequestScript.trim().length > 0
    }),
    [variables, headers, auth, preRequestScript, postRequestScript]
  );

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
        preRequestScript,
        postRequestScript,
        auth,
        resolvedConnectionId
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Collection Settings</h1>
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
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'general', label: 'General' },
              { value: 'variables', label: 'Variables', indicator: tabIndicators.variables },
              { value: 'headers', label: 'Headers', indicator: tabIndicators.headers },
              { value: 'auth', label: 'Authorization', indicator: tabIndicators.auth },
              { value: 'pre', label: 'PreRequest', indicator: tabIndicators.pre },
              { value: 'post', label: 'PostRequest', indicator: tabIndicators.post }
            ]}
          />
        </div>

        {tab === 'general' && (
          <GeneralSection
            name={name}
            onNameChange={setName}
            connectionId={resolvedConnectionId}
            connections={connections}
            onConnectionIdChange={setConnectionId}
            connectionsLoading={connectionsLoading}
            connectionsError={connectionsError}
            onConnectionsRetry={reloadConnections}
            onSave={() => void handleSave()}
            onClose={onClose}
          />
        )}
        {tab === 'variables' && <VariablesSection variables={variables} onChange={setVariables} />}
        {tab === 'headers' && (
          <HeadersSection headers={headers} variables={variables} onChange={setHeaders} />
        )}
        {tab === 'auth' && <AuthSection auth={auth} variables={variables} onChange={setAuth} />}
        {tab === 'pre' && (
          <ScriptSection
            phase="pre"
            description="Runs before every request in this collection, before the request-level pre-request script. Supports {{variable}} syntax."
            placeholder="// hc.variables.set('token', 'abc');"
            value={preRequestScript}
            onChange={setPreRequestScript}
            variables={variables}
          />
        )}
        {tab === 'post' && (
          <ScriptSection
            phase="post"
            description="Runs after every request in this collection, after the request-level post-request script. Supports {{variable}} syntax."
            placeholder={
              '// hc.test("status is 200", () => {\n//   hc.expect(hc.response.code).to.equal(200);\n// });'
            }
            value={postRequestScript}
            onChange={setPostRequestScript}
            variables={variables}
          />
        )}

        <div className="flex justify-end gap-2">
          <button className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={primaryButton}
            onClick={() => void handleSave()}
            disabled={!name.trim() || !resolvedConnectionId || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
