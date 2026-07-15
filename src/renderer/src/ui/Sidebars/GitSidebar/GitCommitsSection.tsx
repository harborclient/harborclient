import {
  EmptySectionLabel,
  SidebarCommitItem,
  type SidebarCommitPushStatus
} from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import type { GitLogEntry } from '#/shared/types';
import { faCodeBranch } from '#/renderer/src/fontawesome';
import { GitCommitDetailModal } from '#/renderer/src/ui/Sidebars/GitSidebar/modals/GitCommitDetailModal';

interface Props {
  /**
   * Git connection id for commit history lookups.
   */
  connectionId: string;

  /**
   * Called when commit history should reload after operations.
   */
  refreshNonce: number;
}

/**
 * Maps a git log entry's origin annotation to the SDK push-status indicator.
 *
 * @param entry - Commit log entry from {@link window.api.gitLog}.
 * @returns Push status for the row indicator (`unknown` when sync is unavailable).
 */
function resolvePushStatus(entry: GitLogEntry): SidebarCommitPushStatus {
  if (entry.pushedToOrigin === true) {
    return 'pushed';
  }
  if (entry.pushedToOrigin === false) {
    return 'unpushed';
  }
  return 'unknown';
}

/**
 * Recent commit list for the Git sidebar.
 */
export function GitCommitsSection({ connectionId, refreshNonce }: Props): JSX.Element {
  const [entries, setEntries] = useState<GitLogEntry[]>([]);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);

  /**
   * Loads recent commits when the section mounts or refreshNonce changes.
   */
  useEffect(() => {
    void window.api
      .gitLog(connectionId, 20)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [connectionId, refreshNonce]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <EmptySectionLabel label="No commits" />
      </div>
    );
  }

  return (
    <>
      <div className="py-2">
        <ul className="m-0 flex list-none flex-col gap-0 p-0" aria-label="Recent commits">
          {entries.map((entry) => (
            <li key={entry.oid}>
              <SidebarCommitItem
                message={entry.message}
                author={entry.author}
                timestampLabel={new Date(entry.timestamp).toLocaleString()}
                icon={faCodeBranch}
                pushStatus={resolvePushStatus(entry)}
                onClick={() => setSelectedOid(entry.oid)}
              />
            </li>
          ))}
        </ul>
      </div>

      {selectedOid != null && (
        <GitCommitDetailModal
          open={true}
          connectionId={connectionId}
          oid={selectedOid}
          onClose={() => setSelectedOid(null)}
        />
      )}
    </>
  );
}
