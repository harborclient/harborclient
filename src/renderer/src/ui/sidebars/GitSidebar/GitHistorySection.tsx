import { EmptySectionLabel } from '@harborclient/sdk/components';
import { GitLog } from '@tomplum/react-git-log';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { GitGraphLogResult } from '#/shared/types';
import { GitCommitDetailModal } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitCommitDetailModal';

interface Props {
  /**
   * Git connection id for graph history lookups.
   */
  connectionId: string;

  /**
   * Called when graph history should reload after operations.
   */
  refreshNonce: number;
}

/**
 * Formats a graph commit timestamp for the compact history table.
 *
 * @param value - ISO timestamp from the graph payload.
 */
function formatHistoryTimestamp(value: string | undefined): string {
  if (value == null || value.length === 0) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Branch graph and commit history visualization for the Git sidebar.
 */
export function GitHistorySection({ connectionId, refreshNonce }: Props): JSX.Element {
  const [graph, setGraph] = useState<GitGraphLogResult | null>(null);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  /**
   * Stable key for the current graph request.
   */
  const graphKey = useMemo(() => `${connectionId}:${refreshNonce}`, [connectionId, refreshNonce]);

  /**
   * Loads graph-ready commit history when the section mounts or refreshNonce changes.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .gitGraphLog(connectionId, 100)
      .then((result) => {
        if (!cancelled) {
          setGraph(result);
          setLoadedKey(graphKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGraph(null);
          setLoadedKey(graphKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectionId, graphKey]);

  const loading = loadedKey !== graphKey;

  if (loading) {
    return (
      <div className="px-2 pb-2 text-[14px] text-muted" role="status">
        Loading history…
      </div>
    );
  }

  if (graph == null || graph.entries.length === 0 || graph.currentBranch == null) {
    return (
      <div className="flex flex-col gap-0.5">
        <EmptySectionLabel label="No history" />
      </div>
    );
  }

  return (
    <>
      <div className="hc-git-history px-1 pb-2">
        <GitLog
          entries={graph.entries}
          currentBranch={graph.currentBranch}
          showHeaders={false}
          showGitIndex={false}
          defaultGraphWidth={72}
          rowSpacing={0}
          enableSelectedCommitStyling={true}
          classes={{
            containerClass: 'hc-git-history-log'
          }}
          onSelectCommit={(commit) => setSelectedOid(commit?.hash ?? null)}
        >
          <GitLog.GraphHTMLGrid
            enableResize={false}
            nodeSize={12}
            showCommitNodeHashes={false}
            showCommitNodeTooltips={false}
            highlightedBackgroundHeight={28}
          />
          <GitLog.Table
            className="hc-git-history-table"
            timestampFormat="MMM D, h:mm A"
            row={({ commit, selected, previewed }) => {
              const author = commit.author?.name ?? 'Unknown author';
              const timestamp = formatHistoryTimestamp(commit.committerDate);
              const rowLabel = `${commit.message}. ${author}${timestamp ? `, ${timestamp}` : ''}`;

              return (
                <div
                  className={`hc-git-history-row flex min-w-0 flex-col gap-0.5 px-2 py-1 ${
                    selected || previewed ? 'bg-selection/60' : ''
                  }`}
                  aria-label={rowLabel}
                >
                  <span className="min-w-0 truncate text-text">{commit.message}</span>
                  <span className="min-w-0 truncate text-[14px] text-muted">
                    {author}
                    {timestamp ? ` · ${timestamp}` : ''}
                  </span>
                </div>
              );
            }}
          />
        </GitLog>
      </div>

      <ul className="sr-only" aria-label="Commit history list">
        {graph.entries.map((entry) => (
          <li key={entry.hash}>{entry.message}</li>
        ))}
      </ul>

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
