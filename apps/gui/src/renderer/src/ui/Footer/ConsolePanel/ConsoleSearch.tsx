import { FormGroup, Input } from '@harborclient/sdk/components';
import type { ChangeEvent, JSX } from 'react';

interface Props {
  /**
   * Current search query.
   */
  value: string;

  /**
   * Called when the user edits the search field.
   */
  onChange: (value: string) => void;
}

/**
 * Compact console header search field that filters request log entries.
 */
export function ConsoleSearch({ value, onChange }: Props): JSX.Element {
  /**
   * Forwards the native input value to the parent filter state.
   *
   * @param event - Change event from the search input.
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };

  return (
    <FormGroup
      bordered={false}
      label="Search console entries"
      htmlFor="footer-console-search"
      srOnly
      className="min-w-0 font-normal"
    >
      <Input
        id="footer-console-search"
        type="search"
        placeholder="Search"
        value={value}
        className="w-100 py-0.5 text-[14px] leading-none font-normal"
        onChange={handleChange}
      />
    </FormGroup>
  );
}
