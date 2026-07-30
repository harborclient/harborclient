import { Button } from '@harborclient/sdk/components';
import type { JSX } from 'react';

interface Props {
  /**
   * Display name of the saved live server.
   */
  serverName: string;

  /**
   * Running origin (e.g. `http://127.0.0.1:5500`), or null when stopped.
   */
  origin: string | null;

  /**
   * Whether there are log lines that can be cleared.
   */
  canClear: boolean;

  /**
   * Clears the visible log and the main-process buffer.
   */
  onClear: () => void;
}

/**
 * Header chrome for the live-server logs page (title, status, clear).
 *
 * @param props - Server identity, running origin, and clear action.
 * @returns Page header row.
 */
export function LiveServerLogsHeader({
  serverName,
  origin,
  canClear,
  onClear
}: Props): JSX.Element {
  const statusLabel = origin != null ? origin : 'Stopped';

  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-separator px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-[18px] font-semibold">Logs: {serverName}</h1>
        <p className="text-muted truncate" aria-live="polite">
          {statusLabel}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!canClear}
          onClick={onClear}
          aria-label="Clear live server logs"
        >
          Clear
        </Button>
      </div>
    </header>
  );
}
