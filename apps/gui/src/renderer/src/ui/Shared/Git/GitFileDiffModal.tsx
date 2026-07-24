import { Modal } from '@harborclient/sdk/components';
import { useId, type JSX } from 'react';
import type { GitRequestDiffFileEntry } from '#/shared/types';
import { GitDiffFileView } from '#/renderer/src/ui/Sidebars/GitSidebar/modals/GitDiffFileView';

interface Props {
  /**
   * Modal title shown in the dialog header.
   */
  title: string;

  /**
   * Closes the diff modal.
   */
  onClose: () => void;

  /**
   * Changed file entry to render when diff loading has finished.
   */
  file: GitRequestDiffFileEntry | null;

  /**
   * True while an async diff request is in flight.
   */
  loading?: boolean;

  /**
   * Error message when diff loading failed.
   */
  error?: string | null;
}

/**
 * Large modal wrapper for one git file diff with optional async loading states.
 */
export function GitFileDiffModal({
  title,
  onClose,
  file,
  loading = false,
  error = null
}: Props): JSX.Element {
  const titleId = useId();

  return (
    <Modal
      onClose={onClose}
      className="flex w-[80vw] max-w-[calc(100vw-2rem)] max-h-[85vh] flex-col"
      labelledBy={titleId}
      title={title}
    >
      {loading ? (
        <p className="text-muted" role="status">
          Loading file diff…
        </p>
      ) : error != null ? (
        <p className="text-danger" role="alert">
          {error}
        </p>
      ) : file != null ? (
        <GitDiffFileView file={file} />
      ) : (
        <p className="text-muted" role="status">
          File diff unavailable.
        </p>
      )}
    </Modal>
  );
}
