import type { JSX } from 'react';
import type { ScriptTestResult } from '#/shared/types';

interface Props {
  /**
   * hc.test assertion results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];
}

/**
 * Script test results list for the Tests tab.
 */
export function Tests({ testResults }: Props): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-separator">
      {testResults.map((test, index) => (
        <div
          key={`${test.name}-${index}`}
          className={`flex items-center gap-2 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
        >
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${test.passed ? 'bg-success' : 'bg-danger'}`}
            aria-hidden="true"
          />
          <span className="sr-only">{test.passed ? 'Passed' : 'Failed'}</span>
          {test.scriptName && (
            <>
              <span className="text-[14px] text-muted">{test.scriptName}</span>
              <span className="text-[14px] text-muted" aria-hidden="true">
                -
              </span>
            </>
          )}
          <span className="text-[14px] text-text">{test.name}</span>
          {!test.passed && test.error && (
            <span className="text-[14px] text-danger">{test.error}</span>
          )}
        </div>
      ))}
    </div>
  );
}
