import { useEffect, useMemo, useState, type JSX } from 'react';
import type { Collection, DatabaseConnection, KeyValue, Variable } from '#/shared/types';
import { cleanVariables } from '#/renderer/src/components/variableUtils';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { faXmark } from '#/renderer/src/fontawesome';
import { iconButton, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
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
   * @param connectionId - Target database connection id.
   */
  onSave: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
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
 * Full-area collection settings with tabbed sections.
 */
export function CollectionSettings(props: Props): JSX.Element {
  return <CollectionSettingsForm key={props.collection.id} {...props} />;
}

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
  const [preRequestScript, setPreRequestScript] = useState(collection.pre_request_script ?? '');
  const [postRequestScript, setPostRequestScript] = useState(collection.post_request_script ?? '');
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [primaryConnectionId, setPrimaryConnectionId] = useState('');
  const [connectionId, setConnectionId] = useState(collection.connectionId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([window.api.listDatabaseConnections(), window.api.getActiveDatabaseId()]).then(
      ([nextConnections, nextPrimaryConnectionId]) => {
        if (cancelled) return;
        setConnections(nextConnections);
        setPrimaryConnectionId(nextPrimaryConnectionId);
        setConnectionId((current) => current || collection.connectionId || nextPrimaryConnectionId);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [collection.connectionId]);

  const resolvedConnectionId = connectionId || collection.connectionId || primaryConnectionId;

  const isDirty = useMemo(
    () =>
      serializeCollectionForm(
        name,
        variables,
        headers,
        preRequestScript,
        postRequestScript,
        resolvedConnectionId
      ) !==
      serializeCollectionForm(
        collection.name,
        collection.variables,
        collection.headers,
        collection.pre_request_script ?? '',
        collection.post_request_script ?? '',
        collection.connectionId ?? primaryConnectionId
      ),
    [
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      resolvedConnectionId,
      collection,
      primaryConnectionId
    ]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  /** Persists name, variables, headers, scripts, and database selection. */
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
              { value: 'variables', label: 'Variables' },
              { value: 'headers', label: 'Headers' },
              { value: 'pre', label: 'PreRequest' },
              { value: 'post', label: 'PostRequest' }
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
            onSave={() => void handleSave()}
            onClose={onClose}
          />
        )}

        {tab === 'variables' && <VariablesSection variables={variables} onChange={setVariables} />}

        {tab === 'headers' && (
          <HeadersSection headers={headers} variables={variables} onChange={setHeaders} />
        )}

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
