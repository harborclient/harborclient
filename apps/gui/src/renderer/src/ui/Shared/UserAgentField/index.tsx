import { AutocompleteInput, FormGroup } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useState } from 'react';
import { normalizeUserAgent } from '@harborclient/core/userAgent';

import { useInheritedUserAgent } from './useInheritedUserAgent';
import { useUserAgentAutocompleteSource } from './useUserAgentAutocompleteSource';

interface Props {
  /**
   * Current User-Agent override; empty means inherit for scoped editors.
   */
  value: string;

  /**
   * Called when the user edits the User-Agent value.
   *
   * @param value - New User-Agent string; empty restores inheritance when allowEmpty.
   */
  onChange: (value: string) => void;

  /**
   * When true, empty values inherit from parent scopes. While blurred, the input
   * shows the resolved inherited User-Agent; while focused, the field can be
   * cleared so the autocomplete dropdown is usable.
   */
  allowEmpty?: boolean;

  /**
   * Collection id used to resolve inheritance for folder/request editors.
   */
  collectionId?: number | null;

  /**
   * Folder id used to resolve inheritance for request editors.
   */
  folderId?: number | null;

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
 * When {@link allowEmpty} is set, an empty stored value still means inherit.
 * The inherited User-Agent is shown only while the field is blurred so the user
 * can clear the input, open the dropdown, and type a different override.
 *
 * @param props - Controlled value, change handler, and optional inherit mode.
 * @returns Labeled autocomplete field for User-Agent selection.
 */
export function UserAgentField({
  value,
  onChange,
  allowEmpty = false,
  collectionId,
  folderId,
  disabled = false,
  id = 'user-agent-field',
  description
}: Props): JSX.Element {
  const source = useUserAgentAutocompleteSource();
  const inheritedValue = useInheritedUserAgent(allowEmpty ? { collectionId, folderId } : undefined);
  const [focused, setFocused] = useState(false);
  /**
   * While focused, show the stored override (including empty) so the user can
   * clear and use the dropdown. While blurred with an empty override, show the
   * inherited User-Agent as the visible value.
   */
  const displayValue = !allowEmpty
    ? value
    : focused
      ? value
      : normalizeUserAgent(value) || inheritedValue;

  /**
   * Persists overrides, collapsing clears and inherited matches back to empty.
   *
   * @param next - Value typed or selected in the autocomplete control.
   */
  const handleChange = (next: string): void => {
    if (!allowEmpty) {
      onChange(next);
      return;
    }
    const trimmed = normalizeUserAgent(next);
    if (!trimmed || trimmed === normalizeUserAgent(inheritedValue)) {
      onChange('');
      return;
    }
    onChange(next);
  };

  /**
   * Tracks focus so an empty inherit can show a blank editable input.
   */
  const handleFocus = (): void => {
    setFocused(true);
  };

  /**
   * Restores the inherited display when an empty field loses focus.
   */
  const handleBlur = (): void => {
    setFocused(false);
  };

  return (
    <FormGroup
      label="User-Agent"
      htmlFor={id}
      description={
        description ??
        (allowEmpty
          ? 'Clear this field to inherit from the parent scope or global default. A key/value User-Agent header overrides this field.'
          : 'Default User-Agent for outbound HTTP when no collection, folder, or request override is set. A key/value User-Agent header overrides this field.')
      }
    >
      <AutocompleteInput
        id={id}
        value={displayValue}
        disabled={disabled}
        source={source}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="User-Agent"
      />
    </FormGroup>
  );
}
