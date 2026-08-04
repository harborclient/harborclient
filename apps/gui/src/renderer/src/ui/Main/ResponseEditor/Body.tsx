import { useCallback, useMemo, type JSX } from 'react';
import {
  CodeEditor,
  COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
  type CodeEditorTextSelection
} from '@harborclient/sdk/components';
import type { SendResult } from '@harborclient/core/types';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setResponseSelection } from '#/renderer/src/store/slices/responseSelectionsSlice';
import {
  bodyLanguage,
  formatBody,
  isBinaryResponse,
  isImageResponse
} from '#/renderer/src/ui/Shared/responseFormatUtils';
import { buildResponseBodySelectionReference } from './responseSectionReference';

interface Props {
  /**
   * HTTP send result whose body is shown in the read-only editor.
   */
  response: SendResult;

  /**
   * When true, stretches the editor to fill remaining height in a flex column
   * (full-page response viewer). Leave false in the embedded response pane.
   */
  fillHeight?: boolean;

  /**
   * UUID of the owning request tab; required for Copy to chat `@res` tokens.
   */
  requestTabId?: string;

  /**
   * Display name of the request at capture time for the chat badge/context.
   */
  requestName?: string;
}

/**
 * Read-only pretty-printed response body for the Body viewer tab.
 *
 * Uses a read-only CodeEditor that stays contenteditable so keyboard users can
 * Tab into the viewer and see focus feedback. Non-image, non-binary responses
 * expose a Copy to chat selection toolbar when AI is available and a request tab
 * id is known. Binary bodies show base64 text.
 */
export function Body({
  response,
  fillHeight = false,
  requestTabId,
  requestName = 'Request'
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const { aiAvailable } = useAiAvailability();
  const { copyToChat } = useCopyToChat();
  const binary = isBinaryResponse(response) && !isImageResponse(response.headers);
  const formatted = binary ? (response.bodyBase64 ?? '') : formatBody(response.body);
  const displayValue = formatted || '(empty body)';
  const language = binary ? 'text' : bodyLanguage(response.body, response.headers);
  const allowCopyToChat =
    aiAvailable && requestTabId != null && !isImageResponse(response.headers) && !binary;

  /**
   * Captures the body selection snapshot, opens AI chat, and inserts the `@res` token.
   *
   * @param selection - Selected text and character offsets from the Body CodeEditor.
   */
  const handleCopySelectionToChat = useCallback(
    (selection: CodeEditorTextSelection): void => {
      if (requestTabId == null || selection.from >= selection.to || selection.text.length === 0) {
        return;
      }

      const { token, snapshot } = buildResponseBodySelectionReference({
        requestTabId,
        requestName,
        response,
        selectedText: selection.text,
        startOffset: selection.from,
        endOffset: selection.to
      });
      dispatch(setResponseSelection({ token, snapshot }));
      void copyToChat(token);
    },
    [copyToChat, dispatch, requestName, requestTabId, response]
  );

  /**
   * Selection toolbar actions for the response body CodeEditor when Copy to chat is available.
   */
  const copyToChatSelectionActions = useMemo(
    () =>
      allowCopyToChat
        ? [
            {
              id: 'copy-to-chat',
              ariaLabel: 'Copy selection from response body to chat',
              key: COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
              onSelect: (selection: CodeEditorTextSelection): void => {
                handleCopySelectionToChat(selection);
              }
            }
          ]
        : undefined,
    [allowCopyToChat, handleCopySelectionToChat]
  );

  return (
    <CodeEditor
      readOnly
      value={displayValue}
      language={language}
      minHeight={fillHeight ? '0' : undefined}
      className={fillHeight ? 'response-body-editor' : undefined}
      selectionActions={copyToChatSelectionActions}
      aria-label="Response body"
    />
  );
}
