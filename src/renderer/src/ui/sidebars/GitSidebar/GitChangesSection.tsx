import { Modal } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitRequestDiffFileEntry, SourceControlStatus } from '#/shared/types';
import { buildGitWorkingTreeSummary } from '#/renderer/src/git/gitWorkingTreeSummary';
import {
  buildGitCommitFileAccessibleName,
  gitCommitChangeNameClass
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { gitWorkingTreeStatusPanel, sourceRow } from '#/renderer/src/ui/shared/classes';
import { GitDiffFileView } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitDiffFileView';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

interface Props {
  /**
   * Stable collection uuid for diff lookup.
   */
  collectionUuid: string;

  /**
   * Current source-control status for the active git connection.
   */
  status: SourceControlStatus | null;

  /**
   * Bumps when parent git state should be reloaded.
   */
  refreshNonce: number;
}

/**
 * Parsed git diff payload returned by `window.api.gitDiff`.
 */
interface GitCollectionDiff {
  /**
   * Git connection id for the resolved collection.
   */
  connectionId?: string;

  /**
   * Changed files included in the payload.
   */
  files: GitRequestDiffFileEntry[];

  /**
   * Error message when diff generation failed.
   */
  error?: string;

  /**
   * Whether file count or total character budget caused omissions.
   */
  truncated?: boolean;

  /**
   * Number of changed files omitted from the files array.
   */
  omittedFileCount?: number;
}

/**
 * Lists changed HarborClient files in the Git sidebar.
 */
export function GitChangesSection({ collectionUuid, status, refreshNonce }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const gitAutoAdd = useAppSelector((state) => state.settings.general.gitAutoAdd);
  const externalMergeEditorPath = useAppSelector(
    (state) => state.settings.general.externalMergeEditorPath
  );
  const [diff, setDiff] = useState<GitCollectionDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [selectedFile, setSelectedFile] = useState<GitRequestDiffFileEntry | null>(null);

  /**
   * Stable key for the currently requested collection diff payload.
   */
  const diffKey = useMemo(
    () => `${collectionUuid}:${refreshNonce}`,
    [collectionUuid, refreshNonce]
  );

  /**
   * Loads the collection git diff when the target collection or refresh nonce changes.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .gitDiff({ collectionUuid })
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const parsed = JSON.parse(raw) as GitCollectionDiff;
        setDiff(parsed);
        setError(parsed.error ?? null);
        setLoadedKey(diffKey);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setDiff(null);
        setError(err instanceof Error ? err.message : String(err));
        setLoadedKey(diffKey);
      });

    return () => {
      cancelled = true;
    };
  }, [collectionUuid, diffKey]);

  const loading = loadedKey !== diffKey;
  const changedFiles = diff?.files ?? [];
  const conflictFiles = changedFiles.filter((file) => file.hasConflict);
  const nonConflictFiles = changedFiles.filter((file) => !file.hasConflict);
  const orderedFiles = [...conflictFiles, ...nonConflictFiles];
  const hasChanges = status != null && status.changedCount > 0;
  const connectionId = diff?.connectionId;

  /**
   * Opens the built-in or external merge editor for one conflicted file.
   *
   * @param file - Changed file entry with conflict markers.
   */
  const handleOpenConflictEditor = useCallback(
    async (file: GitRequestDiffFileEntry): Promise<void> => {
      if (connectionId == null) {
        toast.error('Git connection is unavailable for this collection.');
        return;
      }

      const executable = externalMergeEditorPath.trim();
      if (executable) {
        try {
          await window.api.gitOpenExternalMergeEditor({
            connectionId,
            filePath: file.path
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      dispatch(
        openPageTab({
          type: 'merge-editor',
          connectionId,
          filePath: file.path,
          label: `Merge: ${file.path}`
        })
      );
    },
    [connectionId, dispatch, externalMergeEditorPath]
  );

  /**
   * Opens the diff modal or conflict editor depending on file state.
   *
   * @param file - Changed file entry from the git diff payload.
   */
  const handleFileClick = useCallback(
    (file: GitRequestDiffFileEntry): void => {
      if (file.hasConflict) {
        void handleOpenConflictEditor(file);
        return;
      }
      setSelectedFile(file);
    },
    [handleOpenConflictEditor]
  );

  if (!loading && !hasChanges && changedFiles.length === 0 && error == null) {
    return (
      <div className="flex flex-col gap-2 pb-2">
        {status != null ? (
          <div className={`${gitWorkingTreeStatusPanel} text-text`} role="status">
            <p className="m-0">
              Branch: <strong>{status.branch ?? 'unknown'}</strong>
            </p>
            <p className="m-0 text-[14px] text-muted">
              {buildGitWorkingTreeSummary(status, gitAutoAdd)}
            </p>
          </div>
        ) : null}
        <div className="px-2 text-muted mt-2">&lt;No changed requests&gt;</div>
      </div>
    );
  }

  return (
    <>
      {status != null ? (
        <div className={`${gitWorkingTreeStatusPanel} text-text`} role="status">
          <p className="m-0 text-muted">{buildGitWorkingTreeSummary(status, gitAutoAdd)}</p>
          {status.conflictCount > 0 ? (
            <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[14px] text-text">
              {status.conflictCount} file(s) have merge conflicts. Click a conflicted file below to
              open the merge editor, resolve markers, then commit from the Git sidebar.
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="px-2 pb-2 text-[14px] text-muted" role="status">
          Loading changed files…
        </div>
      ) : error != null ? (
        <p className="px-2 pb-2 text-danger" role="alert">
          {error}
        </p>
      ) : changedFiles.length === 0 ? (
        <div className="px-2 pb-2 text-muted text-center mt-3">&lt;No changed requests&gt;</div>
      ) : (
        <>
          {diff?.truncated === true ? (
            <p className="px-2 pb-1 text-muted" role="status">
              Showing {changedFiles.length} changed file(s)
              {diff.omittedFileCount != null && diff.omittedFileCount > 0
                ? `; ${diff.omittedFileCount} more omitted`
                : ''}
              .
            </p>
          ) : null}
          {conflictFiles.length > 0 ? (
            <p className="px-2 pb-1 text-[14px] text-text" role="status">
              Conflicts ({conflictFiles.length})
            </p>
          ) : null}
          <ul className="m-0 flex list-none flex-col gap-0 p-0 pb-2">
            {orderedFiles.map((file) => (
              <li key={file.path} className={sourceRow(false, true)}>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                  aria-label={
                    file.hasConflict
                      ? `Resolve merge conflict in ${file.path}`
                      : buildGitCommitFileAccessibleName(file.path, file.status)
                  }
                  onClick={() => handleFileClick(file)}
                >
                  <span className="shrink-0 px-1 py-px text-muted">
                    {file.hasConflict ? 'conflict' : file.status}
                  </span>
                  <span
                    className={`min-w-0 truncate ${
                      file.hasConflict
                        ? 'font-medium text-amber-700 dark:text-amber-300'
                        : gitCommitChangeNameClass(file.status)
                    }`}
                  >
                    {file.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedFile != null ? (
        <Modal
          onClose={() => setSelectedFile(null)}
          className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
          labelledBy="git-file-diff-title"
          title={`Changes — ${selectedFile.path}`}
        >
          <GitDiffFileView file={selectedFile} />
        </Modal>
      ) : null}
    </>
  );
}
