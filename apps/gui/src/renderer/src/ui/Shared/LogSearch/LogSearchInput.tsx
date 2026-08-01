import { FormGroup, Input } from '@harborclient/sdk/components';
import type { ChangeEvent, JSX, KeyboardEvent } from 'react';
import { LogSearchToggles } from './LogSearchToggles';
import type { LogMatchOptions } from './logMatchOptions';

interface Props {
  /**
   * Native input id (also used as FormGroup `htmlFor`).
   */
  id: string;

  /**
   * Screen-reader label for the filter field.
   */
  label: string;

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

  /**
   * Placeholder text for the search input.
   */
  placeholder?: string;

  /**
   * Optional key handler on the underlying input (Enter / arrows for find next/prev).
   */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Shared log filter input with in-field match toggles (case, whole word, regex).
 *
 * @param props - Controlled value, options, labels, and change handlers.
 * @returns Accessible search field with trailing toggle buttons.
 */
export function LogSearchInput({
  id,
  label,
  value,
  onChange,
  options,
  onOptionsChange,
  invalidRegex,
  placeholder = 'Filter logs',
  onKeyDown
}: Props): JSX.Element {
  /**
   * Forwards the native input value to the parent filter state.
   *
   * @param event - Change event from the search input.
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  return (
    <FormGroup bordered={false} label={label} htmlFor={id} srOnly className="min-w-0 font-normal">
      <div className="relative">
        <Input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          aria-invalid={invalidRegex || undefined}
          className="w-full pr-24 font-normal [&::-webkit-search-cancel-button]:hidden"
          onChange={handleChange}
          onKeyDown={onKeyDown}
        />
        <LogSearchToggles options={options} onChange={onOptionsChange} />
      </div>
    </FormGroup>
  );
}
