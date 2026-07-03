import {
  AsyncListState,
  Button,
  FaIcon,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Snippet } from '#/shared/types';
import { snippetScopeLabel } from '#/shared/snippetScope';
import { faPlus } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';
import {
  createSnippet,
  deleteSnippet,
  refreshSnippets,
  updateSnippet
} from '#/renderer/src/store/thunks/snippets';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { CodePreviewTooltip } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import { SnippetEditModal } from '#/renderer/src/ui/shared/SnippetEditModal';
import {
  createBlankSnippet,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/snippetEditDraft';
import { sectionEntryBySection } from '../catalog/catalog';
import { SettingLabel } from '../components/SettingLabel';
import { settingsSectionMeta } from '../constants';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';

/**
 * Settings page for managing reusable JavaScript snippets.
 */
export function SnippetsSection(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const snippets = useAppSelector(selectSnippets);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SnippetEditDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { label, icon } = settingsSectionMeta('snippets');
  const catalogEntry = sectionEntryBySection('snippets');

  /**
   * Loads snippets when the settings page opens.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Fetches snippets and surfaces load failures inline.
     */
    const load = async (): Promise<void> => {
      setLoading(true);
      setLoadError(null);
      try {
        await dispatch(refreshSnippets()).unwrap();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load snippets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Opens the create snippet modal with a blank draft.
   */
  const handleAdd = (): void => {
    setEditingDraft(createBlankSnippet());
    setIsNew(true);
    setError(null);
  };

  /**
   * Opens the edit modal for an existing snippet.
   *
   * @param snippet - Snippet to edit.
   */
  const handleEdit = (snippet: Snippet): void => {
    setEditingDraft({
      id: snippet.id,
      name: snippet.name,
      code: snippet.code,
      scope: snippet.scope
    });
    setIsNew(false);
    setError(null);
  };

  /**
   * Closes the edit modal and clears transient error state.
   */
  const handleCancelEdit = (): void => {
    setEditingDraft(null);
    setIsNew(false);
    setError(null);
  };

  /**
   * Persists the snippet draft through create or update IPC.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingDraft) {
      return;
    }

    const trimmedName = editingDraft.name.trim();
    if (!trimmedName) {
      setError('Snippet name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNew || editingDraft.id == null) {
        await dispatch(
          createSnippet({
            name: trimmedName,
            code: editingDraft.code,
            scope: editingDraft.scope
          })
        ).unwrap();
        toast.success('Snippet created');
      } else {
        await dispatch(
          updateSnippet({
            id: editingDraft.id,
            name: trimmedName,
            code: editingDraft.code,
            scope: editingDraft.scope
          })
        ).unwrap();
        toast.success('Snippet saved');
      }
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes a snippet after confirmation.
   *
   * @param snippet - Snippet to delete.
   */
  const handleDelete = async (snippet: Snippet): Promise<void> => {
    const confirmed = await confirm({
      title: 'Delete snippet',
      message: `Delete "${snippet.name}"? Requests referencing this snippet will stop running it.`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteSnippet(snippet.id)).unwrap();
      toast.success('Snippet deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete snippet');
    }
  };

  return (
    <Page
      embedded
      title={label}
      description={catalogEntry?.description}
      icon={icon}
      actions={
        <Button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          onClick={handleAdd}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
          Add
        </Button>
      }
    >
      <div className="mb-6 flex flex-col gap-1">
        <span className="text-[18px] font-medium text-text">
          <SettingLabel settingId="snippets.items">Snippets</SettingLabel>
        </span>
        <p className="hc-form-group-description m-0 text-[14px] text-muted mb-2">
          Create reusable JavaScript snippets for use in pre-request and post-request script lists.
        </p>
        <AsyncListState
          loading={loading}
          error={loadError}
          onRetry={() => void dispatch(refreshSnippets())}
          isEmpty={!loading && !loadError && snippets.length === 0}
          emptyMessage="No snippets yet."
        >
          <ResourceList className="flex flex-col gap-4">
            {snippets.map((snippet) => (
              <ResourceListRow
                key={snippet.id}
                primary={
                  <div className="flex flex-col gap-1">
                    <ResourceListPrimary>{snippet.name}</ResourceListPrimary>
                    <span className="text-[14px] text-muted">
                      {snippetScopeLabel(snippet.scope)}
                    </span>
                    <CodePreviewTooltip
                      code={snippet.code}
                      actionLabel={`Edit ${snippet.name}`}
                      onClick={() => handleEdit(snippet)}
                      emptyLabel="Empty snippet"
                    />
                  </div>
                }
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="toolbar"
                      aria-label={`Edit ${snippet.name}`}
                      onClick={() => handleEdit(snippet)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      className={toolbarDangerButtonClass}
                      aria-label={`Delete ${snippet.name}`}
                      onClick={() => void handleDelete(snippet)}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />
            ))}
          </ResourceList>
        </AsyncListState>
      </div>

      {editingDraft && (
        <SnippetEditModal
          draft={editingDraft}
          isNew={isNew}
          saving={saving}
          error={error}
          onChange={setEditingDraft}
          onCancel={handleCancelEdit}
          onSave={() => void handleSave()}
        />
      )}
    </Page>
  );
}
