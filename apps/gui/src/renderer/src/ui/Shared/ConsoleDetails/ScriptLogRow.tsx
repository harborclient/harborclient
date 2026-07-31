import type { JSX } from 'react';
import type { ScriptLogEntry } from '@harborclient/core/types';
import { useAppDispatch, useAppStore } from '#/renderer/src/store/hooks';
import {
  canOpenScriptLogInEditor,
  openScriptLogInEditor
} from '#/renderer/src/scripting/openScriptLogInEditor';
import { renderScriptConsoleEntryBody } from './scriptConsoleRenderRegistry';

interface Props {
  /**
   * Structured console line to render.
   */
  entry: ScriptLogEntry;

  /**
   * Request tab that produced this log; preferred when resolving jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Builds an accessible name for a navigable script log source link.
 *
 * @param entry - Log line being rendered.
 * @returns Label for the source button.
 */
function scriptLogSourceAccessibleName(entry: ScriptLogEntry): string {
  const name = entry.scriptName.trim() || 'script';
  return `Open ${name}`;
}

/**
 * One DevTools-style console log row: message body on the left, script source on the right.
 */
export function ScriptLogRow({ entry, requestTabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const navigable = canOpenScriptLogInEditor(entry);
  const scriptLabel = entry.scriptName.trim() || 'script';
  const isError = entry.level === 'error';
  const isWarn = entry.level === 'warn';

  const rowClass = isError
    ? 'border-b border-separator bg-danger/10 text-danger last:border-b-0'
    : isWarn
      ? 'border-b border-separator bg-warning/10 text-warning last:border-b-0'
      : 'border-b border-separator last:border-b-0';

  const source = navigable ? (
    <button
      type="button"
      aria-label={scriptLogSourceAccessibleName(entry)}
      className="shrink-0 cursor-pointer text-right text-[14px] text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
      onClick={() => {
        openScriptLogInEditor(dispatch, store.getState, entry, requestTabId);
      }}
    >
      {scriptLabel}
    </button>
  ) : (
    <span className="shrink-0 text-right text-[14px] text-muted">{scriptLabel}</span>
  );

  return (
    <div className={`flex items-start gap-3 px-2.5 py-1.5 ${rowClass}`}>
      {renderScriptConsoleEntryBody(entry)}
      {source}
    </div>
  );
}
