import type { JSX } from 'react';
import type { ScriptExecutionEvent } from '#/shared/types';
import { StatusDot } from '@harborclient/sdk/components';

import {
  formatFlowExecutionDetail,
  formatFlowExecutionLabel,
  formatVariableExecutionDetail,
  formatVariableExecutionLabel
} from './executionEventLabels';

interface Props {
  /**
   * Ordered variable and flow-control activity captured while scripts ran.
   */
  executionEvents: readonly ScriptExecutionEvent[];
}

/**
 * Renders ordered variable and flow-control trace rows for a single send.
 */
export function TraceDetails({ executionEvents }: Props): JSX.Element {
  if (executionEvents.length === 0) {
    return <div className="px-2.5 py-2 text-center text-[14px] text-muted">No trace</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-separator">
      {executionEvents.map((event, index) => {
        const label =
          event.type === 'variable'
            ? formatVariableExecutionLabel(event)
            : formatFlowExecutionLabel(event);
        const detail =
          event.type === 'variable'
            ? formatVariableExecutionDetail(event)
            : formatFlowExecutionDetail(event);

        return (
          <div
            key={`${event.type}-${event.scriptName ?? 'script'}-${index}`}
            className={`flex items-center gap-2 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
          >
            <StatusDot
              variant={event.type === 'variable' ? 'accent' : 'warning'}
              label={event.type === 'variable' ? 'Variable change' : 'Flow change'}
            />
            {event.scriptName && (
              <>
                <span className="text-[14px] text-muted">{event.scriptName}</span>
                <span className="text-[14px] text-muted" aria-hidden="true">
                  -
                </span>
              </>
            )}
            <span className="text-[14px] text-text">{label}</span>
            {detail && (
              <>
                <span className="text-[14px] text-muted" aria-hidden="true">
                  -
                </span>
                <span className="min-w-0 truncate font-mono text-[14px] text-text">{detail}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
