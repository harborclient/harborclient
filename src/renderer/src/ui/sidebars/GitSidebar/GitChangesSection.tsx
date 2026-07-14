import { EmptySectionLabel, FaIcon, Modal, RowActionsMenu } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitRequestDiffFileEntry, SourceControlStatus } from '#/shared/types';
import {
  buildGitCommitFileAccessibleName,
  gitChangeStatusMarker,
  gitChangeStatusMarkerLabel,
  gitCommitChangeNameClass,
  resolveGitChangeDisplayLabel
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/shared/classes';
import { faMarkdown } from '#/renderer/src/fontawesome';
import { GitDiffFileView } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitDiffFileView';
import { useSidebarGit } from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarGitContext';
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

  /**
   * Refreshes git status, diff, and collection data after a revert.
   */
  onRefresh: () => void;
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
export function GitChangesSection({
  collectionUuid,
  status,
  refreshNonce,
  onRefresh
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { changedItemCountByCollectionUuid } = useSidebarGit();
  const externalMergeEditorPath = useAppSelector(
    (state) => state.settings.general.externalMergeEditorPath
  );
  const [diff, setDiff] = useState<GitCollectionDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [selectedFile, setSelectedFile] = useState<GitRequestDiffFileEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /**
   * Stable key for the currently requested collection diff payload.
   */
  const diffKey = useMemo(
    () => `${collectionUuid}:${refreshNonce}`,
    [collectionUuid, refreshNonce]
  );

  /**
   * Loads the collection git diff when the target collection, explicit refresh
   * nonce, or periodically polled connection status changes. Including status
   * keeps an already-open Changes section synchronized with request saves.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .gitDiff({ collectionUuid, stagedOnly: false, excludeUntracked: true })
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
  }, [collectionUuid, diffKey, status]);

  const loading = loadedKey !== diffKey;
  const changedFiles = diff?.files ?? [];
  const conflictFiles = changedFiles.filter((file) => file.hasConflict);
  const nonConflictFiles = changedFiles.filter((file) => !file.hasConflict);
  const orderedFiles = [...conflictFiles, ...nonConflictFiles];
  const collectionChangedCount = changedItemCountByCollectionUuid[collectionUuid] ?? 0;
  const hasChanges = collectionChangedCount > 0;
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

  /**
   * Discards uncommitted working-tree changes for one request or document file.
   *
   * @param file - Changed file entry from the git diff payload.
   */
  const handleRevertFile = useCallback(
    (file: GitRequestDiffFileEntry): void => {
      if (connectionId == null) {
        toast.error('Git connection is unavailable for this collection.');
        return;
      }

      const displayLabel = resolveGitChangeDisplayLabel(file.path, file.displayName);
      void (async () => {
        const confirmed = await confirm({
          title: 'Revert changes',
          message: file.hasConflict
            ? `Discard merge conflict resolution and restore "${displayLabel}" to the last committed version?`
            : `Discard uncommitted changes to "${displayLabel}"?`,
          confirmLabel: 'Revert changes',
          variant: 'danger'
        });
        if (!confirmed) {
          return;
        }

        try {
          await window.api.gitRevertFile(connectionId, collectionUuid, file.path);
          onRefresh();
          toast.success(`Reverted changes to ${displayLabel}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      })();
    },
    [collectionUuid, confirm, connectionId, onRefresh]
  );

  if (!loading && !hasChanges && changedFiles.length === 0 && error == null) {
    return (
      <div className="flex flex-col gap-2 pb-2">
        <div className="flex flex-col gap-0.5">
          <EmptySectionLabel label="No changes" className="mt-5!" />
        </div>
      </div>
    );
  }

  return (
    <>
      {loading ? (
        <div className="px-2 pb-2 text-[14px] text-muted" role="status">
          Loading changed files…
        </div>
      ) : error != null ? (
        <p className="px-2 pb-2 text-danger" role="alert">
          {error}
        </p>
      ) : changedFiles.length === 0 ? (
        <div className="flex flex-col">
          <EmptySectionLabel label="No changes" />
        </div>
      ) : (
        <>
          {conflictFiles.length > 0 ? (
            <p className="px-2 pb-1 text-[14px] text-text" role="status">
              Conflicts ({conflictFiles.length})
            </p>
          ) : null}
          <ul className="m-0 flex list-none flex-col gap-0 p-0 pb-2 pt-2">
            {orderedFiles.map((file) => {
              const displayLabel = resolveGitChangeDisplayLabel(file.path, file.displayName);
              const statusMarker = gitChangeStatusMarker(file.status, file.hasConflict);
              const statusMarkerLabel = gitChangeStatusMarkerLabel(file.status, file.hasConflict);
              const menuId = `git-change-${file.path}`;
              const showRowMenu =
                file.resourceKind === 'request' || file.resourceKind === 'document';
              const menuGroups = [
                [
                  {
                    label: 'Revert changes',
                    variant: 'danger' as const,
                    onSelect: () => handleRevertFile(file)
                  }
                ]
              ];

              return (
                <li
                  key={file.path}
                  className={`group ${sourceRow(false, true)}`}
                  onContextMenu={
                    showRowMenu
                      ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenMenuId(menuId);
                        }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-inherit app-no-drag"
                    aria-label={
                      file.hasConflict
                        ? `Resolve merge conflict in ${displayLabel}`
                        : buildGitCommitFileAccessibleName(
                            file.path,
                            file.status,
                            file.displayName,
                            file.resourceKind
                          )
                    }
                    onClick={() => handleFileClick(file)}
                  >
                    {file.resourceKind === 'request' && file.method != null ? (
                      <span
                        className={`shrink-0 px-1 py-px ${METHOD_CLASSES[file.method.toLowerCase()] ?? 'text-info'}`}
                      >
                        {file.method}
                      </span>
                    ) : file.resourceKind === 'document' ? (
                      <FaIcon
                        icon={faMarkdown}
                        className="h-3.5 w-3.5 shrink-0 text-muted"
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{displayLabel}</span>
                    <span
                      className={`shrink-0 ${
                        file.hasConflict
                          ? 'text-amber-700 dark:text-amber-300'
                          : gitCommitChangeNameClass(file.status)
                      }`}
                      title={statusMarkerLabel}
                      aria-label={statusMarkerLabel}
                    >
                      [{statusMarker}]
                    </span>
                  </button>
                  {showRowMenu ? (
                    <RowActionsMenu
                      menuId={menuId}
                      openMenuId={openMenuId}
                      onOpenChange={setOpenMenuId}
                      groups={menuGroups}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selectedFile != null ? (
        <Modal
          onClose={() => setSelectedFile(null)}
          className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
          labelledBy="git-file-diff-title"
          title={`Changes — ${resolveGitChangeDisplayLabel(selectedFile.path, selectedFile.displayName)}`}
        >
          <GitDiffFileView file={selectedFile} />
        </Modal>
      ) : null}
    </>
  );
}
