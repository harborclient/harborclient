import type { JSX, MouseEvent } from 'react';
import type { ScriptRunError } from '@harborclient/core/types';
import { Button, FaIcon } from '@harborclient/sdk/components';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { COPY_TO_CHAT_ICON } from '#/renderer/src/hooks/useCopyToChat';
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
 * Builds a short accessible name for a navigable script error row.
 *
 * @param error - Script failure being rendered.
 * @returns Label for the row button.
 */
function scriptErrorAccessibleName(error: ScriptRunError): string {
  const name = error.scriptName?.trim() || 'script';
  const location =
    error.line != null
      ? ` at line ${error.line}${error.column != null ? `:${error.column}` : ''}`
      : '';
  return `Open script error in ${name}${location}`;
}

/**
 * One script runtime/compile failure row for the console Output section.
 *
 * Request-scoped rows with a script id open the script editor at the mapped
 * error line when activated. Collection/folder rows remain static text so the
 * failure is still visible without a jump target. Request-scoped rows also
 * offer Copy to chat when AI is available.
 */
export function ScriptErrorRow({ error, requestTabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const navigable = canOpenScriptErrorInEditor(error);
  const canCopy = aiAvailable && canCopyScriptErrorToChat(error);
  const scriptLabel = error.scriptName?.trim() || 'script';

  /**
   * Copies the script error into the AI chat composer without opening the editor.
   *
   * @param event - Click event from the Copy to chat control.
   */
  const handleCopyToChat = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    void copyScriptErrorToChat(dispatch, store.getState, error, requestTabId, aiSettings);
  };

  const copyButton = canCopy ? (
    <Button
      type="button"
      variant="icon"
      className={scriptRowIconButtonClass}
      aria-label={`Copy script error from ${scriptLabel} to chat`}
      onClick={handleCopyToChat}
    >
      <FaIcon icon={COPY_TO_CHAT_ICON} />
    </Button>
  ) : null;

  const content = (
    <>
      {error.scriptName?.trim() ? (
        <span className="font-medium">{error.scriptName.trim()}: </span>
      ) : null}
      <span>{error.message}</span>
    </>
  );

  if (!navigable) {
    return (
      <div className="flex items-start gap-2 whitespace-pre-wrap rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger">
        <div className="min-w-0 flex-1">{content}</div>
        {copyButton}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger hover:bg-danger/20 focus-within:bg-danger/20">
      <button
        type="button"
        aria-label={scriptErrorAccessibleName(error)}
        className="min-w-0 flex-1 cursor-pointer whitespace-pre-wrap text-left focus-visible:outline-none"
        onClick={() => {
          openScriptErrorInEditor(dispatch, store.getState, error, requestTabId);
        }}
      >
        {content}
      </button>
      {copyButton}
    </div>
  );
}
