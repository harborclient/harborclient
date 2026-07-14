import { EmptySectionLabel, FaIcon } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import type { GitLogEntry } from '#/shared/types';
import { faCodeBranch } from '#/renderer/src/fontawesome';
import { GitCommitDetailModal } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitCommitDetailModal';

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
              <button
                type="button"
                className="group flex w-full cursor-pointer rounded-md p-2 text-left hover:bg-selection/60 app-no-drag"
                onClick={() => setSelectedOid(entry.oid)}
              >
                <FaIcon
                  icon={faCodeBranch}
                  className="h-4 w-4 shrink-0 text-muted mr-2"
                  aria-hidden
                />
                <div className="flex flex-col gap-0.5 -mt-1.5">
                  <span className="block min-w-0 truncate text-text font-medium">
                    {entry.message}
                  </span>
                  <span className="block min-w-0 truncate text-muted text-[14px]">
                    {entry.author} · {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              </button>
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
