import { ControlledAccordion, useAccordionProvider } from '@szhsin/react-accordion';
import type { JSX } from 'react';
import type { ScriptTestResult, SendResult } from '#/shared/types';

import { formatBytes } from '#/renderer/src/ui/shared/responseFormatUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { KeyValueTable, type KeyValueRow } from './KeyValueTable';

interface Props {
  /**
   * HTTP send result that provides the request and response metadata.
   */
  result: SendResult;

  /**
   * Console output captured from pre-request and post-response scripts.
   */
  logs?: readonly string[];

  /**
   * hc.test assertion results captured from scripts for this send.
   */
  tests?: readonly ScriptTestResult[];

  /**
   * Aggregated script runtime errors for this send.
   */
  scriptError?: string;
}

interface OutputDetailsProps {
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
 * Renders reusable request/response console details for footer rows and response tabs.
 */
export function ConsoleDetails({ result, logs = [], tests = [], scriptError }: Props): JSX.Element {
  const accordion = useAccordionProvider({
    allowMultiple: true,
    transition: true,
    transitionTimeout: 200,
    mountOnEnter: true
  });
  const generalRows: KeyValueRow[] = [
    { label: 'Request URL', value: result.request?.url ?? '-' },
    { label: 'Request Method', value: result.request?.method ?? '-' },
    {
      label: 'Status Code',
      value: result.error ? 'Error' : `${result.status} ${result.statusText}`
    },
    { label: 'Time', value: `${result.timeMs} ms` },
    { label: 'Size', value: formatBytes(result.sizeBytes) }
  ];
  const requestHeaderRows = Object.entries(result.request?.headers ?? {}).map(([label, value]) => ({
    label,
    value
  }));
  const responseHeaderRows = Object.entries(result.headers).map(([label, value]) => ({
    label,
    value
  }));

  return (
    <div className="flex flex-col">
      {result.error && (
        <div className="mb-2 rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger">
          {result.error}
        </div>
      )}

      <ControlledAccordion providerValue={accordion}>
        <CollapsibleSection itemKey="general" title="General" initialEntered>
          <KeyValueTable rows={generalRows} />
        </CollapsibleSection>
        <CollapsibleSection itemKey="request" title="Request" initialEntered>
          <KeyValueTable rows={requestHeaderRows} emptyMessage="No headers" />
        </CollapsibleSection>
        <CollapsibleSection itemKey="response" title="Response" initialEntered>
          <KeyValueTable rows={responseHeaderRows} emptyMessage="No headers" />
        </CollapsibleSection>
        <CollapsibleSection itemKey="output" title="Output" initialEntered>
          <OutputDetails logs={logs} tests={tests} scriptError={scriptError} />
        </CollapsibleSection>
      </ControlledAccordion>
    </div>
  );
}

/**
 * Renders script output, test results, and runtime errors for a single send.
 */
function OutputDetails({ logs, tests, scriptError }: OutputDetailsProps): JSX.Element {
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
      )}
    </div>
  );
}
