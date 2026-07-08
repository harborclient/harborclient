import {
  AsyncListState,
  Button,
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
import type { TeamHub, TeamHubAdminRunResult } from '#/shared/types';

import { faClockRotateLeft } from '#/renderer/src/fontawesome';

import { useTeamHubAdminRunResults } from '#/renderer/src/hooks/useTeamHubAdminRunResults';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Admin team hub connection whose run results are being managed.
   */
  hub: TeamHub;
}

/**
 * Returns a compact pass/fail summary for an admin run result row.
 *
 * @param summary - Aggregate counts from the saved snapshot.
 */
function runResultSummaryText(summary: TeamHubAdminRunResult['summary']): string {
  const parts = [`${summary.passed} passed`, `${summary.failed} failed`];
  if (summary.skipped > 0) {
    parts.push(`${summary.skipped} skipped`);
  }
  return parts.join(', ');
}

/**
 * Team Hub run result administration view for operator tokens.
 */
export function TeamRunResultsView({ hub }: Props): JSX.Element {
  const { runResults, loading, error, reload } = useTeamHubAdminRunResults(hub.id);
  const [deletingRunResult, setDeletingRunResult] = useState<TeamHubAdminRunResult | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Opens the delete confirmation modal for a run result row.
   *
   * @param runResult - Run result record to delete.
   */
  const handleDeleteClick = (runResult: TeamHubAdminRunResult): void => {
    setActionError(null);
    setDeleteConfirmText('');
    setDeletingRunResult(runResult);
  };

  /**
   * Closes the delete confirmation modal.
   */
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }

    setDeletingRunResult(null);
    setDeleteConfirmText('');
    setActionError(null);
  };

  /**
   * Permanently deletes the selected run result on the hub after confirmation.
   */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!deletingRunResult || deleteConfirmText !== 'DELETE') {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      await window.api.deleteTeamHubRunResult(hub.id, deletingRunResult.id);
      setDeletingRunResult(null);
      setDeleteConfirmText('');
      reload();
      toast.success('Run result deleted.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page
      embedded
      title="Run results"
      icon={faClockRotateLeft}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
    >
      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={runResults.length === 0}
        emptyMessage="No run results found."
      >
        <ResourceList>
          {runResults.map((runResult) => (
            <ResourceListRow
              key={runResult.id}
              wrap
              primary={
                <div className="flex flex-col gap-1">
                  <ResourceListPrimary>{runResult.label}</ResourceListPrimary>
                  <span className="text-[14px] text-muted">
                    {runResultSummaryText(runResult.summary)}
                  </span>
                </div>
              }
              secondary={runResult.id}
              actions={
                <Button
                  type="button"
                  variant="toolbar"
                  className={toolbarDangerButtonClass}
                  aria-label={`Delete ${runResult.label}`}
                  onClick={() => handleDeleteClick(runResult)}
                >
                  Delete
                </Button>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {actionError && !deletingRunResult ? (
        <FieldError spacing="section">{actionError}</FieldError>
      ) : null}

      {deletingRunResult ? (
        <Modal
          labelledBy="delete-run-result-title"
          onClose={closeDeleteModal}
          title="Delete run result?"
          description={
            <>
              Permanently delete &ldquo;{deletingRunResult.label}&rdquo; from the team hub? Team
              members will lose access to this snapshot on the server.
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
              htmlFor="delete-run-result-confirm"
              className="mb-4"
            >
              <Input
                id="delete-run-result-confirm"
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
