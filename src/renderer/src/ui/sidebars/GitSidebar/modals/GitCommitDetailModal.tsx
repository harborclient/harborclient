import { Modal } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { GitCommitDetail } from '#/shared/types';
import { buildGitCommitChangesViewModel } from '#/renderer/src/git/buildGitCommitChangesViewModel';
import {
  buildGitCommitFileAccessibleName,
  gitCommitChangeNameClass,
  gitResourceKindLabel,
  resolveGitChangeDisplayLabel
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { sourceRow } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Git connection id for commit detail lookup.
   */
  connectionId: string;

  /**
   * Commit object id to display.
   */
  oid: string;

  /**
   * Called when the modal should close.
   */
  onClose: () => void;
}

/**
 * Shows commit metadata and changed file paths for one git commit.
 */
export function GitCommitDetailModal({
  open,
  connectionId,
  oid,
  onClose
}: Props): JSX.Element | null {
  const [detail, setDetail] = useState<GitCommitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');

  /**
   * Stable key for the currently requested commit detail payload.
   */
  const commitKey = useMemo(() => `${connectionId}:${oid}`, [connectionId, oid]);

  /**
   * Flat file rows for the loaded commit detail.
   */
  const changesViewModel = useMemo(() => {
    if (detail == null) {
      return null;
    }
    return buildGitCommitChangesViewModel(detail.files);
  }, [detail]);

  /**
   * Loads commit details when the modal opens or the target commit changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void window.api
      .gitCommitDetail(connectionId, oid)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
          setError(null);
          setLoadedKey(commitKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoadedKey(commitKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, connectionId, oid, commitKey]);

  if (!open) {
    return null;
  }

  const loading = loadedKey !== commitKey;

  return (
    <Modal
      onClose={onClose}
      className="w-[60rem]"
      labelledBy="git-commit-detail-title"
      title="Commit details"
    >
      {error != null ? (
        <p className="text-danger" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="text-muted" role="status">
          Loading commit details…
        </p>
      ) : detail == null ? (
        <p className="text-muted" role="status">
          Commit details unavailable.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-control p-3 rounded-md">
            <p id="git-commit-detail-title" className="m-0 font-medium text-text">
              {detail.message}
            </p>
            <p className="m-0 text-[16px] text-muted">
              {detail.author} · {new Date(detail.timestamp).toLocaleString()}
            </p>
            <p className="m-0 break-all text-[16px] text-muted">{detail.oid}</p>
            {detail.fullMessage.trim() !== detail.message.trim() ? (
              <pre className="m-0 whitespace-pre-wrap rounded border border-separator bg-surface p-3 text-[14px] text-text">
                {detail.fullMessage}
              </pre>
            ) : null}
          </div>

          <h3 className="m-0 text-[16px] font-medium text-text">Changed files</h3>
          <div className="border border-separator border-md rounded-md p-3">
            {changesViewModel == null || changesViewModel.files.length === 0 ? (
              <p className="m-0 text-[16px] text-muted">No changed files</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0 p-0">
                {changesViewModel.files.map((file) => {
                  const displayLabel = resolveGitChangeDisplayLabel(file.path, file.displayName);
                  const kindLabel = gitResourceKindLabel(file.resourceKind);
                  return (
                    <li key={file.path} className={sourceRow(false, true)}>
                      <span
                        className={`flex min-w-0 items-center gap-1.5 truncate px-1.5 py-0.5 ${gitCommitChangeNameClass(file.status)}`}
                        aria-label={buildGitCommitFileAccessibleName(
                          file.path,
                          file.status,
                          file.displayName,
                          file.resourceKind
                        )}
                      >
                        {kindLabel != null ? (
                          <span className="shrink-0 rounded border border-separator px-1 py-px text-[14px] text-muted">
                            {kindLabel}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">{displayLabel}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
