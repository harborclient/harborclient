import { StatusDot } from '@harborclient/sdk/components';
import { METHOD_CLASSES, statusDotVariant } from '#/renderer/src/ui/Shared/classes';
import type { JSX } from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { ConsoleDetails } from '#/renderer/src/ui/Shared/ConsoleDetails/ConsoleDetails';

interface Props {
  entry: ConsoleEntry;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * A single expandable console log entry.
 */
export function EntryRow({ entry, expanded, onToggle }: Props): JSX.Element {
  const { result } = entry;
  const method = result.request?.method ?? 'GET';
  const methodClass = METHOD_CLASSES[method.toLowerCase()] ?? METHOD_CLASSES.get;
  const url = result.request?.url ?? '—';
  const statusLabel = result.error ? 'Error' : `${result.status} ${result.statusText}`;

  return (
    <div className="border-b border-separator last:border-b-0">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-selection/60 app-no-drag"
        aria-expanded={expanded}
        aria-controls={`console-entry-${entry.id}-details`}
        onClick={onToggle}
      >
        <StatusDot variant={statusDotVariant(result.status)} />
        <span className={`shrink-0 px-1.5 py-0.5 text-[14px] uppercase ${methodClass}`}>
          {method}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-text">{url}</span>
        <span className="shrink-0 text-muted">{statusLabel}</span>
        <span className="shrink-0 text-muted">{result.timeMs} ms</span>
        <span className="shrink-0 text-muted">{formatBytes(result.sizeBytes)}</span>
        <span className="shrink-0 text-[14px] text-muted">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        {(entry.requestName || entry.collectionName) && (
          <span className="max-w-[120px] shrink-0 truncate text-[14px] text-muted">
            {entry.collectionName ? `${entry.collectionName} / ` : ''}
            {entry.requestName}
          </span>
        )}
        <span className="shrink-0 text-muted" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      <div
        id={`console-entry-${entry.id}-details`}
        hidden={!expanded}
        className="border-t border-separator bg-surface px-3 py-3"
      >
        <ConsoleDetails
          result={result}
          logs={entry.logs}
          tests={entry.tests}
          executionEvents={entry.executionEvents}
          scriptError={entry.scriptError}
        />
      </div>
    </div>
  );
}
