import { useMemo, type JSX } from 'react';
import type { GitRequestDiffFileEntry } from '#/shared/types';
import { parseGitDiffFileSides } from '#/renderer/src/git/parseGitDiffFile';
import { GitDiffFileSummary } from './GitDiffFileSummary';
import { GitDiffMergeView } from './GitDiffMergeView';

interface Props {
  /**
   * Changed file entry from a git diff IPC payload.
   */
  file: GitRequestDiffFileEntry;
}

/**
 * Side-by-side, syntax-highlighted viewer for one git diff file entry.
 */
export function GitDiffFileView({ file }: Props): JSX.Element {
  /**
   * Parsed previous/current file bodies for the merge view.
   */
  const sides = useMemo(() => parseGitDiffFileSides(file), [file]);

  if (file.binary) {
    return (
      <div className="flex flex-col gap-2">
        <GitDiffFileSummary file={file} />
        <p className="m-0 text-[14px] text-muted">Binary file; diff omitted.</p>
      </div>
    );
  }

  if (sides == null) {
    return (
      <div className="flex flex-col gap-2">
        <GitDiffFileSummary file={file} />
        <p className="m-0 text-[14px] text-muted">No textual diff available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <GitDiffFileSummary file={file} />
      <GitDiffMergeView file={file} previous={sides.previous} current={sides.current} />
    </div>
  );
}
