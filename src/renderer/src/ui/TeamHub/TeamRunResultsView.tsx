import {
  AsyncListState,
  Button,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import { type JSX } from 'react';
import type { TeamHub, TeamHubAdminRunResult } from '#/shared/types';

import { faClockRotateLeft } from '#/renderer/src/fontawesome';

import { useTeamHubAdminRunResults } from '#/renderer/src/hooks/useTeamHubAdminRunResults';
import { useTypedDeleteConfirm } from '#/renderer/src/hooks/useTypedDeleteConfirm';
import { DeleteConfirmModal } from '#/renderer/src/ui/shared/DeleteConfirmModal';
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
  const deleteRunResult = useTypedDeleteConfirm<TeamHubAdminRunResult>({
    onDelete: (runResult) => window.api.deleteTeamHubRunResult(hub.id, runResult.id),
    onSuccess: reload,
    successMessage: 'Run result deleted.'
  });

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
                  onClick={() => deleteRunResult.open(runResult)}
                >
                  Delete
                </Button>
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {deleteRunResult.target ? (
        <DeleteConfirmModal
          title="Delete run result?"
          description={
            <>
              Permanently delete &ldquo;{deleteRunResult.target.label}&rdquo; from the team hub?
              Team members will lose access to this snapshot on the server.
            </>
          }
          busy={deleteRunResult.busy}
          error={deleteRunResult.error}
          onConfirm={() => void deleteRunResult.confirm()}
          onClose={deleteRunResult.close}
        />
      ) : null}
    </Page>
  );
}
