import { AutocompleteInput, FormGroup } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useUserAgentAutocompleteSource } from './useUserAgentAutocompleteSource';

interface Props {
  /**
   * Current User-Agent value; empty means inherit for scoped editors.
   */
  value: string;

  /**
   * Called when the user edits the User-Agent value.
   *
   * @param value - New User-Agent string.
   */
  onChange: (value: string) => void;

  /**
   * When true, shows an inherit placeholder and allows clearing the field.
   */
  allowEmpty?: boolean;

  /**
   * Disables the control while a save is in flight.
   */
  disabled?: boolean;

  /**
   * Optional id forwarded to the combobox input for label association.
   */
  id?: string;

  /**
   * Optional description shown under the label.
   */
  description?: string;
}

/**
 * Creatable User-Agent control backed by built-in presets plus custom entries.
 *
 * Choosing or typing a value not already in the list appends it to general
 * settings so every User-Agent control shares the same growing dataset.
 *
 * @param props - Controlled value, change handler, and optional inherit mode.
 * @returns Labeled autocomplete field for User-Agent selection.
 */
export function UserAgentField({
  value,
  onChange,
  allowEmpty = false,
  disabled = false,
  id = 'user-agent-field',
  description
}: Props): JSX.Element {
  const source = useUserAgentAutocompleteSource();

  return (
    <FormGroup
      label="User-Agent"
      htmlFor={id}
      description={
        description ??
        (allowEmpty
          ? 'Leave empty to inherit from the parent scope or global default. A key/value User-Agent header overrides this field.'
          : 'Default User-Agent for outbound HTTP when no collection, folder, or request override is set. A key/value User-Agent header overrides this field.')
      }
    >
      <AutocompleteInput
        id={id}
        value={value}
        disabled={disabled}
        source={source}
        placeholder={allowEmpty ? 'Inherit (use parent or global default)' : undefined}
        onChange={onChange}
        aria-label="User-Agent"
      />
    </FormGroup>
  );
}
