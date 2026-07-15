import { MergeView } from '@codemirror/merge';
import { useEffect, useMemo, useRef, type JSX } from 'react';
import type { GitRequestDiffFileEntry } from '#/shared/types';
import { createGitDiffMergeExtensionsForPath } from '#/renderer/src/git/gitDiffMergeExtensions';
import { parseGitDiffFileSides } from '#/renderer/src/git/parseGitDiffFile';

interface Props {
  /**
   * Changed file entry from a git diff IPC payload.
   */
  file: GitRequestDiffFileEntry;
}

/**
 * Renders one changed file path and status summary above the diff panes.
 *
 * @param file - Changed file entry to summarize.
 */
function GitDiffFileSummary({ file }: { file: GitRequestDiffFileEntry }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-[14px] font-medium text-text">
        {file.status}: {file.path}
        {file.binary ? ' (binary)' : ''}
      </p>
      {file.renamedFrom != null ? (
        <p className="m-0 text-[14px] text-muted">Renamed from {file.renamedFrom}</p>
      ) : null}
      {file.truncated ? (
        <p className="m-0 text-[14px] text-muted" role="status">
          Diff truncated; showing an excerpt of this file.
        </p>
      ) : null}
    </div>
  );
}

interface GitDiffMergeViewProps {
  /**
   * Changed file entry providing the path and diff excerpt.
   */
  file: GitRequestDiffFileEntry;

  /**
   * Text at HEAD (previous revision).
   */
  previous: string;

  /**
   * Text in the working tree or index (current revision).
   */
  current: string;
}

/**
 * Mounts a side-by-side, syntax-highlighted CodeMirror merge view for one file.
 */
function GitDiffMergeView({ file, previous, current }: GitDiffMergeViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Creates or updates the MergeView when file content or syntax mode changes.
   */
  useEffect(() => {
    const parent = containerRef.current;
    if (parent == null) {
      return;
    }

    const mergeView = new MergeView({
      parent,
      a: {
        doc: previous,
        extensions: createGitDiffMergeExtensionsForPath(file.path, 'Previous content')
      },
      b: {
        doc: current,
        extensions: createGitDiffMergeExtensionsForPath(file.path, 'Current content')
      },
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      highlightChanges: true
    });

    return () => {
      mergeView.destroy();
    };
  }, [current, file.path, previous]);

  return (
    <div
      ref={containerRef}
      className="git-diff-merge-view min-h-[12rem] max-h-[min(50vh,32rem)] overflow-hidden rounded border border-separator"
      role="group"
      aria-label={`Side-by-side diff for ${file.path}`}
    />
  );
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
