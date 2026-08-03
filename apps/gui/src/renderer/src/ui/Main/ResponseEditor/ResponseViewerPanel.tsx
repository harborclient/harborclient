import type { JSX } from 'react';
import type {
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptRunError,
  ScriptTestResult,
  SendResult,
  SseEvent
} from '@harborclient/core/types';
import { Body } from './Body';
import { Console } from './Console';
import { Events } from './Events';
import { SseRaw } from './Events/SseRaw';
import { Headers } from './Headers';
import { Logs } from './Logs';
import { Preview } from './Preview';
import { Redirects } from './Redirects';
import { Tests } from './Tests';
import { Timing } from './Timing';
import type { ResponseViewerTab } from './responseViewerTabs';

interface Props {
  /**
   * Which built-in response viewer sub-tab to render.
   */
  viewerTab: ResponseViewerTab;

  /**
   * HTTP send result to display.
   */
  response: SendResult;

  /**
   * URL of the active request, used to resolve relative assets in HTML preview.
   */
  requestUrl: string;

  /**
   * hc.test results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];

  /**
   * Console output captured from scripts for the last send.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Ordered variable and flow-control activity from scripts for the last send.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Request tab that owns this response; preferred for jump-to-editor and Copy to chat.
   */
  requestTabId?: string;

  /**
   * Display name of the request at capture time for response-body Copy to chat.
   */
  requestName?: string;

  /**
   * When true, Body stretches its CodeEditor to fill remaining height
   * (full-page response viewer). Ignored for non-body tabs.
   */
  fillHeight?: boolean;

  /**
   * SSE events for Events/Raw tabs; empty when viewing a buffered HTTP response.
   */
  sseEvents?: SseEvent[];
}

/**
 * Renders one built-in response viewer sub-tab for the editor or a full page.
 */
export function ResponseViewerPanel({
  viewerTab,
  response,
  requestUrl,
  testResults,
  scriptLogs,
  executionEvents,
  scriptError,
  scriptErrors,
  requestTabId,
  requestName,
  fillHeight = false,
  sseEvents = []
}: Props): JSX.Element {
  switch (viewerTab) {
    case 'body':
      return (
        <Body
          response={response}
          fillHeight={fillHeight}
          requestTabId={requestTabId}
          requestName={requestName}
        />
      );
    case 'events':
      return <Events events={sseEvents} />;
    case 'raw':
      return <SseRaw events={sseEvents} />;
    case 'preview':
      return <Preview response={response} requestUrl={requestUrl} />;
    case 'headers':
      return (
        <Headers
          headers={response.headers}
          requestName={requestName}
          status={response.status}
          statusText={response.statusText}
          error={response.error}
        />
      );
    case 'timing':
      return <Timing response={response} requestName={requestName} />;
    case 'console':
      return (
        <Console
          response={response}
          executionEvents={executionEvents}
          requestTabId={requestTabId}
        />
      );
    case 'logs':
      return (
        <Logs
          scriptLogs={scriptLogs}
          scriptError={scriptError}
          scriptErrors={scriptErrors}
          requestTabId={requestTabId}
        />
      );
    case 'redirects':
      return <Redirects redirects={response.redirects ?? []} />;
    case 'tests':
      return <Tests testResults={testResults} requestTabId={requestTabId} />;
  }
}
