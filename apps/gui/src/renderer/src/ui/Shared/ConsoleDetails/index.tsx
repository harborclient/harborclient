import { ControlledAccordion } from '@szhsin/react-accordion';
import type { JSX } from 'react';
import type { ScriptLogEntry, ScriptRunError, SendResult } from '@harborclient/core/types';

import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { ConsoleSelectionHost } from '#/renderer/src/ui/Main/ResponseEditor/consoleSelection/ConsoleSelectionHost';
import { CollapsibleSection } from './CollapsibleSection';
import { usePersistedConsoleSectionExpansion } from './usePersistedConsoleSectionExpansion';
import { KeyValueTable, type KeyValueRow } from './KeyValueTable';
import { ScriptLogsView } from './ScriptLogsView';

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
   *
   * When provided (footer console entries), a Logs accordion section is shown.
   * The response Console tab omits this prop; logs live on the Logs tab.
   * Execution traces appear as debug log lines in this list.
   */
  logs?: readonly ScriptLogEntry[];

  /**
   * Aggregated script runtime errors for this send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations; when
   * present, errors render as clickable jump-to-editor rows.
   */
  scriptErrors?: readonly ScriptRunError[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;

  /**
   * When true, include the Logs accordion section (footer console entries).
   * Defaults to true when `logs`, `scriptError`, or `scriptErrors` are passed.
   */
  showLogsSection?: boolean;
}

/**
 * Renders reusable request/response console details for footer rows and response tabs.
 */
export function ConsoleDetails({
  flush = false,
  result,
  logs = [],
  scriptError,
  scriptErrors,
  requestTabId,
  showLogsSection
}: Props): JSX.Element {
  const { sections, accordion } = usePersistedConsoleSectionExpansion();
  const includeLogs =
    showLogsSection ??
    (logs.length > 0 || Boolean(scriptError) || (scriptErrors != null && scriptErrors.length > 0));
  const generalRows: KeyValueRow[] = [
    { label: 'Request URL', value: result.request?.url ?? '-' },
    { label: 'Request Method', value: result.request?.method ?? '-' },
    {
      label: 'Status Code',
      value: result.error ? 'Error' : `${result.status} ${result.statusText}`
    },
    ...(result.error ? [{ label: 'Error', value: result.error }] : []),
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
    <ConsoleSelectionHost
      meta={{
        status: result.status,
        statusText: result.statusText,
        ...(result.error != null ? { error: result.error } : {})
      }}
    >
      <div className="flex flex-col">
        <ControlledAccordion providerValue={accordion}>
          <CollapsibleSection
            itemKey="general"
            title="General"
            initialEntered={sections.general}
            flush={flush}
          >
            <KeyValueTable section="general" rows={generalRows} />
          </CollapsibleSection>
          <CollapsibleSection
            itemKey="request"
            title="Request"
            initialEntered={sections.request}
            flush={flush}
          >
            <KeyValueTable
              section="request"
              rows={requestHeaderRows}
              linkHeaderNames
              emptyMessage="No headers"
            />
          </CollapsibleSection>
          <CollapsibleSection
            itemKey="response"
            title="Response"
            initialEntered={sections.response}
            flush={flush}
          >
            <KeyValueTable
              section="response"
              rows={responseHeaderRows}
              linkHeaderNames
              emptyMessage="No headers"
            />
          </CollapsibleSection>
          {includeLogs ? (
            <CollapsibleSection
              itemKey="logs"
              title="Logs"
              initialEntered={sections.logs}
              flush={flush}
            >
              <ScriptLogsView
                logs={logs}
                scriptError={scriptError}
                scriptErrors={scriptErrors}
                requestTabId={requestTabId}
              />
            </CollapsibleSection>
          ) : null}
        </ControlledAccordion>
      </div>
    </ConsoleSelectionHost>
  );
}
