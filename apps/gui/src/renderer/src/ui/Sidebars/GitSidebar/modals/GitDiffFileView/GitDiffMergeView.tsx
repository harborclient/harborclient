import { MergeView } from '@codemirror/merge';
import { useEffect, useRef, type JSX } from 'react';
import type { GitRequestDiffFileEntry } from '#/shared/types';
import { createGitDiffMergeExtensionsForPath } from '#/renderer/src/git/gitDiffMergeExtensions';

interface Props {
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
export function GitDiffMergeView({ file, previous, current }: Props): JSX.Element {
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
