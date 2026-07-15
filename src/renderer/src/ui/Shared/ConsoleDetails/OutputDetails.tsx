import type { JSX } from 'react';
import type { ScriptTestResult } from '#/shared/types';
import { StatusDot } from '@harborclient/sdk/components';

interface Props {
  /**
   * Console output captured from script console.log/console.error calls.
   */
  logs: readonly string[];

  /**
   * hc.test assertion results captured while scripts ran.
   */
  tests: readonly ScriptTestResult[];

  /**
   * Aggregated script runtime errors for this send.
   */
  scriptError?: string;
}

/**
 * Renders script output, test results, and runtime errors for a single send.
 */
export function OutputDetails({ logs, tests, scriptError }: Props): JSX.Element {
  const hasOutput = logs.length > 0 || tests.length > 0 || Boolean(scriptError);

  if (!hasOutput) {
    return <div className="px-2.5 py-2 text-center text-[14px] text-muted">No output</div>;
  }

  return (
    <div className="flex flex-col gap-2 px-2.5 py-2">
      {scriptError && (
        <div className="whitespace-pre-wrap rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger">
          {scriptError}
        </div>
      )}
      {logs.length > 0 && (
        <pre className="m-0 overflow-auto rounded-md border border-separator bg-control px-2.5 py-2 font-mono text-[14px] text-text whitespace-pre-wrap">
          {logs.join('\n')}
        </pre>
      )}
      {tests.length > 0 && (
        <div className="overflow-hidden rounded-md border border-separator">
          {tests.map((test, index) => (
            <div
              key={`${test.name}-${index}`}
              className={`flex items-center gap-2 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
            >
              <StatusDot
                variant={test.passed ? 'success' : 'danger'}
                label={test.passed ? 'Passed' : 'Failed'}
              />
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
      )}
    </div>
  );
}
