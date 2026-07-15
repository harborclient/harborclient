import { CodeEditor } from '@harborclient/sdk/components';
import type { ComponentProps, JSX } from 'react';
import { usePersistedScriptEditorUiState } from '#/renderer/src/hooks/usePersistedScriptEditorUiState';
import { SCRIPT_EDITOR_MIN_HEIGHT } from './constants';

type Props = {
  /**
   * Stable script row id used to persist editor height.
   */
  scriptId: string;
} & Omit<
  ComponentProps<typeof CodeEditor>,
  | 'height'
  | 'minHeight'
  | 'onHeightChange'
  | 'initialScrollTop'
  | 'initialSelection'
  | 'onViewStateChange'
>;

/**
 * CodeEditor wrapper that restores and persists height, scroll, and selection per script row.
 */
export function ScriptRowCodeEditor({ scriptId, ...props }: Props): JSX.Element {
  const { height, onHeightChange, initialScrollTop, initialSelection, onViewStateChange } =
    usePersistedScriptEditorUiState(scriptId, SCRIPT_EDITOR_MIN_HEIGHT);

  return (
    <CodeEditor
      {...props}
      minHeight={SCRIPT_EDITOR_MIN_HEIGHT}
      height={height}
      onHeightChange={onHeightChange}
      initialScrollTop={initialScrollTop}
      initialSelection={initialSelection}
      onViewStateChange={onViewStateChange}
    />
  );
}
