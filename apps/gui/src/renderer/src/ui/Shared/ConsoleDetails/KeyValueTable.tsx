import type { JSX } from 'react';
import { consoleCellDataAttrs } from '#/renderer/src/ui/Main/ResponseEditor/consoleSelection/captureConsoleSelection';
import { HeaderNameLink } from '#/renderer/src/ui/Main/ResponseEditor/HeaderNameLink';

export interface KeyValueRow {
  /**
   * Label shown in the left column.
   */
  label: string;

  /**
   * Value shown in the right column.
   */
  value: string;
}

interface Props {
  /**
   * Rows rendered as inspector-style label/value pairs.
   */
  rows: readonly KeyValueRow[];

  /**
   * Console pointer section id for Copy to chat (for example `general`).
   */
  section?: string;

  /**
   * When true, left-column labels render as MDN-linked header names
   * (Request/Response header tables).
   */
  linkHeaderNames?: boolean;

  /**
   * Message displayed when no rows are available.
   */
  emptyMessage?: string;
}

const rowClass =
  'grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 border-t border-separator first:border-t-0';

/**
 * Renders flat Chrome-style key/value rows for console inspector sections.
 */
export function KeyValueTable({
  rows,
  section,
  linkHeaderNames = false,
  emptyMessage = 'No values'
}: Props): JSX.Element {
  if (rows.length === 0) {
    return <div className="px-2.5 py-2 text-center text-[14px] text-muted">{emptyMessage}</div>;
  }

  return (
    <div>
      {rows.map(({ label, value }) => {
        const cellAttrs = section != null ? consoleCellDataAttrs(section, label) : null;
        return (
          <div className={rowClass} key={label}>
            {linkHeaderNames ? (
              <HeaderNameLink headerName={label} />
            ) : (
              <span className="break-words text-[14px] font-medium">{label}</span>
            )}
            <span
              className="break-words font-mono text-[14px] text-text-secondary"
              {...(cellAttrs ?? {})}
            >
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
