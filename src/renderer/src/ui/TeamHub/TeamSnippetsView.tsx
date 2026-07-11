import {
  AsyncListState,
  Button,
  FaIcon,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { snippetScopeLabel } from '#/shared/snippetScope';
import { DEFAULT_SCRIPT_STAGE } from '#/shared/scriptStage';
import type { TeamHub, TeamHubAdminSnippet } from '#/shared/types';

import { faPlus, faCode } from '#/renderer/src/fontawesome';

import { useTeamHubAdminSnippets } from '#/renderer/src/hooks/useTeamHubAdminSnippets';
import { CodePreviewTooltip } from '#/renderer/src/ui/shared/CodePreviewTooltip';
import { SnippetEditModal } from '#/renderer/src/ui/shared/SnippetEditModal';
import {
  createBlankSnippet,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/snippetEditDraft';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Admin team hub connection whose snippets are being managed.
   */
  hub: TeamHub;
}

/**
 * Team Hub snippet administration view for operator tokens.
 */
export function TeamSnippetsView({ hub }: Props): JSX.Element {
  const { snippets, loading, error, reload } = useTeamHubAdminSnippets(hub.id);
  const [editingDraft, setEditingDraft] = useState<SnippetEditDraft | null>(null);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingSnippet, setDeletingSnippet] = useState<TeamHubAdminSnippet | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Opens the create modal with a blank snippet draft.
   */
  const handleAdd = (): void => {
    setEditingDraft(createBlankSnippet());
    setEditingSnippetId(null);
    setIsNew(true);
    setSaveError(null);
  };

  /**
   * Opens the edit modal for a hub snippet row.
   *
   * @param snippet - Snippet record to edit.
   */
  const handleEdit = (snippet: TeamHubAdminSnippet): void => {
    setEditingDraft({
      name: snippet.name,
      code: snippet.code,
      scope: snippet.scope,
      stage: DEFAULT_SCRIPT_STAGE
    });
    setEditingSnippetId(snippet.id);
    setIsNew(false);
    setSaveError(null);
  };

  /**
   * Closes the create/edit modal and clears transient error state.
   */
  const handleCancelEdit = (): void => {
    setEditingDraft(null);
    setEditingSnippetId(null);
    setIsNew(false);
    setSaveError(null);
  };

  /**
   * Persists the snippet draft through create or update admin IPC.
   */
  const handleSave = async (): Promise<void> => {
    if (!editingDraft) {
      return;
    }

    const trimmedName = editingDraft.name.trim();
    if (!trimmedName) {
      setSaveError('Snippet name is required.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const input = {
        name: trimmedName,
        code: editingDraft.code,
        scope: editingDraft.scope
      };

      if (isNew || editingSnippetId == null) {
        await window.api.createTeamHubAdminSnippet(hub.id, input);
        toast.success('Snippet created.');
      } else {
        await window.api.updateTeamHubAdminSnippet(hub.id, editingSnippetId, input);
        toast.success('Snippet updated.');
      }

      handleCancelEdit();
      reload();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Opens the delete confirmation modal for a snippet row.
   *
   * @param snippet - Snippet record to delete.
   */
  const handleDeleteClick = (snippet: TeamHubAdminSnippet): void => {
    setActionError(null);
    setDeleteConfirmText('');
    setDeletingSnippet(snippet);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingSnippet(null);
    setDeleteConfirmText('');
    setActionError(null);
  };

  /**
   * Permanently deletes the selected snippet on the hub after confirmation.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingSnippet || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubAdminSnippet(hub.id, deletingSnippet.id);
      setDeletingSnippet(null);
      setDeleteConfirmText('');
      reload();
      toast.success('Snippet deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page
      embedded
      title="Snippets"
      icon={faCode}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
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
      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={snippets.length === 0}
        emptyMessage="No snippets found."
      >
        <ResourceList>
          {snippets.map((snippet) => (
            <ResourceListRow
              key={snippet.id}
              wrap
              primary={
                <div className="flex flex-col gap-1">
                  <ResourceListPrimary>{snippet.name}</ResourceListPrimary>
                  <span className="text-[14px] text-muted">{snippetScopeLabel(snippet.scope)}</span>
                  <CodePreviewTooltip
                    code={snippet.code}
                    actionLabel={`Edit ${snippet.name}`}
                    onClick={() => handleEdit(snippet)}
                    emptyLabel="Empty snippet"
                  />
                </div>
              }
              secondary={snippet.id}
              actions={
                <>
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
                    onClick={() => handleDeleteClick(snippet)}
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {actionError && !deletingSnippet ? (
        <FieldError spacing="section">{actionError}</FieldError>
      ) : null}

      {editingDraft ? (
        <SnippetEditModal
          draft={editingDraft}
          isNew={isNew}
          saving={saving}
          error={saveError}
          hideStorageLocation
          onChange={setEditingDraft}
          onCancel={handleCancelEdit}
          onSave={() => void handleSave()}
        />
      ) : null}

      {deletingSnippet ? (
        <Modal
          labelledBy="delete-snippet-title"
          onClose={closeDeleteModal}
          title="Delete snippet?"
          description={
            <>
              Permanently delete &ldquo;{deletingSnippet.name}&rdquo; from the team hub? Team
              members will lose access to this snippet on the server.
            </>
          }
          closeDisabled={deleting}
          disableEscape={deleting}
        >
          <ModalFormLayout
            error={actionError ? <FieldError spacing="section">{actionError}</FieldError> : null}
            actions={
              <Button
                type="button"
                variant="primaryDanger"
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                onClick={() => void handleConfirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            }
          >
            <FormGroup
              label="Type DELETE to confirm"
              htmlFor="delete-snippet-confirm"
              className="mb-4"
            >
              <Input
                id="delete-snippet-confirm"
                value={deleteConfirmText}
                disabled={deleting}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                autoComplete="off"
              />
            </FormGroup>
          </ModalFormLayout>
        </Modal>
      ) : null}
    </Page>
  );
}
