import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faCircleCheck, faCircleExclamation, faSpinner } from '#/renderer/src/fontawesome';
import type { AiChatToolRow } from '#/renderer/src/store/slices/aiChatSlice';
import { toolRowOwnerLabel, toolRowStatusLabel } from './toolRowPresentation';

interface Props {
  /**
   * Normalized tool progress row from active turn state.
   */
  row: AiChatToolRow;
}

/**
 * Compact tool progress row for an in-flight AI turn.
 *
 * Shows tool name, owning runtime, and running/done/error status without raw payloads.
 */
export function ActiveTurnToolRow({ row }: Props): JSX.Element {
  const statusLabel = toolRowStatusLabel(row.status);
  const ownerLabel = toolRowOwnerLabel(row.owner);

  return (
    <li className="flex items-center gap-2 rounded-md border border-separator bg-control px-2 py-1.5 text-[14px]">
      <span className="shrink-0 text-muted" aria-hidden="true">
        {row.status === 'running' ? (
          <FaIcon
            icon={faSpinner}
            className="h-3.5 w-3.5 motion-reduce:animate-none animate-spin"
          />
        ) : row.status === 'done' ? (
          <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 text-success" />
        ) : (
          <FaIcon icon={faCircleExclamation} className="h-3.5 w-3.5 text-danger" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-text">{row.name}</span>
      <span className="shrink-0 text-muted">{ownerLabel}</span>
      <span className="shrink-0 text-muted">{statusLabel}</span>
    </li>
  );
}
