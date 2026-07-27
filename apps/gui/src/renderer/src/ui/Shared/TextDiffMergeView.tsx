import { MergeView } from '@codemirror/merge';
import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import { useEffect, useRef, type JSX } from 'react';
import { createGitDiffMergeExtensions } from '#/renderer/src/git/gitDiffMergeExtensions';

interface Props {
  /**
   * Left-pane document (previous revision).
   */
  previous: string;

  /**
   * Right-pane document (current revision).
   */
  current: string;

  /**
   * Syntax mode for both panes.
   */
  language: CodeEditorLanguage;

  /**
   * Accessible name for the previous pane.
   */
  previousLabel?: string;

  /**
   * Accessible name for the current pane.
   */
  currentLabel?: string;

  /**
   * Accessible name for the merge view group.
   */
  ariaLabel: string;

  /**
   * When true, stretches to fill remaining modal height instead of the capped default.
   */
  fillHeight?: boolean;
}

/**
 * Requests a CodeMirror layout pass after the merge container resizes.
 *
 * @param mergeView - Active merge view instance.
 */
function remeasureMergeView(mergeView: MergeView): void {
  mergeView.a.requestMeasure();
  mergeView.b.requestMeasure();
}

/**
 * Mounts a side-by-side, syntax-highlighted CodeMirror merge view for plain text.
 */
export function TextDiffMergeView({
  previous,
  current,
  language,
  previousLabel = 'Previous content',
  currentLabel = 'Current content',
  ariaLabel,
  fillHeight = false
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  /**
   * Creates or updates the MergeView when document content or language changes.
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
        extensions: createGitDiffMergeExtensions(language, previousLabel)
      },
      b: {
        doc: current,
        extensions: createGitDiffMergeExtensions(language, currentLabel)
      },
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      highlightChanges: true
    });

    mergeViewRef.current = mergeView;
    if (fillHeight) {
      remeasureMergeView(mergeView);
    }

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
  }, [current, currentLabel, fillHeight, language, previous, previousLabel]);

  /**
   * Keeps CodeMirror layout in sync when the fill-height container is resized.
   */
  useEffect(() => {
    const parent = containerRef.current;
    const mergeView = mergeViewRef.current;
    if (!fillHeight || parent == null || mergeView == null) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const activeMergeView = mergeViewRef.current;
      if (activeMergeView != null) {
        remeasureMergeView(activeMergeView);
      }
    });

    observer.observe(parent);
    remeasureMergeView(mergeView);

    return () => {
      observer.disconnect();
    };
  }, [fillHeight]);

  const sizeClass = fillHeight
    ? 'git-diff-merge-view git-diff-merge-view--fill min-h-0 flex-1 max-h-none overflow-hidden rounded border border-separator'
    : 'git-diff-merge-view min-h-[12rem] max-h-[min(50vh,32rem)] overflow-hidden rounded border border-separator';

  return <div ref={containerRef} className={sizeClass} role="group" aria-label={ariaLabel} />;
}
