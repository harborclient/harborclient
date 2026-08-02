import {
  AsyncListState,
  Button,
  FaIcon,
  FieldError,
  Page,
  ResourceList
} from '@harborclient/sdk/components';
import {
  buildRuntimeExport,
  buildRuntimesExport,
  RUNTIME_CATALOG,
  type Runtime,
  type RuntimeKind
} from '@harborclient/core/types';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { faPlus } from '#/renderer/src/fontawesome';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { sectionEntryBySection } from '../catalog/catalog';
import { settingsSectionMeta } from '../constants';
import { consumePendingRuntimeDraft } from './pendingRuntimeDraft';
import { RuntimeEditPage } from './RuntimeEditPage';
import { RuntimeRow } from './RuntimeRow';
import { runtimeExportFileName } from './runtimeExportFileName';

/**
 * Creates a blank runtime draft for the Add page.
 *
 * @param kind - Initial runtime kind.
 * @param version - Optional version override.
 * @param name - Optional display name.
 * @returns New runtime with empty id/path.
 */
function createBlankRuntime(kind: RuntimeKind = 'node', version?: string, name?: string): Runtime {
  const resolvedVersion = version?.trim() || RUNTIME_CATALOG[kind].versions[0] || '';
  return {
    id: '',
    name: name?.trim() || `${RUNTIME_CATALOG[kind].label} v${resolvedVersion}`,
    kind,
    version: resolvedVersion,
    path: '',
    env: []
  };
}

/**
 * Reads a one-shot pending draft left by live-server import.
 *
 * @returns Initial editor state when a draft was queued; otherwise closed.
 */
function initialEditorFromPendingDraft(): { editing: Runtime | null; isNew: boolean } {
  const pending = consumePendingRuntimeDraft();
  if (pending == null) {
    return { editing: null, isNew: false };
  }
  return {
    editing: createBlankRuntime(pending.kind, pending.version, pending.name),
    isNew: true
  };
}

/**
 * Settings page for machine-local companion-process runtimes.
 */
export function RuntimesSection(): JSX.Element {
  const confirm = useConfirm();
  const variables = useAppSelector((state) => state.settings.general.globalVariables);
  const { label, icon } = settingsSectionMeta('runtimes');
  const catalog = sectionEntryBySection('runtimes');
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  // Lazy init consumes a one-shot import draft without a mount effect.
  const [editorBootstrap] = useState(initialEditorFromPendingDraft);
  const [editing, setEditing] = useState<Runtime | null>(editorBootstrap.editing);
  const [isNew, setIsNew] = useState(editorBootstrap.isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reloads runtimes from the main-process registry.
   */
  async function reload(): Promise<void> {
    setLoading(true);
    setListError(null);
    try {
      setRuntimes(await window.api.listRuntimes());
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Loads runtimes when the Settings → Runtimes section mounts.
   */
  useEffect(() => {
    let cancelled = false;
    void window.api
      .listRuntimes()
      .then((next) => {
        if (!cancelled) {
          setRuntimes(next);
          setListError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Opens the Add page with a blank Node runtime draft.
   */
  function handleAdd(): void {
    setError(null);
    setIsNew(true);
    setEditing(createBlankRuntime());
  }

  /**
   * Opens the edit page for an existing runtime.
   *
   * @param runtime - Runtime to edit.
   */
  function handleEdit(runtime: Runtime): void {
    setError(null);
    setIsNew(false);
    setEditing({ ...runtime, env: [...runtime.env] });
  }

  /**
   * Returns to the runtimes list without saving.
   */
  function handleCancel(): void {
    setEditing(null);
    setIsNew(false);
    setError(null);
  }

  /**
   * Persists the draft runtime via IPC.
   */
  async function handleSave(): Promise<void> {
    if (editing == null) {
      return;
    }
    if (editing.name.trim() === '') {
      setError('Name is required');
      return;
    }
    if (editing.path.trim() === '') {
      setError('Path is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await window.api.saveRuntime(editing);
      setRuntimes(next);
      setEditing(null);
      setIsNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Confirms and deletes a runtime.
   *
   * @param runtime - Runtime to remove.
   */
  async function handleRemove(runtime: Runtime): Promise<void> {
    const confirmed = await confirm({
      title: 'Remove runtime',
      message: `Remove “${runtime.name || 'Untitled'}”? Live servers that use it will need another matching runtime before their run command can start.`,
      confirmLabel: 'Remove',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    try {
      setRuntimes(await window.api.deleteRuntime(runtime.id));
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Exports one runtime as a HarborClient `runtime` JSON file.
   *
   * @param runtime - Runtime to serialize.
   */
  async function handleExportRuntime(runtime: Runtime): Promise<void> {
    try {
      const envelope = buildRuntimeExport(runtime);
      const result = await window.api.saveTextFile(
        JSON.stringify(envelope, null, 2),
        runtimeExportFileName(runtime.name)
      );
      if (result.canceled) {
        return;
      }
      toast.success('Runtime exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export runtime');
    }
  }

  /**
   * Exports all configured runtimes as a HarborClient `runtimes` JSON file.
   */
  async function handleExportAllRuntimes(): Promise<void> {
    try {
      const envelope = buildRuntimesExport(runtimes);
      const result = await window.api.saveTextFile(
        JSON.stringify(envelope, null, 2),
        'runtimes.json'
      );
      if (result.canceled) {
        return;
      }
      toast.success('Runtimes exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export runtimes');
    }
  }

  if (editing != null) {
    return (
      <RuntimeEditPage
        runtime={editing}
        isNew={isNew}
        saving={saving}
        error={error}
        variables={variables}
        onChange={setEditing}
        onCancel={handleCancel}
        onSave={() => void handleSave()}
      />
    );
  }

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={label}
      icon={icon}
      description={catalog.description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={runtimes.length === 0}
            onClick={() => void handleExportAllRuntimes()}
          >
            Export
          </Button>
          <Button type="button" onClick={handleAdd}>
            <FaIcon icon={faPlus} className="mr-2" />
            Add
          </Button>
        </div>
      }
    >
      <AsyncListState
        loading={loading}
        error={listError}
        onRetry={() => void reload()}
        isEmpty={runtimes.length === 0}
        emptyMessage="No runtimes yet. Add a Node, PHP, or Python executable to use with live server run commands."
      >
        <ResourceList className="flex flex-col gap-4">
          {runtimes.map((runtime) => (
            <RuntimeRow
              key={runtime.id}
              runtime={runtime}
              onExport={() => void handleExportRuntime(runtime)}
              onEdit={() => handleEdit(runtime)}
              onRemove={() => void handleRemove(runtime)}
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {error ? <FieldError spacing="section">{error}</FieldError> : null}
    </Page>
  );
}
