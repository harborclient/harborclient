import type { LiveServerErrorPage } from '@harborclient/core/types';
import type { JSX } from 'react';
import { ErrorPageRow } from './ErrorPageRow';

interface Props {
  /**
   * Current error-page rows (may include a trailing incomplete draft row).
   */
  errorPages: LiveServerErrorPage[];

  /**
   * When true, disables edit/remove.
   */
  disabled?: boolean;

  /**
   * Document root used as the file-picker default when a row has no path yet.
   */
  root: string;

  /**
   * Called when the error-page list changes.
   *
   * @param next - Updated rows (including a trailing blank row when needed).
   */
  onChange: (next: LiveServerErrorPage[]) => void;
}

/**
 * Ensures the error-page list ends with one blank draft row for inline add.
 *
 * @param pages - Current rows from modal state.
 * @returns Rows with a trailing empty enabled row when the last code is filled.
 */
function withTrailingBlankRow(pages: LiveServerErrorPage[]): LiveServerErrorPage[] {
  const rows = pages.map((page) => ({
    code: page.code ?? '',
    path: page.path ?? '',
    enabled: page.enabled !== false
  }));
  const last = rows[rows.length - 1];
  if (last == null || last.code.trim() !== '') {
    rows.push({ code: '', path: '', enabled: true });
  }
  return rows;
}

/**
 * Editable key/value-style list of status-code → HTML file error pages.
 *
 * @param props - Rows, document root, disabled flag, and change handler.
 */
export function ErrorPageList({ errorPages, disabled, root, onChange }: Props): JSX.Element {
  const rows = withTrailingBlankRow(errorPages);

  /**
   * Updates one row and keeps a trailing blank row when the last code is filled.
   *
   * @param index - Row index.
   * @param next - Updated row values.
   */
  function handleRowChange(index: number, next: LiveServerErrorPage): void {
    const updated = rows.map((row, i) => (i === index ? next : row));
    onChange(withTrailingBlankRow(updated));
  }

  /**
   * Removes a row, always leaving at least one blank draft row.
   *
   * @param index - Row index to remove.
   */
  function handleRemove(index: number): void {
    if (rows.length <= 1) {
      onChange([{ code: '', path: '', enabled: true }]);
      return;
    }
    onChange(withTrailingBlankRow(rows.filter((_, i) => i !== index)));
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-muted">
            <th className="w-6 p-1">
              <span className="sr-only">Enable</span>
            </th>
            <th className="p-1 font-normal">Status code</th>
            <th className="p-1 font-normal">File path</th>
            <th className="w-7 p-1">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((page, index) => (
            <ErrorPageRow
              key={`error-page-${index}`}
              index={index}
              page={page}
              disabled={disabled}
              browseDefaultPath={root}
              onChange={(next) => handleRowChange(index, next)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
