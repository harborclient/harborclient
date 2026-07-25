import { ControlledAccordion } from '@szhsin/react-accordion';
import type { JSX } from 'react';
import type { ScriptExecutionEvent, ScriptTestResult, SendResult } from '@harborclient/core/types';

import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { CollapsibleSection } from './CollapsibleSection';
import { usePersistedConsoleSectionExpansion } from './usePersistedConsoleSectionExpansion';
import { KeyValueTable, type KeyValueRow } from './KeyValueTable';
import { OutputDetails } from './OutputDetails';
import { TraceDetails } from './TraceDetails';

interface Props {
  /**
   * When true, section headers extend edge-to-edge by canceling typical parent
   * horizontal padding (for example ResponseEditor's `p-3`).
   */
  flush?: boolean;

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
   * Ordered variable and flow-control activity captured from scripts for this send.
   */
  executionEvents?: readonly ScriptExecutionEvent[];

  /**
   * Aggregated script runtime errors for this send.
   */
  scriptError?: string;
}

/**
 * Renders reusable request/response console details for footer rows and response tabs.
 */
export function ConsoleDetails({
  flush = false,
  result,
  logs = [],
  tests = [],
  executionEvents = [],
  scriptError
}: Props): JSX.Element {
  const { sections, accordion } = usePersistedConsoleSectionExpansion();
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
        <CollapsibleSection
          itemKey="general"
          title="General"
          initialEntered={sections.general}
          flush={flush}
        >
          <KeyValueTable rows={generalRows} />
        </CollapsibleSection>
        <CollapsibleSection
          itemKey="request"
          title="Request"
          initialEntered={sections.request}
          flush={flush}
        >
          <KeyValueTable rows={requestHeaderRows} emptyMessage="No headers" />
        </CollapsibleSection>
        <CollapsibleSection
          itemKey="response"
          title="Response"
          initialEntered={sections.response}
          flush={flush}
        >
          <KeyValueTable rows={responseHeaderRows} emptyMessage="No headers" />
        </CollapsibleSection>
        <CollapsibleSection
          itemKey="output"
          title="Logs"
          initialEntered={sections.output}
          flush={flush}
        >
          <OutputDetails logs={logs} tests={tests} scriptError={scriptError} />
        </CollapsibleSection>
        <CollapsibleSection
          itemKey="trace"
          title="Trace"
          initialEntered={sections.trace}
          flush={flush}
        >
          <TraceDetails executionEvents={executionEvents} />
        </CollapsibleSection>
      </ControlledAccordion>
    </div>
  );
}
