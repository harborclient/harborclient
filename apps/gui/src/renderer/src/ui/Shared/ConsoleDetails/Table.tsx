import type { JSX } from 'react';
import type { ScriptConsoleTableData } from '@harborclient/core/types';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';

interface Props {
  /**
   * Structured console.table payload (stringified cells).
   */
  table: ScriptConsoleTableData;
}

/**
 * Renders a console.table payload as an accessible HTML table.
 */
export function Table({ table }: Props): JSX.Element {
  if (table.columns.length === 0 || table.rows.length === 0) {
    return (
      <pre className="m-0 min-w-0 flex-1 font-mono text-[14px] whitespace-pre-wrap break-words">
        (empty)
      </pre>
    );
  }

  return (
    <Scrollbars axis="horizontal" className="min-w-0 flex-1">
      <table className="w-max border-collapse border border-separator font-mono text-[14px]">
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border border-separator px-2 py-1 text-left font-semibold whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}-${row[0] ?? ''}`}>
              {table.columns.map((column, colIndex) => (
                <td
                  key={`${column}-${colIndex}`}
                  className="border border-separator px-2 py-1 align-top whitespace-nowrap"
                >
                  {row[colIndex] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Scrollbars>
  );
}
