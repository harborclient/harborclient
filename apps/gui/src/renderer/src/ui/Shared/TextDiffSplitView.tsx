import { presentableDiff, type Change } from '@codemirror/merge';
import { EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { ResizeHandle, useResizable, type CodeEditorLanguage } from '@harborclient/sdk/components';
import { useCallback, useEffect, useLayoutEffect, useRef, type JSX } from 'react';
import { createGitDiffMergeExtensions } from '#/renderer/src/git/gitDiffMergeExtensions';

/** Minimum width in pixels for either Diff pane. */
const MIN_PANE_WIDTH = 160;

/** Width of the vertical resize handle (`w-1.5` ≈ 6px). */
const HANDLE_WIDTH = 6;

/** Fallback left-pane width before the container has been measured. */
const DEFAULT_LEFT_WIDTH = 400;

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
   * Accessible name for the split Diff group.
   */
  ariaLabel: string;
}

/**
 * Line decoration for deleted content on the previous (left) pane.
 */
const deletedLine = Decoration.line({ class: 'cm-textDiff-deletedLine' });

/**
 * Line decoration for inserted content on the current (right) pane.
 */
const insertedLine = Decoration.line({ class: 'cm-textDiff-insertedLine' });

/**
 * Inline mark for deleted text ranges on the previous pane.
 */
const deletedText = Decoration.mark({ class: 'cm-textDiff-deletedText' });

/**
 * Inline mark for inserted text ranges on the current pane.
 */
const insertedText = Decoration.mark({ class: 'cm-textDiff-insertedText' });

/**
 * Builds line and inline decorations for one side of a presentable Diff.
 *
 * @param doc - Document text for the pane.
 * @param changes - Character-range Diff from {@link presentableDiff}.
 * @param side - Which Diff side this pane represents (`a` = previous, `b` = current).
 * @returns CodeMirror decoration extension for the pane.
 */
function createDiffDecorationExtension(
  doc: string,
  changes: readonly Change[],
  side: 'a' | 'b'
): Extension {
  const state = EditorState.create({ doc });
  const ranges = [];
  const lineDeco = side === 'a' ? deletedLine : insertedLine;
  const textDeco = side === 'a' ? deletedText : insertedText;
  const decoratedLines = new Set<number>();

  for (const change of changes) {
    const from = side === 'a' ? change.fromA : change.fromB;
    const to = side === 'a' ? change.toA : change.toB;
    if (from >= to) {
      continue;
    }

    const clampedTo = Math.min(to, state.doc.length);
    if (from < clampedTo) {
      ranges.push(textDeco.range(from, clampedTo));
    }

    let pos = from;
    while (pos < to && pos <= state.doc.length) {
      const line = state.doc.lineAt(Math.min(pos, state.doc.length));
      if (!decoratedLines.has(line.number)) {
        decoratedLines.add(line.number);
        ranges.push(lineDeco.range(line.from));
      }
      if (line.to >= state.doc.length) {
        break;
      }
      pos = line.to + 1;
    }
  }

  return EditorView.decorations.of(Decoration.set(ranges, true));
}

/**
 * Mounts a read-only CodeMirror editor into a parent element.
 *
 * @param parent - DOM node that hosts the editor.
 * @param doc - Initial document text.
 * @param extensions - Editor extensions including language and Diff decorations.
 * @returns The created editor view.
 */
function mountEditor(parent: HTMLElement, doc: string, extensions: Extension[]): EditorView {
  parent.replaceChildren();
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions
    })
  });
}

/**
 * Wires one-way vertical scroll sync from a source editor to a target editor.
 *
 * @param source - Editor whose scroll position is mirrored.
 * @param target - Editor that receives the mirrored scrollTop.
 * @param syncingRef - Shared re-entrancy guard shared by both directions.
 * @returns Cleanup that removes the scroll listener.
 */
function bindScrollSync(
  source: EditorView,
  target: EditorView,
  syncingRef: { current: boolean }
): () => void {
  /**
   * Copies vertical scroll from the source scroller to the target.
   */
  const handleScroll = (): void => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    target.scrollDOM.scrollTop = source.scrollDOM.scrollTop;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  source.scrollDOM.addEventListener('scroll', handleScroll);
  return () => {
    source.scrollDOM.removeEventListener('scroll', handleScroll);
  };
}

/**
 * Side-by-side read-only Diff editors with a resizable vertical divider.
 *
 * Uses {@link presentableDiff} decorations instead of CodeMirror's fixed-width
 * {@link MergeView} so the left pane width can be dragged freely.
 */
export function TextDiffSplitView({
  previous,
  current,
  language,
  previousLabel = 'Previous content',
  currentLabel = 'Current content',
  ariaLabel
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftHostRef = useRef<HTMLDivElement | null>(null);
  const rightHostRef = useRef<HTMLDivElement | null>(null);
  const leftViewRef = useRef<EditorView | null>(null);
  const rightViewRef = useRef<EditorView | null>(null);
  const syncingScrollRef = useRef(false);
  const containerWidthRef = useRef(0);
  const leftWidthRef = useRef(DEFAULT_LEFT_WIDTH);
  const seededSplitRef = useRef(false);

  /**
   * Returns the maximum left-pane width that still leaves room for the right pane.
   */
  const getMaxLeftWidth = useCallback((): number => {
    const width = containerWidthRef.current;
    if (width <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(MIN_PANE_WIDTH, width - MIN_PANE_WIDTH - HANDLE_WIDTH);
  }, []);

  const {
    size: leftWidth,
    minSize,
    maxSize,
    setSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: DEFAULT_LEFT_WIDTH,
    minSize: MIN_PANE_WIDTH,
    getMaxSize: getMaxLeftWidth
  });

  /**
   * Keeps a ref of the left pane width for ResizeObserver clamping.
   */
  useEffect(() => {
    leftWidthRef.current = leftWidth;
  }, [leftWidth]);

  /**
   * Tracks container width and seeds the left pane to ~50% on first measure.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    /**
     * Updates the measured container width and clamps the left pane.
     */
    const updateWidth = (): void => {
      const width = container.clientWidth;
      containerWidthRef.current = width;
      if (width <= 0) {
        return;
      }
      const maxLeft = Math.max(MIN_PANE_WIDTH, width - MIN_PANE_WIDTH - HANDLE_WIDTH);
      if (!seededSplitRef.current) {
        seededSplitRef.current = true;
        const nextWidth = Math.floor((width - HANDLE_WIDTH) / 2);
        leftWidthRef.current = nextWidth;
        setSize(nextWidth);
        return;
      }
      if (leftWidthRef.current > maxLeft) {
        leftWidthRef.current = maxLeft;
        setSize(maxLeft);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [setSize]);

  /**
   * Creates or replaces both editors when Diff documents or language change.
   */
  useEffect(() => {
    const leftHost = leftHostRef.current;
    const rightHost = rightHostRef.current;
    if (leftHost == null || rightHost == null) {
      return;
    }

    const changes = presentableDiff(previous, current);
    const leftView = mountEditor(leftHost, previous, [
      ...createGitDiffMergeExtensions(language, previousLabel),
      createDiffDecorationExtension(previous, changes, 'a'),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]);
    const rightView = mountEditor(rightHost, current, [
      ...createGitDiffMergeExtensions(language, currentLabel),
      createDiffDecorationExtension(current, changes, 'b'),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]);

    leftViewRef.current = leftView;
    rightViewRef.current = rightView;

    const unbindLeft = bindScrollSync(leftView, rightView, syncingScrollRef);
    const unbindRight = bindScrollSync(rightView, leftView, syncingScrollRef);

    return () => {
      unbindLeft();
      unbindRight();
      leftView.destroy();
      rightView.destroy();
      leftViewRef.current = null;
      rightViewRef.current = null;
    };
  }, [current, currentLabel, language, previous, previousLabel]);

  /**
   * Remeasures editors when the split width or container size changes.
   */
  useEffect(() => {
    leftViewRef.current?.requestMeasure();
    rightViewRef.current?.requestMeasure();
  }, [leftWidth]);

  return (
    <div
      ref={containerRef}
      className="text-diff-split-view flex min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-separator"
      role="group"
      aria-label={ariaLabel}
    >
      <div
        className="text-diff-split-view-pane flex min-h-0 shrink-0 flex-col overflow-hidden"
        style={{ width: leftWidth }}
      >
        <div
          ref={leftHostRef}
          className="text-diff-split-view-editor min-h-0 flex-1 overflow-hidden"
        />
      </div>
      <ResizeHandle
        orientation="vertical"
        value={leftWidth}
        min={minSize}
        max={Number.isFinite(maxSize) ? maxSize : leftWidth + MIN_PANE_WIDTH}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize Diff panes"
      />
      <div className="text-diff-split-view-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          ref={rightHostRef}
          className="text-diff-split-view-editor min-h-0 flex-1 overflow-hidden"
        />
      </div>
    </div>
  );
}
