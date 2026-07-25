import type { JSX } from 'react';
import type { ScriptTestResult } from '@harborclient/core/types';
import { Table, TableBody, TableHead, TableHeader } from '@harborclient/sdk/components';
import { TestResultTableRow } from './TestResultTableRow';

interface Props {
  /**
   * hc.test assertion results from pre/post scripts for the last send.
   */
  testResults: readonly ScriptTestResult[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Bordered Test | Error | Expected | Time table for script assertion results.
 *
 * Matches the Headers key/value editor shell (SDK Table, fat p-3 cells, 14px
 * uppercase headers, 16px inherited body text) for the Tests tab and console Logs.
 * Pass/fail status is shown as a StatusDot at the start of the Test cell.
 */
export function TestResultsTable({ testResults, requestTabId }: Props): JSX.Element {
  return (
    <Table className="hc-test-results-table mt-4">
      <TableHeader>
        <tr>
          <TableHead>Test</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead className="w-24 text-right">Time</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {testResults.map((test, index) => (
          <TestResultTableRow
            key={`${test.scriptId ?? test.scriptName ?? 'script'}-${test.name}-${index}`}
            test={test}
            requestTabId={requestTabId}
          />
        ))}
      </TableBody>
    </Table>
  );
}
