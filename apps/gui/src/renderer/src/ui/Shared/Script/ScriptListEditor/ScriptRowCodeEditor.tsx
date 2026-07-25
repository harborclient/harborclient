import { CodeEditor } from '@harborclient/sdk/components';
import type { ComponentProps, JSX } from 'react';
import { usePersistedScriptEditorUiState } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import {
  buildRevealDiagnostics,
  type RevealDiagnosticCopyToChat
} from '#/renderer/src/scripting/buildRevealDiagnostics';
import { lineColToSelection } from '#/renderer/src/scripting/lineColToSelection';
import { SCRIPT_EDITOR_MIN_HEIGHT } from './constants';

type Props = {
  /**
   * Stable script row id used to persist editor height.
   */
  scriptId: string;

  /**
   * Optional 1-based line to reveal when opening from a test failure.
   */
  revealLine?: number;

  /**
   * Optional 1-based column for the reveal selection.
   */
  revealColumn?: number;

  /**
   * Assertion failure or script error message shown as a CodeMirror error underline.
   */
  revealMessage?: string;

  /**
   * Marker origin: `test` for assertion failures, `script` for runtime/compile errors.
   */
  revealSource?: 'test' | 'script';

  /**
   * When set with {@link revealMessage}, adds Copy to chat to the lint error tooltip.
   */
  copyRevealToChat?: RevealDiagnosticCopyToChat;
} & Omit<
  ComponentProps<typeof CodeEditor>,
  | 'height'
  | 'minHeight'
  | 'onHeightChange'
  | 'initialScrollTop'
  | 'initialSelection'
  | 'onViewStateChange'
  | 'diagnostics'
>;

/**
 * CodeEditor wrapper that restores and persists height, scroll, and selection per script row.
 *
 * When reveal line/column props are set (from a test-result jump), those override the
 * persisted selection for this mount so the failure line is selected immediately. When
 * {@link revealMessage} is also set, an error underline is shown over the same span.
 */
export function ScriptRowCodeEditor({
  scriptId,
  revealLine,
  revealColumn,
  revealMessage,
  revealSource,
  copyRevealToChat,
  value,
  ...props
}: Props): JSX.Element {
  const { height, onHeightChange, initialScrollTop, initialSelection, onViewStateChange } =
    usePersistedScriptEditorUiState(scriptId, SCRIPT_EDITOR_MIN_HEIGHT);

  const source = typeof value === 'string' ? value : '';
  const revealSelection =
    revealLine != null && Number.isFinite(revealLine)
      ? lineColToSelection(source, revealLine, revealColumn)
      : null;
  const revealDiagnostics = buildRevealDiagnostics(
    source,
    revealLine,
    revealColumn,
    revealMessage,
    revealSource,
    copyRevealToChat
  );

  return (
    <CodeEditor
      {...props}
      value={value}
      minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
      height={height}
      onHeightChange={onHeightChange}
      initialScrollTop={revealSelection ? Math.max(0, (revealLine! - 1) * 18) : initialScrollTop}
      initialSelection={revealSelection ?? initialSelection}
      diagnostics={revealDiagnostics}
      onViewStateChange={onViewStateChange}
    />
  );
}
