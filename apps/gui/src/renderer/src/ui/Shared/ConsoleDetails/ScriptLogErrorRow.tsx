import type { JSX, MouseEvent } from 'react';
import type { ScriptRunError } from '@harborclient/core/types';
import { CopyToChatButton } from '@harborclient/sdk/components';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppStore } from '#/renderer/src/store/hooks';
import {
  canCopyScriptErrorToChat,
  copyScriptErrorToChat
} from '#/renderer/src/scripting/copyScriptFailureToChat';
import {
  canOpenScriptErrorInEditor,
  openScriptErrorInEditor
} from '#/renderer/src/scripting/openScriptErrorInEditor';
import { scriptRowIconButtonClass } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Structured script failure to render.
   */
  error: ScriptRunError;

  /**
   * Request tab that produced this error; preferred when resolving jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Builds a short accessible name for a navigable script error source link.
 *
 * @param error - Script failure being rendered.
 * @returns Label for the source button.
 */
function scriptLogErrorSourceAccessibleName(error: ScriptRunError): string {
  const name = error.scriptName?.trim() || 'script';
  const location =
    error.line != null
      ? ` at line ${error.line}${error.column != null ? `:${error.column}` : ''}`
      : '';
  return `Open script error in ${name}${location}`;
}

/**
 * One DevTools-style script error row for the Logs tab / footer console Logs section.
 *
 * Message stays on the left; the script name is a right-aligned source link when
 * jump-to-editor is available.
 */
export function ScriptLogErrorRow({ error, requestTabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const navigable = canOpenScriptErrorInEditor(error);
  const canCopy = aiAvailable && canCopyScriptErrorToChat(error);
  const scriptLabel = error.scriptName?.trim() || 'script';

  /**
   * Stops the row click handler from also opening the editor when Copy to chat is used.
   *
   * @param event - Click event from the Copy to chat control.
   */
  const handleCopyClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * Copies the script error into the AI chat composer without opening the editor.
   */
  const handleCopyToChat = (): void => {
    void copyScriptErrorToChat(dispatch, store.getState, error, requestTabId, aiSettings);
  };

  const copyButton = canCopy ? (
    <CopyToChatButton
      appearance="icon"
      className={scriptRowIconButtonClass}
      aria-label={`Copy script error from ${scriptLabel} to chat`}
      onClick={handleCopyClick}
      onSelect={handleCopyToChat}
    />
  ) : null;

  const source = navigable ? (
    <button
      type="button"
      aria-label={scriptLogErrorSourceAccessibleName(error)}
      className="shrink-0 cursor-pointer text-right text-[14px] text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
      onClick={() => {
        openScriptErrorInEditor(dispatch, store.getState, error, requestTabId);
      }}
    >
      {scriptLabel}
    </button>
  ) : (
    <span className="shrink-0 text-right text-[14px] text-muted">{scriptLabel}</span>
  );

  return (
    <div className="flex items-start gap-3 border-b border-separator bg-danger/10 px-2.5 py-1.5 text-danger last:border-b-0">
      <pre className="m-0 min-w-0 flex-1 overflow-x-auto font-mono text-[14px] whitespace-pre-wrap break-words">
        {error.message}
      </pre>
      <div className="flex shrink-0 items-start gap-1">
        {copyButton}
        {source}
      </div>
    </div>
  );
}
