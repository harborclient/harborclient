import type { JSX } from 'react';
import { LogSearchInput } from '#/renderer/src/ui/Shared/LogSearch/LogSearchInput';
import type { LogMatchOptions } from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';

interface Props {
  /**
   * Current filter query shown in the input.
   */
  value: string;

  /**
   * Called when the user edits the filter field.
   */
  onChange: (value: string) => void;

  /**
   * Match-case / whole-word / regex toggles.
   */
  options: LogMatchOptions;

  /**
   * Called when a match toggle changes.
   */
  onOptionsChange: (options: LogMatchOptions) => void;

  /**
   * When true, the filter query is an invalid regular expression.
   */
  invalidRegex: boolean;
}

/**
 * Filter row under the live-server logs header with in-input match toggles.
 *
 * @param props - Controlled value, options, and change handlers.
 * @returns Padded search input for filtering terminal lines.
 */
export function LiveServerLogSearch({
  value,
  onChange,
  options,
  onOptionsChange,
  invalidRegex
}: Props): JSX.Element {
  return (
    <div className="shrink-0 p-3">
      <LogSearchInput
        id="footer-live-server-logs-search"
        label="Filter live server logs"
        value={value}
        onChange={onChange}
        options={options}
        onOptionsChange={onOptionsChange}
        invalidRegex={invalidRegex}
      />
    </div>
  );
}
