import { CopyToChatButton } from '@harborclient/sdk/components';
import type { SendResult } from '@harborclient/http';
import type {
  ScriptExecutionEvent,
  ScriptRunError,
  ScriptTestResult
} from '@harborclient/core/types';
import { useCallback, type JSX } from 'react';
import {
  AI_RESPONSE_SECTION_LABELS,
  type AiResponseSection
} from '@harborclient/core/ai/scriptReferences';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useCopyToChat } from '#/renderer/src/hooks/useCopyToChat';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setResponseSelection } from '#/renderer/src/store/slices/responseSelectionsSlice';
import { buildResponseSectionReference } from './responseSectionReference';

interface Props {
  /**
   * Which response-viewer section to copy into chat.
   */
  section: AiResponseSection;

  /**
   * UUID of the owning request tab (used in the `@res` token).
   */
  requestTabId: string;

  /**
   * Display name of the request at capture time.
   */
  requestName: string;

  /**
   * Latest HTTP send result shown in the viewer.
   */
  response: SendResult;

  /**
   * hc.test results from the last send (console / tests sections).
   */
  testResults?: ScriptTestResult[];

  /**
   * Console log lines from scripts for the last send.
   */
  scriptLogs?: string[];

  /**
   * Ordered variable and flow-control activity from scripts.
   */
  executionEvents?: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime error message, when present.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata.
   */
  scriptErrors?: ScriptRunError[];
}

/**
 * Page-header wand action that opens AI chat with an `@res` response-section badge.
 */
export function ResponseViewerCopyToChatActions({
  section,
  requestTabId,
  requestName,
  response,
  testResults,
  scriptLogs,
  executionEvents,
  scriptError,
  scriptErrors
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const { aiAvailable } = useAiAvailability();
  const { copyToChat } = useCopyToChat();
  const sectionLabel = AI_RESPONSE_SECTION_LABELS[section];

  /**
   * Captures the section snapshot, opens the AI sidebar, and inserts the `@res` token.
   */
  const handleCopyToChat = useCallback((): void => {
    const { token, snapshot } = buildResponseSectionReference({
      requestTabId,
      requestName,
      section,
      response,
      testResults,
      scriptLogs,
      executionEvents,
      scriptError,
      scriptErrors
    });
    dispatch(setResponseSelection({ token, snapshot }));
    void copyToChat(token);
  }, [
    copyToChat,
    dispatch,
    executionEvents,
    requestName,
    requestTabId,
    response,
    scriptError,
    scriptErrors,
    scriptLogs,
    section,
    testResults
  ]);

  if (!aiAvailable) {
    return null;
  }

  return (
    <CopyToChatButton
      appearance="icon"
      aria-label={`Copy ${sectionLabel.toLowerCase()} to chat`}
      title={`Copy ${sectionLabel.toLowerCase()} to chat`}
      className="inline-flex shrink-0 items-center justify-center"
      onSelect={handleCopyToChat}
    />
  );
}
