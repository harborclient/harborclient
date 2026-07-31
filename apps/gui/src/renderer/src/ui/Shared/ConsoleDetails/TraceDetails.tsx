import type { JSX } from 'react';
import type { ScriptExecutionEvent } from '@harborclient/core/types';
import {
  StatusDot,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader
} from '@harborclient/sdk/components';

import {
  formatExecutionEventKey,
  formatExecutionEventValue,
  formatFlowExecutionLabel,
  formatVariableExecutionLabel
} from './executionEventLabels';

interface Props {
  /**
   * Ordered variable and flow-control activity captured while scripts ran.
   */
  executionEvents: readonly ScriptExecutionEvent[];
}

/**
 * Renders ordered variable and flow-control trace rows as a bordered table.
 */
export function TraceDetails({ executionEvents }: Props): JSX.Element {
  if (executionEvents.length === 0) {
    return <div className="px-2.5 py-2 text-center text-[14px] text-muted">No trace</div>;
  }

  return (
    <Table aria-label="Script execution trace">
      <TableHeader>
        <tr>
          <TableHead>Source</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {executionEvents.map((event, index) => {
          const label =
            event.type === 'variable'
              ? formatVariableExecutionLabel(event)
              : formatFlowExecutionLabel(event);
          const key = formatExecutionEventKey(event);
          const value = formatExecutionEventValue(event);

          return (
            <tr key={`${event.type}-${event.scriptName ?? 'script'}-${index}`}>
              <TableCell className="whitespace-nowrap align-top">
                <div className="flex items-center gap-2">
                  <StatusDot
                    variant={event.type === 'variable' ? 'accent' : 'warning'}
                    label={event.type === 'variable' ? 'Variable change' : 'Flow change'}
                  />
                  <span className="text-muted">{event.scriptName ?? '—'}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap align-top">{label}</TableCell>
              <TableCell className="whitespace-nowrap align-top font-mono">
                {key ?? (
                  <span className="text-muted" aria-hidden="true">
                    —
                  </span>
                )}
              </TableCell>
              <TableCell className="break-all align-top font-mono">
                {value ?? (
                  <span className="text-muted" aria-hidden="true">
                    —
                  </span>
                )}
              </TableCell>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
