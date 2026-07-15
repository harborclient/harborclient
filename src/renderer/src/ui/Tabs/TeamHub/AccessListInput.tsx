import { Input, FormGroup } from '@harborclient/sdk/components';
import { useRef, useState, type JSX, type ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import {
  applyAccessSuggestion,
  filterAccessListSuggestions,
  getCurrentAccessToken
} from '#/renderer/src/ui/Tabs/TeamHub/teamUserFormHelpers';

/**
 * One autocomplete suggestion for an access list field.
 */
export interface AccessListSuggestion {
  /**
   * Access id stored in the comma-separated value.
   */
  id: string;

  /**
   * Human-readable label shown in the dropdown.
   */
  label: string;
}

interface Props<TFieldValues extends FieldValues> {
  /**
   * react-hook-form control for the parent form.
   */
  control: Control<TFieldValues>;

  /**
   * Field name bound to the comma-separated access list text.
   */
  name: FieldPath<TFieldValues>;

  /**
   * Visible label for the input.
   */
  label: string;

  /**
   * Input placeholder text.
   */
  placeholder: string;

  /**
   * HTML id used by the label association.
   */
  inputId: string;

  /**
   * Resource options shown in the autocomplete dropdown.
   */
  suggestions: AccessListSuggestion[];

  /**
   * Whether the input and dropdown are disabled.
   */
  disabled?: boolean;

  /**
   * Optional helper text rendered below the input.
   */
  helperText?: ReactNode;
}

/**
 * Comma-separated access list input with resource autocomplete suggestions.
 */
export function AccessListInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  inputId,
  suggestions,
  disabled = false,
  helperText
}: Props<TFieldValues>): JSX.Element {
  const [focused, setFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clears a pending blur timeout when the component unmounts.
   */
  const clearBlurTimeout = (): void => {
    if (blurTimeoutRef.current != null) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const filteredSuggestions = filterAccessListSuggestions(
          suggestions,
          getCurrentAccessToken(field.value ?? '')
        );

        /**
         * Keeps focus long enough for dropdown option clicks to register.
         */
        const handleBlur = (): void => {
          clearBlurTimeout();
          blurTimeoutRef.current = setTimeout(() => {
            setFocused(false);
          }, 150);
        };

        /**
         * Inserts a suggestion into the comma-separated field value.
         *
         * @param suggestionId - Selected access id.
         */
        const handleSelectSuggestion = (suggestionId: string): void => {
          field.onChange(applyAccessSuggestion(field.value ?? '', suggestionId));
          setFocused(true);
        };

        const showDropdown = focused && !disabled && filteredSuggestions.length > 0;

        return (
          <div className="relative">
            <FormGroup label={label} htmlFor={inputId} description={helperText}>
              <Input
                id={inputId}
                type="text"
                variant="surface"
                placeholder={placeholder}
                disabled={disabled}
                value={field.value ?? ''}
                autoComplete="off"
                onChange={field.onChange}
                onBlur={() => {
                  field.onBlur();
                  handleBlur();
                }}
                onFocus={() => {
                  clearBlurTimeout();
                  setFocused(true);
                }}
              />
            </FormGroup>
            {showDropdown && (
              <ul
                className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-lg"
                role="listbox"
              >
                {filteredSuggestions.map((suggestion) => (
                  <li key={suggestion.id} role="option">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-[14px] text-text hover:bg-surface-hover"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectSuggestion(suggestion.id)}
                    >
                      <span className="font-medium">{suggestion.label}</span>
                      {suggestion.id !== suggestion.label && (
                        <span className="ml-2 text-muted">{suggestion.id}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    />
  );
}
