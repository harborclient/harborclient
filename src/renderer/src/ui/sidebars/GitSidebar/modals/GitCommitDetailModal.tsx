import {
  Modal,
  SidebarDocumentItem,
  SidebarItem,
  SidebarRequestItem,
  SidebarStatusMarker,
  SIDEBAR_ITEM_BUTTON_CLASS,
  Textarea
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type {
  GitCommitDetail,
  GitCommitPlainFileChange,
  GitRequestDiffFileEntry
} from '#/shared/types';
import { buildGitCommitChangesViewModel } from '#/renderer/src/git/buildGitCommitChangesViewModel';
import {
  buildGitCommitFileAccessibleName,
  gitChangeStatusMarker,
  gitChangeStatusMarkerLabel,
  gitCommitChangeNameClass,
  resolveGitChangeDisplayLabel
} from '#/renderer/src/git/gitCommitChangeDisplay';
import { faMarkdown } from '#/renderer/src/fontawesome';
import { GitDiffFileView } from '#/renderer/src/ui/sidebars/GitSidebar/modals/GitDiffFileView';

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
  const [selectedChange, setSelectedChange] = useState<GitCommitPlainFileChange | null>(null);
  const [selectedDiffFile, setSelectedDiffFile] = useState<GitRequestDiffFileEntry | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const diffRequestRef = useRef(0);

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

  /**
   * Clears nested diff modal state and cancels any in-flight diff request.
   */
  const clearDiffModalState = useCallback((): void => {
    diffRequestRef.current += 1;
    setSelectedChange(null);
    setSelectedDiffFile(null);
    setDiffLoading(false);
    setDiffError(null);
  }, []);

  /**
   * Opens the diff modal for one changed file in this commit.
   *
   * @param file - Commit file row selected by the user.
   */
  const handleFileClick = useCallback(
    (file: GitCommitPlainFileChange): void => {
      const requestId = diffRequestRef.current + 1;
      diffRequestRef.current = requestId;
      setSelectedChange(file);
      setSelectedDiffFile(null);
      setDiffLoading(true);
      setDiffError(null);

      void window.api
        .gitCommitFileDiff({
          connectionId,
          commitOid: oid,
          filePath: file.path,
          status: file.status,
          displayName: file.displayName,
          resourceKind: file.resourceKind,
          method: file.method
        })
        .then((result) => {
          if (diffRequestRef.current !== requestId) {
            return;
          }
          setSelectedDiffFile(result);
          setDiffLoading(false);
        })
        .catch((err: unknown) => {
          if (diffRequestRef.current !== requestId) {
            return;
          }
          setSelectedDiffFile(null);
          setDiffError(err instanceof Error ? err.message : String(err));
          setDiffLoading(false);
        });
    },
    [connectionId, oid]
  );

  /**
   * Closes the nested diff modal and clears its loading state.
   */
  const handleCloseDiffModal = useCallback((): void => {
    clearDiffModalState();
  }, [clearDiffModalState]);

  /**
   * Closes the commit detail modal and any open nested diff modal.
   */
  const handleCloseCommitModal = useCallback((): void => {
    clearDiffModalState();
    onClose();
  }, [clearDiffModalState, onClose]);

  if (!open) {
    return null;
  }

  const loading = loadedKey !== commitKey;
  const selectedDisplayLabel =
    selectedChange == null
      ? ''
      : resolveGitChangeDisplayLabel(selectedChange.path, selectedChange.displayName);

  return (
    <>
      <Modal
        onClose={handleCloseCommitModal}
        className="w-[60rem]"
        labelledBy="git-commit-detail-title"
        title={detail?.oid || ''}
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
            <Textarea id="git-commit-detail-title" readOnly>
              {detail.message}
            </Textarea>

            <h3 className="m-0 text-[16px] font-medium text-text">Changes</h3>
            <div className="border border-separator border-md rounded-md p-2">
              {changesViewModel == null || changesViewModel.files.length === 0 ? (
                <p className="m-0 text-[16px] text-muted">No changed files</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-0 p-0">
                  {changesViewModel.files.map((file) => {
                    const displayLabel = resolveGitChangeDisplayLabel(file.path, file.displayName);
                    const statusMarker = gitChangeStatusMarker(file.status, false);
                    const statusMarkerLabel = gitChangeStatusMarkerLabel(file.status, false);
                    const statusMarkerProps = {
                      marker: statusMarker,
                      className: gitCommitChangeNameClass(file.status),
                      label: statusMarkerLabel
                    };
                    const rowAriaLabel = buildGitCommitFileAccessibleName(
                      file.path,
                      file.status,
                      file.displayName,
                      file.resourceKind
                    );

                    if (file.resourceKind === 'request' && file.method != null) {
                      return (
                        <SidebarRequestItem
                          key={file.path}
                          as="li"
                          method={file.method}
                          name={displayLabel}
                          statusMarker={statusMarkerProps}
                          ariaLabel={rowAriaLabel}
                          onClick={() => handleFileClick(file)}
                        />
                      );
                    }

                    if (file.resourceKind === 'document') {
                      return (
                        <SidebarDocumentItem
                          key={file.path}
                          as="li"
                          icon={faMarkdown}
                          name={displayLabel}
                          statusMarker={statusMarkerProps}
                          ariaLabel={rowAriaLabel}
                          onClick={() => handleFileClick(file)}
                        />
                      );
                    }

                    return (
                      <SidebarItem key={file.path} as="li">
                        <button
                          type="button"
                          className={SIDEBAR_ITEM_BUTTON_CLASS}
                          aria-label={rowAriaLabel}
                          onClick={() => handleFileClick(file)}
                        >
                          <span className="min-w-0 truncate">{displayLabel}</span>
                          <SidebarStatusMarker
                            marker={statusMarkerProps.marker}
                            className={statusMarkerProps.className}
                            label={statusMarkerProps.label}
                          />
                        </button>
                      </SidebarItem>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {selectedChange != null ? (
        <Modal
          onClose={handleCloseDiffModal}
          className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
          labelledBy="git-commit-file-diff-title"
          title={`Changes — ${selectedDisplayLabel}`}
        >
          {diffLoading ? (
            <p className="text-muted" role="status">
              Loading file diff…
            </p>
          ) : diffError != null ? (
            <p className="text-danger" role="alert">
              {diffError}
            </p>
          ) : selectedDiffFile != null ? (
            <GitDiffFileView file={selectedDiffFile} />
          ) : (
            <p className="text-muted" role="status">
              File diff unavailable.
            </p>
          )}
        </Modal>
      ) : null}
    </>
  );
}
