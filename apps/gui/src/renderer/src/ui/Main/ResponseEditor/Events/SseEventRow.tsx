import type { JSX, KeyboardEvent } from 'react';
import type { SseEvent } from '@harborclient/core/types';
import { TableCell } from '@harborclient/sdk/components';

interface Props {
  /**
   * Event shown in this table row.
   */
  event: SseEvent;

  /**
   * Whether this row is the selected detail target.
   */
  selected: boolean;

  /**
   * Called when the user activates the row.
   */
  onSelect: (event: SseEvent) => void;
}

/**
 * Formats an event timestamp for the events table.
 *
 * @param receivedAt - Epoch milliseconds when the event arrived.
 * @returns Locale time string.
 */
function formatEventTime(receivedAt: number): string {
  return new Date(receivedAt).toLocaleTimeString();
}

/**
 * Truncates event data for the table preview column.
 *
 * @param data - Full event data payload.
 * @returns Short preview string.
 */
function previewData(data: string): string {
  const singleLine = data.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 120) {
    return singleLine;
  }
  return `${singleLine.slice(0, 117)}…`;
}

/**
 * One selectable SSE event row in the Events table.
 *
 * @param props - Event, selection state, and select handler.
 * @returns Table row cells for seq, time, type, id, and data preview.
 */
export function SseEventRow({ event, selected, onSelect }: Props): JSX.Element {
  /**
   * Activates the row with Enter or Space for keyboard users.
   *
   * @param keyboardEvent - Keyboard event from the row.
   */
  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLTableRowElement>): void => {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault();
      onSelect(event);
    }
  };

  return (
    <tr
      className={`cursor-pointer ${selected ? 'bg-selection' : 'hover:bg-selection/60'}`}
      tabIndex={0}
      aria-selected={selected}
      onClick={() => onSelect(event)}
      onKeyDown={handleKeyDown}
    >
      <TableCell className="w-14 font-mono text-[14px] text-muted text-center">
        {event.seq}
      </TableCell>
      <TableCell className="w-28 whitespace-nowrap text-[14px] text-muted">
        {formatEventTime(event.receivedAt)}
      </TableCell>
      <TableCell className="w-28 font-mono text-[14px]">{event.type}</TableCell>
      <TableCell className="w-28 font-mono text-[14px] text-muted">{event.id ?? '—'}</TableCell>
      <TableCell className="font-mono text-[14px]">{previewData(event.data)}</TableCell>
    </tr>
  );
}
