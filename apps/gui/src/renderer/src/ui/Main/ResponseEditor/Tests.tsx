import type { JSX } from 'react';
import type { ScriptTestResult } from '@harborclient/core/types';
import { TestResultsTable } from '#/renderer/src/ui/Shared/TestResultsTable';

interface Props {
  /**
   * hc.test assertion results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Script test results table for the Tests tab.
 */
export function Tests({ testResults, requestTabId }: Props): JSX.Element {
  return <TestResultsTable testResults={testResults} requestTabId={requestTabId} />;
}
