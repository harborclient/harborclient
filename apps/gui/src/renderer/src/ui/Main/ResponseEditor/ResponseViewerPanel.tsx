import type { JSX } from 'react';
import type {
  ScriptExecutionEvent,
  ScriptRunError,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';
import { Body } from './Body';
import { Console } from './Console';
import { Headers } from './Headers';
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
  scriptLogs: string[];

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
   * Request tab that owns this response; preferred for jump-to-editor.
   */
  requestTabId?: string;
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
  requestTabId
}: Props): JSX.Element {
  switch (viewerTab) {
    case 'body':
      return <Body response={response} />;
    case 'preview':
      return <Preview response={response} requestUrl={requestUrl} />;
    case 'headers':
      return <Headers headers={response.headers} />;
    case 'timing':
      return <Timing response={response} />;
    case 'console':
      return (
        <Console
          response={response}
          scriptLogs={scriptLogs}
          testResults={testResults}
          executionEvents={executionEvents}
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
